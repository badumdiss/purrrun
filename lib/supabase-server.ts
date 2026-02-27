import { createClient } from "@supabase/supabase-js";

export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Prefer service role key (bypasses RLS); fall back to anon key so the
  // leaderboard still works on Vercel even if SUPABASE_SERVICE_ROLE_KEY is
  // missing — RLS policies already allow public SELECT and INSERT.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, key);
}
