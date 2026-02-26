import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("scores")
      .select("player_name, score")
      .order("score", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Aggregate: keep only the highest score per player
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      const existing = map.get(row.player_name) ?? 0;
      if (row.score > existing) map.set(row.player_name, row.score);
    }

    const leaderboard = Array.from(map.entries())
      .map(([player_name, high_score]) => ({ player_name, high_score }))
      .sort((a, b) => b.high_score - a.high_score)
      .slice(0, 10);

    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("GET /api/scores error:", err);
    return NextResponse.json({ leaderboard: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerName, score } = body as { playerName: string; score: number };

    if (!playerName || typeof score !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { error } = await supabase
      .from("scores")
      .insert({ player_name: playerName.trim(), score: Math.floor(score) });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/scores error:", err);
    return NextResponse.json({ error: "Failed to save score" }, { status: 500 });
  }
}
