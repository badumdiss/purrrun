import {
  buildSpriteCache,
  CAT_RUN_A,
  CAT_RUN_B,
  CAT_JUMP,
  CAT_DEAD,
  CAT_CROUCH,
} from "./sprites";

// ─── Constants ───────────────────────────────────────────────────────────────
const GRAVITY = 0.55;
const JUMP_FORCE = -14;
const DOUBLE_JUMP_FORCE = -11;
const INITIAL_SPEED = 5;
const MAX_SPEED = 16;
const SPEED_SCALE = 0.0008;

// Sprite scale: each sprite pixel → 4 canvas pixels (pixel-art 16-bit look)
const SPRITE_SCALE = 4;

const CAT_X = 110;
// Normal cat: 16 cols × 14 rows @ SPRITE_SCALE 4 → 64×56 canvas px
const CAT_W = 64;
const CAT_H = 56;
// Crouch cat: 20 cols × 10 rows @ SPRITE_SCALE 4 → 80×40 canvas px
const CAT_CROUCH_W = 80;
const CAT_CROUCH_H = 40;

const SMALL_MOUSE_W = 44;
const SMALL_MOUSE_H = 38;
const LARGE_MOUSE_W = 70;
const LARGE_MOUSE_H = 56;
const DOG_W = 118;
const DOG_H = 90;
// Belly gap must be > CAT_CROUCH_H (40) so crouching cat is safe
const DOG_BELLY_GAP = 44;

