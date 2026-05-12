import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Función para procesar el HTML y extraer los videos
async function processHtml(html: string, videoUrl: string) {
  let videos: any[] = [];

  // Patrón 1: metadata en data-options (Vidsonic y OK.ru)
  const dataOptionsMatch = html.match(/data-options=["'](\{.*?\})["']/);
  if (dataOptionsMatch) {
    try {
      const options = JSON.parse(dataOptionsMatch[1].replace(/&quot;/g, '"'));
      let metadata = options.flashvars?.metadata || options.metadata;
      if (!metadata && options.flashvars?.metadata) metadata = options.flashvars.metadata;
      if (typeof metadata === 'string') {
        try { metadata = JSON.parse(metadata); } catch (e) { }
      }

      if (metadata && Array.isArray(metadata)) {
        metadata.forEach((m: any) => {
          if (m.file) videos.push({ name: m.label || 'Video', url: m.file });
        });
      } else if (metadata && metadata.videos && Array.isArray(metadata.videos)) {
        metadata.videos.forEach((v: any) => {
          const qualityNames: Record<string, string> = {
            'mobile': '144p', 'lowest': '240p', 'low': '360p', 'sd': '480p',
            'hd': '720p', 'full': '1080p', 'full_hd': '1080p', 'quad_hd': '2K', 'ultra_hd': '4K'
          };
          if (v.url) videos.push({ name: qualityNames[v.name] || v.name, url: v.url });
        });
      }
    } catch (e) { }
  }

  // Patrón 2: Base64 sources (Vidmoly)
  if (videos.length === 0) {
    const b64Match = html.match(/sources:\s*["']([A-Za-z0-9+/=]{20,})["']/);
    if (b64Match) {
      try {
        const decoded = Buffer.from(b64Match[1], 'base64').toString('utf-8');
        const sources = JSON.parse(decoded);
        if (Array.isArray(sources)) {
          sources.forEach((s: any) => {
            if (s.file) videos.push({ name: s.label || 'Video', url: s.file });
          });
        }
      } catch (e) { }
    }
  }

  // Patrón 3: Sources en variables de script (Vidmoly/JWPlayer)
  if (videos.length === 0) {
    const jwPatterns = [
      /file\s*:\s*["'](https?:\/\/[^"']+\.(m3u8|mp4|urlset)[^"']*)["']/i,
      /["']?file["']?\s*:\s*["'](https?:\/\/[^"']+)["']/i,
      /source\s*:\s*["'](https?:\/\/[^"']+)["']/i
    ];
    for (const pattern of jwPatterns) {
      const match = html.match(pattern);
      if (match && (match[1].includes('.m3u8') || match[1].includes('.urlset') || match[1].includes('.mp4'))) {
        videos.push({ name: 'Vidmoly HD', url: match[1] });
        break;
      }
    }
  }

  // Patrón 4: Fuerza Bruta
  if (videos.length === 0) {
    const bruteMatch = html.match(/https?:\/\/[^"'\s<>|]+\.(m3u8|mp4|urlset)(?:\?[^"'\s<>|]*)?/gi);
    if (bruteMatch) {
      const forbidden = ['test-videos', 'bunny', 'analytics', 'doubleclick', 'staticmoly'];
      const realLinks = bruteMatch.filter(l => !forbidden.some(f => l.includes(f)));
      const uniqueLinks = Array.from(new Set(realLinks));
      uniqueLinks.forEach((link, index) => {
        const isMaster = link.includes('master.m3u8') || link.includes('.urlset');
        videos.push({ name: isMaster ? 'Vidmoly HD' : `Video ${index + 1}`, url: link });
      });
    }
  }

  // Si no hay videos y es landing de Vidmoly, este código se llama recursivamente desde GET si es necesario, 
  // pero aquí devolvemos lo que tengamos.
  return videos;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({ error: 'URL no proporcionada.' }, { status: 400 });
  }

  try {
    let targetUrl = videoUrl.replace('http://', 'https://').replace('.biz', '.me');
    let html = '';
    let responseStatus = 200;

    // --- ESTRATEGIA CAMALEÓN PARA VIDMOLY ---
    if (videoUrl.includes('vidmoly.')) {
      const crawlers = [
        'WhatsApp/2.21.12.21 A', // Bot de WhatsApp (Muy efectivo)
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', // Bot de Facebook
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' // Googlebot
      ];

      for (const crawlerUA of crawlers) {
        console.log(`Intentando con identidad: ${crawlerUA}`);
        try {
          // Intentamos tanto con el link original como con la landing page (/v/)
          const attemptUrls = [targetUrl];
          if (targetUrl.includes('/e/')) {
             const id = targetUrl.split('/e/')[1].split('?')[0];
             attemptUrls.push(`https://vidmoly.me/v/${id}`);
          }

          for (const url of attemptUrls) {
            const res = await fetch(url, {
              headers: { 
                'User-Agent': crawlerUA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cache-Control': 'no-cache'
              }
            });
            
            if (res.ok) {
              const text = await res.text();
              if (!text.includes('Security Check') && !text.includes('challenges.cloudflare.com')) {
                html = text;
                targetUrl = url;
                break;
              }
            }
          }
          if (html) break;
        } catch (e) {}
      }
    }

    // --- FALLBACK: FETCH DIRECTO MÓVIL ---
    if (!html) {
      console.log('Todos los crawlers fallaron, intentando fetch móvil final...');
      const res = await fetch(targetUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', 
          'Referer': 'https://www.google.com/' 
        }
      });
      responseStatus = res.status;
      if (res.ok) html = await res.text();
    }

    if (!html) {
      return NextResponse.json({ error: `No se pudo obtener el contenido (${responseStatus})` }, { status: responseStatus || 500 });
    }

    // --- PROCESAMIENTO ---
    let videos = await processHtml(html, targetUrl);

    // Si falló, intentamos una vez más con la URL original exacta si era distinta
    if (videos.length === 0 && targetUrl !== videoUrl) {
      const res = await fetch(videoUrl);
      if (res.ok) {
        const fallbackHtml = await res.text();
        videos = await processHtml(fallbackHtml, videoUrl);
      }
    }

    if (videos.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron enlaces de video compatibles.',
        debug: { url: targetUrl, status: responseStatus, html: html.substring(0, 500) }
      }, { status: 404 });
    }

    // --- APLICACIÓN DE PROXY ---
    const proxyBase = process.env.NEXT_PUBLIC_VIDEO_PROXY_URL;
    if (!proxyBase) throw new Error('Proxy URL no configurada');

    const qualities = videos.map((v: any) => ({
      name: v.name,
      url: `${proxyBase}${proxyBase.includes('?') ? '&' : '?'}url=${encodeURIComponent(v.url)}`
    })).reverse();

    return NextResponse.json({ qualities });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
