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
  // 1. Desofuscamos Packer
  let cleanHtml = unPack(html);
  
  // 2. Decodificamos secuencias Hexadecimales (\x68\x74\x74\x70...)
  cleanHtml = cleanHtml.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // 3. Limpiamos escapes de JSON
  cleanHtml = cleanHtml.replace(/\\\/|\\/g, '/');

  const patterns = [
    // Buscador de dominios críticos y extensiones
    /(https?:\/\/[^"'\s<>|]+(?:vmwesa\.online|moly\.io|vidmoly\.me\/hls|master\.m3u8)[^"'\s<>|]+)/gi,
    // Buscador de fuentes en JSON
    /["']?(?:file|src|url)["']?\s*[:=]\s*["']?((?:https?:)?\/\/[^"']+\.(?:m3u8|mp4|urlset))["']?/gi,
    // Buscador "ciego" de links m3u8
    /https?:\/\/[^"'\s<>|]+\.m3u8(?:[^"'\s<>|]*)?/gi
  ];

  for (const p of patterns) {
    const matches = cleanHtml.matchAll(p);
    for (const match of matches) {
      const url = match[1] || match[0];
      if (url && url.includes('http') && !url.includes('staticmoly') && !url.includes('hotjar')) {
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
    const idMatch = videoUrl.match(/\/(?:v|e|embed-|embed\/|dl\/|lite-)?([a-zA-Z0-9]{8,15})/);
    if (idMatch) id = idMatch[1];
    
    let html = '';
    let statusLog = '';
    const fbUA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

    if (id) {
      // 1. INTENTO DIRECTO AL EMBED CON DISFRAZ DE FACEBOOK (VIP ACCESS)
      const embedUrl = `https://vidmoly.me/e/${id}`;
      try {
        const res = await fetch(embedUrl, { headers: { 'User-Agent': fbUA, 'Referer': 'https://www.facebook.com/' } });
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 500 && !text.includes('Security Check')) {
            html = text;
            statusLog = 'Exito vía Embed (Facebook UA)';
          }
        }
      } catch (e) {}

      // 2. FALLBACK A LA LANDING PAGE CON FACEBOOK UA
      if (!html) {
        const landingUrl = `https://vidmoly.me/v/${id}`;
        try {
          const res = await fetch(landingUrl, { headers: { 'User-Agent': fbUA } });
          if (res.ok) {
            html = await res.text();
            statusLog = 'Exito vía Landing (Facebook UA)';
          }
        } catch (e) {}
      }
    }

    if (!html || html.includes('Security Check')) {
      return NextResponse.json({ error: 'Bloqueo de Vidmoly total.', debug: { id } }, { status: 403 });
    }

    let videos = await processHtml(html);

    // Búsqueda profunda en strings largos (posibles codificaciones)
    if (videos.length === 0) {
      const b64Matches = html.match(/[A-Za-z0-9+/]{50,}/g) || [];
      for (const b64 of b64Matches) {
        try {
          const decoded = atob(b64);
          if (decoded.includes('http')) {
            const more = await processHtml(decoded);
            videos = [...videos, ...more];
          }
        } catch (e) {}
      }
    }

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'Estamos dentro, pero el link no aparece en el HTML.', 
        debug: { id, log: statusLog, html_size: html.length, snippet: html.substring(0, 500) } 
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
