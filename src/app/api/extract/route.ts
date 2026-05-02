import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');
  const isProxy = searchParams.get('proxy') === 'true';

  // Si se solicita como proxy, actuamos como puente total
  if (isProxy && videoUrl) {
    try {
      const response = await fetch(videoUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://vidmoly.biz/' 
        }
      });

      // Si es un archivo de video (.ts), lo devolvemos como binario
      if (videoUrl.includes('.ts') || response.headers.get('Content-Type')?.includes('video')) {
        const buffer = await response.arrayBuffer();
        return new Response(buffer, {
          headers: { 
            'Content-Type': response.headers.get('Content-Type') || 'video/mp2t',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }

      let text = await response.text();
      
      // Si es un manifiesto m3u8, reescribimos absolutamente todos los enlaces (recursivo total)
      if (text.includes('#EXTM3U') && !videoUrl.includes('google.com')) {
        const baseUrl = videoUrl.substring(0, videoUrl.lastIndexOf('/') + 1);
        const origin = request.nextUrl.origin;
        
        text = text.split('\n').map(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const absoluteUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
            return `${origin}/api/extract?proxy=true&url=${encodeURIComponent(absoluteUrl)}`;
          }
          return line;
        }).join('\n');
      }

      return new Response(text, {
        headers: { 
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (e) {
      return new Response('Error en proxy', { status: 500 });
    }
  }

  if (!videoUrl) {
    return NextResponse.json({ error: 'Falta la URL del video' }, { status: 400 });
  }

  try {
    // Caso especial: Gdtvid / P2PPlay (no necesita scraping de HTML, tiene API directa)
    if (videoUrl.includes('p2pplay.pro')) {
      const id = videoUrl.split('#')[1] || videoUrl.split('/').pop();
      if (id && id.length > 3) {
        const streamUrl = `https://gdtvid.p2pplay.pro/api/source/${id}`;
        return NextResponse.json({
          qualities: [{
            name: 'Auto',
            url: `${request.nextUrl.origin}/api/extract?proxy=true&url=${encodeURIComponent(streamUrl)}`
          }]
        });
      }
    }

    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://vidmoly.biz/'
      }
    });

    if (!response.ok) {
      if (response.status === 404) throw new Error('El video ya no está disponible en el servidor de origen.');
      if (response.status === 403) throw new Error('El acceso al servidor de origen fue denegado.');
      throw new Error(`Error del servidor externo (${response.status})`);
    }

    const html = await response.text();
    
    // Intentamos extraer metadatos de diferentes bloques posibles
    let videos: any[] = [];

    // Patrón 1: metadata en data-options
    const dataOptionsMatch = html.match(/data-options=["'](\{.*?\})["']/);
    if (dataOptionsMatch) {
      try {
        const options = JSON.parse(dataOptionsMatch[1].replace(/&quot;/g, '"'));
        const metadata = options.flashvars?.metadata || options.metadata;
        if (metadata && typeof metadata === 'string') {
          const parsedMeta = JSON.parse(metadata);
          videos = parsedMeta.videos || [];
        } else if (metadata?.videos) {
            videos = metadata.videos;
        }
      } catch (e) {}
    }

    // Patrón 2: metadata en flashvars directo (fallback)
    if (videos.length === 0) {
      const flashvarsMatch = html.match(/flashvars=(.*?)(&|$)/);
      if (flashvarsMatch) {
        const decoded = decodeURIComponent(flashvarsMatch[1]);
        const metaMatch = decoded.match(/metadata=(.*?)$/);
        if (metaMatch) {
          try {
            const parsedMeta = JSON.parse(metaMatch[1]);
            videos = parsedMeta.videos || [];
          } catch (e) {}
        }
      }
    }

    // Patrón 3: Buscar JSON de metadatos directo en el script (último recurso)
    if (videos.length === 0) {
        const jsonMatch = html.match(/\"metadata\":\"(\{.*?\})\"/);
        if (jsonMatch) {
            try {
                const innerJson = JSON.parse(jsonMatch[1].replace(/\\"/g, '"'));
                videos = innerJson.videos || [];
            } catch (e) {}
        }
    }

    // Patrón 4: JWPlayer sources (Común en Vidmoly y otros)
    if (videos.length === 0) {
      const jwMatch = html.match(/sources:\s*\[\s*\{\s*file:\s*["']([^"']+)["']/);
      if (jwMatch) {
        // Intentar obtener la etiqueta de calidad si existe cerca
        const labelMatch = html.match(/label:\s*["']([^"']+)["']/);
        videos.push({
          name: labelMatch ? labelMatch[1] : 'full',
          url: jwMatch[1]
        });
      }
    }

    if (videos.length === 0) {
      return NextResponse.json({ error: 'No se encontraron enlaces de descarga compatibles.' }, { status: 404 });
    }

    // Mapear calidades a nombres amigables y envolver en proxy
    const qualities = videos.map((v: any) => ({
      name: v.name === 'mobile' ? '144p' : 
            v.name === 'lowest' ? '240p' : 
            v.name === 'low' ? '360p' : 
            v.name === 'sd' ? '480p' : 
            v.name === 'hd' ? '720p' : 
            v.name === 'full' ? '1080p' : 
            v.name === 'quad' ? '2K' : 
            v.name === 'ultra' ? '4K' : v.name,
      url: `${request.nextUrl.origin}/api/extract?proxy=true&url=${encodeURIComponent(v.url)}`
    })).reverse(); 

    return NextResponse.json({ qualities });

  } catch (error: any) {
    console.error('Error en extracción:', error);
    return NextResponse.json({ error: error.message || 'Error desconocido al extraer.' }, { status: 500 });
  }
}
