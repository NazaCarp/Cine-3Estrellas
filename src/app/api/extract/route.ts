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

  // Buscamos links directos o estructuras JSON de fuentes
  const patterns = [
    /file\s*:\s*["'](https?:\/\/[^"']+\.(m3u8|mp4|urlset)[^"']*)["']/i,
    /["']?sources["']?\s*:\s*(\[[^\]]+\])/i, // Nueva búsqueda para JSON de fuentes en Nuxt
    /https?:\/\/[^"'\s<>|]+\.(m3u8|mp4|urlset)(?:[^"'\s<>|]*)?/gi
  ];

  for (const p of patterns) {
    const match = cleanHtml.match(p);
    if (match) {
      if (p.source.includes('sources')) {
        try {
          const sources = JSON.parse(match[1]);
          if (Array.isArray(sources)) {
            sources.forEach((s: any) => {
              const url = s.file || s.src || s.url;
              if (url) videos.push({ name: s.label || s.name || 'Vidmoly', url });
            });
          }
        } catch (e) { }
      } else {
        const links = p.global ? (match as string[]) : [match[1]];
        links.forEach((link: string) => {
          if (link && link.includes('http') && !link.includes('staticmoly')) {
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

    if (id && videoUrl.includes('vidmoly')) {
      // ATACAMOS LA LANDING PAGE (Que sabemos que no está bloqueada)
      const landingUrl = `https://vidmoly.me/v/${id}`;
      try {
        console.log('Intentando extraer desde la Landing Page:', landingUrl);
        // Usamos AllOrigins estándar (no raw) para que nos devuelva el objeto JSON
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(landingUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.contents && !data.contents.includes('Security Check')) {
            html = data.contents;
            statusLog = 'Exito vía Landing Page';
          }
        }
      } catch (e) {}

      // Fallback: Fetch directo a la Landing con identidad de Googlebot
      if (!html) {
        try {
          const res = await fetch(landingUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } 
          });
          if (res.ok) {
            const text = await res.text();
            if (!text.includes('Security Check')) html = text;
          }
        } catch (e) {}
      }
    }

    if (!html) {
      return NextResponse.json({ 
        error: 'Vidmoly ha bloqueado todos los puntos de acceso.', 
        debug: { id, status: 'Bloqueo total' } 
      }, { status: 403 });
    }

    // Buscamos videos en la Landing Page (están en los datos de Nuxt)
    let videos = await processHtml(html);

    // Si no hay videos, intentamos buscar el m3u8 en el texto crudo (a veces viene en un base64)
    if (videos.length === 0 && html.includes('base64')) {
       const b64Match = html.match(/[A-Za-z0-9+/]{100,}/g);
       if (b64Match) {
          for (const b64 of b64Match) {
             try {
                const decoded = atob(b64);
                if (decoded.includes('http')) {
                   const moreVideos = await processHtml(decoded);
                   videos = [...videos, ...moreVideos];
                }
             } catch (e) {}
          }
       }
    }

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'Estamos dentro de la web, pero el link del video está muy bien escondido.', 
        debug: { id, log: statusLog, html_size: html.length } 
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
