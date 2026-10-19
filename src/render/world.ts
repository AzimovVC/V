import { balance } from '../config/balance';
import { data, FLOOR_Y, ROOM_H, WORLD_LEFT, WORLD_RIGHT, roomById } from '../data';
import { leakLevel } from '../core/state';
import type { Game } from '../core/game';
import type { RoomDef, WeatherId } from '../core/types';
import { blob, fillPoly, fillRect, hatch, lerpColor, line, polyline, rect } from './sketch';

export interface Env {
  g: Game;
  t: number;
  clear: Record<string, number>;
  sev: number;
  wid: WeatherId;
  viewL: number; viewR: number; viewT: number;
}

const FLOOR_H = 170; // высота верхних ярусов
const INK = '#b9a98f';

const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// ───────────────────────── небо, дождь, окна ─────────────────────────

function sky(ctx: CanvasRenderingContext2D, env: Env, x: number, y: number, w: number, h: number, wid: WeatherId, strength = 1): void {
  const c = data.weather[wid].sky;
  const gr = ctx.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
  ctx.fillStyle = gr;
  ctx.fillRect(x, y, w, h);
  if (wid === 'quiet') {
    ctx.fillStyle = 'rgba(255,240,210,0.8)';
    for (let i = 0; i < 7; i++) {
      const sx = x + hash(i + 3) * w, sy = y + hash(i + 9) * h * 0.6;
      const tw = 0.5 + 0.5 * Math.sin(env.t * 0.8 + i * 2);
      ctx.globalAlpha = (0.35 + 0.5 * tw) * strength;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }
}

function rainStreaks(ctx: CanvasRenderingContext2D, env: Env, x: number, y: number, w: number, h: number, sev: number, density: number): void {
  if (sev < 0.55) return;
  const k = Math.min(1, (sev - 0.5) / 2.2);
  const n = Math.floor(density * (0.15 + k));
  const slant = 0.25 + k * 0.5;
  const speed = 260 + k * 420;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = `rgba(170,190,205,${0.18 + k * 0.22})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const px = x + ((hash(i) * (w + h * slant) + env.t * speed * slant * 0.4) % (w + h * slant)) - h * slant * 0.3;
    const py = y + (hash(i + 77) * h + env.t * speed * (0.6 + hash(i + 5) * 0.5)) % h;
    const len = 8 + k * 14;
    ctx.moveTo(px, py); ctx.lineTo(px - len * slant, py + len);
  }
  ctx.stroke();
  ctx.restore();
}

function drawWindowView(ctx: CanvasRenderingContext2D, env: Env, cx: number, y: number, w: number, h: number, wid: WeatherId, sev: number): void {
  const x = cx - w / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  sky(ctx, env, x, y, w, h, wid, 1);
  rainStreaks(ctx, env, x, y, w, h, sev, 70);
  // земля и трава на уровне окна подвала
  ctx.fillStyle = wid === 'quiet' ? '#1b2218' : '#0c1210';
  fillRect(ctx, x, y + h * 0.72, w, h * 0.3, 7, 1);
  ctx.strokeStyle = wid === 'quiet' ? '#4e5c42' : '#27332b';
  ctx.lineWidth = 1.3;
  const sway = wid === 'storm' ? 6 : wid === 'drizzle' ? 2 : 0.6;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const gx = x + 3 + i * (w / 14), gy = y + h * 0.74;
    ctx.moveTo(gx, gy + 3);
    ctx.quadraticCurveTo(gx + Math.sin(env.t * 2 + i) * sway * 0.5, gy - 5, gx + Math.sin(env.t * 2.3 + i * 1.7) * sway, gy - 10 - hash(i) * 5);
  }
  ctx.stroke();
  if (env.g.rt.flash > 0 && wid !== 'quiet') {
    ctx.fillStyle = `rgba(230,240,255,${env.g.rt.flash * 0.75})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// ───────────────────────── здание ─────────────────────────

function drawBuilding(ctx: CanvasRenderingContext2D, env: Env): void {
  const { g } = env;
  const L = WORLD_LEFT - 20, R = WORLD_RIGHT + 20, W = R - L;

  // земля под подвалом
  ctx.fillStyle = '#0f0b09';
  ctx.fillRect(L - 400, ROOM_H, W + 800, 800);
  ctx.strokeStyle = 'rgba(120,100,80,0.16)'; ctx.lineWidth = 1;
  hatch(ctx, L - 400, ROOM_H + 6, W + 800, 500, 14, 4, 0.6);
  ctx.fillStyle = 'rgba(80,66,52,0.35)';
  for (let i = 0; i < 26; i++) {
    blob(ctx, L + hash(i + 40) * W, ROOM_H + 40 + hash(i + 61) * 250, 6 + hash(i) * 14, 4 + hash(i + 2) * 8, i, 2);
  }

  // небо над домом
  const gy = 0;
  sky(ctx, env, L - 600, env.viewT - 40, W + 1200, gy - env.viewT + 40, env.wid);

  // верхние ярусы (тёмные, недоступные пока)
  for (let k = 1; k <= 4; k++) {
    const top = -FLOOR_H * k, bot = top + FLOOR_H;
    ctx.fillStyle = '#16110f';
    ctx.fillRect(L, top, W, FLOOR_H);
    ctx.strokeStyle = 'rgba(185,169,143,0.2)'; ctx.lineWidth = 1.4;
    hatch(ctx, L, top, W, FLOOR_H, 16, 10 + k, 0.8);
    ctx.strokeStyle = 'rgba(185,169,143,0.42)'; ctx.lineWidth = 2;
    rect(ctx, L, top, W, FLOOR_H, 20 + k, 1.6);
    // окна
    for (let i = 0; i < 8; i++) {
      const wx = L + 60 + i * 215;
      ctx.fillStyle = '#0a0807';
      fillRect(ctx, wx, top + 42, 46, 62, i + k * 10, 1);
      ctx.strokeStyle = 'rgba(185,169,143,0.3)';
      rect(ctx, wx, top + 42, 46, 62, i + k * 11, 1);
      line(ctx, wx + 23, top + 42, wx + 23, top + 104, i + k * 12, 0.8, 1);
    }
    const tier = data.tiers[Math.min(k, data.tiers.length - 2)];
    ctx.fillStyle = 'rgba(200,185,160,0.34)';
    ctx.font = 'italic 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${tier.name} · ${tier.theme}`, L + 14, bot - 12);
  }
  // крыша
  const rt = -FLOOR_H * 4;
  ctx.fillStyle = '#100c0a';
  fillPoly(ctx, [[L - 20, rt], [(L + R) / 2, rt - 120], [R + 20, rt]], 5, 1);
  ctx.strokeStyle = 'rgba(185,169,143,0.4)'; ctx.lineWidth = 2;
  polyline(ctx, [[L - 20, rt], [(L + R) / 2, rt - 120], [R + 20, rt]], 31, 1.5);
  ctx.fillStyle = 'rgba(200,185,160,0.34)';
  ctx.fillText(`${data.tiers[4].name} · ${data.tiers[4].theme}`, (L + R) / 2 - 50, rt - 20);

  // дождь по верхней части дома
  rainStreaks(ctx, env, env.viewL, env.viewT, env.viewR - env.viewL, -env.viewT, env.sev, 130);

  // подвал: общая рамка и «потолок»-перекрытие
  ctx.fillStyle = '#1a1412';
  ctx.fillRect(L, -10, W, 12);
  ctx.strokeStyle = 'rgba(185,169,143,0.5)'; ctx.lineWidth = 2;
  line(ctx, L, 0, R, 0, 3, 1.2);
  line(ctx, L, ROOM_H, R, ROOM_H, 4, 1.2);
  line(ctx, L, 0, L, ROOM_H, 5, 1.2);
  line(ctx, R, 0, R, ROOM_H, 6, 1.2);
  void g;
}

// ───────────────────────── лестничная клетка ─────────────────────────

function drawStairwell(ctx: CanvasRenderingContext2D, env: Env): void {
  const x0 = WORLD_LEFT - 20, x1 = -8;
  ctx.fillStyle = '#12161a';
  ctx.fillRect(x0, 0, x1 - x0, ROOM_H);
  ctx.strokeStyle = 'rgba(120,150,170,0.2)'; ctx.lineWidth = 1;
  hatch(ctx, x0, 0, x1 - x0, ROOM_H, 12, 8, 0.7);
  ctx.strokeStyle = 'rgba(150,170,185,0.45)'; ctx.lineWidth = 1.8;
  // марши лестницы вверх
  for (let k = 0; k < 5; k++) {
    const yBase = FLOOR_Y - FLOOR_H * k;
    const dir = k % 2 === 0 ? 1 : -1;
    const sa = dir === 1 ? x0 + 6 : x1 - 6;
    const sb = dir === 1 ? x1 - 6 : x0 + 6;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const sx = sa + (sb - sa) * t, sy = yBase - FLOOR_H * t * 0.92;
      line(ctx, sx, sy, sx + (sb - sa) / n, sy, k * 20 + i, 0.5, 1);
      line(ctx, sx + (sb - sa) / n, sy, sx + (sb - sa) / n, sy - (FLOOR_H * 0.92) / n, k * 20 + i + 1, 0.5, 1);
    }
  }
  void env;
}

// ───────────────────────── комнаты ─────────────────────────

function drawRoomShell(ctx: CanvasRenderingContext2D, env: Env, room: RoomDef): void {
  const c = env.clear[room.id] ?? 0;
  const P = room.palette;
  ctx.fillStyle = lerpColor(P.wall, P.wallLit, c);
  ctx.fillRect(room.x, 0, room.w, ROOM_H);
  ctx.strokeStyle = lerpColor(P.line, P.lineLit, c);
  ctx.globalAlpha = 0.16; ctx.lineWidth = 1;
  hatch(ctx, room.x, 0, room.w, FLOOR_Y, 18, room.x + 2, 0.55);
  ctx.globalAlpha = 1;
  // пол
  ctx.fillStyle = lerpColor(P.floor, P.floorLit, c);
  ctx.fillRect(room.x, FLOOR_Y, room.w, ROOM_H - FLOOR_Y);
  ctx.strokeStyle = lerpColor(P.line, P.lineLit, c);
  ctx.lineWidth = 2;
  line(ctx, room.x, FLOOR_Y, room.x + room.w, FLOOR_Y, room.x + 7, 1.2);
  ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
  hatch(ctx, room.x, FLOOR_Y + 2, room.w, ROOM_H - FLOOR_Y - 2, 9, room.x + 5, 0.3);
  ctx.globalAlpha = 1;
  // балка под потолком
  ctx.fillStyle = lerpColor(P.accent, P.accentLit, c * 0.6);
  ctx.globalAlpha = 0.5;
  ctx.fillRect(room.x, 0, room.w, 9);
  ctx.globalAlpha = 1;
}

function inkFor(room: RoomDef, env: Env): string {
  return lerpColor(room.palette.line, room.palette.lineLit, env.clear[room.id] ?? 0);
}

function drawMyRoom(ctx: CanvasRenderingContext2D, env: Env, room: RoomDef): void {
  const { g, t } = env;
  const s = g.state;
  const ink = inkFor(room, env);
  ctx.strokeStyle = ink; ctx.lineWidth = 1.8;

  // кровать у дальнего края
  ctx.fillStyle = lerpColor('#3a2a22', '#6b4a32', env.clear['myroom'] ?? 0);
  fillRect(ctx, 150, 196, 66, 22, 41, 1);
  rect(ctx, 150, 196, 66, 22, 41, 1);
  line(ctx, 150, 218, 150, FLOOR_Y, 42, 0.7, 1); line(ctx, 216, 218, 216, FLOOR_Y, 43, 0.7, 1);
  ctx.fillStyle = '#6a574a'; fillRect(ctx, 154, 190, 22, 8, 44, 1);

  // обустройство
  for (const id of s.equipped) drawItem(ctx, env, id, s.broken.includes(id));

  // шкаф
  const hid = s.player.hidden === 'wardrobe';
  const wx = room.x + 100;
  ctx.fillStyle = lerpColor('#4a3626', '#7a5636', env.clear['myroom'] ?? 0);
  fillRect(ctx, wx - 34, 84, 68, FLOOR_Y - 84, 51, 1);
  ctx.strokeStyle = ink;
  rect(ctx, wx - 34, 84, 68, FLOOR_Y - 84, 51, 1.1);
  polyline(ctx, [[wx - 38, 84], [wx + 38, 84]], 52, 1);
  ctx.fillStyle = '#0a0706';
  fillRect(ctx, wx - (hid ? 5 : 1.5), 90, hid ? 10 : 3, FLOOR_Y - 98, 53, 0.4);
  line(ctx, wx - 9, 150, wx - 9, 162, 54, 0.4, 1);
  line(ctx, wx + 9, 150, wx + 9, 162, 55, 0.4, 1);

  // лампа и табурет
  const lx = room.x + 250;
  drawLamp(ctx, env, lx);
  ctx.strokeStyle = ink; ctx.lineWidth = 1.8;
  ctx.fillStyle = '#3a2d25';
  fillRect(ctx, lx - 20, 206, 40, 6, 61, 0.6);
  line(ctx, lx - 16, 212, lx - 18, FLOOR_Y, 62, 0.6, 1);
  line(ctx, lx + 16, 212, lx + 18, FLOOR_Y, 63, 0.6, 1);
  rect(ctx, lx - 20, 206, 40, 6, 61, 0.7);

  // стол с тетрадью
  const nx = room.x + 345;
  ctx.fillStyle = '#4a382b';
  fillRect(ctx, nx - 38, 190, 76, 7, 71, 0.6);
  rect(ctx, nx - 38, 190, 76, 7, 71, 0.7);
  line(ctx, nx - 32, 197, nx - 32, FLOOR_Y, 72, 0.6, 1);
  line(ctx, nx + 32, 197, nx + 32, FLOOR_Y, 73, 0.6, 1);
  ctx.fillStyle = '#c9b88f';
  fillPoly(ctx, [[nx - 13, 190], [nx + 13, 190], [nx + 15, 180], [nx - 11, 180]], 74, 0.5);
  ctx.strokeStyle = 'rgba(60,45,30,0.7)'; ctx.lineWidth = 1;
  line(ctx, nx - 7, 183, nx + 8, 183, 75, 0.3, 1);
  line(ctx, nx - 7, 186, nx + 6, 186, 76, 0.3, 1);
  if (!s.flags['memory_valve']) {
    ctx.strokeStyle = `rgba(233,200,140,${0.35 + 0.3 * Math.sin(t * 2.5)})`; ctx.lineWidth = 1.5;
    blob(ctx, nx, 182, 22 + Math.sin(t * 2.5) * 2, 12, 77, 0.2, false, true);
  }

  // окно
  const wnx = room.x + 440;
  drawWindowView(ctx, env, wnx, 36, 68, 62, env.wid, env.sev);
  ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
  rect(ctx, wnx - 34, 36, 68, 62, 81, 1.1);
  line(ctx, wnx, 36, wnx, 98, 82, 0.8, 1);
  line(ctx, wnx - 34, 67, wnx + 34, 67, 83, 0.8, 1);
  line(ctx, wnx - 40, 98, wnx + 40, 98, 84, 0.9);
  if (s.windowCracks > 0) {
    ctx.strokeStyle = 'rgba(235,240,245,0.75)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < s.windowCracks * 3; i++) {
      const a = hash(i + 5) * 6.28, r = 12 + hash(i) * 26;
      line(ctx, wnx - 6 + hash(i + 9) * 12, 60 + hash(i + 2) * 12, wnx + Math.cos(a) * r, 67 + Math.sin(a) * r * 0.8, 85 + i, 0.8, 1);
    }
  }

  // дверь на лестницу
  const open = tenantAtDoor(g);
  drawDoorOut(ctx, env, room, open);
}

