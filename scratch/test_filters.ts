import { fetchMoviesByGenre } from '../src/lib/data';
import { Movie } from '../src/types';

async function test() {
  console.log('Testing Stars Filter (8+)...');
  const { movies, count } = await fetchMoviesByGenre([878], 1, 10, 'popularity', '8', 'all');
  console.log(`Count: ${count}`);
  movies.forEach((m: Movie) => {
    console.log(`${m.title}: ${m.vote_average}`);
  });
}

test();
