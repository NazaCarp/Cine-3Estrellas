import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoUrl = searchParams.get('url');
  const isProxy = searchParams.get('proxy') === 'true';

  if (!videoUrl) {
    return NextResponse.json({ error: 'URL no proporcionada.' }, { status: 400 });
  }

  // Si se solicita como proxy, actuamos como puente total
  if (isProxy && videoUrl) {
    try {
      let urlObj;
      try {
        urlObj = new URL(videoUrl);
      } catch (e) {
        return new Response('URL inválida', { status: 400 });
      }
      
      let referer = `${urlObj.protocol}//${urlObj.hostname}/`;
      
      // Ajustes específicos por servidor (Normalización de Referer)
      if (videoUrl.includes('vidmoly.')) referer = 'https://vidmoly.biz/';
      if (videoUrl.includes('p2pplay.pro')) referer = 'https://gdtvid.p2pplay.pro/';
      if (videoUrl.includes('vidsonic.net')) referer = 'https://vidsonic.net/';
      if (videoUrl.includes('ok.ru')) referer = 'https://ok.ru/';
      
      // Soporte para Range Requests (Seek en MP4)
      const rangeHeader = request.headers.get('range');
      const fetchHeaders: any = { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Origin': referer.replace(/\/$/, '')
      };
      if (rangeHeader) fetchHeaders['Range'] = rangeHeader;
      
      const response = await fetch(videoUrl, { headers: fetchHeaders });

      if (!response.ok && response.status !== 206) {
        return new Response(`Error origen: ${response.status}`, { status: response.status });
      }

      const contentType = response.headers.get('Content-Type') || '';
      const contentRange = response.headers.get('Content-Range');
      const contentLength = response.headers.get('Content-Length');
      const acceptRanges = response.headers.get('Accept-Ranges');
      const isDownload = searchParams.get('download') === 'true';

      if (videoUrl.includes('.ts') || contentType.includes('video') || contentType.includes('octet-stream')) {
        const headers: any = {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
          'Accept-Ranges': acceptRanges || 'bytes',
        };
        if (contentRange) headers['Content-Range'] = contentRange;
        if (contentLength) headers['Content-Length'] = contentLength;
        
        if (isDownload) {
          const ext = contentType.includes('mp4') ? 'mp4' : 'ts';
          headers['Content-Disposition'] = `attachment; filename="video-${Date.now()}.${ext}"`;
        }

        return new Response(response.body, {
          status: response.status,
          headers: headers
        });
      }

      // Para archivos m3u8, procesamos los segmentos para que pasen por nuestro proxy
      let text = await response.text();
      const baseUrl = videoUrl.substring(0, videoUrl.lastIndexOf('/') + 1);
      
      const lines = text.split('\n');
      const processedLines = lines.map(line => {
        if (line.trim() === '' || line.startsWith('#')) return line;
        
        let segmentUrl = line.trim();
        if (!segmentUrl.startsWith('http')) {
          segmentUrl = new URL(segmentUrl, baseUrl).toString();
        }
        
        return `${request.nextUrl.origin}/api/extract?proxy=true&url=${encodeURIComponent(segmentUrl)}`;
      });

      return new Response(processedLines.join('\n'), {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error: any) {
      return new Response(`Error proxy: ${error.message}`, { status: 500 });
    }
  }

  // --- MODO EXTRACCIÓN ---
  try {
    let extractionReferer = 'https://vidmoly.biz/';
    if (videoUrl.includes('vidsonic.net')) extractionReferer = 'https://vidsonic.net/';
    if (videoUrl.includes('ok.ru')) extractionReferer = 'https://ok.ru/';
    
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': extractionReferer
      }
    });

    if (!response.ok) {
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
      const b64Match = html.match(/sources:\s*["']([A-Za-z0-9+/=]+)["']/);
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

    // Patrón 3: JWPlayer sources estándar
    if (videos.length === 0) {
      const jwMatch = html.match(/sources:\s*\[\s*\{\s*file:\s*["']([^"']+)["']/);
      if (jwMatch) {
        const labelMatch = html.match(/label:\s*["']([^"']+)["']/);
        videos.push({ name: labelMatch ? labelMatch[1] : 'Original', url: jwMatch[1] });
      }
    }

    if (videos.length === 0) {
      // Búsqueda profunda de .m3u8 o .mp4
      const deepMatch = html.match(/https?:\/\/[^"']+\.(m3u8|mp4)[^"']*/g);
      if (deepMatch) {
        const realLinks = deepMatch.filter(l => !l.includes('test-videos') && !l.includes('bunny'));
        if (realLinks.length > 0) videos.push({ name: 'Directo', url: realLinks[0] });
      }
    }

    if (videos.length === 0) {
      return NextResponse.json({ error: 'No se encontraron enlaces de video compatibles.' }, { status: 404 });
    }

    const qualities = videos.map((v: any) => ({
      name: v.name,
      url: `${request.nextUrl.origin}/api/extract?proxy=true&url=${encodeURIComponent(v.url)}`
    })).reverse(); 

    return NextResponse.json({ qualities });

  } catch (error: any) {
    console.error('Error en extracción:', error);
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 });
  }
}
