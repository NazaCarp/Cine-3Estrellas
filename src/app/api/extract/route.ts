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

  const patterns = [
    // 1. Buscador de fuentes en JSON o variables JS
    /(?:file|src|url|sources?)["']?\s*[:=]\s*["']?((?:https?:)?\/\/[^"']+\.(?:m3u8|mp4|urlset|mkv)[^"']*)["']?/gi,
    // 2. Buscador de dominios de video de Vidmoly
    /(https?:\/\/[^"'\s<>|]+(?:vmwesa\.online|moly\.io|vidmoly\.me\/hls)[^"'\s<>|]+)/gi,
    // 3. Cualquier link m3u8
    /https?:\/\/[^"'\s<>|]+\.m3u8(?:[^"'\s<>|]*)?/gi
  ];

  for (const p of patterns) {
    const matches = cleanHtml.matchAll(p);
    for (const match of matches) {
      const url = (match[1] || match[0]).replace(/\\/g, '');
      if (url.includes('http') && !url.includes('staticmoly')) {
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
      // PROBAMOS CON VARIOS PROXIES Y DOMINIOS
      const targets = [
        `https://vidmoly.to/e/${id}`,
        `https://vidmoly.me/e/${id}`,
        `https://vidmoly.org/e/${id}`
      ];

      for (const target of targets) {
        try {
          // Intentamos con Codetabs Proxy (Muy efectivo)
          const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`;
          const res = await fetch(proxyUrl);
          if (res.ok) {
            const text = await res.text();
            if (text && text.length > 1000 && !text.includes('Security Check')) {
              html = text;
              statusLog = `Exito vía Codetabs (${target})`;
              break;
            }
          }
        } catch (e) {}

        if (!html) {
           // Fallback a AllOrigins Raw
           try {
             const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`);
             if (res.ok) {
               const text = await res.text();
               if (text && text.length > 1000 && !text.includes('Security Check')) {
                 html = text;
                 statusLog = `Exito vía AllOrigins (${target})`;
                 break;
               }
             }
           } catch (e) {}
        }
      }
    }

    if (!html) {
      return NextResponse.json({ error: 'Todos los proxies han sido bloqueados por Vidmoly.', debug: { id } }, { status: 403 });
    }

    let videos = await processHtml(html);

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'Estamos dentro, pero el link del video no se encuentra en el HTML.', 
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
