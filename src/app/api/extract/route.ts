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

  // Patrones de búsqueda ultra-amplios
  const patterns = [
    /["']?(?:file|src|url|sources?)["']?\s*[:=]\s*["']?((?:https?:)?\/\/[^"']+\.(?:m3u8|mp4|urlset|mkv)[^"']*)["']?/gi,
    /["']?sources["']?\s*:\s*(\[[^\]]+\])/gi,
    /https?:\/\/[^"'\s<>|]+\.(m3u8|mp4|urlset)(?:[^"'\s<>|]*)?/gi
  ];

  for (const p of patterns) {
    const matches = cleanHtml.matchAll(p);
    for (const match of matches) {
      if (p.source.includes('sources') && match[1].includes('{')) {
        try {
          const sources = JSON.parse(match[1]);
          if (Array.isArray(sources)) {
            sources.forEach((s: any) => {
              const url = s.file || s.src || s.url;
              if (url && url.includes('http')) videos.push({ name: s.label || s.name || 'Video', url });
            });
          }
        } catch (e) { }
      } else {
        const url = match[1] || match[0];
        if (url && url.includes('http') && !url.includes('staticmoly') && !url.includes('hotjar') && !url.includes('analytics')) {
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
    const idMatch = videoUrl.match(/\/(?:v|e|embed-|embed\/|dl\/)?([a-zA-Z0-9]{8,15})/);
    if (idMatch) id = idMatch[1];
    
    let html = '';
    let statusLog = '';

    if (id && videoUrl.includes('vidmoly')) {
      // 1. INTENTO VÍA PÁGINA DE DESCARGA (Suele estar abierta y tener el link directo)
      const dlUrl = `https://vidmoly.me/dl/${id}`;
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(dlUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.contents && !data.contents.includes('Security Check')) {
            html = data.contents;
            statusLog = 'Exito vía Download Page';
          }
        }
      } catch (e) {}

      // 2. FALLBACK A LA LANDING PAGE SI EL DL FALLA
      if (!html) {
        const landingUrl = `https://vidmoly.me/v/${id}`;
        try {
          const res = await fetch(landingUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } 
          });
          if (res.ok) {
            html = await res.text();
            statusLog = 'Exito vía Landing Page';
          }
        } catch (e) {}
      }
    }

    if (!html) {
      return NextResponse.json({ error: 'Vidmoly ha bloqueado todos los puntos de acceso.', debug: { id } }, { status: 403 });
    }

    let videos = await processHtml(html);

    // Si aún no hay nada, buscamos el ID del video en cualquier string base64 (muy común en Nuxt)
    if (videos.length === 0) {
       const b64Regex = /[A-Za-z0-9+/]{50,}/g;
       const b64Matches = html.match(b64Regex) || [];
       for (const b64 of b64Matches) {
          try {
             const decoded = atob(b64);
             if (decoded.includes('http') && decoded.includes(id)) {
                const moreVideos = await processHtml(decoded);
                if (moreVideos.length > 0) {
                   videos = [...videos, ...moreVideos];
                   statusLog += ' + Base64 Decode Success';
                }
             }
          } catch (e) {}
       }
    }

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'Estamos dentro de la web, pero el link del video está muy bien escondido.', 
        debug: { id, log: statusLog, html_size: html.length, snippet: html.substring(0, 500) } 
      }, { status: 404 });
    }

    const proxyBase = process.env.NEXT_PUBLIC_VIDEO_PROXY_URL;
    const qualities = videos.map((v: any) => ({
      name: v.name,
      url: `${proxyBase}${proxyBase?.includes('?') ? '&' : '?'}url=${encodeURIComponent(v.url)}`
    })).reverse();

    // Eliminamos duplicados
    const uniqueQualities = Array.from(new Map(qualities.map(q => [q.url, q])).values());

    return NextResponse.json({ qualities: uniqueQualities });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