function tenantAtDoor(g: Game): boolean {
  const t = g.rt.tenant;
  return (t.phase === 'enter' || t.phase === 'patrol' || t.phase === 'leave') && t.x > -40 && t.x < 60;
}

function drawDoorOut(ctx: CanvasRenderingContext2D, env: Env, room: RoomDef, open: boolean): void {
  const g = env.g, s = g.state;
  const ink = inkFor(room, env);
  const x = room.x;
  ctx.fillStyle = open ? '#070809' : '#3d2e23';
  if (open) {
    fillRect(ctx, x - 6, 76, 14, FLOOR_Y - 76, 91, 0.5);
    ctx.fillStyle = '#4a382a';
    fillPoly(ctx, [[x + 8, 78], [x + 40, 86], [x + 40, FLOOR_Y - 8], [x + 8, FLOOR_Y]], 92, 0.8);
  } else {
    fillRect(ctx, x, 76, 44, FLOOR_Y - 76, 91, 0.8);
    // холодная щель света снизу — жилец рядом
    const near = g.rt.tenant.phase === 'steps' || g.rt.tenant.phase === 'knock';
    ctx.fillStyle = near ? 'rgba(150,170,195,0.55)' : 'rgba(110,130,150,0.18)';
    ctx.fillRect(x + 2, FLOOR_Y - 3, 40, 3);
  }
  ctx.strokeStyle = ink; ctx.lineWidth = 2;
  rect(ctx, x, 76, 44, FLOOR_Y - 76, 93, 1);
  if (!open) {
    line(ctx, x + 8, 90, x + 8, FLOOR_Y - 14, 94, 0.5, 1);
    line(ctx, x + 34, 90, x + 34, FLOOR_Y - 14, 95, 0.5, 1);
    ctx.fillStyle = ink; blob(ctx, x + 36, 156, 2.4, 2.4, 96, 0.2);
    // засов
    if (s.equipped.includes('bolt')) {
      const br = s.broken.includes('bolt');
      ctx.strokeStyle = br ? '#a8493a' : '#9a8f84'; ctx.lineWidth = 3.5;
      line(ctx, x + 2, 140, x + 42, br ? 146 : 140, 97, 0.8);
      ctx.lineWidth = 1.5;
      line(ctx, x + 2, 136, x + 2, 146, 98, 0.4, 1);
    }
    // лестница наверх — подсказка
    if (s.flags['pantry_box']) {
      ctx.fillStyle = `rgba(233,200,140,${0.6 + 0.3 * Math.sin(env.t * 2)})`;
      ctx.font = '16px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText('⇧', x + 22, 66);
    }
  }
}

