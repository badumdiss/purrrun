"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  onStart: (name: string) => void;
  onLeaderboard: () => void;
}

// ── PNG wandering cat above the Start button ──────────────────────────────────
// Uses Walk3.png (orange cat, 6 run frames) + Still.png (frame 1 = orange idle).
// The cat wanders erratically left/right, facing whichever way it's heading.
// When pouncing=true it grows and hops down onto the button.
function PngWanderCat({ pouncing }: { pouncing: boolean }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const pounceRef  = useRef(pouncing);
  pounceRef.current = pouncing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const CW = 320, CH = 72;
    const CAT_SZ  = 40;           // normal display size
    const FRAME_W = 20;            // source frame size (20×20 px each)
    const GROUND_Y = CH - CAT_SZ; // y of cat top when "on ground"

    const runFrames: HTMLCanvasElement[] = [];
    let   stillFrame: HTMLCanvasElement | null = null;
    let   loaded = 0;

    function buildFrame(img: HTMLImageElement, srcX: number, size: number): HTMLCanvasElement {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const cx = c.getContext("2d")!;
      cx.imageSmoothingEnabled = false;
      cx.drawImage(img, srcX, 0, FRAME_W, FRAME_W, 0, 0, size, size);
      return c;
    }

    function onReady() {
      loaded++;
      if (loaded < 2) return;

      // ── animation state ────────────────────────────────────────────────────
      let catX       = CW / 2 - CAT_SZ / 2;
      let catY       = GROUND_Y;
      let catVX      = (Math.random() > 0.5 ? 1 : -1) * (1.8 + Math.random() * 1.5);
      let catVY      = 0;
      let facingRight = catVX > 0;

      let runIdx       = 0;
      let runTimer     = 0;
      let dirTimer     = 0;
      let nextDir      = 700 + Math.random() * 1100;
      let hopTimer     = 0;
      let nextHop      = 1000 + Math.random() * 2200;
      let airborne     = false;
      let jumpCount    = 0;   // 0 = on ground, 1 = single, 2 = double
      let doubleTimer  = 0;   // time since first jump (for scheduling double jump)
      let willDouble   = false; // whether this hop will have a double jump

      // pounce phase: "wander" → "leap" → "done"
      let phase: "wander" | "leap" | "done" = "wander";
      let leapScale  = 1;
      let lastTs     = -1;
      let rafId: number;

      const ctx = (canvas as HTMLCanvasElement).getContext("2d")!;

      function drawCat(
        sprite: HTMLCanvasElement,
        x: number, y: number,
        size: number,
        faceRight: boolean,
      ) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (faceRight) {
          // Sprite faces LEFT naturally — flip to face right
          ctx.translate(x + size, y);
          ctx.scale(-1, 1);
          ctx.drawImage(sprite, 0, 0, size, size);
        } else {
          ctx.drawImage(sprite, x, y, size, size);
        }
        ctx.restore();
      }

      const animate = (ts: number) => {
        if (lastTs < 0) lastTs = ts;
        const dt = Math.min(ts - lastTs, 50);
        lastTs = ts;

        ctx.clearRect(0, 0, CW, CH);

        // ── trigger leap when button pressed ──────────────────────────────
        if (pounceRef.current && phase === "wander") {
          phase     = "leap";
          catVX     = 0;
          catVY     = -9;
          leapScale = 1;
          // face center
          facingRight = catX < CW / 2 - CAT_SZ / 2;
        }

        if (phase === "leap") {
          leapScale = Math.min(leapScale + 0.05 * (dt / 16), 1.8);
          catVY    += 0.85 * (dt / 16);
          catY     += catVY  * (dt / 16);
          const sz  = Math.round(CAT_SZ * leapScale);
          const landY = CH - sz;
          if (catY >= landY && catVY > 0) {
            catY  = landY;
            phase = "done";
          }
          // drift toward centre x
          const targetX = CW / 2 - sz / 2;
          catX += (targetX - catX) * 0.08 * (dt / 16);
          runTimer += dt;
          if (runTimer > 90) { runIdx = (runIdx + 1) % runFrames.length; runTimer = 0; }
          drawCat(runFrames[runIdx] ?? stillFrame!, catX, catY, sz, facingRight);
          rafId = requestAnimationFrame(animate);
          return;
        }

        if (phase === "done") {
          const sz = Math.round(CAT_SZ * leapScale);
          drawCat(stillFrame!, CW / 2 - sz / 2, CH - sz, sz, facingRight);
          rafId = requestAnimationFrame(animate);
          return;
        }

        // ── wander phase ──────────────────────────────────────────────────
        dirTimer += dt;
        hopTimer += dt;
        runTimer += dt;

        // Random direction change
        if (dirTimer >= nextDir) {
          dirTimer = 0;
          nextDir  = 600 + Math.random() * 1200;
          catVX    = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2.5);
          facingRight = catVX > 0;
        }

        // Occasional hop (50% chance of double jump)
        if (!airborne && hopTimer >= nextHop) {
          hopTimer    = 0;
          nextHop     = 1400 + Math.random() * 2800;
          airborne    = true;
          jumpCount   = 1;
          catVY       = -(5 + Math.random() * 3);
          willDouble  = Math.random() < 0.5;
          doubleTimer = 0;
        }

        // Gravity + double jump
        if (airborne) {
          doubleTimer += dt;
          // Trigger double jump ~200–350ms after first jump, while still rising
          if (willDouble && jumpCount === 1 && doubleTimer > 200 + Math.random() * 150 && catVY < 0) {
            catVY     = -(4 + Math.random() * 3);
            jumpCount = 2;
          }
          catVY += 0.7 * (dt / 16);
          catY  += catVY * (dt / 16);
          if (catY >= GROUND_Y) {
            catY      = GROUND_Y;
            catVY     = 0;
            airborne  = false;
            jumpCount = 0;
          }
        }

        catX += catVX * (dt / 16);

        // Bounce off edges — flip direction
        if (catX < 0) {
          catX = 0;
          catVX = Math.abs(catVX);
          facingRight = true;
          dirTimer = 0; nextDir = 500 + Math.random() * 900;
        }
        if (catX > CW - CAT_SZ) {
          catX = CW - CAT_SZ;
          catVX = -Math.abs(catVX);
          facingRight = false;
          dirTimer = 0; nextDir = 500 + Math.random() * 900;
        }

        // Animate run frames
        if (runTimer > 90) { runIdx = (runIdx + 1) % runFrames.length; runTimer = 0; }

        const sprite = airborne ? stillFrame! : runFrames[runIdx];
        drawCat(sprite, catX, catY, CAT_SZ, facingRight);

        rafId = requestAnimationFrame(animate);
      };

      rafId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rafId);
    }

    // Load Walk3 (run frames)
    const walkImg = new Image();
    walkImg.onload = () => {
      const frames = walkImg.width / FRAME_W;
      for (let i = 0; i < frames; i++) {
        runFrames.push(buildFrame(walkImg, i * FRAME_W, CAT_SZ));
      }
      onReady();
    };
    walkImg.src = "/cats/Walk3.png";

    // Load Still (idle frame, index 1 = orange cat)
    const stillImg = new Image();
    stillImg.onload = () => {
      stillFrame = buildFrame(stillImg, 1 * FRAME_W, CAT_SZ);
      onReady();
    };
    stillImg.src = "/cats/Still.png";

    // cleanup handled inside onReady; return no-op if images not loaded yet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={72}
      style={{ imageRendering: "pixelated", width: 320, height: 72, display: "block" }}
    />
  );
}

