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
  const cleanHtml = unPack(html).replace(/\\\/|\\/g, '/');

  const patterns = [
    // 1. Buscador de dominios específicos (vmwesa, moly.io)
    /(https?:\/\/[^"'\s<>|]+(?:vmwesa\.online|moly\.io|vidmoly\.me\/hls)[^"'\s<>|]+)/gi,
    // 2. Buscador de links de video directos
    /https?:\/\/[^"'\s<>|]+\.(?:m3u8|mp4|urlset)(?:[^"'\s<>|]*)?/gi,
    // 3. Buscador de fuentes en variables de ofuscación (_0x...)
    /["'](https?:\/\/[^"']+)["']/gi
  ];

  for (const p of patterns) {
    const matches = cleanHtml.matchAll(p);
    for (const match of matches) {
      const url = match[1] || match[0];
      if (url && url.includes('http') && (url.includes('m3u8') || url.includes('vmwesa'))) {
        if (!url.includes('staticmoly') && !url.includes('hotjar')) {
          const isMaster = url.includes('master.m3u8') || url.includes('.urlset');
          videos.push({ name: isMaster ? 'Vidmoly HD' : 'Video', url });
        }
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

    if (id) {
      // 1. INTENTO VÍA VERSIÓN LITE (Menos protección, link más directo)
      const liteUrl = `https://vidmoly.me/lite-${id}.html`;
      try {
        const res = await fetch(liteUrl, { 
          headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' } 
        });
        if (res.ok) {
          html = await res.text();
          if (html.length > 500 && !html.includes('Security Check')) statusLog = 'Exito vía Lite-Version';
        }
      } catch (e) {}

      // 2. FALLBACK A LA LANDING PAGE CON FACEBOOK UA
      if (!html || html.includes('Security Check')) {
        const landingUrl = `https://vidmoly.me/v/${id}`;
        try {
          const res = await fetch(landingUrl, { 
            headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' } 
          });
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

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'Estamos dentro, pero el video está muy bien escondido.', 
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
