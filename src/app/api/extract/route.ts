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

  const patterns = [
    /file\s*:\s*["'](https?:\/\/[^"']+\.(m3u8|mp4|urlset)[^"']*)["']/i,
    /sources:\s*["']([A-Za-z0-9+/=]{20,})["']/,
    /["']?file["']?\s*:\s*["'](https?:\/\/[^"']+)["']/i,
    /https?:\/\/[^"'\s<>|]+\.(m3u8|mp4|urlset)(?:[^"'\s<>|]*)?/gi
  ];

  for (const p of patterns) {
    const match = cleanHtml.match(p);
    if (match) {
      if (p.source.includes('sources') && !p.global) {
        try {
          const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
          const sources = JSON.parse(decoded);
          if (Array.isArray(sources)) sources.forEach((s: any) => { if (s.file) videos.push({ name: s.label || 'Video', url: s.file }); });
        } catch (e) { }
      } else {
        const links = p.global ? (match as string[]) : [match[1]];
        links.forEach((link: string) => {
          if (link && link.includes('http') && !link.includes('staticmoly') && !link.includes('hotjar') && !link.includes('analytics')) {
            const isMaster = link.includes('master.m3u8') || link.includes('.urlset');
            videos.push({ name: isMaster ? 'Vidmoly HD' : 'Video', url: link });
          }
        });
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
    const idMatch = videoUrl.match(/\/(?:v|e|embed-|embed\/)?([a-zA-Z0-9]{8,15})/);
    if (idMatch) id = idMatch[1];
    
    let html = '';
    let statusLog = '';

    if (id && videoUrl.includes('vidmoly')) {
      // 1. EL ARMA DEFINITIVA: JINA READER API
      // Jina es un motor de lectura que Vidmoly no suele bloquear porque parece un bot de IA legítimo.
      try {
        const jinaUrl = `https://r.jina.ai/https://vidmoly.me/e/${id}`;
        console.log('Intentando Túnel Jina:', jinaUrl);
        const res = await fetch(jinaUrl, {
           headers: { 'X-Return-Format': 'html' } // Forzamos que nos devuelva el HTML
        });
        if (res.ok) {
          const text = await res.text();
          if (text && (text.includes('vidmoly') || text.includes('file:'))) {
            html = text;
            statusLog = 'Exito vía Jina Tunnel';
          }
        }
      } catch (e) {}

      // 2. FALLBACK: GOOGLE TRANSLATE (Si Jina falla)
      if (!html) {
        try {
          const googleProxy = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(`https://vidmoly.me/e/${id}`)}`;
          const res = await fetch(googleProxy);
          if (res.ok) {
            const text = await res.text();
            if (text && text.includes('vidmoly')) {
              html = text;
              statusLog = 'Exito vía Google Tunnel';
            }
          }
        } catch (e) {}
      }
    }

    if (!html) {
      return NextResponse.json({ 
        error: 'Vidmoly ha bloqueado todos los túneles de acceso.', 
        debug: { id, status: 'Muro de Cloudflare impenetrable' } 
      }, { status: 403 });
    }

    const videos = await processHtml(html);

    if (videos.length === 0) {
      return NextResponse.json({ 
        error: 'Se saltó el bloqueo pero no se encontró el video.', 
        debug: { id, log: statusLog, html_snippet: html.substring(0, 500) } 
      }, { status: 404 });
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
