"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GameEngine } from "@/lib/game/GameEngine";
import { LeaderboardEntry } from "@/lib/supabase";

// ── Off-white ghost cat flying around the game-over background ─────────────
function FlyingGhostCat() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const CAT_SIZE = 56;
    let catX = 80 + Math.random() * (W - CAT_SIZE - 160);
    let catY = 20 + Math.random() * (H - CAT_SIZE - 40);
    let catVX = (Math.random() > 0.5 ? 1 : -1) * (1.4 + Math.random() * 2.0);
    let catVY = (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.6);
    let facingRight = catVX > 0;

    let runFrames: HTMLCanvasElement[] = [];
    let frameIdx = 0;
    let frameTimer = 0;
    let loadedCount = 0;
    let rafId: number;
    let lastTs = -1;

    function buildGhostFrame(img: HTMLImageElement, srcX: number): HTMLCanvasElement {
      const tmp = document.createElement("canvas");
      tmp.width = tmp.height = CAT_SIZE;
      const tc = tmp.getContext("2d")!;
      tc.imageSmoothingEnabled = false;
      tc.drawImage(img, srcX, 0, 20, 20, 0, 0, CAT_SIZE, CAT_SIZE);
      // Tint off-white: overlay only where cat pixels exist
      tc.globalCompositeOperation = "source-atop";
      tc.fillStyle = "rgba(240, 237, 255, 0.72)";
      tc.fillRect(0, 0, CAT_SIZE, CAT_SIZE);
      return tmp;
    }

    function startAnim() {
      loadedCount++;
      if (loadedCount < 2) return;

      const animate = (ts: number) => {
        if (lastTs < 0) lastTs = ts;
        const dt = Math.min(ts - lastTs, 50);
        lastTs = ts;

        catX += catVX * (dt / 16);
        catY += catVY * (dt / 16);

        // Bounce off walls
        if (catX < 0) { catX = 0; catVX = Math.abs(catVX); facingRight = true; }
        if (catX + CAT_SIZE > W) { catX = W - CAT_SIZE; catVX = -Math.abs(catVX); facingRight = false; }
        if (catY < 0) { catY = 0; catVY = Math.abs(catVY); }
        if (catY + CAT_SIZE > H) { catY = H - CAT_SIZE; catVY = -Math.abs(catVY); }

        frameTimer += dt;
        if (frameTimer > 100) { frameIdx = (frameIdx + 1) % Math.max(1, runFrames.length); frameTimer = 0; }

        ctx.clearRect(0, 0, W, H);

        const frame = runFrames[frameIdx];
        if (!frame) { rafId = requestAnimationFrame(animate); return; }

        // Halo above cat
        const haloCX = catX + CAT_SIZE / 2;
        const haloY  = catY - CAT_SIZE * 0.08;
        ctx.save();
        ctx.strokeStyle = "rgba(255, 218, 40, 0.92)";
        ctx.lineWidth   = CAT_SIZE * 0.09;
        ctx.shadowColor = "rgba(255, 218, 40, 0.6)";
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.ellipse(haloCX, haloY, CAT_SIZE * 0.3, CAT_SIZE * 0.095, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Ghost cat (semi-transparent)
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.imageSmoothingEnabled = false;
        if (facingRight) {
          ctx.translate(catX + CAT_SIZE, catY);
          ctx.scale(-1, 1);
          ctx.drawImage(frame, 0, 0, CAT_SIZE, CAT_SIZE);
        } else {
          ctx.drawImage(frame, catX, catY, CAT_SIZE, CAT_SIZE);
        }
        ctx.restore();

        rafId = requestAnimationFrame(animate);
      };

      rafId = requestAnimationFrame(animate);
    }

    const walkImg = new Image();
    walkImg.onload = () => {
      const frames = walkImg.width / 20;
      for (let i = 0; i < frames; i++) runFrames.push(buildGhostFrame(walkImg, i * 20));
      startAnim();
    };
    walkImg.src = "/cats/Walk3.png";

    // Second load trigger (so loadedCount hits 2 when both are "ready")
    const stillImg = new Image();
    stillImg.onload = () => startAnim();
    stillImg.src = "/cats/Still.png";

    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
        pointerEvents: "none",
      }}
    />
  );
}

interface Props {
  playerName: string;
  onQuit: () => void;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
}