function drawLamp(ctx: CanvasRenderingContext2D, env: Env, lx: number): void {
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  line(ctx, lx, 0, lx, 46, 100, 0.5, 1);
  ctx.fillStyle = '#5a4430';
  fillPoly(ctx, [[lx - 15, 46], [lx + 15, 46], [lx + 25, 70], [lx - 25, 70]], 101, 0.5);
  polyline(ctx, [[lx - 15, 46], [lx + 15, 46], [lx + 25, 70], [lx - 25, 70]], 102, 0.7, true);
  const fl = 0.85 + 0.15 * Math.sin(env.t * 9) * Math.sin(env.t * 3.7);
  ctx.fillStyle = `rgba(255,${200 + 20 * fl | 0},130,${0.9 * fl})`;
  blob(ctx, lx, 73, 8, 6, 103, 0.4);
}

function drawItem(ctx: CanvasRenderingContext2D, env: Env, id: string, broken: boolean): void {
  ctx.save();
  if (broken) ctx.globalAlpha = 0.75;
  const ink = broken ? '#a8493a' : INK;
  ctx.strokeStyle = ink; ctx.lineWidth = 1.8;
  if (id === 'chair') {
    const cx = 440;
    ctx.fillStyle = '#5b3f2d';
    fillRect(ctx, cx - 18, 188, 34, 7, 111, 0.5);
    rect(ctx, cx - 18, 188, 34, 7, 111, 0.6);
    line(ctx, cx - 18, 195, cx - 20, FLOOR_Y, 112, 0.5, 1);
    line(ctx, cx + 16, 195, cx + 18, FLOOR_Y, 113, 0.5, 1);
    line(ctx, cx - 18, 188, cx - 20, 150, 114, 0.5, 1);
    line(ctx, cx - 20, 150, cx - 8, 150, 115, 0.5, 1);
    ctx.fillStyle = 'rgba(160,60,50,0.6)';
  } else if (id === 'rug') {
    ctx.fillStyle = '#6b3d36';
    fillRect(ctx, 168, FLOOR_Y - 5, 170, 5, 121, 0.6);
    ctx.strokeStyle = '#d2a56a'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) line(ctx, 176 + i * 16, FLOOR_Y - 4, 184 + i * 16, FLOOR_Y - 1, 122 + i, 0.3, 1);
  } else if (id === 'stove') {
    const sx = 392;
    ctx.fillStyle = '#2b2727';
    fillRect(ctx, sx - 18, 190, 36, 42, 131, 0.8);
    rect(ctx, sx - 18, 190, 36, 42, 131, 0.8);
    line(ctx, sx, 190, sx, 150, 132, 0.6, 1);
    ctx.fillStyle = broken ? '#3a2018' : `rgba(255,150,70,${0.75 + 0.2 * Math.sin(env.t * 7)})`;
    fillRect(ctx, sx - 9, 208, 18, 12, 133, 0.4);
  }
  if (broken) {
    ctx.strokeStyle = '#c9694f'; ctx.lineWidth = 2;
    const cx = id === 'chair' ? 440 : id === 'rug' ? 250 : id === 'stove' ? 392 : 20;
    line(ctx, cx - 8, 200, cx + 8, 216, 140, 0.6, 1);
    line(ctx, cx + 8, 200, cx - 8, 216, 141, 0.6, 1);
  }
  ctx.restore();
}

