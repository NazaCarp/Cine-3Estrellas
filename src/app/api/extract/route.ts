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
  // Limpieza agresiva de caracteres de escape
  const cleanHtml = unPack(html).replace(/\\\/|\\/g, '/');

  const patterns = [
    // 1. Buscador de dominios de video (vmwesa, moly.io)
    /(https?:\/\/[^"'\s<>|]+(?:vmwesa\.online|moly\.io|vidmoly\.me\/hls)[^"'\s<>|]+)/gi,
    // 2. Buscador de archivos de video directos
    /https?:\/\/[^"'\s<>|]+\.(?:m3u8|mp4|urlset)(?:[^"'\s<>|]*)?/gi,
    // 3. Buscador de objetos JSON que contienen enlaces
    /\{(?:[^{}]*["'](?:file|url|src)["']\s*:\s*["'](https?:\/\/[^"']+)["'][^{}]*)\}/gi
  ];

  for (const p of patterns) {
    const matches = cleanHtml.matchAll(p);
    for (const match of matches) {
      const url = match[1] || match[0];
      if (url && url.includes('http') && !url.includes('staticmoly')) {
        const isMaster = url.includes('master.m3u8') || url.includes('.urlset');
        videos.push({ name: isMaster ? 'Vidmoly HD' : 'Video', url });
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

    if (id) {
      // ATACAMOS LA PÁGINA DE INFO (/v/) QUE NO TIENE BLOQUEO
      const landingUrl = `https://vidmoly.me/v/${id}`;
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(landingUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.contents) {
            html = data.contents;
            statusLog = 'Exito vía AllOrigins (Landing)';
          }
        }
      } catch (e) {}

      if (!html) {
        try {
          const res = await fetch(landingUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } });
          if (res.ok) {
            html = await res.text();
            statusLog = 'Exito vía Directo (Landing)';
          }
        } catch (e) {}
      }
    }

    if (!html || html.includes('Security Check')) {
      return NextResponse.json({ error: 'No se pudo acceder a Vidmoly.', debug: { id } }, { status: 403 });
    }

    // Análisis forense de la página
    let videos = await processHtml(html);

    // Si no hay videos, buscamos CUALQUIER Base64 y lo decodificamos
    if (videos.length === 0) {
      const b64Candidate = html.match(/[A-Za-z0-9+/]{100,}/g) || [];
      for (const b64 of b64Candidate) {
        try {
          const decoded = atob(b64);
          if (decoded.includes('http') && (decoded.includes('m3u8') || decoded.includes('vmwesa'))) {
            const more = await processHtml(decoded);
            videos = [...videos, ...more];
          }
        } catch (e) {}
      }
    }

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'Página cargada, pero el video está encriptado.', 
        debug: { id, log: statusLog, html_size: html.length } 
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
