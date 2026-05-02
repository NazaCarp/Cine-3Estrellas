import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');
  const isProxy = searchParams.get('proxy') === 'true';

  // Si se solicita como proxy, actuamos como puente total
  if (isProxy && videoUrl) {
    try {
      // Determinamos el Referer correcto dinámicamente
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
      if (videoUrl.includes('voe.sx')) referer = 'https://voe.sx/';
      
      const response = await fetch(videoUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': referer,
          'Origin': referer.replace(/\/$/, '')
        }
      });

      if (!response.ok) {
        return new Response(`Error origen: ${response.status}`, { status: response.status });
      }

      // Si es un archivo de video (.ts), lo devolvemos como binario
      const contentType = response.headers.get('Content-Type') || '';
      if (videoUrl.includes('.ts') || contentType.includes('video') || contentType.includes('octet-stream')) {
        const buffer = await response.arrayBuffer();
        return new Response(buffer, {
          headers: { 
            'Content-Type': contentType || 'video/mp2t',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }

      let text = await response.text();
      
      // Si es un manifiesto m3u8, reescribimos absolutamente todos los enlaces (recursivo total)
      if (text.includes('#EXTM3U')) {
        // Extraemos la base de la URL ignorando el nombre del archivo y los parámetros
        const urlPath = urlObj.origin + urlObj.pathname;
        const baseUrl = urlPath.substring(0, urlPath.lastIndexOf('/') + 1);
        const origin = request.nextUrl.origin;
        
        text = text.split('\n').map(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            let absoluteUrl = trimmed;
            if (!trimmed.startsWith('http')) {
              // Si es relativo, unimos baseUrl + path. Si el path empieza con /, usamos origin.
              if (trimmed.startsWith('/')) {
                absoluteUrl = urlObj.origin + trimmed;
              } else {
                absoluteUrl = baseUrl + trimmed;
              }
            }
            
            // Para Vidsonic, intentamos devolver la URL directa si es un sub-manifiesto o segmento,
            // ya que sus CDNs suelen tener CORS abierto y así evitamos el error 500 del proxy recursivo.
            if (videoUrl.includes('vidsonic.net')) {
              return absoluteUrl;
            }

            return `${origin}/api/extract?proxy=true&url=${encodeURIComponent(absoluteUrl)}`;
          }
          return line;
        }).join('\n');
      }

      return new Response(text, {
        headers: { 
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (e: any) {
      return new Response(`Error en proxy: ${e.message}`, { status: 500 });
    }
  }

  if (!videoUrl) {
    return NextResponse.json({ error: 'Falta la URL del video' }, { status: 400 });
  }

  try {
    // Caso especial: Vidsonic (Decodificador Inverso)
    if (videoUrl.includes('vidsonic.net')) {
      try {
        const response = await fetch(videoUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://vidsonic.net/'
          }
        });
        
        const html = await response.text();
        const hexMatch = html.match(/_0x1\s*=\s*['"]([^'"]+)['"]/);
        
        if (hexMatch) {
          const hex = hexMatch[1].split('|').join('');
          let decoded = '';
          for (let i = 0; i < hex.length; i += 2) {
            decoded += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
          }
          const realUrl = decoded.split('').reverse().join('');
          
          if (realUrl.startsWith('http')) {
            return NextResponse.json({
              qualities: [{
                name: 'Auto',
                url: `${request.nextUrl.origin}/api/extract?proxy=true&url=${encodeURIComponent(realUrl)}`
              }]
            });
          }
        }
      } catch (e) {
        console.error("Fallo extracción Vidsonic:", e);
      }
    }

    // Caso especial: Gdtvid / P2PPlay (Versión Final Blindada)
    if (videoUrl.includes('p2pplay.pro')) {
      const segments = videoUrl.split('/').filter(Boolean);
      const id = segments[segments.length - 1];

      if (id && id.length > 3) {
        try {
          const apiUrl = `https://gdtvid.p2pplay.pro/api/source/${id}`;
          const apiRes = await fetch(apiUrl, {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://gdtvid.p2pplay.pro/',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'es-ES,es;q=0.9',
              'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
              'Sec-Ch-Ua-Mobile': '?0',
              'Sec-Ch-Ua-Platform': '"Windows"',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-origin'
            }
          });
          
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            const realFileUrl = apiData.data?.[0]?.file || apiData.file;
            
            if (realFileUrl) {
              return NextResponse.json({
                qualities: [{
                  name: 'Original',
                  url: `${request.nextUrl.origin}/api/extract?proxy=true&url=${encodeURIComponent(realFileUrl)}`
                }]
              });
            }
          }
          // Si la API falla, retornamos error controlado en lugar de dejar que explote el servidor
          return NextResponse.json({ error: 'El servidor de Gdtvid no respondió correctamente.' }, { status: 403 });
        } catch (e) {
          console.error("Fallo crítico Gdtvid:", e);
          return NextResponse.json({ error: 'Error de conexión con Gdtvid.' }, { status: 502 });
        }
      }
    }

    // Ajustes específicos por servidor (Normalización de Referer y Mirroring)
    let finalUrlToFetch = videoUrl;
    if (videoUrl.includes('voe.sx')) {
      finalUrlToFetch = videoUrl.replace('voe.sx', 'richardquestionbuilding.com');
    }

    // Determinamos el Referer correcto para la extracción
    let extractionReferer = 'https://vidmoly.biz/';
    if (finalUrlToFetch.includes('p2pplay.pro')) extractionReferer = 'https://gdtvid.p2pplay.pro/';
    if (finalUrlToFetch.includes('vidsonic.net')) extractionReferer = 'https://vidsonic.net/';
    if (finalUrlToFetch.includes('richardquestionbuilding.com') || finalUrlToFetch.includes('voe.sx')) {
      extractionReferer = 'https://richardquestionbuilding.com/';
    }

    const response = await fetch(finalUrlToFetch, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': extractionReferer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
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

    // Patrón 5: VOE avanzado (Descifrador Maestro de 7 capas)
    if (videos.length === 0 && (videoUrl.includes('voe.sx') || html.includes('voe.sx'))) {
      console.log("[DEBUG VOE] Iniciando extracción...");
      const voeDataMatch = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/);
      if (voeDataMatch) {
        console.log("[DEBUG VOE] Bloque JSON encontrado");
        try {
          const jsonData = JSON.parse(voeDataMatch[1]);
          const encrypted = Array.isArray(jsonData) ? jsonData[0] : jsonData;
          
          if (encrypted && typeof encrypted === 'string') {
            // El algoritmo maestro de VOE (7 capas de protección)
            const decryptVoePro = (str: string) => {
              try {
                // 1. Aplicar ROT13
                let s = str.replace(/[a-zA-Z]/g, (c: any) => {
                  return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
                });

                // 2. Sustitución de Símbolos
                const map: any = {
                  '!!': '?', '#&': '.', '@$': '/', '^^': '_', 
                  '*~': '=', '%?': '-', '~@': ':'
                };
                Object.keys(map).forEach(key => {
                  s = s.split(key).join(map[key]);
                });

                // 3. Primera decodificación Base64
                s = Buffer.from(s, 'base64').toString('utf-8');

                // 4. Caesar Shift (-3)
                s = s.split('').map(c => String.fromCharCode(c.charCodeAt(0) - 3)).join('');

                // 5. Invertir la cadena (Reverse)
                s = s.split('').reverse().join('');

                // 6. Segunda decodificación Base64
                s = Buffer.from(s, 'base64').toString('utf-8');

                return s;
              } catch (e) {
                return str; 
              }
            };

            const decrypted = decryptVoePro(encrypted);
            console.log("[DEBUG VOE] Descifrado Maestro completado.");
            
            try {
              const finalData = JSON.parse(decrypted);
              const sources = finalData.sources || finalData;
              if (Array.isArray(sources)) {
                sources.forEach((src: any) => {
                  if (src.file) videos.push({ name: src.label || 'Original', url: src.file });
                });
              } else if (sources && sources.file) {
                videos.push({ name: sources.label || 'Original', url: sources.file });
              }
            } catch (e) {
              const urlMatch = decrypted.match(/https?:\/\/[^"']+/);
              if (urlMatch) videos.push({ name: 'Original', url: urlMatch[0] });
            }
          }
        } catch (e) {
          console.error("[DEBUG VOE] Error en Descifrado Maestro:", e);
        }
      }

      // Búsqueda inversa (Fallback para VOE)
      if (videos.length === 0) {
        console.log("[DEBUG VOE] Probando búsqueda inversa...");
        const reversedM3u8 = html.match(/[A-Za-z0-9\/\.\:\?\&\_]{20,}8u3m\./g);
        if (reversedM3u8) {
          const realUrl = reversedM3u8[0].split('').reverse().join('');
          console.log("[DEBUG VOE] URL inversa detectada!");
          videos.push({ name: 'Original', url: realUrl });
        }
      }
      // Fallback: Si no hay base64/JSON, buscar el patrón de fuentes de VOE normal
      if (videos.length === 0) {
        const b64Matches = html.match(/[A-Za-z0-9+/]{50,}/g);
        if (b64Matches) {
          for (const b64 of b64Matches) {
            try {
              const decoded = Buffer.from(b64, 'base64').toString('utf-8');
              if (decoded.includes('http') && (decoded.includes('.m3u8') || decoded.includes('.mp4'))) {
                const urlMatch = decoded.match(/https?:\/\/[^"']+/);
                if (urlMatch) {
                  videos.push({ name: 'Original', url: urlMatch[0] });
                  break;
                }
              }
            } catch (e) {}
          }
        }
      }
    }

    // Patrón 6: Búsqueda profunda (Último recurso mejorado)
    if (videos.length === 0) {
      const voeMatch = html.match(/["']hls["']:\s*["']([^"']+)["']/i) || 
                       html.match(/["']mp4["']:\s*["']([^'"]+)["']/i);
      if (voeMatch) {
        videos.push({ name: 'Original', url: voeMatch[1] });
      } else {
        const deepMatch = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/g);
        if (deepMatch) {
          const realLinks = deepMatch.filter(l => !l.includes('test-videos.co.uk') && !l.includes('bunny'));
          if (realLinks.length > 0) {
            videos.push({ name: 'Directo', url: realLinks[0] });
          }
        }
      }
    }

    if (videos.length === 0) {
      console.log("[DEBUG VOE] No se encontró nada. Probando reconstrucción manual...");
      const idMatch = videoUrl.match(/\/e\/([a-zA-Z0-9]+)/);
      if (idMatch) {
        const id = idMatch[1];
        const urlObj = new URL(videoUrl);
        const domain = urlObj.hostname;

        // Intentamos con el dominio actual de forma dinámica
        videos.push({
          name: 'Directo (MP4)',
          url: `https://${domain}/d/${id}/video.mp4`
        });
        videos.push({
          name: 'Manual (HLS)',
          url: `https://${domain}/engine/hls/${id}/master.m3u8`
        });
      }
    }

    if (videos.length === 0) {
      console.log("[DEBUG VOE] Fallo total.");
      return NextResponse.json({ error: 'No se encontraron enlaces de descarga compatibles.' }, { status: 404 });
    }

    // Mapear calidades a nombres amigables y envolver en proxy
    const qualities = videos.map((v: any) => ({
      name: v.name,
      url: `${request.nextUrl.origin}/api/extract?proxy=true&url=${encodeURIComponent(v.url)}`
    })).reverse(); 

    return NextResponse.json({ qualities });

  } catch (error: any) {
    console.error('Error en extracción:', error);
    return NextResponse.json({ error: error.message || 'Error desconocido al extraer.' }, { status: 500 });
  }
}
