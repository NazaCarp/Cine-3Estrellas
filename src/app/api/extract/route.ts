import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Decodificador de Packer (p,a,c,k,e,d)
function unPack(code: string): string {
  try {
    if (!code.includes('eval(function(p,a,c,k,e,d)')) return code;
    const p = /eval\(function\(p,a,c,k,e,d\)\{.*return p\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)\)\)/;
    const match = code.match(p);
    if (!match) return code;
    let [_, payload, aStr, cStr, keyStr] = match;
    let a = parseInt(aStr), c = parseInt(cStr), k = keyStr.split('|');
    let e = (c: number): string => (c < a ? '' : e(Math.floor(c / a))) + String.fromCharCode((c % a) + (c % a > 35 ? 29 : 39));
    while (c--) { if (k[c]) payload = payload.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]); }
    return payload;
  } catch (e) { return code; }
}

async function processHtml(html: string) {
  let videos: any[] = [];
  const cleanHtml = unPack(html);

  // Patrones de búsqueda de última generación
  const patterns = [
    // 1. Buscador de dominios específicos de Vidmoly (vmwesa, moly.io, etc)
    /(https?:\/\/[^"'\s<>|]+(?:vmwesa\.online|moly\.io|vidmoly\.me\/hls)[^"'\s<>|]+)/gi,
    // 2. Buscador de objetos JSON con info de video
    /\{(?:[^{}]*["']file["']\s*:\s*["'](https?:\/\/[^"']+)["'][^{}]*)\}/gi,
    // 3. Buscador de links de video estándar
    /https?:\/\/[^"'\s<>|]+\.(?:m3u8|mp4|urlset)(?:[^"'\s<>|]*)?/gi
  ];

  for (const p of patterns) {
    const matches = cleanHtml.matchAll(p);
    for (const match of matches) {
      const url = match[1] || match[0];
      if (url && url.includes('http') && !url.includes('staticmoly') && !url.includes('hotjar')) {
        const isMaster = url.includes('master.m3u8') || url.includes('.urlset');
        // Limpiamos la URL de posibles caracteres de escape de JSON
        const cleanUrl = url.replace(/\\/g, '');
        videos.push({ name: isMaster ? 'Vidmoly HD' : 'Video', url: cleanUrl });
      }
    }
  }
  return videos;
}

export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get('url');
  if (!videoUrl) return NextResponse.json({ error: 'URL faltante' }, { status: 400 });

  try {
    let id = '';
    const idMatch = videoUrl.match(/\/(?:v|e|embed-|embed\/|dl\/)?([a-zA-Z0-9]{8,15})/);
    if (idMatch) id = idMatch[1];
    
    let html = '';
    let statusLog = '';

    if (id && videoUrl.includes('vidmoly')) {
      const landingUrl = `https://vidmoly.me/v/${id}`;
      
      // 1. INTENTO LANDING CON IDENTIDAD IPHONE (Vidmoly a veces entrega el m3u8 directo a móviles)
      try {
        const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
        const res = await fetch(landingUrl, { headers: { 'User-Agent': iphoneUA } });
        if (res.ok) {
          html = await res.text();
          statusLog = 'Exito vía Landing Page (iPhone UA)';
        }
      } catch (e) {}

      // 2. FALLBACK VÍA PROXY SI EL DIRECTO NO DA RESULTADOS
      if (!html) {
        try {
          const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(landingUrl)}`);
          if (res.ok) {
            const data = await res.json();
            html = data.contents;
            statusLog = 'Exito vía AllOrigins Proxy';
          }
        } catch (e) {}
      }
    }

    if (!html || html.includes('Security Check')) {
      return NextResponse.json({ error: 'Bloqueo de Cloudflare persistente.', debug: { id } }, { status: 403 });
    }

    let videos = await processHtml(html);

    // Búsqueda profunda en bloques de datos
    if (videos.length === 0) {
      // Intentamos buscar cualquier string largo que pueda ser una URL codificada
      const anyUrlMatch = html.match(/https?%3A%2F%2F[^"'\s<>|]+/gi);
      if (anyUrlMatch) {
        for (const encoded of anyUrlMatch) {
          const decoded = decodeURIComponent(encoded);
          if (decoded.includes('m3u8') || decoded.includes('mp4')) {
            videos.push({ name: 'Video Detectado', url: decoded });
          }
        }
      }
    }

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'Estamos dentro, pero el link está encriptado o no presente.', 
        debug: { id, log: statusLog, html_size: html.length, snippet: html.substring(0, 300) } 
      }, { status: 404 });
    }

    const proxyBase = process.env.NEXT_PUBLIC_VIDEO_PROXY_URL;
    const qualities = videos.map((v: any) => ({
      name: v.name,
      url: `${proxyBase}${proxyBase?.includes('?') ? '&' : '?'}url=${encodeURIComponent(v.url)}`
    })).reverse();

    const uniqueQualities = Array.from(new Map(qualities.map(q => [q.url, q])).values());

    return NextResponse.json({ qualities: uniqueQualities });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
