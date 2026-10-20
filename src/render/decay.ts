import { FLOOR_Y } from '../data';
import type { RoomDef } from '../core/types';
import type { Env } from './world';
import { blob, fillPoly, line, polyline } from './sketch';

const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

/** Следы заброшенности: чем меньше комната расчищена, тем гуще. Убирается вместе с уборкой. */
export function drawDecay(ctx: CanvasRenderingContext2D, env: Env, room: RoomDef): void {
  const k = 1 - (env.clear[room.id] ?? 0);
  if (k < 0.05) return;
  const x0 = room.x, seed = room.x * 0.37;
  ctx.save();

  // подтёки от потолка
  for (let i = 0; i < 5; i++) {
    const x = x0 + 30 + hash(seed + i) * (room.w - 60), len = 50 + hash(seed + i + 9) * 100;
    ctx.fillStyle = `rgba(8,6,5,${0.28 * k})`;
    fillPoly(ctx, [[x - 5, 8], [x + 5, 8], [x + 2 + hash(i) * 3, 8 + len], [x - 2, 8 + len * 0.8]], seed + i + 40, 0.9);
  }
  // облезшие обои: тёмные клочья со светлой кромкой
  for (let i = 0; i < 4; i++) {
    const x = x0 + 40 + hash(seed + i * 3) * (room.w - 100), y = 28 + hash(seed + i * 7) * 70;
    ctx.fillStyle = `rgba(10,8,7,${0.34 * k})`;
    blob(ctx, x, y, 14 + hash(i + seed) * 12, 18 + hash(i + 2) * 14, seed + 60 + i, 0.5);
    ctx.strokeStyle = `rgba(200,185,160,${0.2 * k})`; ctx.lineWidth = 1;
    polyline(ctx, [[x - 12, y + 12], [x - 6, y - 14], [x + 4, y - 18]], seed + 70 + i, 0.8);
  }
  // трещины в штукатурке
  ctx.strokeStyle = `rgba(6,5,4,${0.7 * k})`; ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const x = x0 + 60 + hash(seed + i * 11) * (room.w - 120);
    const pts: Array<[number, number]> = [[x, 10]];
    for (let j = 1; j < 6; j++) pts.push([x + (hash(seed + i * 5 + j) - 0.5) * 36, 10 + j * 22]);
    polyline(ctx, pts, seed + 80 + i, 0.7);
  }
  // царапины от когтей у края комнаты: кто-то пытался войти
  ctx.strokeStyle = `rgba(190,170,140,${0.28 * k})`; ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) line(ctx, x0 + 52 + i * 5, 130 + i * 2, x0 + 46 + i * 5, 180, seed + 90 + i, 0.4, 1);
  // пыльная мгла у пола и паутина в углу
  const g = ctx.createLinearGradient(0, FLOOR_Y - 40, 0, FLOOR_Y);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.3 * k})`);
  ctx.fillStyle = g; ctx.fillRect(x0, FLOOR_Y - 40, room.w, 40);
  ctx.strokeStyle = `rgba(200,195,185,${0.25 * k})`; ctx.lineWidth = 1;
  const cx = x0 + room.w - 4;
  for (let i = 1; i <= 4; i++) line(ctx, cx, 10, cx - 12 * i, 10 + 3 * i, seed + 100 + i, 0.3, 1);
  line(ctx, cx, 10, cx - 36, 44, seed + 110, 0.3, 1);
  line(ctx, cx, 10, cx - 4, 50, seed + 111, 0.3, 1);
  ctx.restore();
}
