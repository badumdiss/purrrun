import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Score {
  id: string;
  player_name: string;
  score: number;
  played_at: string;
}

export interface LeaderboardEntry {
  player_name: string;
  high_score: number;
}
