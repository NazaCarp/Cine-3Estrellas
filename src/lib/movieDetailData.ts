import { supabase } from '../lib/supabase';
import { Movie } from '@/types';

/**
 * Fetches full details for a movie, including TMDB overview, runtime, certifications, 
 * languages (from our versions), and similar movies.
 */
export async function fetchFullMovieDetail(movie: Movie): Promise<Movie> {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_API_KEY) return movie;

  try {
    // 1. Fetch main movie data and release dates (for certifications) and similar movies from TMDB
    const [tmdbRes, releaseRes, similarRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=es-MX`),
      fetch(`https://api.themoviedb.org/3/movie/${movie.id}/release_dates?api_key=${TMDB_API_KEY}`),
      fetch(`https://api.themoviedb.org/3/movie/${movie.id}/similar?api_key=${TMDB_API_KEY}&language=es-MX`)
    ]);

    const tmdbData = await tmdbRes.json();
    const releaseData = await releaseRes.json();
    const similarData = await similarRes.json();

    // 2. Parse Languages from movie.versions (our DB info)
    const languagesSet = new Set<string>();
    if (movie.versions) {
      Object.keys(movie.versions).forEach(v => {
        const lang = v.split('_')[0].toUpperCase(); // e.g. "LAT", "SPA", "SUB"
        if (lang === 'LAT') languagesSet.add('Latino');
        else if (lang === 'SPA' || lang === 'ESP') languagesSet.add('Castellano');
        else if (lang === 'SUB' || lang === 'ENG') languagesSet.add('Subtitulado');
        else languagesSet.add(lang);
      });
    }

    // 3. Extract Certification (Age Rating) - Prefer MX or US
    let certification = 'TP'; // Todo Público default
    const releases = releaseData.results || [];
    const certPriority = ['MX', 'US', 'ES', 'AR'];
    
    for (const countryCode of certPriority) {
      const countryData = releases.find((r: any) => r.iso_3166_1 === countryCode);
      if (countryData && countryData.release_dates[0]?.certification) {
        const rawCert = countryData.release_dates[0].certification;
        // Map common ratings to understandable text
        if (rawCert === 'R' || rawCert === 'NC-17' || rawCert === '18') certification = '+18';
        else if (rawCert === 'PG-13' || rawCert === '15' || rawCert === '12') certification = '+13';
        else if (rawCert === 'PG' || rawCert === '7') certification = '+7';
        else if (rawCert === 'G' || rawCert === 'U') certification = 'TP';
        else certification = rawCert;
        break;
      }
    }

    // 4. Parse Similar Movies (map from TMDB to our Movie structure basics)
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
      overview: tmdbData.overview || movie.overview,
      runtime: tmdbData.runtime || movie.runtime,
      genres_names: tmdbData.genres?.map((g: any) => g.name) || movie.genres_names,
      certification,
      languages: Array.from(languagesSet),
      similar: similarMovies
    };
  } catch (error) {
    console.error('Error fetching full movie detail:', error);
    return movie;
  }
}
