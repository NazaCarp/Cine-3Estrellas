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
  
  // 1. Desofuscamos Packer y Unicode (\u0068...) y Hex (\x68...)
  let cleanHtml = unPack(html)
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\/|\\/g, '/');

  const patterns = [
    // Buscador de dominios críticos y extensiones
    /(https?:\/\/[^"'\s<>|]+(?:vmwesa\.online|moly\.io|master\.m3u8|urlset)[^"'\s<>|]*)/gi,
    // Buscador de fuentes en JSON
    /["']?(?:file|src|url)["']?\s*[:=]\s*["']?((?:https?:)?\/\/[^"']+\.(?:m3u8|mp4|urlset))["']?/gi
  ];

  for (const p of patterns) {
    const matches = cleanHtml.matchAll(p);
    for (const match of matches) {
      const url = (match[1] || match[0]).trim();
      if (url && url.includes('http') && !url.includes('staticmoly') && !url.includes('hotjar')) {
        const isMaster = url.includes('master.m3u8') || url.includes('.urlset');
        videos.push({ name: isMaster ? 'Vidmoly HD' : 'Video', url });
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
    const idMatch = videoUrl.match(/\/(?:v|e|embed-|embed\/|dl\/|lite-)?([a-zA-Z0-9]{8,15})/);
    if (idMatch) id = idMatch[1];
    
    let html = '';
    let statusLog = '';
    const googleBot = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    const fbBot = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

    if (id) {
      // 1. INTENTO LANDING CON DISFRAZ DE FACEBOOK (Lo que nos funcionó para entrar)
      const landingUrl = `https://vidmoly.me/v/${id}`;
      try {
        const res = await fetch(landingUrl, { headers: { 'User-Agent': fbBot } });
        if (res.ok) {
          html = await res.text();
          if (html.length > 1000 && !html.includes('Security Check')) statusLog = 'Exito vía Landing (Facebook UA)';
        }
      } catch (e) {}

      // 2. INTENTO EMBED CON GOOGLEBOT (Si la landing no tiene el link claro)
      if (!html || html.includes('Security Check')) {
        const embedUrl = `https://vidmoly.me/e/${id}`;
        try {
          const res = await fetch(embedUrl, { headers: { 'User-Agent': googleBot } });
          if (res.ok) {
            html = await res.text();
            statusLog = 'Exito vía Embed (Googlebot UA)';
          }
        } catch (e) {}
      }
    }

    if (!html || html.includes('Security Check')) {
      return NextResponse.json({ error: 'Bloqueo de Vidmoly total.', debug: { id } }, { status: 403 });
    }

    let videos = await processHtml(html);

    // Búsqueda de emergencia en el código crudo (Links fragmentados)
    if (videos.length === 0) {
       const rawLinks = html.match(/https?:\/\/[^"'\s<>|]+/gi) || [];
       for (const link of rawLinks) {
          if (link.includes('vmwesa') || link.includes('moly.io')) {
             videos.push({ name: 'Video Detectado (Raw)', url: link.replace(/\\/g, '') });
          }
       }
    }

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'Estamos dentro, pero el link está fragmentado.', 
        debug: { id, log: statusLog, html_size: html.length, snippet: html.substring(0, 300) } 
      }, { status: 404 });
    }

    const proxyBase = process.env.NEXT_PUBLIC_VIDEO_PROXY_URL;
    const qualities = videos.map((v: any) => ({
      name: v.name,
      url: `${proxyBase}${proxyBase?.includes('?') ? '&' : '?'}url=${encodeURIComponent(v.url)}`
    })).reverse();

    const uniqueQualities = Array.from(new Map(qualities.map(q => [q.url, q])).values());

    return NextResponse.json({ qualities: uniqueQualities });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
