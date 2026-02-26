"use client";

import { useEffect, useState } from "react";
import { LeaderboardEntry } from "@/lib/supabase";

interface Props {
  onBack: () => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ onBack }: Props) {
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    fetch("/api/scores")
      .then((r) => r.json())
      .then((data) => setEntries(data.leaderboard ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative min-h-screen bg-[#06040f] flex flex-col items-center justify-center overflow-hidden px-4">
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 60 }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left:    `${(i * 37 + 13) % 100}%`,
              top:     `${(i * 53 + 7)  % 70}%`,
              width:   i % 3 === 0 ? 3 : 2,
              height:  i % 3 === 0 ? 3 : 2,
              opacity: 0.4 + (i % 5) * 0.1,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-8"
        style={{
          background:    "rgba(20,5,40,0.85)",
          border:        "1px solid rgba(120,50,200,0.45)",
          backdropFilter:"blur(12px)",
          boxShadow:     "0 0 50px rgba(120,50,200,0.25)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2
            className="text-3xl font-black font-mono"
            style={{
              color:      "#ff8c00",
              textShadow: "0 0 20px rgba(255,140,0,0.5)",
            }}
          >
            🏆 LEADERBOARD
          </h2>
          <p className="text-purple-400 font-mono text-xs mt-1 tracking-widest opacity-70">
            top 10 runners
          </p>
        </div>

        {/* Table */}
        {loading && (
          <p className="text-center text-purple-400 font-mono text-sm py-8 animate-pulse">
            fetching scores…
          </p>
        )}

        {error && !loading && (
          <p className="text-center text-red-400 font-mono text-sm py-8">
            couldn&apos;t load scores — check your Supabase setup
          </p>
        )}

        {!loading && !error && entries.length === 0 && (
          <p className="text-center text-gray-600 font-mono text-sm py-8">
            no scores yet — be the first! 🐱
          </p>
        )}

        {!loading && !error && entries.length > 0 && (
          <ol className="space-y-2">
            {entries.map((entry, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg px-4 py-2.5 transition-colors"
                style={{
                  background: i === 0
                    ? "rgba(255,215,0,0.08)"
                    : i === 1
                    ? "rgba(192,192,192,0.07)"
                    : i === 2
                    ? "rgba(205,127,50,0.07)"
                    : "rgba(255,255,255,0.03)",
                  border: i < 3
                    ? `1px solid rgba(255,140,0,${0.25 - i * 0.06})`
                    : "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {/* Rank */}
                <span className="font-mono text-base w-8 shrink-0">
                  {i < 3 ? MEDALS[i] : (
                    <span className="text-gray-600 text-sm">{i + 1}.</span>
                  )}
                </span>

                {/* Name */}
                <span
                  className="flex-1 font-mono font-bold text-sm truncate"
                  style={{ color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "#d4b8ff" }}
                >
                  {entry.player_name}
                </span>

                {/* Score */}
                <span
                  className="font-mono font-bold text-sm shrink-0"
                  style={{ color: "#00ff41", textShadow: "0 0 8px rgba(0,255,65,0.4)" }}
                >
                  {entry.high_score.toLocaleString()} m
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* Back button */}
        <button
          onClick={onBack}
          className="mt-8 w-full py-3 rounded-xl font-bold font-mono text-base border border-purple-600 text-purple-300 hover:bg-purple-900/30 active:scale-95 transition-all"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