export default function CatGame({ playerName, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rafRef = useRef<number>(0);
  const isCrouchingRef = useRef(false);

  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/scores");
      const data: LeaderboardData = await res.json();
      setLeaderboard(data.leaderboard ?? []);
    } catch {
      // silent
    }
  }, []);

  const saveScore = useCallback(
    async (score: number) => {
      setSaving(true);
      try {
        await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName, score }),
        });
      } catch {
        // silent
      } finally {
        setSaving(false);
        fetchLeaderboard();
      }
    },
    [playerName, fetchLeaderboard]
  );

  const handleGameOver = useCallback(
    (score: number) => {
      setFinalScore(score);
      setGameOver(true);
      fetchLeaderboard(); // pre-populate immediately; saveScore also refreshes after POST
      saveScore(score);
    },
    [saveScore, fetchLeaderboard]
  );

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setGameOver(false);
    setFinalScore(0);
    setShowHint(true);
    isCrouchingRef.current = false;

    const engine = new GameEngine(canvas, handleGameOver);
    engineRef.current = engine;

    // Hide hint after 3s
    const hintTimer = setTimeout(() => setShowHint(false), 3000);

    const loop = (ts: number) => {
      engine.update(ts);
      if (engine.gameState === "playing") {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => clearTimeout(hintTimer);
  }, [handleGameOver]);

  // Key controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        engineRef.current?.jump();
      }
      if (e.code === "ArrowDown" && !isCrouchingRef.current) {
        e.preventDefault();
        isCrouchingRef.current = true;
        engineRef.current?.startCrouch();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") {
        isCrouchingRef.current = false;
        engineRef.current?.endCrouch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Touch controls for mobile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (dy > 30) {
        isCrouchingRef.current = true;
        engineRef.current?.startCrouch();
        setTimeout(() => {
          isCrouchingRef.current = false;
          engineRef.current?.endCrouch();
        }, 600);
      } else {
        engineRef.current?.jump();
      }
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // Mount: start game
  useEffect(() => {
    const cleanup = startGame();
    return () => {
      cancelAnimationFrame(rafRef.current);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestart = () => {
    cancelAnimationFrame(rafRef.current);
    startGame();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#06040f] select-none">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-4xl px-4 pb-3">
        <span className="text-purple-400 font-mono text-sm">
          playing as{" "}
          <span className="text-orange-400 font-bold">{playerName}</span>
        </span>
        <button
          onClick={onQuit}
          className="text-gray-500 hover:text-gray-300 font-mono text-sm transition-colors"
        >
          ← quit
        </button>
      </div>

      {/* Canvas wrapper */}
      <div className="relative w-full max-w-4xl">
        <canvas
          ref={canvasRef}
          width={900}
          height={300}
          className="w-full rounded-xl border border-purple-900 shadow-[0_0_40px_rgba(120,0,255,0.3)]"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Controls hint overlay */}
        {showHint && !gameOver && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2 text-xs font-mono pointer-events-none">
            <span className="bg-black/60 border border-purple-700 text-purple-300 px-2 py-1 rounded">
              <kbd className="text-orange-400">SPACE/↑</kbd> jump
            </span>
            <span className="bg-black/60 border border-purple-700 text-purple-300 px-2 py-1 rounded">
              <kbd className="text-orange-400">×2</kbd> double
            </span>
            <span className="bg-black/60 border border-purple-700 text-purple-300 px-2 py-1 rounded">
              <kbd className="text-orange-400">×3</kbd> triple
            </span>
            <span className="bg-black/60 border border-purple-700 text-purple-300 px-2 py-1 rounded">
              <kbd className="text-orange-400">↓</kbd> crouch
            </span>
          </div>
        )}

        {/* Game over overlay — fixed to viewport so it never gets clipped by the canvas box */}
        {gameOver && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(6,4,15,0.82)" }}
          >
            {/* Ghost cat flying across the full screen */}
            <FlyingGhostCat />
            <div className="relative z-10 bg-black/80 border border-purple-700 rounded-2xl p-8 text-center backdrop-blur-sm w-full max-w-sm mx-4 shadow-[0_0_40px_rgba(120,0,255,0.4)]">
              <h2 className="text-2xl font-bold text-red-400 font-mono mb-1">
                Game Over
              </h2>
              <p className="text-gray-400 font-mono text-sm mb-4">
                {playerName} ran{" "}
                <span className="text-orange-400 font-bold text-lg">
                  {finalScore} m
                </span>
              </p>

              {/* Mini leaderboard */}
              <div className="mb-5">
                <p className="text-purple-400 font-mono text-xs mb-2 uppercase tracking-wider">
                  Leaderboard
                </p>
                {saving && (
                  <p className="text-gray-500 font-mono text-xs mb-2">
                    saving score…
                  </p>
                )}
                {leaderboard.length === 0 && !saving && (
                  <p className="text-gray-600 font-mono text-xs">
                    no scores yet
                  </p>
                )}
                <ul className="space-y-1 max-h-36 overflow-y-auto">
                  {leaderboard.map((entry, i) => (
                    <li
                      key={i}
                      className={`flex justify-between font-mono text-xs px-2 py-0.5 rounded ${
                        entry.player_name === playerName
                          ? "bg-orange-900/40 text-orange-300"
                          : "text-gray-400"
                      }`}
                    >
                      <span>
                        {i + 1}. {entry.player_name}
                      </span>
                      <span className="text-green-400">
                        {entry.high_score} m
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRestart}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold font-mono py-2 rounded-lg transition-colors"
                >
                  Try Again 🐱
                </button>
                <button
                  onClick={onQuit}
                  className="flex-1 border border-purple-600 text-purple-300 hover:bg-purple-900/30 font-mono py-2 rounded-lg transition-colors"
                >
                  Quit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="mt-4 flex gap-4 md:hidden">
        <button
          onTouchStart={(e) => { e.preventDefault(); engineRef.current?.jump(); }}
          className="bg-orange-700 active:bg-orange-500 text-white font-bold font-mono px-8 py-4 rounded-xl text-lg select-none"
        >
          Jump
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); isCrouchingRef.current = true; engineRef.current?.startCrouch(); }}
          onTouchEnd={(e) => { e.preventDefault(); isCrouchingRef.current = false; engineRef.current?.endCrouch(); }}
          className="bg-purple-800 active:bg-purple-600 text-white font-bold font-mono px-8 py-4 rounded-xl text-lg select-none"
        >
          Crouch
        </button>
      </div>

      <p className="mt-3 text-gray-700 font-mono text-xs">
        avoid mice · crouch under dogs · survive
      </p>
    </div>
  );
}
