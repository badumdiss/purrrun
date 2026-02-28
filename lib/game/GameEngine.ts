import {
  buildSpriteCache,
  CAT_RUN_A,
  CAT_RUN_B,
  CAT_JUMP,
  CAT_DEAD,
  CAT_CROUCH,
} from "./sprites";

// ─── Constants ───────────────────────────────────────────────────────────────
const GRAVITY = 1.0;
const JUMP_FORCE = -17.971;
const DOUBLE_JUMP_FORCE = -14.3;
const INITIAL_SPEED = 6.655;
const MAX_SPEED = 21.296;
const SPEED_SCALE = 0.0008;

// Sprite scale: each sprite pixel → 4 canvas pixels (pixel-art 16-bit look)
const SPRITE_SCALE = 4;

const CAT_X = 110;
// PNG cat sprites are 20×20 source pixels @ scale 4 → 80×80 canvas px
const CAT_W = 80;
const CAT_H = 80;
// Crouch: same width, squished to 40px tall
const CAT_CROUCH_W = 80;
const CAT_CROUCH_H = 40;

// PNG sprite config
const PNG_FRAME_SRC  = 20;  // each frame in source sheet is 20×20 px
const PNG_DISPLAY    = 80;  // render at 80×80 canvas px (4× scale)
const PNG_STILL_IDX  = 1;   // frame index 1 in Still.png = orange cat
const PNG_BODY_ROWS  = 14;  // rows 0-13 = head+body (14 of 20 source rows)
const PNG_LEG_SQUISH = 4;   // compressed leg height in canvas px during crouch
const PNG_CROUCH_H   = PNG_BODY_ROWS * (PNG_DISPLAY / PNG_FRAME_SRC) + PNG_LEG_SQUISH; // 60
const PNG_TAIL_X     = 56;  // source col 14 × 4 = x where tail starts in canvas

const SMALL_MOUSE_W = 108;
const SMALL_MOUSE_H = 92;
const LARGE_MOUSE_W = 170;
const LARGE_MOUSE_H = 144;
const DOG_W = 320;
const DOG_H = 260;
// Belly gap: must be > CAT_CROUCH_H (40) so crouching cat is safe,
//            and < CAT_H (80) so standing cat is blocked.
const DOG_BELLY_GAP  = 60;  // must be > CAT_CROUCH_H (40) and < CAT_H (80)

// Mouse autonomous behaviour
const MOUSE_JUMP_FORCE  = JUMP_FORCE * Math.sqrt(0.2); // 20% of cat jump height ≈ -8.03
const MOUSE_EXTRA_SPEED = 2.4;                          // extra px/16ms beyond game scroll (+20%)
const DOG_GAP           = CAT_W * 2;                   // clear zone each side of dog (2× cat body)
const MOUSE_JUMP_DIST   = SMALL_MOUSE_W;               // start jump check within one mouse-width
const MIN_OBS_DELAY     = 600;                          // minimum ms between spawns (≥ 2-cat gap)

// Pixel-analysis-derived visual hitbox offsets (source bounds → canvas coords)
// Cat  source: x=0-18, y=2-19 in 20×20 at 4× → x=0-72 y=8-76 in 80×80; flipped → x+=8
// Rat  source: x=1-25, y=21-31 in 32×32; content in bottom ~34% of sprite
// Dog  source: x=6-34, y=23-47 in 48×48; content in bottom ~52% of sprite
const CAT_HIT_BUF = 4; // small extra buffer on cat hitbox for playability

// ─── Types ────────────────────────────────────────────────────────────────────
export type CatState = "running" | "jumping" | "double-jumping" | "crouching" | "dead";
export type ObstacleType = "small-mouse" | "large-mouse" | "dog";

interface Cat {
  x: number; y: number; w: number; h: number;
  vy: number; state: CatState;
  jumpCount: number; animFrame: number; animTimer: number;
  deathAngle: number;
}

interface Obstacle {
  type: ObstacleType;
  x: number; y: number; w: number; h: number;
  vy: number;
}

