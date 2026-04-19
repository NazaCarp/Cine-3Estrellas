export interface Movie {
  id: number;
  title: string;
  poster_path: string;
  backdrop_path?: string;
  release_date?: string;
  genre_ids: number[];
  created_at: string;
  vote_average: number;
  popularity: number;
  keywords: string[];
  overview?: string;
  runtime?: number;
  genres_names?: string[];
  quality?: string;
  versions?: Record<string, string>;
  certification?: string;
  languages?: string[];
  similar?: Movie[];
  origin_country?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  order: number;
  genre_ids: number[];
  keywords: string[];
  min_rating: number;
  sort_by: string;
  max_items: number;
  // Metadata for sorting
  newest_content_date?: string;
  movies?: Movie[];
  total_movies?: number;
}
