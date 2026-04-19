"use server";

import { Movie } from '@/types';
import { calculateMaxQuality, normalizeCertification } from '@/lib/utils';

/**
 * Server Action to fetch movie details.
 * This ensures TMDB_API_KEY is available and hide from client.
 */
export async function getMovieDetailAction(movie: Movie): Promise<Movie> {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY missing in Server Action");
    return movie;
  }

  try {
    const [tmdbRes, releaseRes, similarRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=translations`),
      fetch(`https://api.themoviedb.org/3/movie/${movie.id}/release_dates?api_key=${TMDB_API_KEY}`),
      fetch(`https://api.themoviedb.org/3/movie/${movie.id}/similar?api_key=${TMDB_API_KEY}&language=es-MX`)
    ]);

    if (!tmdbRes.ok) throw new Error("TMDB Main Fetch Failed");

    const tmdbData = await tmdbRes.json();
    const releaseData = await releaseRes.json();
    const similarData = await similarRes.json();

    // Language fallback logic for Overview
    let bestOverview = tmdbData.overview || '';
    if (!bestOverview && tmdbData.translations?.translations) {
      const trans = tmdbData.translations.translations;
      // Priorizar MX > ES > cualquier ES > EN > primero disponible
      const fallback =
        trans.find((t: any) => t.iso_639_1 === 'es' && t.iso_3166_1 === 'MX')?.data?.overview ||
        trans.find((t: any) => t.iso_639_1 === 'es' && t.iso_3166_1 === 'ES')?.data?.overview ||
        trans.find((t: any) => t.iso_639_1 === 'es')?.data?.overview ||
        trans.find((t: any) => t.iso_639_1 === 'en')?.data?.overview ||
        '';
      bestOverview = fallback;
    }

    // Languages
    const languagesSet = new Set<string>();
    if (movie.versions) {
      Object.keys(movie.versions).forEach(v => {
        const langCode = v.split('_')[0].toUpperCase();
        if (langCode === 'LAT') languagesSet.add('Latino');
        else if (langCode === 'SPA' || langCode === 'ESP') languagesSet.add('Castellano');
        else if (langCode === 'SUB' || langCode === 'ENG') languagesSet.add('Subtitulado');
        else languagesSet.add(langCode);
      });
    }

    // Certification
    let certification = normalizeCertification(movie.certification);

    // Si ya tenemos una certificación válida en DB (que no sea TP o vacía), la respetamos
    if (!certification || certification === 'TP') {
      const releases = releaseData.results || [];
      const certPriority = ['MX', 'US', 'ES', 'AR', 'CA', 'BR'];
      for (const countryCode of certPriority) {
        const countryData = releases.find((r: any) => r.iso_3166_1 === countryCode);
        if (countryData && countryData.release_dates) {
          // Buscar la primera que no sea vacía o NR
          const validRelease = countryData.release_dates.find((rd: any) =>
            rd.certification && rd.certification.toUpperCase() !== 'NR' && rd.certification !== ''
          );

          if (validRelease) {
            certification = normalizeCertification(validRelease.certification);
            break;
          }
        }
      }
    }

    // Similar
    const similarMovies: Movie[] = (similarData.results || []).slice(0, 12).map((s: any) => ({
      id: s.id,
      title: s.title,
      poster_path: s.poster_path,
      backdrop_path: s.backdrop_path,
      vote_average: s.vote_average,
      release_date: s.release_date,
      genre_ids: s.genre_ids,
      created_at: new Date().toISOString()
    }));

    return {
      ...movie,
      overview: bestOverview || movie.overview,
      runtime: tmdbData.runtime || movie.runtime,
      genres_names: tmdbData.genres?.map((g: any) => g.name) || movie.genres_names,
      certification,
      languages: Array.from(languagesSet),
      similar: similarMovies,
      origin_country: tmdbData.origin_country?.[0] || tmdbData.production_countries?.[0]?.iso_3166_1 || 'US',
      quality: calculateMaxQuality(movie.versions)
    };
  } catch (error) {
    console.error('Action Detail Error:', error);
    return movie;
  }
}
