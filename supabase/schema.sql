-- Cat Runner - Supabase Schema
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_name);

-- Enable Row Level Security
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read scores (public leaderboard)
CREATE POLICY "Anyone can view scores"
  ON scores FOR SELECT
  USING (true);

-- Allow anyone to insert scores (no auth required)
CREATE POLICY "Anyone can insert scores"
  ON scores FOR INSERT
  WITH CHECK (true);
