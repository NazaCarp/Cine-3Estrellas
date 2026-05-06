import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoUrl = searchParams.get('url');
  if (!videoUrl) {
    return NextResponse.json({ error: 'URL no proporcionada.' }, { status: 400 });
  }

  // NOTA: El modo proxy interno ha sido ELIMINADO para proteger el ancho de banda de Vercel.
  // Ahora TODO el tráfico de video proxy se enruta a través del Worker de Cloudflare.

  // --- MODO EXTRACCIÓN ---
  try {
    let extractionReferer = '';
    if (videoUrl.includes('vidmoly.')) extractionReferer = 'https://vidmoly.biz/';
    if (videoUrl.includes('vidsonic.net')) extractionReferer = 'https://vidsonic.net/';
    if (videoUrl.includes('ok.ru')) extractionReferer = 'https://ok.ru/';
    
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Referer': extractionReferer || videoUrl,
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="121", "Google Chrome";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok && response.status !== 403 && response.status !== 401) {
      throw new Error(`Error del servidor externo (${response.status})`);
    }

    const html = await response.text();
    let videos: any[] = [];

    // Patrón 1: metadata en data-options (Vidsonic y OK.ru)
    const dataOptionsMatch = html.match(/data-options=["'](\{.*?\})["']/);
    if (dataOptionsMatch) {
      try {
        const options = JSON.parse(dataOptionsMatch[1].replace(/&quot;/g, '"'));
        
        // Caso A: Estructura Vidsonic
        let metadata = options.flashvars?.metadata || options.metadata;
        
        // Caso B: Estructura OK.ru (metadata es un string JSON dentro de data-options)
        if (!metadata && options.flashvars?.metadata) {
          metadata = options.flashvars.metadata;
        }
        
        if (typeof metadata === 'string') {
          try { metadata = JSON.parse(metadata); } catch(e) {}
        }

        if (metadata && Array.isArray(metadata)) {
          metadata.forEach((m: any) => {
            if (m.file) videos.push({ name: m.label || 'Video', url: m.file });
          });
        } else if (metadata && metadata.videos && Array.isArray(metadata.videos)) {
          // Específico para OK.ru
          metadata.videos.forEach((v: any) => {
            const qualityNames: Record<string, string> = {
              'mobile': '144p',
              'lowest': '240p',
              'low': '360p',
              'sd': '480p',
              'hd': '720p',
              'full': '1080p',
              'full_hd': '1080p',
              'quad_hd': '2K',
              'ultra_hd': '4K'
            };
            if (v.url) videos.push({ name: qualityNames[v.name] || v.name, url: v.url });
          });
        }
      } catch (e) {}
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
        } catch (e) {}
      }
    }

    // Patrón 3: Sources en variables de script (Vidmoly/JWPlayer)
    if (videos.length === 0) {
      const varSourcesMatch = html.match(/var\s+sources\s*=\s*(\[[\s\S]*?\]);/);
      if (varSourcesMatch) {
        try {
          const sources = JSON.parse(varSourcesMatch[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
          if (Array.isArray(sources)) {
            sources.forEach((s: any) => {
              if (s.file) videos.push({ name: s.label || 'Video', url: s.file });
            });
          }
        } catch (e) {}
      }
    }

    // Patrón 4: Vidsonic Hex-encoded URL (Nuevo)
    if (videos.length === 0) {
      const vidsonicHexMatch = html.match(/['"]([a-f0-9]{2,}\|[a-f0-9|]{20,})['"]/);
      if (vidsonicHexMatch) {
        try {
          const hex = vidsonicHexMatch[1].split('|').join('');
          let decoded = '';
          for (let i = 0; i < hex.length; i += 2) {
            decoded += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
          }
          const finalUrl = decoded.split('').reverse().join('');
          if (finalUrl.startsWith('http')) {
            videos.push({ name: 'HD', url: finalUrl });
          }
        } catch (e) {}
      }
    }

    if (videos.length === 0) {
      // Patrón 5: Vidsonic data-vs (Base64)
      const dataVsMatch = html.match(/data-vs=["']([A-Za-z0-9+/=]{20,})["']/);
      if (dataVsMatch) {
        try {
          const decoded = Buffer.from(dataVsMatch[1], 'base64').toString('utf-8');
          if (decoded.startsWith('http')) {
            videos.push({ name: 'HD', url: decoded });
          } else {
            try {
              const data = JSON.parse(decoded);
              if (data.file) videos.push({ name: 'HD', url: data.file });
              else if (data.url) videos.push({ name: 'HD', url: data.url });
            } catch(e) {}
          }
        } catch (e) {}
      }
    }

    if (videos.length === 0) {
      // Búsqueda profunda de .m3u8 o .mp4
      const deepMatch = html.match(/https?:\/\/[^"']+\.(m3u8|mp4|urlset)[^"']*/g);
      if (deepMatch) {
        const forbidden = ['test-videos', 'bunny', 'analytics', 'doubleclick', 'google-analytics', 'hotjar'];
        const realLinks = deepMatch.filter(l => !forbidden.some(f => l.includes(f)));
        if (realLinks.length > 0) {
          videos.push({ name: 'Directo', url: realLinks[0] });
        }
      }
    }

    if (videos.length === 0) {
      console.log(`[Extracción Fallida] URL: ${videoUrl} | HTML: ${html.substring(0, 500).replace(/\n/g, ' ')}`);
      return NextResponse.json({ error: 'No se encontraron enlaces de video compatibles.' }, { status: 404 });
    }

    // Usamos ESTRICTAMENTE el Worker de Cloudflare.
    const proxyBase = process.env.NEXT_PUBLIC_VIDEO_PROXY_URL;
    
    if (!proxyBase) {
      throw new Error('ATENCIÓN: NEXT_PUBLIC_VIDEO_PROXY_URL no está configurado en .env. Debes configurar el Worker de Cloudflare para reproducir videos sin consumir el ancho de banda de Vercel.');
    }

    const qualities = videos.map((v: any) => ({
      name: v.name,
      url: `${proxyBase}${proxyBase.includes('?') ? '&' : '?'}url=${encodeURIComponent(v.url)}`
    })).reverse(); 

    return NextResponse.json({ qualities });

  } catch (error: any) {
    console.error('Error en extracción:', error);
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 });
  }
}
