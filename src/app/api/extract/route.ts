import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({ error: 'Falta la URL del video' }, { status: 400 });
  }

  try {
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

    if (videos.length === 0) {
      if (videoUrl.includes('vidmoly.')) {
        return NextResponse.json({ 
          error: 'Vidmoly no permite descargas directas automáticas por su protección contra robots. Usa el reproductor para ver el video.' 
        }, { status: 403 });
      }
      return NextResponse.json({ error: 'No se encontraron enlaces de descarga compatibles.' }, { status: 404 });
    }

    // Mapear calidades a nombres amigables
    const qualities = videos.map((v: any) => ({
      name: v.name === 'mobile' ? '144p' : 
            v.name === 'lowest' ? '240p' : 
            v.name === 'low' ? '360p' : 
            v.name === 'sd' ? '480p' : 
            v.name === 'hd' ? '720p' : 
            v.name === 'full' ? '1080p' : 
            v.name === 'quad' ? '2K' : 
            v.name === 'ultra' ? '4K' : v.name,
      url: v.url
    })).reverse(); // De mayor a menor calidad

    return NextResponse.json({ qualities });

  } catch (error: any) {
    console.error('Error en extracción:', error);
    return NextResponse.json({ error: error.message || 'Error desconocido al extraer.' }, { status: 500 });
  }
}