interface Cloud { x: number; y: number; w: number; speed: number; }
interface Star  { x: number; y: number; r: number; alpha: number; }

// ─── GameEngine ───────────────────────────────────────────────────────────────
export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private groundY: number;

  private cat: Cat;
  private obstacles: Obstacle[] = [];
  private clouds: Cloud[] = [];
  private stars: Star[] = [];
  private groundOffset = 0;

  // Pixel-art sprite cache (fallback)
  private spriteRun: HTMLCanvasElement[] = [];
  private spriteJump!: HTMLCanvasElement;
  private spriteDead!: HTMLCanvasElement;
  private spriteCrouch!: HTMLCanvasElement;

  // PNG sprite cache (primary)
  private catRunPng: HTMLCanvasElement[] = [];
  private catStillPng: HTMLCanvasElement | null = null;
  private catCrouchPng: HTMLCanvasElement | null = null;
  private catPngLoaded = false;

  // PNG obstacle sprites
  private dogFrames: HTMLCanvasElement[] = [];
  private ratFrames: HTMLCanvasElement[] = [];
  private obsPngLoaded = false;
  private dogAnimFrame = 0;
  private ratAnimFrame = 0;
  private obsAnimTimer  = 0;

  private crouchHeld = false;
  private speed = INITIAL_SPEED;
  private _score = 0;
  private lastObstacleTime = -1;
  private nextObstacleDelay = 2400;
  private lastTime = -1;
  private _state: "playing" | "gameover" = "playing";
  private readonly onGameOver: (score: number) => void;

  constructor(canvas: HTMLCanvasElement, onGameOver: (score: number) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.groundY = canvas.height - 75;
    this.onGameOver = onGameOver;

    this.cat = {
      x: CAT_X, y: this.groundY - CAT_H,
      w: CAT_W, h: CAT_H,
      vy: 0, state: "running",
      jumpCount: 0, animFrame: 0, animTimer: 0,
      deathAngle: 0,
    };

    // Build pixel-art sprite caches (fallback — browser only)
    this.spriteRun = [
      buildSpriteCache(CAT_RUN_A, SPRITE_SCALE),
      buildSpriteCache(CAT_RUN_B, SPRITE_SCALE),
    ];
    this.spriteJump   = buildSpriteCache(CAT_JUMP,   SPRITE_SCALE);
    this.spriteDead   = buildSpriteCache(CAT_DEAD,   SPRITE_SCALE);
    this.spriteCrouch = buildSpriteCache(CAT_CROUCH, SPRITE_SCALE);

    // Load PNG sprites (orange cat — Walk3 + Still frame 1)
    this.loadCatPngs();
    // Load PNG obstacle sprites (Dog 2 + Rat 1)
    this.loadObstaclePngs();

    // Stars
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (this.groundY - 50),
        r: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.6 + 0.4,
      });
    }

    // Clouds
    for (let i = 0; i < 4; i++) {
      this.clouds.push({
        x: (canvas.width / 4) * i + Math.random() * 80,
        y: 20 + Math.random() * 60,
        w: 70 + Math.random() * 50,
        speed: 0.4 + Math.random() * 0.4,
      });
    }
  }

  get score()     { return this._score; }
  get gameState() { return this._state; }

  // ─── Input ─────────────────────────────────────────────────────────────────
  jump() {
    if (this._state !== "playing") return;
    if (this.cat.jumpCount === 0) {
      this.cat.vy = JUMP_FORCE;
      this.cat.jumpCount = 1;
      this.cat.state = "jumping";
    } else if (this.cat.jumpCount === 1) {
      this.cat.vy = DOUBLE_JUMP_FORCE;
      this.cat.jumpCount = 2;
      this.cat.state = "double-jumping";
    } else if (this.cat.jumpCount === 2) {
      this.cat.vy = DOUBLE_JUMP_FORCE;
      this.cat.jumpCount = 3;
      this.cat.state = "double-jumping";
    }
  }

  startCrouch() {
    if (this._state !== "playing") return;
    this.crouchHeld = true;
    // Apply immediately if already on the ground running
    if (this.cat.state === "running") {
      this.cat.state = "crouching";
      this.cat.w = CAT_CROUCH_W;
      this.cat.h = CAT_CROUCH_H;
      this.cat.y = this.groundY - CAT_CROUCH_H;
    }
  }

  endCrouch() {
    this.crouchHeld = false;
    if (this.cat.state === "crouching") {
      this.cat.state = "running";
      this.cat.w = CAT_W;
      this.cat.h = CAT_H;
      this.cat.y = this.groundY - CAT_H;
    }
  }

  // ─── Update ────────────────────────────────────────────────────────────────
  update(timestamp: number) {
    if (this._state === "gameover") {
      this.cat.deathAngle = Math.min(this.cat.deathAngle + 0.08, Math.PI / 2);
      this.draw();
      return;
    }

    // First frame — seed timestamps
    if (this.lastTime < 0) {
      this.lastTime = timestamp;
      this.lastObstacleTime = timestamp;
      this.draw();
      return;
    }

    const dt = Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;

    this._score += dt * 0.04;
    this.speed = Math.min(INITIAL_SPEED + this._score * SPEED_SCALE, MAX_SPEED);

    this.updateCat(dt);
    this.spawnObstacle(timestamp);
    this.updateObstacles(dt);
    this.updateClouds(dt);
    this.groundOffset = (this.groundOffset + this.speed * (dt / 16)) % 40;

    // Cat animation frames
    const runFrameCount = this.catPngLoaded ? this.catRunPng.length : this.spriteRun.length;
    this.cat.animTimer += dt;
    if (this.cat.animTimer > 90) {
      this.cat.animFrame = (this.cat.animFrame + 1) % runFrameCount;
      this.cat.animTimer = 0;
    }

    // Obstacle animation frames
    this.obsAnimTimer += dt;
    if (this.obsAnimTimer > 100) {
      this.dogAnimFrame = (this.dogAnimFrame + 1) % (this.dogFrames.length || 6);
      this.ratAnimFrame = (this.ratAnimFrame + 1) % (this.ratFrames.length || 4);
      this.obsAnimTimer = 0;
    }

    if (this.checkCollisions()) {
      this._state = "gameover";
      this.cat.state = "dead";
      this.onGameOver(Math.floor(this._score));
      return;
    }

    this.draw();
  }

  private updateCat(dt: number) {
    if (this.cat.state === "crouching") return;
    this.cat.vy += GRAVITY * (dt / 16); // scale by dt so height is framerate-independent
    this.cat.y  += this.cat.vy * (dt / 16);
    const floor = this.groundY - this.cat.h;
    if (this.cat.y >= floor) {
      this.cat.y = floor;
      this.cat.vy = 0;
      this.cat.jumpCount = 0;
      if (this.cat.state === "jumping" || this.cat.state === "double-jumping") {
        if (this.crouchHeld) {
          // Instantly crouch on landing — no delay
          this.cat.state = "crouching";
          this.cat.w = CAT_CROUCH_W;
          this.cat.h = CAT_CROUCH_H;
          this.cat.y = this.groundY - CAT_CROUCH_H;
        } else {
          this.cat.state = "running";
        }
      }
    }
  }

  private spawnObstacle(timestamp: number) {
    if (this.lastObstacleTime < 0) return;
    if (timestamp - this.lastObstacleTime < this.nextObstacleDelay) return;

    const score = this._score;
    let type: ObstacleType;
    const rand = Math.random();

    if (score < 200)      type = "small-mouse";
    else if (score < 400) type = rand < 0.55 ? "small-mouse" : "large-mouse";
    else {
      if      (rand < 0.38) type = "small-mouse";
      else if (rand < 0.65) type = "large-mouse";
      else                  type = "dog";
    }

    // Enforce mandatory 2-cat pixel gap from every visible obstacle's right edge
    const spawnX = this.canvas.width + 30;
    for (const existing of this.obstacles) {
      if (spawnX - (existing.x + existing.w) < CAT_W * 2) return;
    }

    const obs: Obstacle = { type, x: spawnX, y: 0, w: 0, h: 0, vy: 0 };
    if (type === "small-mouse") { obs.w = SMALL_MOUSE_W; obs.h = SMALL_MOUSE_H; }
    else if (type === "large-mouse") { obs.w = LARGE_MOUSE_W; obs.h = LARGE_MOUSE_H; }
    else { obs.w = DOG_W; obs.h = DOG_H; }
    obs.y = this.groundY - obs.h;

    this.obstacles.push(obs);
    this.lastObstacleTime = timestamp;
    // Randomised delay — base shrinks with score, random spread on top, min always enforced
    const base = Math.max(0, 1800 - score * 1.0);
    this.nextObstacleDelay = MIN_OBS_DELAY + base + Math.random() * 900;
  }

  private updateObstacles(dt: number) {
    const gameMove  = this.speed * (dt / 16);
    const mouseMove = gameMove + MOUSE_EXTRA_SPEED * (dt / 16);

    // Dogs move at game scroll speed
    for (const obs of this.obstacles) {
      if (obs.type === "dog") obs.x -= gameMove;
    }

    // Mice: independent physics + gap/jump behaviour
    for (const obs of this.obstacles) {
      if (obs.type === "dog") continue;

      // Vertical physics
      obs.vy += GRAVITY * (dt / 16);
      obs.y  += obs.vy * (dt / 16);
      const floor = this.groundY - obs.h;
      if (obs.y >= floor) { obs.y = floor; obs.vy = 0; }

      // Move left faster than game scroll
      obs.x -= mouseMove;

      // Right-side dog gap: only clamp mice that are to the RIGHT of the dog.
      // Without the side-guard, mice that have already passed the dog get teleported
      // back to minX (off-screen right), causing the "random disappearance" bug.
      for (const other of this.obstacles) {
        if (other.type !== "dog") continue;
        const dogRight = other.x + other.w;
        if (obs.x > dogRight) {          // Mouse is approaching from the right — enforce DOG_GAP
          const minX = dogRight + DOG_GAP;
          if (obs.x < minX) obs.x = minX;
        }
        // Left side: mice naturally move faster than dogs so the gap widens on its own;
        // no clamp needed (a clamp here would push mice off-screen when the dog nears x=0).
      }

      // Jump over any obstacle immediately ahead — randomised trigger & force
      if (obs.vy === 0) {
        for (const other of this.obstacles) {
          if (other === obs) continue;
          const gap = obs.x - (other.x + other.w);
          if (gap >= 0 && gap < MOUSE_JUMP_DIST && Math.random() < 0.12) {
            obs.vy = MOUSE_JUMP_FORCE * (0.85 + Math.random() * 0.3);
            break;
          }
        }
      }
    }

    this.obstacles = this.obstacles.filter(o => o.x + o.w > -20);
  }

  private updateClouds(dt: number) {
    for (const c of this.clouds) {
      c.x -= c.speed * (dt / 16);
      if (c.x + c.w < 0) {
        c.x = this.canvas.width + 20;
        c.y = 20 + Math.random() * 60;
        c.w = 70 + Math.random() * 50;
      }
    }
  }

  private checkCollisions(): boolean {
    const catHit = this.getCatHitbox();
    for (const obs of this.obstacles) {
      const boxes = this.getObsHitboxes(obs);
      for (const box of boxes) {
        if (!this.aabbOverlap(catHit, box)) continue;

        if (obs.type === "dog") {
          // Belly gap: crouching cat (physics y=185) safe; standing (physics y=145) blocked.
          const bodyBottom = obs.y + DOG_H - DOG_BELLY_GAP;
          if (this.cat.y < bodyBottom) return true;
        } else {
          return true;
        }
      }
    }
    return false;
  }

  // Cat visual hitbox — based on actual non-transparent pixel bounds of the cat sprite.
  // After flip, cat visual content spans:
  //   x: cat.x+4  to cat.x+80  (source x=0-18 at 4× = 0-72px, flipped → +4 to +80)
  //   y: cat.y+8  to cat.y+76  (source y=2-19 at 4×)
  // Apply CAT_HIT_BUF on each side to avoid single-pixel edge kills.
  private getCatHitbox() {
    const { cat } = this;
    const B = CAT_HIT_BUF; // = 4
    if (cat.state === "crouching") {
      const drawY = this.groundY - PNG_CROUCH_H;
      return { x: cat.x + 4 + B, y: drawY + B, w: 76 - 2 * B, h: PNG_CROUCH_H - 2 * B };
    }
    // Standing / jumping: visual x=+4 to +80 (76px wide), y=+8 to +76 (68px tall)
    return { x: cat.x + 4 + B, y: cat.y + 8 + B, w: 76 - 2 * B, h: 68 - 2 * B };
    // → { x: cat.x+8, y: cat.y+12, w: 68, h: 60 }  right=cat.x+76, bottom=cat.y+72
  }

  // Returns multiple hitboxes per obstacle, each strictly inside the visible body.
  // Rat source (frame 0): narrow head at top (y=23-27, x=8-24), wider body below (y=27-31, x=2-25).
  // All obstacles rendered flipped (facing left) → x coords mirrored: x_screen = obs.x + W - src_x*scale.
  private getObsHitboxes(obs: Obstacle): Array<{ x: number; y: number; w: number; h: number }> {
    if (obs.type === "small-mouse") {
      const sw = SMALL_MOUSE_W / 32, sh = SMALL_MOUSE_H / 32;
      const W = SMALL_MOUSE_W;
      return [
        // Upper narrow box: src x=8-24, y=23-27 (head / upper body)
        { x: obs.x + W - 25 * sw, y: obs.y + 23 * sh, w: 17 * sw, h: 4 * sh },
        // Lower wide box:  src x=2-25, y=27-31 (belly / legs)
        { x: obs.x + W - 26 * sw, y: obs.y + 27 * sh, w: 24 * sw, h: 5 * sh },
      ];
    }
    if (obs.type === "large-mouse") {
      const lw = LARGE_MOUSE_W / 32, lh = LARGE_MOUSE_H / 32;
      const W = LARGE_MOUSE_W;
      return [
        { x: obs.x + W - 25 * lw, y: obs.y + 23 * lh, w: 17 * lw, h: 4 * lh },
        { x: obs.x + W - 26 * lw, y: obs.y + 27 * lh, w: 24 * lw, h: 5 * lh },
      ];
    }
    // Dog: source x=6-34, y=23-47 in 48×48; shrink by half-cat-length each side horizontally
    const dw = DOG_W / 48, dh = DOG_H / 48;
    const dogInset = CAT_W / 2; // 40px inset each side → less sensitive collision
    return [{ x: obs.x + DOG_W - 35 * dw + dogInset, y: obs.y + 23 * dh, w: 29 * dw - CAT_W, h: 25 * dh }];
  }

  private aabbOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ─── Draw ──────────────────────────────────────────────────────────────────
  draw() {
    const { ctx, canvas, groundY } = this;
    const W = canvas.width, H = canvas.height;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, "#06040f");
    sky.addColorStop(1, "#12082a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.drawMoon(ctx, W - 80, 45);
    for (const c of this.clouds) this.drawCloud(ctx, c);
    this.drawGround(ctx, W, H, groundY);

    for (const obs of this.obstacles) {
      if      (obs.type === "small-mouse") this.drawMouse(ctx, obs, false);
      else if (obs.type === "large-mouse") this.drawMouse(ctx, obs, true);
      else                                 this.drawDog(ctx, obs);
    }

    this.drawCat(ctx);
    this.drawHUD(ctx, W);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  private drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.save();
    ctx.fillStyle = "#fffde7";
    ctx.shadowColor = "#fffde7";
    ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#12082a";
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx + 10, cy - 4, 18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private drawCloud(ctx: CanvasRenderingContext2D, c: Cloud) {
    ctx.save();
    ctx.fillStyle = "rgba(120,100,180,0.18)";
    ctx.beginPath();
    ctx.ellipse(c.x + c.w * 0.35, c.y,      c.w * 0.35, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 0.65, c.y + 5,  c.w * 0.28, 11, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 0.5,  c.y - 6,  c.w * 0.3,  12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D, W: number, H: number, groundY: number) {
    const grad = ctx.createLinearGradient(0, groundY, 0, H);
    grad.addColorStop(0,   "#1e0a3c");
    grad.addColorStop(0.15,"#2a0e50");
    grad.addColorStop(1,   "#0d0620");
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, W, H - groundY);

    ctx.strokeStyle = "#4a1a7a";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

    ctx.strokeStyle = "rgba(160,80,255,0.25)";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

    ctx.strokeStyle = "rgba(160,80,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([20, 20]);
    ctx.lineDashOffset = -this.groundOffset;
    ctx.beginPath(); ctx.moveTo(0, groundY + 12); ctx.lineTo(W, groundY + 12); ctx.stroke();
    ctx.setLineDash([]);
  }

  // ─── PNG sprite loader ─────────────────────────────────────────────────────
  private loadCatPngs() {
    let walkReady = false;
    let stillReady = false;
    const check = () => { if (walkReady && stillReady) this.catPngLoaded = true; };

    // Walk3.png — 6 frames × 20px wide (orange cat running)
    const walkImg = new Image();
    walkImg.onload = () => {
      const frames = walkImg.width / PNG_FRAME_SRC;
      for (let i = 0; i < frames; i++) {
        const c = document.createElement("canvas");
        c.width = PNG_DISPLAY; c.height = PNG_DISPLAY;
        const cx = c.getContext("2d")!;
        cx.imageSmoothingEnabled = false;
        cx.drawImage(walkImg, i * PNG_FRAME_SRC, 0, PNG_FRAME_SRC, PNG_FRAME_SRC, 0, 0, PNG_DISPLAY, PNG_DISPLAY);
        this.catRunPng.push(c);
      }
      walkReady = true;
      check();
    };
    walkImg.src = "/cats/Walk3.png";

    // Still.png — frame index 1 = orange cat idle
    const stillImg = new Image();
    stillImg.onload = () => {
      // ── Normal still frame (idle / jump / dead) ──
      const c = document.createElement("canvas");
      c.width = PNG_DISPLAY; c.height = PNG_DISPLAY;
      const cx = c.getContext("2d")!;
      cx.imageSmoothingEnabled = false;
      cx.drawImage(stillImg, PNG_STILL_IDX * PNG_FRAME_SRC, 0, PNG_FRAME_SRC, PNG_FRAME_SRC, 0, 0, PNG_DISPLAY, PNG_DISPLAY);
      this.catStillPng = c;

      // ── Crouch canvas ──────────────────────────────────────────────────────
      // Body (rows 0–13) at full 4× scale = 56 px tall
      // Legs (rows 14–19) squished to 4 px
      // Tail (source cols 14–18 → canvas x 56–80): cleared → straight stub
      const bodyH = PNG_BODY_ROWS * (PNG_DISPLAY / PNG_FRAME_SRC); // 56
      const legH  = PNG_LEG_SQUISH;                                  // 4
      const cc = document.createElement("canvas");
      cc.width  = PNG_DISPLAY;
      cc.height = PNG_CROUCH_H; // 60
      const ccx = cc.getContext("2d")!;
      ccx.imageSmoothingEnabled = false;

      // Body+head portion
      ccx.drawImage(
        stillImg,
        PNG_STILL_IDX * PNG_FRAME_SRC, 0, PNG_FRAME_SRC, PNG_BODY_ROWS,
        0, 0, PNG_DISPLAY, bodyH
      );
      // Legs portion (squished)
      ccx.drawImage(
        stillImg,
        PNG_STILL_IDX * PNG_FRAME_SRC, PNG_BODY_ROWS,
        PNG_FRAME_SRC, PNG_FRAME_SRC - PNG_BODY_ROWS,
        0, bodyH, PNG_DISPLAY, legH
      );

      // Erase only the upward-curling portion of the tail (rows 0–8 at 4× = y 0–36).
      // Rows 9–13 (y=36–56) keep their rump pixels — they sit flush against the body
      // at the col-13/14 boundary and form a natural attached stub.
      ccx.clearRect(PNG_TAIL_X, 0, PNG_DISPLAY - PNG_TAIL_X, 36);

      this.catCrouchPng = cc;

      stillReady = true;
      check();
    };
    stillImg.src = "/cats/Still.png";
  }

  // ─── Obstacle PNG loader ────────────────────────────────────────────────────
  private loadObstaclePngs() {
    const DOG_FRAME_SRC = 48; // Dog 2 Walk.png: 288×48 → 6 frames of 48×48
    const RAT_FRAME_SRC = 32; // Rat 1 Walk.png: 128×32 → 4 frames of 32×32

    let dogReady = false, ratReady = false;
    const check = () => { if (dogReady && ratReady) this.obsPngLoaded = true; };

    const dogImg = new Image();
    dogImg.onload = () => {
      const frames = dogImg.width / DOG_FRAME_SRC;
      for (let i = 0; i < frames; i++) {
        const c = document.createElement("canvas");
        c.width = DOG_W; c.height = DOG_H;
        const cx = c.getContext("2d")!;
        cx.imageSmoothingEnabled = false;
        cx.drawImage(dogImg, i * DOG_FRAME_SRC, 0, DOG_FRAME_SRC, DOG_FRAME_SRC, 0, 0, DOG_W, DOG_H);
        this.dogFrames.push(c);
      }
      dogReady = true; check();
    };
    dogImg.src = "/obstacles/dog.png";

    const ratImg = new Image();
    ratImg.onload = () => {
      const frames = ratImg.width / RAT_FRAME_SRC;
      for (let i = 0; i < frames; i++) {
        const c = document.createElement("canvas");
        c.width = SMALL_MOUSE_W; c.height = SMALL_MOUSE_H;
        const cx = c.getContext("2d")!;
        cx.imageSmoothingEnabled = false;
        cx.drawImage(ratImg, i * RAT_FRAME_SRC, 0, RAT_FRAME_SRC, RAT_FRAME_SRC, 0, 0, SMALL_MOUSE_W, SMALL_MOUSE_H);
        this.ratFrames.push(c);
      }
      ratReady = true; check();
    };
    ratImg.src = "/obstacles/rat.png";
  }

  // ─── Cat drawing ───────────────────────────────────────────────────────────
  private drawCat(ctx: CanvasRenderingContext2D) {
    const { cat } = this;

    if (this.catPngLoaded) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      if (cat.state === "double-jumping") {
        ctx.shadowColor = "#ff8c00";
        ctx.shadowBlur  = 16;
      }

      if (cat.state === "dead") {
        // Rotate around centre then flip so cat faces right while tumbling
        const cx = cat.x + cat.w / 2, cy = cat.y + cat.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(cat.deathAngle);
        ctx.scale(-1, 1);
        ctx.drawImage(this.catStillPng!, -cat.w / 2, -cat.h / 2, cat.w, cat.h);
      } else if (cat.state === "crouching") {
        // Body stays full size; only legs are tiny; tail is a straight stub.
        // Visual height = PNG_CROUCH_H (60 px); feet land at groundY.
        const drawY = this.groundY - PNG_CROUCH_H;
        ctx.translate(cat.x + CAT_CROUCH_W, drawY);
        ctx.scale(-1, 1); // flip so head faces right
        ctx.drawImage(this.catCrouchPng!, 0, 0, CAT_CROUCH_W, PNG_CROUCH_H);
      } else {
        // Running / jumping — flip so head faces right
        const sprite = cat.state === "jumping" || cat.state === "double-jumping"
          ? this.catStillPng!
          : this.catRunPng[cat.animFrame % this.catRunPng.length];
        ctx.translate(cat.x + cat.w, cat.y);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0, cat.w, cat.h);
      }

      ctx.restore();
      return;
    }

    // ── Pixel-art fallback ──────────────────────────────────────────────────
    let sprite: HTMLCanvasElement;
    if      (cat.state === "dead")                                      sprite = this.spriteDead;
    else if (cat.state === "crouching")                                 sprite = this.spriteCrouch;
    else if (cat.state === "jumping" || cat.state === "double-jumping") sprite = this.spriteJump;
    else sprite = this.spriteRun[cat.animFrame % this.spriteRun.length];

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (cat.state === "double-jumping") {
      ctx.shadowColor = "#ff8c00";
      ctx.shadowBlur  = 16;
    }

    if (cat.state === "dead") {
      const cx = cat.x + cat.w / 2, cy = cat.y + cat.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(cat.deathAngle);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, -cat.w / 2, -cat.h / 2, cat.w, cat.h);
    } else {
      ctx.translate(cat.x + cat.w, cat.y);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0, cat.w, cat.h);
    }

    ctx.restore();
  }

  // ─── Mouse / Rat ───────────────────────────────────────────────────────────
  private drawMouse(ctx: CanvasRenderingContext2D, obs: Obstacle, _large: boolean) {
    if (this.obsPngLoaded && this.ratFrames.length > 0) {
      const sprite = this.ratFrames[this.ratAnimFrame % this.ratFrames.length];
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // Flip to face left
      ctx.translate(obs.x + obs.w, obs.y);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0, obs.w, obs.h);
      ctx.restore();
      return;
    }

    // ── pixel-art fallback ──────────────────────────────────────────────────
    const { x, y, w, h } = obs;
    ctx.save();
    ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 12;
    ctx.fillStyle = "#2a2a3a";
    ctx.beginPath(); ctx.ellipse(x + w*.52, y + h*.62, w*.38, h*.32, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#333344";
    ctx.beginPath(); ctx.ellipse(x + w*.28, y + h*.38, w*.27, h*.34, -.1, 0, Math.PI*2); ctx.fill();
    ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 16;
    ctx.fillStyle = "#ff0000";
    ctx.beginPath(); ctx.ellipse(x + w*.16, y + h*.33, 4, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w*.3,  y + h*.3,  4, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ─── Dog ───────────────────────────────────────────────────────────────────
  private drawDog(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    if (this.obsPngLoaded && this.dogFrames.length > 0) {
      const sprite = this.dogFrames[this.dogAnimFrame % this.dogFrames.length];
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // Flip to face left
      ctx.translate(obs.x + obs.w, obs.y);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0, obs.w, obs.h);
      ctx.restore();
      return;
    }

    // ── pixel-art fallback ──────────────────────────────────────────────────
    const { x, y, w, h } = obs;
    const TAN = "#c68b3b", DRK = "#8b5e1a";
    ctx.fillStyle = TAN;
    ctx.beginPath(); ctx.roundRect(x + w*.1, y + h*.1, w*.8, h*.5, 8); ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = TAN;
    ctx.beginPath(); ctx.ellipse(x + w*.18, y + h*.18, w*.2, h*.2, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 1.5; ctx.stroke();
    for (const lx of [x+w*.2, x+w*.38, x+w*.58, x+w*.74]) {
      const lw = w*.12, lh = h*.42, ly = y + h*.58;
      ctx.fillStyle = TAN;
      ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 4); ctx.fill();
      ctx.strokeStyle = DRK; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────
  private drawHUD(ctx: CanvasRenderingContext2D, W: number) {
    ctx.save();
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "#00ff41";
    ctx.shadowColor = "#00ff41"; ctx.shadowBlur = 10;
    ctx.fillText(`${Math.floor(this._score)} m`, W - 16, 30);
    ctx.restore();
  }
}
