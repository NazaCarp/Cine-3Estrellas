import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

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
    // --- LÓGICA DE NORMALIZACIÓN PARA VIDMOLY ---
    let targetUrl = videoUrl;
    if (videoUrl.includes('vidmoly.')) {
      targetUrl = videoUrl.replace('http://', 'https://');
      if (videoUrl.includes('.biz')) targetUrl = targetUrl.replace('.biz', '.me');
      // A veces /embed- es más permisivo que /e/
      if (targetUrl.includes('/e/')) {
        const id = targetUrl.split('/e/')[1].split('?')[0];
        targetUrl = `https://vidmoly.me/embed-${id}.html`;
      }
    }

    // Usamos un User-Agent de iPhone moderno, que suele saltarse mejor los retos de Cloudflare
    const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
    
    let response = await fetch(targetUrl, {
      headers: {
        'User-Agent': mobileUA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache'
      }
    });

    // Si detectamos el "Security Check", intentamos una última vez con la URL original
    if (response.ok) {
      const initialHtml = await response.clone().text();
      if (initialHtml.includes('Security Check') || initialHtml.includes('challenges.cloudflare.com')) {
        console.log('Detectado Security Check, reintentando con URL original...');
        response = await fetch(videoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://vidmoly.me/'
          }
        });
      }
    }

    if (!response.ok) {
      return NextResponse.json({ error: `Error del servidor externo (${response.status})` }, { status: response.status });
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

    // Patrón 3: Sources en variables de script (Vidmoly/JWPlayer) - MEJORADO
    if (videos.length === 0) {
      // Buscamos cualquier patrón { file: "http..." } o similar
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

    // Patrón 5: Búsqueda profunda de .m3u8 o .mp4 (Mejorado para master.m3u8 y parámetros de token)
    if (videos.length === 0) {
      // Regex de "Fuerza Bruta": busca cualquier URL que parezca un video en todo el documento
      const bruteMatch = html.match(/https?:\/\/[^"'\s<>|]+\.(m3u8|mp4|urlset)(?:\?[^"'\s<>|]*)?/gi);
      if (bruteMatch) {
        const forbidden = ['test-videos', 'bunny', 'analytics', 'doubleclick', 'google-analytics', 'hotjar', 'staticmoly'];
        const realLinks = bruteMatch.filter(l => !forbidden.some(f => l.includes(f)));
        
        // Eliminar duplicados
        const uniqueLinks = Array.from(new Set(realLinks));
        
        uniqueLinks.forEach((link, index) => {
          const isMaster = link.includes('master.m3u8') || link.includes('.urlset');
          videos.push({ 
            name: isMaster ? `Vidmoly HD ${index + 1}` : `Video ${index + 1}`, 
            url: link 
          });
        });
      }
    }

    // --- REINTENTO SI ES LANDING PAGE DE VIDMOLY ---
    if (videos.length === 0 && videoUrl.includes('vidmoly.') && (!videoUrl.includes('embed') && !videoUrl.includes('/e/'))) {
      // Buscamos el embed_url en el HTML (Nuxt Data) o construimos el link de embed
      let embedUrl = '';
      const embedMatch = html.match(/["']embed_url["']\s*:\s*["'](https?:\/\/[^"']+)["']/);
      
      if (embedMatch) {
        embedUrl = embedMatch[1];
      } else {
        // Si no hay embed_url, intentamos convertir /v/667k... a /embed-667k...html
        const codeMatch = videoUrl.match(/\/v\/([a-zA-Z0-9]+)/);
        if (codeMatch) embedUrl = `https://vidmoly.biz/embed-${codeMatch[1]}.html`;
      }

      if (embedUrl) {
        console.log('Reintentando con Embed URL:', embedUrl);
        const embedRes = await fetch(embedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Referer': videoUrl
          }
        });
        
        if (embedRes.ok) {
          const embedHtml = await embedRes.text();
          // Patrón directo para JWPlayer dentro del embed
          const m3u8Match = embedHtml.match(/file\s*:\s*["'](https?:\/\/[^"']+\.(m3u8|urlset)[^"']*)["']/);
          if (m3u8Match) {
            videos.push({ name: 'Vidmoly HD', url: m3u8Match[1] });
          } else {
            // Búsqueda profunda en el embed
            const deepEmbedMatch = embedHtml.match(/https?:\/\/[^"']+\.(m3u8|urlset)(?:\?[^"']*)?/g);
            if (deepEmbedMatch) {
              const master = deepEmbedMatch.find(l => l.includes('master.m3u8') || l.includes('.urlset'));
              videos.push({ name: 'Vidmoly HD', url: master || deepEmbedMatch[0] });
            }
          }
        }
      }
    }

    if (videos.length === 0) {
      console.log(`[Extracción Fallida] URL: ${videoUrl}`);
      return NextResponse.json({ 
        error: 'No se encontraron enlaces de video compatibles.',
        debug: {
          url_solicitada: videoUrl,
          url_final: targetUrl,
          html_inicio: html.substring(0, 500),
          html_longitud: html.length,
          status_externo: response.status
        }
      }, { status: 404 });
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