const HIT_MARGIN = 8; // px of forgiveness on each edge

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

  // Pixel-art sprite cache
  private spriteRun: HTMLCanvasElement[] = [];
  private spriteJump!: HTMLCanvasElement;
  private spriteDead!: HTMLCanvasElement;
  private spriteCrouch!: HTMLCanvasElement;

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

    // Build pixel-art sprite caches (browser only — document is available)
    this.spriteRun = [
      buildSpriteCache(CAT_RUN_A, SPRITE_SCALE),
      buildSpriteCache(CAT_RUN_B, SPRITE_SCALE),
    ];
    this.spriteJump   = buildSpriteCache(CAT_JUMP,   SPRITE_SCALE);
    this.spriteDead   = buildSpriteCache(CAT_DEAD,   SPRITE_SCALE);
    this.spriteCrouch = buildSpriteCache(CAT_CROUCH, SPRITE_SCALE);

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
    }
  }

  startCrouch() {
    if (this._state !== "playing") return;
    if (this.cat.state === "running") {
      this.cat.state = "crouching";
      this.cat.w = CAT_CROUCH_W;
      this.cat.h = CAT_CROUCH_H;
      this.cat.y = this.groundY - CAT_CROUCH_H;
    }
  }

  endCrouch() {
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

    // Animation frames (only 2 run frames)
    this.cat.animTimer += dt;
    if (this.cat.animTimer > 90) {
      this.cat.animFrame = (this.cat.animFrame + 1) % 2;
      this.cat.animTimer = 0;
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
    this.cat.vy += GRAVITY;
    this.cat.y  += this.cat.vy * (dt / 16);
    const floor = this.groundY - this.cat.h;
    if (this.cat.y >= floor) {
      this.cat.y = floor;
      this.cat.vy = 0;
      this.cat.jumpCount = 0;
      if (this.cat.state === "jumping" || this.cat.state === "double-jumping") {
        this.cat.state = "running";
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

    const obs: Obstacle = { type, x: this.canvas.width + 30, y: 0, w: 0, h: 0 };
    if (type === "small-mouse") { obs.w = SMALL_MOUSE_W; obs.h = SMALL_MOUSE_H; }
    else if (type === "large-mouse") { obs.w = LARGE_MOUSE_W; obs.h = LARGE_MOUSE_H; }
    else { obs.w = DOG_W; obs.h = DOG_H; }
    obs.y = this.groundY - obs.h;

    this.obstacles.push(obs);
    this.lastObstacleTime = timestamp;
    this.nextObstacleDelay = Math.max(900, 2400 - score * 1.2);
  }

  private updateObstacles(dt: number) {
    const move = this.speed * (dt / 16);
    this.obstacles = this.obstacles
      .map(o => ({ ...o, x: o.x - move }))
      .filter(o => o.x + o.w > -20);
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
    const cat = this.cat;
    for (const obs of this.obstacles) {
      if (!this.rectsOverlap(cat, obs)) continue;
      if (obs.type === "dog") {
        // Dog body hitbox = everything above the belly gap
        const bodyBottom = obs.y + obs.h - DOG_BELLY_GAP;
        // Crouching cat: cat.y = groundY - CAT_CROUCH_H = groundY - 40
        // bodyBottom    = groundY - DOG_BELLY_GAP         = groundY - 44
        // cat.y (groundY-40) < bodyBottom (groundY-44)? → -40 < -44? NO → safe ✓
        // Standing cat:   cat.y = groundY - CAT_H         = groundY - 56
        // cat.y (groundY-56) < bodyBottom (groundY-44)? → -56 < -44? YES → collision ✓
        if (cat.y < bodyBottom) return true;
      } else {
        return true;
      }
    }
    return false;
  }

  private rectsOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ): boolean {
    return (
      a.x + HIT_MARGIN     < b.x + b.w - HIT_MARGIN &&
      a.x + a.w - HIT_MARGIN > b.x + HIT_MARGIN &&
      a.y + HIT_MARGIN     < b.y + b.h - HIT_MARGIN &&
      a.y + a.h - HIT_MARGIN > b.y + HIT_MARGIN
    );
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

  // ─── Cat (pixel-art sprites) ───────────────────────────────────────────────
  private drawCat(ctx: CanvasRenderingContext2D) {
    const { cat } = this;

    let sprite: HTMLCanvasElement;
    if      (cat.state === "dead")                                  sprite = this.spriteDead;
    else if (cat.state === "crouching")                             sprite = this.spriteCrouch;
    else if (cat.state === "jumping" || cat.state === "double-jumping") sprite = this.spriteJump;
    else sprite = this.spriteRun[cat.animFrame % this.spriteRun.length];

    ctx.save();
    ctx.imageSmoothingEnabled = false; // nearest-neighbour → authentic pixel-art

    if (cat.state === "dead") {
      const cx = cat.x + cat.w / 2, cy = cat.y + cat.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(cat.deathAngle);
      ctx.translate(-cx, -cy);
    }

    if (cat.state === "double-jumping") {
      ctx.shadowColor = "#ff8c00";
      ctx.shadowBlur  = 16;
    }

    ctx.drawImage(sprite, cat.x, cat.y, cat.w, cat.h);
    ctx.restore();
  }

  // ─── Mouse ─────────────────────────────────────────────────────────────────
  private drawMouse(ctx: CanvasRenderingContext2D, obs: Obstacle, large: boolean) {
    void large; // size already encoded in obs.w / obs.h
    const { x, y, w, h } = obs;

    ctx.save();
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur  = 12;

    // Body
    ctx.fillStyle = "#2a2a3a";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.52, y + h * 0.62, w * 0.38, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = "#333344";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.28, y + h * 0.38, w * 0.27, h * 0.34, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath(); ctx.ellipse(x + w * 0.12, y + h * 0.08, w * 0.13, h * 0.14, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.3,  y + h * 0.06, w * 0.12, h * 0.13,  0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a001a";
    ctx.beginPath(); ctx.ellipse(x + w * 0.12, y + h * 0.09, w * 0.08, h * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.3,  y + h * 0.07, w * 0.07, h * 0.07,  0.2, 0, Math.PI * 2); ctx.fill();

    // Red glowing eyes
    ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 16;
    ctx.fillStyle = "#ff0000";
    ctx.beginPath(); ctx.ellipse(x + w * 0.16, y + h * 0.33, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.3,  y + h * 0.3,  4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#220000";
    ctx.beginPath(); ctx.ellipse(x + w * 0.16, y + h * 0.33, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.3,  y + h * 0.3,  2, 2, 0, 0, Math.PI * 2); ctx.fill();

    // Evil grin + teeth
    ctx.strokeStyle = "#888"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y + h * 0.52);
    ctx.quadraticCurveTo(x + w * 0.22, y + h * 0.62, x + w * 0.34, y + h * 0.52);
    ctx.stroke();
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(x + w * 0.16, y + h * 0.52, 4, 5);
    ctx.fillRect(x + w * 0.22, y + h * 0.53, 4, 5);
    ctx.fillRect(x + w * 0.28, y + h * 0.52, 4, 5);

    // Whiskers
    ctx.strokeStyle = "rgba(255,200,200,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + w * 0.06, y + h * 0.44); ctx.lineTo(x - w * 0.1, y + h * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.06, y + h * 0.5);  ctx.lineTo(x - w * 0.1, y + h * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.38, y + h * 0.44); ctx.lineTo(x + w * 0.54, y + h * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.38, y + h * 0.5);  ctx.lineTo(x + w * 0.54, y + h * 0.5); ctx.stroke();

    // Tail
    ctx.strokeStyle = "#444"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.9, y + h * 0.7);
    ctx.bezierCurveTo(x + w * 1.15, y + h * 0.5, x + w * 1.2, y + h * 0.2, x + w * 1.05, y + h * 0.1);
    ctx.stroke();

    // Legs
    ctx.strokeStyle = "#444"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + w * 0.38, y + h * 0.82); ctx.lineTo(x + w * 0.34, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.5,  y + h * 0.85); ctx.lineTo(x + w * 0.54, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.64, y + h * 0.82); ctx.lineTo(x + w * 0.6,  y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.74, y + h * 0.84); ctx.lineTo(x + w * 0.78, y + h); ctx.stroke();

    ctx.restore();
  }

  // ─── Dog ───────────────────────────────────────────────────────────────────
  private drawDog(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    const { x, y, w, h } = obs;
    const TAN = "#c68b3b", DRK = "#8b5e1a", WH = "#f5f0e0";

    // Body
    ctx.fillStyle = TAN;
    ctx.beginPath();
    ctx.roundRect(x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.5, 8);
    ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 2; ctx.stroke();

    // Belly
    ctx.fillStyle = WH;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.48, w * 0.28, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spots
    ctx.fillStyle = DRK; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.ellipse(x + w * 0.65, y + h * 0.22, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.45, y + h * 0.18,  7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = TAN;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.18, y + h * 0.18, w * 0.2, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = DRK; ctx.lineWidth = 1.5; ctx.stroke();

    // Snout
    ctx.fillStyle = WH;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.08, y + h * 0.25, w * 0.1, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.03, y + h * 0.22, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = "#4a3000";
    ctx.beginPath(); ctx.ellipse(x + w * 0.12, y + h * 0.14, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(x + w * 0.11, y + h * 0.13, 1.5, 0, Math.PI * 2); ctx.fill();

    // Ears
    ctx.fillStyle = DRK;
    ctx.beginPath(); ctx.ellipse(x + w * 0.1,  y + h * 0.28, w * 0.08, h * 0.12, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.26, y + h * 0.1,  w * 0.07, h * 0.11, -0.3, 0, Math.PI * 2); ctx.fill();

    // Mouth + tongue
    ctx.strokeStyle = DRK; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.03, y + h * 0.28);
    ctx.quadraticCurveTo(x + w * 0.09, y + h * 0.34, x + w * 0.15, y + h * 0.28);
    ctx.stroke();
    ctx.fillStyle = "#ff6b8a";
    ctx.beginPath(); ctx.ellipse(x + w * 0.08, y + h * 0.32, 5, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Tail
    ctx.strokeStyle = TAN; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.9,  y + h * 0.2);
    ctx.bezierCurveTo(x + w * 1.12, y + h * 0.1, x + w * 1.18, y - h * 0.1, x + w * 1.08, y - h * 0.15);
    ctx.stroke();

    // 4 Legs
    for (const lx of [x + w * 0.2, x + w * 0.38, x + w * 0.58, x + w * 0.74]) {
      const lw = w * 0.12, lh = h * 0.42;
      const ly = y + h * 0.58;
      ctx.fillStyle = TAN;
      ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 4); ctx.fill();
      ctx.strokeStyle = DRK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = WH;
      ctx.beginPath(); ctx.ellipse(lx + lw / 2, ly + lh, lw * 0.6, lw * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    }

    // "CROUCH!" hint as the dog approaches
    if (obs.x > this.canvas.width * 0.15 && obs.x < this.canvas.width * 0.55) {
      ctx.save();
      ctx.fillStyle = "#ff4500";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ff4500"; ctx.shadowBlur = 8;
      ctx.fillText("↓ CROUCH!", x + w * 0.5, y - 10);
      ctx.restore();
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
