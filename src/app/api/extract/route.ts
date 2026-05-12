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

  // Patrones de búsqueda (JWPlayer, Base64, Master M3U8)
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
          if (link.includes('http') && !link.includes('staticmoly')) {
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
    // Normalizamos a la Landing Page (/v/) porque es la que NO tiene bloqueo
    let id = '';
    const idMatch = videoUrl.match(/\/(?:v|e|embed-)?([a-zA-Z0-9]{8,15})/);
    if (idMatch) id = idMatch[1];
    
    const landingUrl = id ? `https://vidmoly.me/v/${id}` : videoUrl.replace('.biz', '.me');
    let html = '';

    // 1. INTENTO VÍA ALLORIGINS A LA LANDING PAGE
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(landingUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.contents && !data.contents.includes('Security Check')) html = data.contents;
      }
    } catch (e) {}

    // 2. FALLBACK A FETCH DIRECTO CON IDENTIDAD WHATSAPP
    if (!html) {
      const res = await fetch(landingUrl, { headers: { 'User-Agent': 'WhatsApp/2.21.12.21 A' } });
      if (res.ok) {
        const text = await res.text();
        if (!text.includes('Security Check')) html = text;
      }
    }

    if (!html) return NextResponse.json({ error: 'Bloqueo de seguridad persistente.', debug: { url: landingUrl } }, { status: 403 });

    // 3. PROCESAR EL EMBED SI ESTAMOS EN LA LANDING
    let videos = await processHtml(html);
    if (videos.length === 0 && (html.includes('embed_url') || html.includes('embed-'))) {
      const embedMatch = html.match(/["\\]+embed_url["\\]+\s*:\s*["\\]+(https?:\/\/[^"\\]+)["\\]+/i) ||
                         html.match(/["'](https?:\/\/[^"']+\/embed-[^"']+)["']/i);
      
      if (embedMatch) {
        const embedUrl = embedMatch[1].replace(/\\/g, '');
        console.log('Siguiendo embed vía puente AllOrigins:', embedUrl);
        
        try {
          const embedProxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(embedUrl)}`;
          const res = await fetch(embedProxyUrl);
          if (res.ok) {
            const data = await res.json();
            const embedHtml = data.contents;
            if (embedHtml) {
              videos = await processHtml(embedHtml);
            }
          }
        } catch (e) {
          console.error('Fallo AllOrigins en el embed:', e);
        }
      }
    }

    if (videos.length === 0) return NextResponse.json({ error: 'No se encontraron videos.', debug: { url: landingUrl, html: html.substring(0, 500) } }, { status: 404 });

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