// ── Full-screen grow animation after pounce ───────────────────────────────────
// Cat grows from ~72 px at screen centre to cover the whole screen, then calls onDone.
function FillScreenCat({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const startSize = 72;                             // matches pounce leapScale 1.8 × 40
    const maxSize   = Math.hypot(W, H) * 2.1;        // big enough to fill any screen
    const duration  = 900;                            // ms
    const cx = W / 2, cy = H * 0.62;                 // roughly where button sits

    let stillFrame: HTMLCanvasElement | null = null;
    let rafId: number;

    const stillImg = new Image();
    stillImg.onload = () => {
      stillFrame = document.createElement("canvas");
      stillFrame.width = stillFrame.height = 80;
      const fc = stillFrame.getContext("2d")!;
      fc.imageSmoothingEnabled = false;
      fc.drawImage(stillImg, 20, 0, 20, 20, 0, 0, 80, 80); // Still frame index 1 (orange cat)

      const t0 = performance.now();

      const animate = (ts: number) => {
        const t = Math.min((ts - t0) / duration, 1);
        const ease = t * t;                            // ease-in = starts slow, accelerates
        const size  = startSize + (maxSize - startSize) * ease;

        ctx.fillStyle = "#06040f";
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Cat faces right — flip horizontally
        ctx.translate(cx + size / 2, cy - size / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(stillFrame!, 0, 0, size, size);
        ctx.restore();

        if (t < 1) {
          rafId = requestAnimationFrame(animate);
        } else {
          onDoneRef.current();
        }
      };

      rafId = requestAnimationFrame(animate);
    };
    stillImg.src = "/cats/Still.png";

    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        imageRendering: "pixelated",
        display: "block",
      }}
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
            left:    `${s.x}%`,
            top:     `${s.y}%`,
            width:   s.r * 2,
            height:  s.r * 2,
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
  const [filling, setFilling]   = useState(false);
  const [error, setError]       = useState("");
  const nameRef  = useRef(name);
  nameRef.current = name;
  const inputRef = useRef<HTMLInputElement>(null);

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
    // After the pounce-leap settles (~800 ms), trigger the screen-fill animation
    setTimeout(() => setFilling(true), 800);
  };

  const handleFillDone = useCallback(() => {
    onStart(nameRef.current.trim());
  }, [onStart]);

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
          PURR RUN
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

        {/* PNG cat wanders above the button */}
        <div className="mt-3 flex justify-center" style={{ height: 72 }}>
          <PngWanderCat pouncing={pouncing} />
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
            { key: "SPACE/↑",     desc: "jump" },
            { key: "SPACE/↑ ×2",  desc: "double jump" },
            { key: "↓",           desc: "crouch" },
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

      {/* Full-screen cat-grow transition after pounce */}
      {filling && <FillScreenCat onDone={handleFillDone} />}
    </div>
  );
}
