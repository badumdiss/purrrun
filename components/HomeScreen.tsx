"use client";

import { useState, useEffect, useRef } from "react";
import { buildSpriteCache, CAT_RUN_A, CAT_RUN_B, CAT_JUMP } from "@/lib/game/sprites";

interface Props {
  onStart: (name: string) => void;
  onLeaderboard: () => void;
}

// ── Tiny pixel-art cat that runs from the left and jumps onto the Start button
// Canvas is 320×44 px (the full card width), cat sprite is 32×28 (scale 2).
// The cat faces RIGHT (flipped) and lands roughly centred over the button.
function TinyRunningCat({ pouncing }: { pouncing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pounceRef = useRef(pouncing);
  pounceRef.current = pouncing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const CAT_W = 32, CAT_H = 28;
    const CANVAS_W = canvas.width;
    const GROUND_Y = canvas.height - CAT_H; // y of cat top when on "ground"

    const runFrames = [
      buildSpriteCache(CAT_RUN_A, 2),
      buildSpriteCache(CAT_RUN_B, 2),
    ];
    const jumpSprite = buildSpriteCache(CAT_JUMP, 2);

    // Target x: roughly centred in the canvas (lands on the button area)
    const TARGET_X = CANVAS_W / 2 - CAT_W / 2;

    let catX = -CAT_W - 10;
    let catY = GROUND_Y;
    let catVY = 0;
    let phase: "running" | "jumping" | "idle" = "running";
    let runIdx = 0;
    let runTimer = 0;
    let lastTs = -1;
    let rafId: number;

    const drawSprite = (sprite: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, CANVAS_W, canvas.height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // Flip horizontally so cat faces right
      ctx.translate(catX + CAT_W, catY);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0, CAT_W, CAT_H);
      ctx.restore();
    };

    const animate = (ts: number) => {
      if (lastTs < 0) lastTs = ts;
      const dt = Math.min(ts - lastTs, 50);
      lastTs = ts;

      if (pounceRef.current && phase === "idle") {
        // Quick leap off-screen to the right
        catX += 6 * (dt / 16);
        catVY += 1.0 * (dt / 16);
        catY += catVY * (dt / 16);
        if (catY > canvas.height + 10) { cancelAnimationFrame(rafId); return; }
        drawSprite(jumpSprite);
        rafId = requestAnimationFrame(animate);
        return;
      }

      if (phase === "running") {
        catX += 3.5 * (dt / 16);
        runTimer += dt;
        if (runTimer > 110) { runIdx = (runIdx + 1) % 2; runTimer = 0; }
        if (catX >= TARGET_X - 20) {
          phase = "jumping";
          catVY = -7;
        }
        drawSprite(runFrames[runIdx]);
      } else if (phase === "jumping") {
        catX += 1.5 * (dt / 16);
        catVY += 0.9 * (dt / 16);
        catY += catVY * (dt / 16);
        if (catY >= GROUND_Y && catVY > 0) {
          catY = GROUND_Y;
          catVY = 0;
          catX = TARGET_X;
          phase = "idle";
        }
        drawSprite(jumpSprite);
      } else {
        // Idle: slow blink between frames
        runTimer += dt;
        if (runTimer > 450) { runIdx = (runIdx + 1) % 2; runTimer = 0; }
        drawSprite(runFrames[runIdx]);
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount; pounce is read via ref

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={44}
      style={{ imageRendering: "pixelated", width: 320, height: 44, display: "block" }}
    />
  );
}

// ── Starfield ────────────────────────────────────────────────────────────────
function Stars() {
  const stars = Array.from({ length: 80 }, (_, i) => ({
    x: (i * 37 + 13) % 100,
    y: (i * 53 + 7)  % 70,
    r: i % 3 === 0 ? 1.5 : 1,
    o: 0.4 + (i % 5) * 0.1,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top:  `${s.y}%`,
            width:  s.r * 2,
            height: s.r * 2,
            opacity: s.o,
          }}
        />
      ))}
    </div>
  );
}

// ── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ onStart, onLeaderboard }: Props) {
  const [name, setName]         = useState("");
  const [pouncing, setPouncing] = useState(false);
  const [error, setError]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore saved name
  useEffect(() => {
    const saved = localStorage.getItem("catRunnerPlayerName");
    if (saved) setName(saved);
    inputRef.current?.focus();
  }, []);

  const handleStart = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name to start!");
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or less");
      return;
    }
    setError("");
    localStorage.setItem("catRunnerPlayerName", trimmed);
    setPouncing(true);
    setTimeout(() => onStart(trimmed), 700);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleStart();
  };

  return (
    <div className="relative min-h-screen bg-[#06040f] flex flex-col items-center justify-center overflow-hidden">
      <Stars />

      {/* Moon */}
      <div
        className="absolute top-10 right-16 w-16 h-16 rounded-full"
        style={{ background: "#fffde7", boxShadow: "0 0 30px 10px rgba(255,253,231,0.3)" }}
      >
        <div className="absolute top-1 right-1 w-12 h-12 rounded-full" style={{ background: "#06040f" }} />
      </div>

      {/* Title */}
      <div className="relative z-10 text-center mb-4">
        <h1
          className="text-5xl md:text-6xl font-black font-mono tracking-tight"
          style={{
            color: "#ff8c00",
            textShadow: "0 0 30px rgba(255,140,0,0.6), 0 0 60px rgba(255,140,0,0.3)",
          }}
        >
          PURR-RUN
        </h1>
        <p className="text-purple-400 font-mono text-sm tracking-widest mt-1 opacity-80">
          — the cat side-scroller —
        </p>
      </div>

      {/* Glass card */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 rounded-2xl p-6"
        style={{
          background: "rgba(20,5,40,0.7)",
          border: "1px solid rgba(120,50,200,0.4)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 0 40px rgba(120,50,200,0.2)",
        }}
      >
        <label className="block text-purple-300 font-mono text-sm mb-2 tracking-wide">
          Your name, adventurer:
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={handleKeyDown}
          maxLength={20}
          placeholder="e.g. Whiskers McGee"
          className="w-full bg-black/40 border border-purple-700 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors mb-1"
        />
        {error && <p className="text-red-400 font-mono text-xs mb-2">{error}</p>}

        {/* Tiny cat runs from left and lands on the button */}
        <div className="mt-3 flex justify-center overflow-hidden" style={{ height: 44 }}>
          <TinyRunningCat pouncing={pouncing} />
        </div>

        <button
          onClick={handleStart}
          disabled={pouncing}
          className={`relative w-full py-3.5 rounded-xl font-black font-mono text-lg tracking-wide transition-all duration-200
            ${pouncing
              ? "opacity-50 cursor-not-allowed bg-orange-800"
              : "bg-orange-600 hover:bg-orange-500 active:scale-95 hover:shadow-[0_0_20px_rgba(255,140,0,0.5)]"
            } text-white`}
        >
          {pouncing ? "🐱 pouncing…" : "🐾 START GAME"}
        </button>

        <button
          onClick={onLeaderboard}
          className="w-full mt-2 py-2.5 rounded-xl font-bold font-mono text-sm border border-purple-700 text-purple-300 hover:bg-purple-900/30 active:scale-95 transition-all"
        >
          🏆 See Leaderboard
        </button>

        <div className="mt-4 pt-4 border-t border-purple-900/50 grid grid-cols-3 gap-2 text-center">
          {[
            { key: "SPACE/↑",    desc: "jump" },
            { key: "SPACE/↑ ×2", desc: "double jump" },
            { key: "↓",          desc: "crouch" },
          ].map(({ key, desc }) => (
            <div key={key}>
              <div className="text-orange-400 font-mono text-xs font-bold bg-black/40 rounded px-1 py-0.5 mb-1">
                {key}
              </div>
              <div className="text-gray-500 font-mono text-xs">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="relative z-10 mt-6 text-gray-700 font-mono text-xs">
        jump over evil mice · crouch under dogs · rack up distance
      </p>
    </div>
  );
}