// ───────── Котельная ─────────

function drawBoiler(ctx: CanvasRenderingContext2D, env: Env, room: RoomDef): void {
  const { g, t } = env;
  const s = g.state, rooted = s.rooms['boiler'].rooted;
  const c = env.clear['boiler'] ?? 0;
  const ink = inkFor(room, env);
  ctx.strokeStyle = ink; ctx.lineWidth = 2;

  // бак / котёл
  const bx = 520 + 250;
  ctx.fillStyle = lerpColor('#2e363b', '#5a3d2a', c);
  fillRect(ctx, bx, 96, 96, FLOOR_Y - 96, 201, 1.2);
  rect(ctx, bx, 96, 96, FLOOR_Y - 96, 201, 1.2);
  for (let i = 1; i < 4; i++) line(ctx, bx, 96 + i * 34, bx + 96, 96 + i * 34, 202 + i, 0.8, 1);
  // топка
  ctx.fillStyle = rooted ? `rgba(255,${140 + 30 * Math.sin(t * 6) | 0},60,0.95)` : '#0b0b0c';
  fillRect(ctx, bx + 24, FLOOR_Y - 46, 48, 32, 210, 0.8);
  rect(ctx, bx + 24, FLOOR_Y - 46, 48, 32, 210, 0.8);
  // манометр
  ctx.fillStyle = '#c5b99d'; blob(ctx, bx + 48, 120, 11, 11, 211, 0.4);
  ctx.strokeStyle = '#2b2218'; ctx.lineWidth = 1.4;
  const ang = rooted ? -0.9 : -0.2 + Math.sin(t * 3) * 0.05 + 1.2 * Math.min(1, leakLevel(s) / 3 + 0.4);
  line(ctx, bx + 48, 120, bx + 48 + Math.cos(ang - 1.57) * 8, 120 + Math.sin(ang - 1.57) * 8, 212, 0.2, 1);
  ctx.strokeStyle = ink; ctx.lineWidth = 2;

  // труба под потолком от котла к стыку
  const px = 520 + 190;
  ctx.fillStyle = lerpColor('#3b4348', '#8a5a36', c);
  fillRect(ctx, px - 7, 0, 14, FLOOR_Y, 221, 0.8);
  fillRect(ctx, px, 52, bx - px, 12, 222, 0.8);
  fillRect(ctx, bx + 40, 40, 12, 56, 223, 0.8);
  ctx.strokeStyle = ink;
  line(ctx, px - 7, 0, px - 7, FLOOR_Y, 224, 0.8);
  line(ctx, px + 7, 0, px + 7, FLOOR_Y, 225, 0.8);
  line(ctx, px, 52, bx + 46, 52, 226, 0.8);
  line(ctx, px + 7, 64, bx + 46, 64, 227, 0.8);
  // фланец-стык
  ctx.fillStyle = lerpColor('#4a5258', '#b07440', c);
  fillRect(ctx, px - 12, 108, 24, 12, 228, 0.6);
  rect(ctx, px - 12, 108, 24, 12, 228, 0.6);

  // состояние течи
  const leak = leakLevel(s);
  const muffled = s.rooms['boiler'].muffledLeft > 0;
  if (muffled) {
    ctx.fillStyle = '#7d756a';
    blob(ctx, px, 114, 15, 11, 229, 1.6);
    ctx.strokeStyle = '#463f37'; ctx.lineWidth = 1.2;
    line(ctx, px - 9, 110, px + 8, 118, 230, 0.6, 1);
    line(ctx, px - 6, 118, px + 10, 110, 231, 0.6, 1);
  }
  if (leak > 0) {
    // капли
    ctx.fillStyle = 'rgba(150,185,205,0.85)';
    const rate = 0.7 + leak * 0.7;
    for (let i = 0; i < 1 + leak; i++) {
      const ph = ((t * rate + i * 0.37) % 1);
      const dy = 120 + ph * ph * (FLOOR_Y - 124);
      ctx.fillRect(px - 1 + (i - 1) * 3, dy, 2, 5 + ph * 4);
    }
    // лужа
    ctx.fillStyle = 'rgba(70,100,120,0.55)';
    blob(ctx, px, FLOOR_Y + 3, 28 + leak * 22, 4 + leak, 232, 1.2);
    ctx.strokeStyle = 'rgba(160,200,220,0.5)'; ctx.lineWidth = 1;
    const rr = (t * 1.6) % 1;
    blob(ctx, px - 6, FLOOR_Y + 3, 4 + rr * 14, 1 + rr * 2.5, 233, 0.2, false, true);
  }
  // вентиль: подсвечивается после воспоминания
  if (!rooted && s.flags['memory_valve']) {
    ctx.strokeStyle = `rgba(240,205,140,${0.45 + 0.35 * Math.sin(t * 3)})`; ctx.lineWidth = 2;
    blob(ctx, px, 114, 24 + Math.sin(t * 3) * 2, 16, 234, 0.3, false, true);
  }
  if (rooted) {
    ctx.strokeStyle = '#d99a58'; ctx.lineWidth = 2.5;
    blob(ctx, px + 24, 114, 9, 9, 235, 0.3, false, true);
    line(ctx, px + 12, 114, px + 15, 114, 236, 0.2, 1);
    line(ctx, px + 24, 105, px + 24, 123, 237, 0.2, 1);
    line(ctx, px + 15, 114, px + 33, 114, 238, 0.2, 1);
    // пар из котла
    ctx.fillStyle = 'rgba(230,220,200,0.14)';
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.25 + i * 0.25) % 1;
      blob(ctx, bx + 46 + Math.sin(ph * 6 + i) * 8, 38 - ph * 34, 6 + ph * 10, 5 + ph * 8, 240 + i, 0.8);
    }
  }

  // ниша
  const nx = 520 + 395;
  const hid = s.player.hidden === 'niche';
  ctx.fillStyle = '#08090a';
  fillPoly(ctx, [[nx - 26, FLOOR_Y], [nx - 26, 134], [nx - 14, 114], [nx + 14, 114], [nx + 26, 134], [nx + 26, FLOOR_Y]], 250, 0.6);
  ctx.strokeStyle = ink; ctx.lineWidth = 2;
  polyline(ctx, [[nx - 26, FLOOR_Y], [nx - 26, 134], [nx - 14, 114], [nx + 14, 114], [nx + 26, 134], [nx + 26, FLOOR_Y]], 251, 1);
  ctx.globalAlpha = hid ? 0.5 : 0.25;
  hatch(ctx, nx - 26, 116, 52, FLOOR_Y - 116, 5, 252, 0.4);
  ctx.globalAlpha = 1;

  // ржавый засов на полу
  if (!s.picked.includes('bolt_pickup')) {
    const bxp = 520 + 70;
    ctx.fillStyle = '#7a4a35'; fillRect(ctx, bxp - 14, FLOOR_Y - 5, 28, 5, 260, 0.5);
    ctx.strokeStyle = '#a0643f'; ctx.lineWidth = 1.2; rect(ctx, bxp - 14, FLOOR_Y - 5, 28, 5, 260, 0.5);
    const gl = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255,230,170,${0.3 + 0.5 * gl})`;
    ctx.fillRect(bxp + 8, FLOOR_Y - 9 - gl * 2, 2, 2);
  }
}

// ───────── Кладовая ─────────

function drawPantry(ctx: CanvasRenderingContext2D, env: Env, room: RoomDef): void {
  const { g, t } = env;
  const s = g.state, opened = s.rooms['pantry'].opened;
  const ink = inkFor(room, env);
  ctx.strokeStyle = ink; ctx.lineWidth = 1.8;

  // стеллаж с банками
  const sx = room.x + 40;
  ctx.fillStyle = '#3a3029';
  for (let r = 0; r < 3; r++) {
    const y = 90 + r * 48;
    fillRect(ctx, sx, y, 130, 5, 301 + r, 0.5);
    rect(ctx, sx, y, 130, 5, 301 + r, 0.5);
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = ['#5e4a2c', '#3d5a47', '#5a3b3b', '#47435f', '#6b5c34'][(j + r) % 5];
      fillRect(ctx, sx + 8 + j * 24, y - 22, 14, 22, 310 + r * 5 + j, 0.5);
    }
    ctx.fillStyle = '#3a3029';
  }
  line(ctx, sx + 2, 90, sx + 2, FLOOR_Y, 320, 0.6, 1);
  line(ctx, sx + 128, 90, sx + 128, FLOOR_Y, 321, 0.6, 1);

  // коробка
  const bx = room.x + 200, opened2 = !!s.flags['pantry_box'];
  ctx.fillStyle = '#6a4d33';
  fillRect(ctx, bx - 30, FLOOR_Y - 34, 60, 34, 330, 0.8);
  rect(ctx, bx - 30, FLOOR_Y - 34, 60, 34, 330, 0.9);
  line(ctx, bx - 30, FLOOR_Y - 18, bx + 30, FLOOR_Y - 18, 331, 0.6, 1);
  if (opened2) {
    ctx.fillStyle = '#4a3624';
    fillPoly(ctx, [[bx - 30, FLOOR_Y - 34], [bx - 36, FLOOR_Y - 58], [bx + 24, FLOOR_Y - 58], [bx + 30, FLOOR_Y - 34]], 332, 0.7);
  } else if (opened) {
    ctx.strokeStyle = `rgba(240,205,140,${0.35 + 0.3 * Math.sin(t * 2.6)})`; ctx.lineWidth = 1.6;
    blob(ctx, bx, FLOOR_Y - 20, 42, 26, 333, 0.3, false, true);
  }

  // окно — всегда «тишина»
  const wx = room.x + 370;
  drawWindowView(ctx, env, wx, 36, 68, 62, 'quiet', 0);
  ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
  rect(ctx, wx - 34, 36, 68, 62, 340, 1.1);
  line(ctx, wx, 36, wx, 98, 341, 0.8, 1);
  line(ctx, wx - 34, 67, wx + 34, 67, 342, 0.8, 1);
  line(ctx, wx - 40, 98, wx + 40, 98, 343, 0.9);

  // паутина
  ctx.strokeStyle = 'rgba(210,205,195,0.25)'; ctx.lineWidth = 0.8;
  const cx = room.x + room.w - 10;
  for (let i = 0; i < 5; i++) line(ctx, cx, 10, cx - 50, 10 + i * 12, 350 + i, 0.4, 1);
  line(ctx, cx - 22, 10, cx - 20, 38, 360, 0.3, 1);
}

// ───────── стены между комнатами ─────────

function drawWalls(ctx: CanvasRenderingContext2D, env: Env): void {
  const g = env.g, s = g.state;
  // стена с правой стороны подвала (x=1560) и левая (x=0)
  ctx.fillStyle = '#17110f';
  ctx.fillRect(-8, 0, 8, ROOM_H);
  ctx.fillRect(1560, 0, 12, ROOM_H);
  ctx.strokeStyle = 'rgba(185,169,143,0.55)'; ctx.lineWidth = 2.4;
  line(ctx, 0, 0, 0, 76, 401, 1.2);
  line(ctx, 0, FLOOR_Y, 0, ROOM_H, 402, 1.2);

  // проём Моя комната ↔ Котельная
  const wx = 520;
  ctx.fillStyle = '#17110f';
  ctx.fillRect(wx - 7, 0, 14, 78);
  ctx.strokeStyle = 'rgba(185,169,143,0.55)';
  line(ctx, wx - 7, 0, wx - 7, 78, 410, 1);
  line(ctx, wx + 7, 0, wx + 7, 78, 411, 1);
  line(ctx, wx - 7, 78, wx + 7, 78, 412, 0.8, 1);
  line(ctx, wx - 7, FLOOR_Y, wx - 7, ROOM_H, 413, 1);
  line(ctx, wx + 7, FLOOR_Y, wx + 7, ROOM_H, 414, 1);

  // дверь в Кладовую
  const px = 1040;
  const opened = s.rooms['pantry'].opened;
  ctx.fillStyle = '#17110f';
  ctx.fillRect(px - 7, 0, 14, 78);
  line(ctx, px - 7, 0, px - 7, 78, 420, 1);
  line(ctx, px + 7, 0, px + 7, 78, 421, 1);
  if (!opened) {
    ctx.fillStyle = '#3a2c20';
    fillRect(ctx, px - 20, 78, 40, FLOOR_Y - 78, 422, 0.8);
    ctx.strokeStyle = '#9a8870'; ctx.lineWidth = 2;
    rect(ctx, px - 20, 78, 40, FLOOR_Y - 78, 422, 1);
    line(ctx, px - 20, 100, px + 20, 130, 423, 0.8);
    line(ctx, px + 20, 100, px - 20, 130, 424, 0.8);
    line(ctx, px - 20, 170, px + 20, 200, 425, 0.8);
    ctx.fillStyle = '#a58d5d'; fillRect(ctx, px - 6, 148, 12, 12, 426, 0.4);
    ctx.strokeStyle = '#a58d5d'; ctx.lineWidth = 2;
    blob(ctx, px, 146, 5, 6, 427, 0.2, false, true);
  } else {
    ctx.fillStyle = 'rgba(255,200,130,0.12)';
    ctx.fillRect(px - 7, 78, 14, FLOOR_Y - 78);
    ctx.fillStyle = '#4a382a';
    fillPoly(ctx, [[px + 6, 80], [px + 20, 86], [px + 20, FLOOR_Y - 6], [px + 6, FLOOR_Y]], 428, 0.6);
    ctx.strokeStyle = '#b9a98f'; ctx.lineWidth = 1.6;
    polyline(ctx, [[px + 6, 80], [px + 20, 86], [px + 20, FLOOR_Y - 6], [px + 6, FLOOR_Y]], 429, 0.8, true);
  }
}

// ───────────────────────── актёры ─────────────────────────

function drawPlayer(ctx: CanvasRenderingContext2D, env: Env): void {
  const { g, t } = env;
  const s = g.state, rt = g.rt;
  if (s.player.hidden) return;
  const x = s.player.x;
  const walking = rt.dir !== 0;
  const bob = walking ? Math.sin(rt.walkPhase) * 1.6 : Math.sin(t * 2) * 0.5;
  const crouch = rt.resting || rt.working;
  const h = crouch ? 26 : 36;
  const y = FLOOR_Y;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.player.face, 1);
  const frac = s.energy / balance.energy.max;

  // тень
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  blob(ctx, 0, 0, 15, 3, 501, 0.3);

  // плащ
  ctx.fillStyle = '#2e2622';
  fillPoly(ctx, [[-10, 0], [-7, -h + 6 + bob], [0, -h + bob], [7, -h + 6 + bob], [11, 0]], 502, 0.6);
  ctx.strokeStyle = '#cdb58f'; ctx.lineWidth = 1.5;
  polyline(ctx, [[-10, 0], [-7, -h + 6 + bob], [0, -h + bob], [7, -h + 6 + bob], [11, 0]], 503, 0.7, true);
  // голова
  ctx.fillStyle = '#d8c3a0';
  blob(ctx, 2, -h - 5 + bob, 6.5, 7, 504, 0.4);
  ctx.fillStyle = '#2e2622';
  blob(ctx, 0.5, -h - 7 + bob, 7.5, 6.5, 505, 0.4);
  // огонёк в руке
  const fl = 1 + 0.15 * Math.sin(t * 10) + 0.1 * Math.sin(t * 17);
  const fr = (3 + 7 * frac) * fl;
  const fx = 11, fy = -h * 0.55 + bob;
  const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 2.2);
  gr.addColorStop(0, 'rgba(255,225,150,0.95)');
  gr.addColorStop(0.35, 'rgba(255,170,70,0.55)');
  gr.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(fx - fr * 2.4, fy - fr * 2.4, fr * 4.8, fr * 4.8);
  ctx.fillStyle = '#fff1c4';
  fillPoly(ctx, [[fx - fr * 0.45, fy + fr * 0.35], [fx, fy - fr * 1.3], [fx + fr * 0.45, fy + fr * 0.35], [fx, fy + fr * 0.75]], 506, 0.2);
  ctx.restore();
}

function drawTenant(ctx: CanvasRenderingContext2D, env: Env): void {
  const { g, t } = env;
  const ten = g.rt.tenant;
  if (ten.phase === 'away') return;
  const x = ten.x;
  const walking = ten.phase !== 'knock' && !(ten.phase === 'patrol' && ten.arrived && ten.pause > 0);
  const sway = walking ? Math.sin(t * 6) * 1.5 : Math.sin(t * 1.2) * 0.5;
  const face = ten.phase === 'leave' ? -1 : 1;
  const h = 70;

  ctx.save();
  ctx.translate(x, FLOOR_Y);
  ctx.scale(face, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; blob(ctx, 0, 0, 18, 3, 601, 0.3);
  ctx.fillStyle = '#060505';
  fillPoly(ctx, [[-13, 0], [-9, -h * 0.7], [-5, -h + 10 + sway], [5, -h + 10 + sway], [10, -h * 0.7], [16, 0]], 602, 0.8);
  ctx.strokeStyle = 'rgba(190,175,160,0.45)'; ctx.lineWidth = 1.3;
  polyline(ctx, [[-13, 0], [-9, -h * 0.7], [-5, -h + 10 + sway], [5, -h + 10 + sway], [10, -h * 0.7], [16, 0]], 603, 0.8, true);
  // голова, чуть опущена
  ctx.fillStyle = '#060505';
  blob(ctx, 3, -h - 2 + sway, 7, 8.5, 604, 0.5);
  ctx.stroke();
  // рука к двери при стуке
  if (ten.phase === 'knock') {
    const hit = ten.timer > balance.tenant.knockInterval - 0.18 ? 6 : 0;
    ctx.strokeStyle = 'rgba(190,175,160,0.5)'; ctx.lineWidth = 2;
    line(ctx, 6, -h * 0.72, 22 + hit, -h * 0.62, 605, 0.5, 1);
  }
  ctx.restore();
}

/** Глаза жильца и «Я» в шкафу — поверх темноты (страшно от узнавания, а не от крика). */
export function drawEyes(ctx: CanvasRenderingContext2D, env: Env): void {
  const { g, t } = env;
  const ten = g.rt.tenant;
  if (ten.phase !== 'away') {
    const face = ten.phase === 'leave' ? -1 : 1;
    const ex = ten.x + face * 6, ey = FLOOR_Y - 71 + Math.sin(t * 6) * 1.5;
    const a = ten.phase === 'steps' ? 0.35 : 0.8;
    ctx.fillStyle = `rgba(235,225,205,${a})`;
    ctx.fillRect(ex - 2.5, ey, 2.2, 1.6);
    ctx.fillRect(ex + 2.5, ey, 2.2, 1.6);
  }
  const h = g.state.player.hidden;
  if (h) {
    const room = roomById(h === 'wardrobe' ? 'myroom' : 'boiler');
    const fx = room.fixtures.find((f) => f.id === h)!;
    const ax = room.x + fx.x, ey = h === 'wardrobe' ? 140 : 150;
    const blink = (Math.sin(t * 0.9) > 0.985) ? 0.2 : 1;
    ctx.fillStyle = `rgba(255,215,140,${0.85 * blink})`;
    ctx.fillRect(ax - 4.5, ey, 2.6, 2 * blink + 0.4);
    ctx.fillRect(ax + 1.8, ey, 2.6, 2 * blink + 0.4);
  }
}

// ───────────────────────── общая сборка ─────────────────────────

export function drawWorld(ctx: CanvasRenderingContext2D, env: Env): void {
  drawBuilding(ctx, env);
  drawStairwell(ctx, env);
  for (const room of data.rooms) {
    drawRoomShell(ctx, env, room);
    if (room.id === 'myroom') drawMyRoom(ctx, env, room);
    else if (room.id === 'boiler') drawBoiler(ctx, env, room);
    else if (room.id === 'pantry') drawPantry(ctx, env, room);
  }
  drawWalls(ctx, env);
  drawTenant(ctx, env);
  drawPlayer(ctx, env);
}
