import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Decodificador de Packer (p,a,c,k,e,d)
function unPack(code: string): string {
  try {
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

  // Patrones de búsqueda ultra-agresivos
  const patterns = [
    /file\s*:\s*["'](https?:\/\/[^"']+\.(m3u8|mp4|urlset)[^"']*)["']/i,
    /sources:\s*["']([A-Za-z0-9+/=]{20,})["']/,
    /https?:\/\/[^"'\s<>|]+\.(m3u8|mp4|urlset)(?:[^"'\s<>|]*)?/gi
  ];

  for (const p of patterns) {
    const match = cleanHtml.match(p);
    if (match) {
      if (p.source.includes('sources')) {
        try {
          const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
          const sources = JSON.parse(decoded);
          if (Array.isArray(sources)) sources.forEach((s: any) => { if (s.file) videos.push({ name: s.label || 'Video', url: s.file }); });
        } catch (e) { }
      } else {
        const links = p.global ? match : [match[1]];
        // @ts-ignore
        links.forEach((link: string) => {
          if (link.includes('http') && !link.includes('staticmoly') && !link.includes('hotjar')) {
            const isMaster = link.includes('master.m3u8') || link.includes('.urlset');
            videos.push({ name: isMaster ? 'Vidmoly HD' : 'Video', url: link });
          }
        });
      }
    }
  }
  return videos;
}

export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get('url');
  if (!videoUrl) return NextResponse.json({ error: 'URL faltante' }, { status: 400 });

  try {
    // 1. EXTRAER EL ID DEL VIDEO
    let id = '';
    const idMatch = videoUrl.match(/\/(?:v|e|embed-|embed\/)?([a-zA-Z0-9]{8,15})/);
    if (idMatch) id = idMatch[1];
    if (!id && videoUrl.includes('vidmoly')) {
       // Intento de emergencia por split
       id = videoUrl.split('/').pop()?.split('.')[0] || '';
    }

    let videos: any[] = [];
    let debugInfo: any = { id_detectado: id };

    // 2. INTENTO DIRECTO AL REPRODUCTOR VÍA PROXY (AllOrigins)
    if (id) {
      const directEmbedUrl = `https://vidmoly.me/e/${id}`;
      console.log('Acceso directo al reproductor:', directEmbedUrl);
      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(directEmbedUrl)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.contents && !data.contents.includes('Security Check')) {
            videos = await processHtml(data.contents);
          } else {
             debugInfo.proxy_status = 'Bloqueo detectado en Proxy';
          }
        }
      } catch (e) { debugInfo.proxy_error = e.message; }
    }

    // 3. FALLBACK A LA LANDING PAGE SI EL DIRECTO FALLA
    if (videos.length === 0 && id) {
      const landingUrl = `https://vidmoly.me/v/${id}`;
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(landingUrl)}`);
        if (res.ok) {
          const data = await res.json();
          const html = data.contents;
          // Si aquí encontramos el m3u8 directamente (raro pero posible)
          videos = await processHtml(html);
          
          // O si encontramos el embed_url real
          if (videos.length === 0 && html.includes('embed_url')) {
             const embedMatch = html.match(/embed_url["\\]+:\s*["\\]+(https?:\/\/[^"\\]+)/i);
             if (embedMatch) {
                const realEmbed = embedMatch[1].replace(/\\/g, '');
                const res2 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(realEmbed)}`);
                if (res2.ok) {
                   const data2 = await res2.json();
                   videos = await processHtml(data2.contents);
                }
             }
          }
        }
      } catch (e) {}
    }

    if (videos.length === 0) {
      return NextResponse.json({ error: 'No se encontraron videos.', debug: debugInfo }, { status: 404 });
    }

    const proxyBase = process.env.NEXT_PUBLIC_VIDEO_PROXY_URL;
    const qualities = videos.map((v: any) => ({
      name: v.name,
      url: `${proxyBase}${proxyBase?.includes('?') ? '&' : '?'}url=${encodeURIComponent(v.url)}`
    })).reverse();

    return NextResponse.json({ qualities });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
