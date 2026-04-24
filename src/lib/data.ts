import { supabase } from './supabase';
import { Movie, Category } from '@/types';

export async function fetchHomeData(): Promise<Category[]> {
  try {
    // 1. Fetch active categories
    const { data: categoryData, error: catError } = await supabase
      .from('home_categories')
      .select('*')
      .eq('show_in_home', true)
      .order('order', { ascending: true });

    if (catError) throw catError;
    if (!categoryData) return [];

    const categories: Category[] = categoryData;

    // 2. Fetch movies for each category
    const categoriesWithMovies = await Promise.all(
      categories.map(async (cat) => {
        let query = supabase
          .from('movies')
          .select('*, backdrop_path, release_date')
          .gte('vote_average', cat.min_rating)
          .limit(Math.max(60, cat.max_items || 20));

        // Filter by genre_ids if present
        if (cat.genre_ids && cat.genre_ids.length > 0) {
          query = query.overlaps('genre_ids', cat.genre_ids);
        }

        // Filter by keywords if present
        if (cat.keywords && cat.keywords.length > 0) {
          query = query.overlaps('keywords', cat.keywords);
        }

        // Apply category sorting preference
        if (cat.sort_by === 'created_at') {
          query = query.order('created_at', { ascending: false });
        } else if (cat.sort_by === 'popularity') {
          query = query.order('popularity', { ascending: false });
        } else if (cat.sort_by === 'vote_average') {
          query = query.order('vote_average', { ascending: false });
        }

        // Also fetch total count for this category
        let countQuery = supabase
          .from('movies')
          .select('*', { count: 'exact', head: true })
          .gte('vote_average', cat.min_rating);

        if (cat.genre_ids && cat.genre_ids.length > 0) {
          countQuery = countQuery.overlaps('genre_ids', cat.genre_ids);
        }
        if (cat.keywords && cat.keywords.length > 0) {
          countQuery = countQuery.overlaps('keywords', cat.keywords);
        }

        const [{ data: movieData, error: movieError }, { count: totalCount }] = await Promise.all([
          query,
          countQuery
        ]);

        if (movieError) {
          console.error(`Error fetching movies for category ${cat.name}:`, movieError);
          return { ...cat, movies: [], newest_content_date: '' };
        }

        // Calculate newest content date for this category
        const newestDate = movieData && movieData.length > 0
          ? movieData.reduce((max, m) => (m.created_at > max ? m.created_at : max), movieData[0].created_at)
          : '';

        return {
          ...cat,
          movies: movieData || [],
          newest_content_date: newestDate,
          total_movies: totalCount || (movieData?.length || 0)
        };
      })
    );

    // 3. Sort categories by newest_content_date (most recently added content first)
    // We treat empty dates as very old.
    const sortedCategories = categoriesWithMovies.sort((a, b) => {
      const dateA = a.newest_content_date || '0000-00-00';
      const dateB = b.newest_content_date || '0000-00-00';
      return dateB.localeCompare(dateA);
    });

    // 4. Force specific positions for "Recién Agregadas" and "Lo Más Visto"
    let results = [...sortedCategories];

    // Move "Recién Agregadas" to index 0
    const recIdx = results.findIndex(c => c.name.toLowerCase() === 'recién agregadas');
    if (recIdx !== -1) {
      const [rec] = results.splice(recIdx, 1);
      results.unshift(rec);
    }

    // Move "Lo Más Visto" to index 1 (or 0 if "Recién Agregadas" wasn't found)
    const mosIdx = results.findIndex(c => c.name.toLowerCase() === 'lo más visto');
    if (mosIdx !== -1) {
      const [mos] = results.splice(mosIdx, 1);
      const hasRec = results.some(c => c.name.toLowerCase() === 'recién agregadas');
      const targetIdx = hasRec ? 1 : 0;
      results.splice(targetIdx, 0, mos);
    }

    // 5. Deduplicate movies across categories (prioritize unique items)
    const seenMovieIds = new Set<string>();

    const deduplicatedResults: Category[] = results.map((category): Category => {
      if (!category.movies || category.movies.length === 0) {
        return { ...category, movies: [] };
      }

      const uniqueMovies: Movie[] = [];
      const duplicateMovies: Movie[] = [];

      for (const m of category.movies) {
        if (!seenMovieIds.has(String(m.id))) {
          uniqueMovies.push(m);
          seenMovieIds.add(String(m.id));
        } else {
          duplicateMovies.push(m);
        }
      }

      // Combine: uniques first, then duplicates. 
      // We now keep up to 60 items so the Grid can show "Shadow" movies immediately.
      const initialBatchLimit = 60;
      const combined = [...uniqueMovies, ...duplicateMovies].slice(0, initialBatchLimit);

      return {
        ...category,
        movies: combined
      };
    });

    // 6. Enrich "Lo Más Visto" with TMDB Overviews (for Hero)
    const finalMosIdx = deduplicatedResults.findIndex(c => c.name.toLowerCase() === 'lo más visto');
    if (finalMosIdx !== -1) {
      const mos = deduplicatedResults[finalMosIdx];
      const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      if (TMDB_API_KEY && mos.movies && mos.movies.length > 0) {
        // Only enrich top 10 to keep it fast
        const moviesToEnrich = mos.movies.slice(0, 10);
        const enrichedMovies = await Promise.all(
          moviesToEnrich.map(async (movie) => {
            // Extraer la máxima verdadera calidad desde la base de datos
            let maxQuality = 'HD';
            if (movie.versions) {
              const allStr = Object.values(movie.versions).join(' ').toUpperCase();
              if (allStr.includes('QUALITY=4K')) maxQuality = '4K';
              else if (allStr.includes('QUALITY=1080P') || allStr.includes('QUALITY=HD')) maxQuality = 'HD';
              else if (allStr.includes('QUALITY=720P')) maxQuality = '720p';
              else if (allStr.includes('QUALITY=TS')) maxQuality = 'TS';
              else if (allStr.includes('QUALITY=CAM')) maxQuality = 'CAM';
            }

            try {
              const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=translations`);
              if (!res.ok) return { ...movie, quality: maxQuality };
              const data = await res.json();

              // Fallback logic for enrichment
              let bestOverview = data.overview || '';
              if (!bestOverview && data.translations?.translations) {
                const trans = data.translations.translations;
                bestOverview =
                  trans.find((t: any) => t.iso_639_1 === 'es' && t.iso_3166_1 === 'MX')?.data?.overview ||
                  trans.find((t: any) => t.iso_639_1 === 'es' && t.iso_3166_1 === 'ES')?.data?.overview ||
                  trans.find((t: any) => t.iso_639_1 === 'es')?.data?.overview ||
                  trans.find((t: any) => t.iso_639_1 === 'en')?.data?.overview ||
                  '';
              }

              return {
                ...movie,
                overview: bestOverview,
                // If backdrop is missing in DB, get it from TMDB
                backdrop_path: movie.backdrop_path || data.backdrop_path,
                runtime: data.runtime,
                genres_names: data.genres?.map((g: { name: string }) => g.name) || [],
                quality: maxQuality
              };
            } catch (e) {
              return { ...movie, quality: maxQuality };
            }
          })
        );
        // Replace enriched movies back into the category
        mos.movies = [
          ...enrichedMovies,
          ...mos.movies.slice(10)
        ];
      }
    }

    return deduplicatedResults;
  } catch (err) {
    console.error('Error fetching home data:', err);
    return [];
  }
}

export async function searchMovies(query: string, page: number = 1, pageSize: number = 60): Promise<{ movies: Movie[], count: number }> {
  if (!query || query.trim().length === 0) return { movies: [], count: 0 };

  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: movieData, error, count } = await supabase
      .from('movies')
      .select('*, backdrop_path, release_date', { count: 'exact' })
      .ilike('title', `%${query}%`)
      .order('popularity', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!movieData) return { movies: [], count: 0 };

    // Enrich with quality info
    const enrichedMovies = movieData.map(movie => {
      let maxQuality = 'HD';
      if (movie.versions) {
        const allStr = Object.values(movie.versions).join(' ').toUpperCase();
        if (allStr.includes('QUALITY=4K')) maxQuality = '4K';
        else if (allStr.includes('QUALITY=1080P') || allStr.includes('QUALITY=HD')) maxQuality = 'HD';
        else if (allStr.includes('QUALITY=720P')) maxQuality = '720p';
        else if (allStr.includes('QUALITY=TS')) maxQuality = 'TS';
        else if (allStr.includes('QUALITY=CAM')) maxQuality = 'CAM';
      }
      return { ...movie, quality: maxQuality };
    });

    return { movies: enrichedMovies, count: count || 0 };
  } catch (err) {
    console.error('Error searching movies:', err);
    return { movies: [], count: 0 };
  }
}

export async function fetchMoviesByGenre(
  genreIds: number[],
  page: number = 1,
  pageSize: number = 60,
  sortBy: string = 'popularity',
  starsFilter: string = 'all',
  yearFilter: string = 'all'
): Promise<{ movies: Movie[], count: number }> {
  if (!genreIds || genreIds.length === 0) return { movies: [], count: 0 };

  try {
    let query = supabase
      .from('movies')
      .select('*, backdrop_path, release_date', { count: 'exact' })
      .overlaps('genre_ids', genreIds);

    // Stars Logic
    if (starsFilter && starsFilter !== 'all') {
      const minStars = parseFloat(starsFilter);
      if (!isNaN(minStars)) {
        query = query.filter('vote_average', 'gte', minStars);
      }
    }

    // Year Logic
    if (yearFilter && yearFilter !== 'all') {
      if (yearFilter === 'classic') {
        query = query.filter('release_date', 'lt', '2000-01-01');
      } else if (yearFilter === '2000') {
        query = query.filter('release_date', 'gte', '2000-01-01')
          .filter('release_date', 'lt', '2010-01-01');
      } else {
        const minYear = parseInt(yearFilter);
        if (!isNaN(minYear)) {
          query = query.filter('release_date', 'gte', `${minYear}-01-01`);
        }
      }
    }

    // Sort Logic
    if (sortBy === 'vote_average') {
      query = query.order('vote_average', { ascending: false });
    } else if (sortBy === 'release_date') {
      query = query.order('release_date', { ascending: false });
    } else if (sortBy === 'title') {
      query = query.order('title', { ascending: true, nullsFirst: false });
    } else {
      query = query.order('popularity', { ascending: false });
    }

    // Pagination Logic
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: movieData, error, count } = await query.range(from, to);

    if (error) {
      console.error('Supabase error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    if (!movieData) return { movies: [], count: 0 };

    // Enrich with quality/metadata info
    const enrichedMovies = movieData.map(movie => {
      let maxQuality = 'HD';
      if (movie.versions) {
        const allStr = Object.values(movie.versions).join(' ').toUpperCase();
        if (allStr.includes('QUALITY=4K')) maxQuality = '4K';
        else if (allStr.includes('QUALITY=1080P') || allStr.includes('QUALITY=HD')) maxQuality = 'HD';
        else if (allStr.includes('QUALITY=720P')) maxQuality = '720p';
        else if (allStr.includes('QUALITY=TS')) maxQuality = 'TS';
        else if (allStr.includes('QUALITY=CAM')) maxQuality = 'CAM';
      }
      return { ...movie, quality: maxQuality };
    });

    return { movies: enrichedMovies, count: count || 0 };
  } catch (err) {
    console.error('Error fetching movies by genre:', JSON.stringify(err, null, 2) || err);
    return { movies: [], count: 0 };
  }
}

export async function fetchMoviesByCategory(
  category: Category,
  page: number = 1,
  pageSize: number = 60
): Promise<{ movies: Movie[], count: number }> {
  try {
    let query = supabase
      .from('movies')
      .select('*, backdrop_path, release_date', { count: 'exact' })
      .gte('vote_average', category.min_rating || 0);

    // Filter by genre_ids if present
    if (category.genre_ids && category.genre_ids.length > 0) {
      query = query.overlaps('genre_ids', category.genre_ids);
    }

    // Filter by keywords if present
    if (category.keywords && category.keywords.length > 0) {
      query = query.overlaps('keywords', category.keywords);
    }

    // Apply category sorting preference
    if (category.sort_by === 'created_at') {
      query = query.order('created_at', { ascending: false });
    } else if (category.sort_by === 'popularity') {
      query = query.order('popularity', { ascending: false });
    } else if (category.sort_by === 'vote_average') {
      query = query.order('vote_average', { ascending: false });
    } else {
      query = query.order('popularity', { ascending: false });
    }

    // Pagination Logic
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: movieData, error, count } = await query.range(from, to);

    if (error) {
      console.error(`Error fetching movies for category ${category.name}:`, error);
      throw error;
    }

    if (!movieData) return { movies: [], count: 0 };

    // Enrich with quality info
    const enrichedMovies = movieData.map(movie => {
      let maxQuality = 'HD';
      if (movie.versions) {
        const allStr = Object.values(movie.versions).join(' ').toUpperCase();
        if (allStr.includes('QUALITY=4K')) maxQuality = '4K';
        else if (allStr.includes('QUALITY=1080P') || allStr.includes('QUALITY=HD')) maxQuality = 'HD';
        else if (allStr.includes('QUALITY=720P')) maxQuality = '720p';
        else if (allStr.includes('QUALITY=TS')) maxQuality = 'TS';
        else if (allStr.includes('QUALITY=CAM')) maxQuality = 'CAM';
      }
      return { ...movie, quality: maxQuality };
    });

    return { movies: enrichedMovies, count: count || 0 };
  } catch (err) {
    console.error(`Error in fetchMoviesByCategory for ${category.name}:`, err);
    return { movies: [], count: 0 };
  }
}
