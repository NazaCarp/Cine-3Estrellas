import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Función para decodificar Packer (p,a,c,k,e,d)
function unPack(code: string) {
  try {
    const p = /eval\(function\(p,a,c,k,e,d\)\{.*return p\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)\)\)/;
    const match = code.match(p);
    if (!match) return code;

    let [_, payload, aStr, cStr, keyStr] = match;
    let a = parseInt(aStr), c = parseInt(cStr);
    let k = keyStr.split('|');
    let e = (c: number): string => (c < a ? '' : e(Math.floor(c / a))) + String.fromCharCode((c % a) + (c % a > 35 ? 29 : 39));
    
    while (c--) {
      if (k[c]) payload = payload.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
    }
    return payload;
  } catch (e) { return code; }
}

async function processHtml(html: string, videoUrl: string) {
  let videos: any[] = [];
  const cleanHtml = unPack(html);

  // Patrón 1: JWPlayer / Script vars (Base64 o Directo)
  const jwPatterns = [
    /file\s*:\s*["'](https?:\/\/[^"']+\.(m3u8|mp4|urlset)[^"']*)["']/i,
    /["']?file["']?\s*:\s*["'](https?:\/\/[^"']+)["']/i,
    /sources:\s*["']([A-Za-z0-9+/=]{20,})["']/
  ];

  for (const pattern of jwPatterns) {
    const match = cleanHtml.match(pattern);
    if (match) {
      if (pattern.source.includes('sources')) {
        try {
          const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
          const sources = JSON.parse(decoded);
          if (Array.isArray(sources)) sources.forEach((s: any) => { if (s.file) videos.push({ name: s.label || 'Video', url: s.file }); });
        } catch (e) { }
      } else if (match[1].includes('http')) {
        videos.push({ name: 'Vidmoly HD', url: match[1] });
      }
    }
  }

  // Patrón 2: Fuerza Bruta Extrema
  if (videos.length === 0) {
    const bruteMatch = cleanHtml.match(/https?:\/\/[^"'\s<>|]+\.(m3u8|mp4|urlset)(?:[^"'\s<>|]*)?/gi);
    if (bruteMatch) {
      const forbidden = ['test-videos', 'bunny', 'analytics', 'staticmoly'];
      const uniqueLinks = Array.from(new Set(bruteMatch.filter(l => !forbidden.some(f => l.includes(f)))));
      uniqueLinks.forEach((link, i) => {
        const isMaster = link.includes('master.m3u8') || link.includes('.urlset');
        videos.push({ name: isMaster ? 'Vidmoly HD' : `Opción ${i + 1}`, url: link });
      });
    }
  }

  return videos;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoUrl = searchParams.get('url');

  if (!videoUrl) return NextResponse.json({ error: 'URL no proporcionada.' }, { status: 400 });

  try {
    let targetUrl = videoUrl.replace('http://', 'https://');
    let html = '';
    let responseStatus = 200;

    // --- ESTRATEGIA CRAWLER PARA VIDMOLY ---
    if (videoUrl.includes('vidmoly.')) {
      const ua = 'WhatsApp/2.21.12.21 A';
      // Probamos directo al embed construido
      const codeMatch = videoUrl.match(/\/(?:v|e|embed-)?([a-zA-Z0-9]{8,15})/);
      if (codeMatch) {
        targetUrl = `https://vidmoly.me/embed-${codeMatch[1]}.html`;
        const res = await fetch(targetUrl, { headers: { 'User-Agent': ua, 'Referer': 'https://vidmoly.me/' } });
        if (res.ok) html = await res.text();
      }
    }

    // --- FALLBACK DIRECTO ---
    if (!html) {
      const res = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' } });
      responseStatus = res.status;
      if (res.ok) html = await res.text();
    }

    if (!html) return NextResponse.json({ error: `No se pudo obtener el contenido (${responseStatus})` }, { status: responseStatus || 500 });

    let videos = await processHtml(html, targetUrl);

    if (videos.length === 0) {
      return NextResponse.json({ error: 'No se encontraron enlaces de video.', debug: { url: targetUrl, html: html.substring(0, 500) } }, { status: 404 });
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
