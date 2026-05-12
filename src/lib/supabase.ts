import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('--- DEBUG DE VARIABLES ---');
console.log('URL:', supabaseUrl ? 'Presente' : 'Faltante');
console.log('Key:', supabaseAnonKey ? 'Presente' : 'Faltante');
console.log('TMDB:', process.env.NEXT_PUBLIC_TMDB_API_KEY ? 'Presente' : 'Faltante');

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder-url.supabase.co', 'placeholder-key');
