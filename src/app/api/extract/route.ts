import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Decodificador de Packer (p,a,c,k,e,d) mejorado
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

  // Patrones de búsqueda ultra-agresivos (JWPlayer, Base64, Master M3U8, HLS1, HLS2)
  const patterns = [
    /file\s*:\s*["'](https?:\/\/[^"']+\.(m3u8|mp4|urlset)[^"']*)["']/i,
    /sources:\s*["']([A-Za-z0-9+/=]{20,})["']/,
    /["']?file["']?\s*:\s*["'](https?:\/\/[^"']+)["']/i,
    /https?:\/\/[^"'\s<>|]+\.(m3u8|mp4|urlset)(?:[^"'\s<>|]*)?/gi
  ];

  for (const p of patterns) {
    const match = cleanHtml.match(p);
    if (match) {
      if (p.source.includes('sources') && !p.global) {
        try {
          const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
          const sources = JSON.parse(decoded);
          if (Array.isArray(sources)) sources.forEach((s: any) => { if (s.file) videos.push({ name: s.label || 'Video', url: s.file }); });
        } catch (e) { }
      } else {
        const links = p.global ? (match as string[]) : [match[1]];
        links.forEach((link: string) => {
          if (link && link.includes('http') && !link.includes('staticmoly') && !link.includes('hotjar') && !link.includes('analytics')) {
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
    let id = '';
    const idMatch = videoUrl.match(/\/(?:v|e|embed-|embed\/)?([a-zA-Z0-9]{8,15})/);
    if (idMatch) id = idMatch[1];
    
    let html = '';
    let statusLog = '';

    // --- ESTRATEGIA DE BYPASS NINJA (Google Translate Proxy) ---
    if (videoUrl.includes('vidmoly.')) {
      try {
        const target = `https://vidmoly.me/e/${id}`;
        // Google Translate actúa como un proxy de alta autoridad que Vidmoly no bloquea
        const googleProxy = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(target)}`;
        console.log('Intentando Vidmoly vía Túnel Google:', target);
        
        const res = await fetch(googleProxy, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' }
        });
        
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes('vidmoly')) {
            html = text;
            statusLog = 'Exito vía Google Tunnel';
          }
        }
      } catch (e) {}

      // Fallback 1: AllOrigins Raw
      if (!html) {
        try {
          const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://vidmoly.me/e/${id}`)}`);
          if (res.ok) {
            const text = await res.text();
            if (text && !text.includes('Security Check')) {
              html = text;
              statusLog = 'Exito vía AllOrigins Raw';
            }
          }
        } catch (e) {}
      }
    }

    if (!html) {
      return NextResponse.json({ error: 'No se pudo saltar el bloqueo de Vidmoly.', debug: { id, status: 'Bloqueado por Cloudflare' } }, { status: 403 });
    }

    const videos = await processHtml(html);

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'No se encontraron videos en el código recibido.', 
        debug: { id, log: statusLog, html: html.substring(0, 800) } 
      }, { status: 404 });
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
