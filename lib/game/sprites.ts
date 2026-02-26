// ─── Pixel Art Sprite System ─────────────────────────────────────────────────
// Sprites are defined as 2-D arrays of single-char colour codes.
// '_' = transparent. Scale factor × each cell = final pixel size.

export type SpriteFrame = string[];

// Colour palette
export const PALETTE: Record<string, string> = {
  O: "#ff8c00", // orange body
  D: "#c86400", // dark orange (outline, stripes)
  L: "#ffb347", // light orange (belly / highlight)
  P: "#ff9eb5", // pink (ear interior, nose)
  G: "#55cc66", // green iris
  K: "#111111", // near-black (pupil)
  W: "#ffffff", // white (eye shine)
  T: "#ff8c00", // tail (same as body for simplicity)
  X: "#cc2200", // X for dead eyes
};

// ─── Cat Sprites (16 cols × 14 rows)  facing right ───────────────────────────
//     Tail curves up to the upper-right (cols 12-15, rows 0-6)

export const CAT_RUN_A: SpriteFrame = [
  //  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  "_ D O D _ _ _ _ _ _ _ _ _ _ _ _", // 0  ear
  "D O P O D _ _ _ _ _ _ _ _ _ _ _", // 1  ear inner (P=pink)
  "O O O O O D _ _ _ _ _ _ _ _ D O", // 2  head top          + tail tip
  "G K _ P O D _ _ _ _ _ _ _ D O _", // 3  eye/nose          + tail
  "O O O O D _ _ _ _ _ _ _ D O _ _", // 4  head bottom       + tail
  "D O D O O O O O D _ _ D O _ _ _", // 5  neck+body (stripe)+ tail
  "_ O O D O O D O O O D O _ _ _ _", // 6  body row 1        + tail base
  "_ D O O O O O D O O O D _ _ _ _", // 7  body row 2
  "_ O L O O O O O O L O D _ _ _ _", // 8  body (L=belly highlight)
  "_ O O O D O O D O O O D _ _ _ _", // 9  body row 4
  "_ O O _ O O _ _ O O _ _ _ _ _ _", // A  legs run-A (front fwd, back fwd)
  "_ O O _ O O _ _ O O _ _ _ _ _ _", // B  lower legs
  "_ L L _ L L _ _ L L _ _ _ _ _ _", // C  paws
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _", // D  ground
];

export const CAT_RUN_B: SpriteFrame = [
  "_ D O D _ _ _ _ _ _ _ _ _ _ _ _",
  "D O P O D _ _ _ _ _ _ _ _ _ _ _",
  "O O O O O D _ _ _ _ _ _ _ _ D O",
  "G K _ P O D _ _ _ _ _ _ _ D O _",
  "O O O O D _ _ _ _ _ _ _ D O _ _",
  "D O D O O O O O D _ _ D O _ _ _",
  "_ O O D O O D O O O D O _ _ _ _",
  "_ D O O O O O D O O O D _ _ _ _",
  "_ O L O O O O O O L O D _ _ _ _",
  "_ O O O D O O D O O O D _ _ _ _",
  "_ _ O O _ _ O O _ _ O O _ _ _ _", // legs run-B (shifted)
  "_ _ O O _ _ O O _ _ O O _ _ _ _",
  "_ _ L L _ _ L L _ _ L L _ _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
];

export const CAT_JUMP: SpriteFrame = [
  "_ D O D _ _ _ _ _ _ _ _ _ _ _ _",
  "D O P O D _ _ _ _ _ _ _ _ _ _ _",
  "O O O O O D _ _ _ _ _ _ _ _ D O",
  "G K _ P O D _ _ _ _ _ _ _ D O _",
  "O O O O D _ _ _ _ _ _ _ D O _ _",
  "D O D O O O O O D _ _ D O _ _ _",
  "_ O O D O O D O O O D O _ _ _ _",
  "_ D O O O O O D O O O D _ _ _ _",
  "_ O L O O O O O O L O D _ _ _ _",
  "_ O O O D O O D O O O D _ _ _ _",
  "_ _ D O D _ _ D O D _ _ _ _ _ _", // legs tucked
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
];

