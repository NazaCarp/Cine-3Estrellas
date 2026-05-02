/**
 * Extracts quality information from a version URL or object.
 */
export function extractQuality(val: any): string {
  if (!val) return 'HD';
  
  const urlStr = typeof val === 'object' ? String(val.url || '').toUpperCase() : String(val).toUpperCase();
  
  if (urlStr.includes('QUALITY=4K')) return '4K';
  if (urlStr.includes('QUALITY=1080P')) return '1080p';
  if (urlStr.includes('QUALITY=720P')) return '720p';
  if (urlStr.includes('QUALITY=HD')) return 'HD';
  if (urlStr.includes('QUALITY=TS')) return 'TS';
  if (urlStr.includes('QUALITY=CAM')) return 'CAM';
  
  return 'HD'; // Default fallback
}

/**
 * Calculates the best available quality from a set of movie versions.
 */
export function calculateMaxQuality(versions: Record<string, any> | undefined): string {
  if (!versions || Object.keys(versions).length === 0) return 'HD';
  
  const qualities = Object.values(versions).map(extractQuality);
  
  const priority = ['4K', '1080p', 'HD', '720p', 'TS', 'CAM'];
  for (const p of priority) {
    if (qualities.includes(p)) return p;
  }
  
  return 'HD';
}

/**
 * Normalizes certification strings to a standard format (e.g., 7+, 13+, 18+).
 */
export function normalizeCertification(c: string | undefined): string {
  if (!c) return 'TP';
  const upper = c.toUpperCase().trim();
  if (!upper || upper === 'NR' || upper === 'NOT RATED') return 'TP';
  
  if (['R', 'NC-17', '18'].includes(upper)) return '18+';
  if (['PG-13', '15', '12', '13', '14'].includes(upper)) return '13+';
  if (['PG', '7', '10', 'P'].includes(upper)) return '7+';
  if (['G', 'U', 'TP', 'A', 'GEN'].includes(upper)) return 'TP';
  
  // If it's just a number, add +
  if (/^\d+$/.test(upper)) return `${upper}+`;
  
  return upper;
}

/**
 * Prepares a video URL for playback in an iframe.
 * Specifically converts Vidmoly standard links to their embed counterparts.
 */
export function preparePlayerUrl(url: string): string {
  if (!url) return '';
  
  // Handle Vidmoly (me, biz, etc.)
  if (url.includes('vidmoly.') && (url.includes('/v/') || url.includes('/embed-'))) {
    const idMatch = url.match(/(?:\/v\/|embed-)([a-zA-Z0-9]+)/);
    if (idMatch) {
      const id = idMatch[1];
      const domainMatch = url.match(/vidmoly\.[a-z]+/);
      const domain = domainMatch ? domainMatch[0] : 'vidmoly.me';
      return `https://${domain}/embed-${id}.html`;
    }
  }
  
  // Add other transformations here if needed (e.g. ok.ru, etc.)
  
  return url;
}

