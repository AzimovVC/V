/** Эскизные примитивы: дрожащие двойные линии, штриховка, «кипящие» контуры. */

let boil = 0;
/** Номер «кадра рисования» (меняется ~7 раз/с) — линии слегка перерисовываются, как карандаш. */
export function setBoil(n: number): void { boil = n; }

function mulberry(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number, amp = 1.1, passes = 2): void {
  const r = mulberry(Math.floor(seed * 7919) + boil * 104729);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.ceil(len / 34));
  for (let p = 0; p < passes; p++) {
    ctx.beginPath();
    ctx.moveTo(x1 + (r() - 0.5) * amp * 2, y1 + (r() - 0.5) * amp * 2);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      ctx.lineTo(x1 + (x2 - x1) * t + (r() - 0.5) * amp * 2, y1 + (y2 - y1) * t + (r() - 0.5) * amp * 2);
    }
    ctx.stroke();
  }
}

export function polyline(ctx: CanvasRenderingContext2D, pts: number[][], seed: number, amp = 1.1, close = false): void {
  for (let i = 0; i < pts.length - 1; i++) line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], seed + i * 3.1, amp, 2);
  if (close) line(ctx, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], seed + 99, amp, 2);
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, amp = 1.1): void {
  polyline(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], seed, amp, true);
}

/** Заливка многоугольника с лёгким неровным краем (без «кипения»). */
export function fillPoly(ctx: CanvasRenderingContext2D, pts: number[][], seed: number, amp = 1): void {
  const r = mulberry(Math.floor(seed * 4099));
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = p[0] + (r() - 0.5) * amp * 2, y = p[1] + (r() - 0.5) * amp * 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

export function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, amp = 1): void {
  fillPoly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], seed, amp);
}

export function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number, amp = 1, fill = true, stroke = false): void {
  const r = mulberry(Math.floor(seed * 3571) + (stroke ? boil * 13 : 0));
  const n = 16;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx + (r() - 0.5) * amp * 2;
    const y = cy + Math.sin(a) * ry + (r() - 0.5) * amp * 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

/** Штриховка прямоугольника (диагональ), для фактуры и теней. */
export function hatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step: number, seed: number, slope = 1): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const r = mulberry(Math.floor(seed * 911));
  ctx.beginPath();
  for (let sx = x - h * slope; sx < x + w; sx += step) {
    const j = (r() - 0.5) * step * 0.4;
    ctx.moveTo(sx + j, y + h);
    ctx.lineTo(sx + j + h * slope, y);
  }
  ctx.stroke();
  ctx.restore();
}

// ───────── цвет ─────────
const cache = new Map<string, [number, number, number]>();
function parse(hex: string): [number, number, number] {
  let c = cache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cache.set(hex, c);
  }
  return c;
}
export function lerpColor(a: string, b: string, t: number): string {
  const A = parse(a), B = parse(b);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`;
}