export const CAT_DEAD: SpriteFrame = [
  "_ D O D _ _ _ _ _ _ _ _ _ _ _ _",
  "D O P O D _ _ _ _ _ _ _ _ _ _ _",
  "O O O O O D _ _ _ _ _ _ _ _ D O",
  "X _ X P O D _ _ _ _ _ _ _ D O _", // X eyes
  "O O O O D _ _ _ _ _ _ _ D O _ _",
  "D O D O O O O O D _ _ D O _ _ _",
  "_ O O D O O D O O O D O _ _ _ _",
  "_ D O O O O O D O O O D _ _ _ _",
  "_ O L O O O O O O L O D _ _ _ _",
  "_ O O O D O O D O O O D _ _ _ _",
  "_ O O _ O O _ _ O O _ _ _ _ _ _",
  "_ O O _ O O _ _ O O _ _ _ _ _ _",
  "_ L L _ L L _ _ L L _ _ _ _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
];

// Crouch sprite — wider (20 cols) × 8 rows
export const CAT_CROUCH: SpriteFrame = [
  "_ _ _ D O D _ _ _ _ _ _ _ _ _ _ _ _ _ _",
  "_ _ D O P O D _ _ _ _ _ _ _ _ _ _ _ _ _",
  "_ D O G K P O D _ _ _ _ _ _ _ _ _ _ _ _",
  "D O O O O O O O O D _ _ _ _ _ _ _ _ D O",
  "O O D O O O D O O O O D _ _ _ _ _ D O _",
  "O O O O O O O O O O O O D _ _ D O _ _ _",
  "L O D O O D O O D O L O D D O _ _ _ _ _",
  "D O O O O O O O O O O O D _ _ _ _ _ _ _",
  "_ O O _ O O _ _ _ _ O O _ _ _ _ _ _ _ _",
  "_ L L _ L L _ _ _ _ L L _ _ _ _ _ _ _ _",
];

// ─── Larger pounce sprite for home screen (24 cols × 20 rows) ─────────────────
// Cat in a low, stalking crouch — about to pounce right
export const CAT_POUNCE_HOME: SpriteFrame = [
  // 24 wide × 20 tall
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ D O D _ _ _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ D O P O D _ _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ D O O O O O D _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ D G K _ P O O O D _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ D O O O O O O O O D _ _",
  "_ _ _ _ _ _ _ _ _ _ _ D O O D O O D O O O D _ _",
  "_ _ _ _ _ _ _ _ _ _ D O O O O O O O D O O D D _",
  "_ _ _ _ _ _ _ _ _ D O O O D O O O D O O O O D _",
  "_ _ _ _ _ _ _ _ D O L O O O O L O O O O O O D _",
  "_ _ _ _ _ _ _ D O O O O O O O O D O O O O D _ _",
  "_ _ _ _ _ _ D O O O D O O D O O O O O O D _ _ _",
  "_ _ _ _ _ _ O O O O O O O O O O O O O D _ _ _ _",
  "_ _ _ _ _ _ D O O O O O O O O O O O D _ _ _ _ _",
  "D O _ _ _ _ _ _ D O _ _ _ _ _ _ O O _ _ _ _ _ _",
  "O O _ _ _ _ _ _ O O _ _ _ _ _ _ O O _ _ _ _ _ _",
  "O O _ _ _ _ _ _ O O _ _ _ _ _ _ D O _ _ _ _ _ _",
  "L L _ _ _ _ _ _ L L _ _ _ _ _ _ L L _ _ _ _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
  "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
];

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Parse a sprite row string into an array of char tokens.
 * Cells are space-separated.
 */
function parseRow(row: string): string[] {
  return row.split(" ");
}

/**
 * Draw a sprite frame onto a canvas context.
 * @param ctx  target context
 * @param frame  sprite frame (array of space-separated char rows)
 * @param dx  destination x on ctx
 * @param dy  destination y on ctx
 * @param scale  pixel size (each sprite pixel becomes scale×scale canvas pixels)
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  dx: number,
  dy: number,
  scale: number
) {
  for (let row = 0; row < frame.length; row++) {
    const cells = parseRow(frame[row]);
    for (let col = 0; col < cells.length; col++) {
      const ch = cells[col];
      if (ch === "_") continue;
      ctx.fillStyle = PALETTE[ch] ?? "#ff8c00";
      ctx.fillRect(
        Math.floor(dx + col * scale),
        Math.floor(dy + row * scale),
        scale,
        scale
      );
    }
  }
}

/**
 * Create a cached HTMLCanvasElement for a sprite frame at a given scale.
 * Call once; then use ctx.drawImage(cache, x, y) for fast rendering.
 */
export function buildSpriteCache(
  frame: SpriteFrame,
  scale: number
): HTMLCanvasElement {
  const cols = parseRow(frame[0]).length;
  const rows = frame.length;
  const c = document.createElement("canvas");
  c.width = cols * scale;
  c.height = rows * scale;
  const ctx = c.getContext("2d")!;
  drawSprite(ctx, frame, 0, 0, scale);
  return c;
}
