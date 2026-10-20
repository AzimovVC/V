import { FLOOR_Y } from '../data';
import type { RoomDef } from '../core/types';
import { blob, fillPoly, fillRect, line, lerpColor, polyline, rect } from './sketch';
import type { Env } from './world';

/**
 * Предметы-«точки»: находки, завалы, пыль, беспорядок, перекошенное, верстак, Починщик.
 * Каждый рисуется в двух состояниях — «до» и «после», чтобы уборка была видна.
 */

const seedOf = (id: string) => { let h = 7; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; };

function dust(ctx: CanvasRenderingContext2D, env: Env, x: number, id: string, done: boolean): void {
  const sd = seedOf(id);
  if (done) {
    // чисто: пара тёплых бликов
    ctx.fillStyle = `rgba(255,235,190,${0.1 + 0.08 * Math.sin(env.t * 2 + sd)})`;
    blob(ctx, x, FLOOR_Y - 3, 12, 2, sd, 0.3);
    return;
  }
  // серый налёт на полу + паутина в верхнем углу
  ctx.fillStyle = 'rgba(150,145,135,0.38)';
  blob(ctx, x, FLOOR_Y - 2, 22, 4, sd, 1.2);
  blob(ctx, x - 9, FLOOR_Y - 5, 9, 3, sd + 1, 1);
  ctx.strokeStyle = 'rgba(210,205,195,0.34)'; ctx.lineWidth = 0.9;
  for (let i = 0; i < 4; i++) line(ctx, x - 16, 120, x + 4 + i * 5, 120 + i * 9, sd + i, 0.4, 1);
  line(ctx, x - 10, 120, x - 8, 150, sd + 9, 0.4, 1);
  // пылинки в воздухе
  ctx.fillStyle = 'rgba(210,200,180,0.35)';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 14 + ((i * 9 + env.t * 4) % 30), 190 + Math.sin(env.t * 1.3 + i) * 6 - i * 6, 1.4, 1.4);
}

function mess(ctx: CanvasRenderingContext2D, env: Env, x: number, id: string, done: boolean): void {
  const sd = seedOf(id);
  if (done) {
    // аккуратная стопка
    ctx.fillStyle = '#b9a98a';
    fillRect(ctx, x - 9, FLOOR_Y - 9, 18, 9, sd, 0.4);
    ctx.strokeStyle = 'rgba(60,45,30,0.7)'; ctx.lineWidth = 1;
    rect(ctx, x - 9, FLOOR_Y - 9, 18, 9, sd, 0.4);
    line(ctx, x - 9, FLOOR_Y - 5, x + 9, FLOOR_Y - 5, sd + 1, 0.2, 1);
    return;
  }
  // разбросанные листы и опрокинутое
  ctx.fillStyle = '#a89a7d';
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.7;
    ctx.save(); ctx.translate(x - 14 + i * 10, FLOOR_Y - 2 - (i % 2) * 3); ctx.rotate(a);
    fillRect(ctx, -6, -3, 12, 6, sd + i, 0.4);
    ctx.restore();
  }
  ctx.fillStyle = '#4b4038'; ctx.strokeStyle = '#8a7a66'; ctx.lineWidth = 1.2;
  fillPoly(ctx, [[x + 8, FLOOR_Y - 1], [x + 22, FLOOR_Y - 9], [x + 28, FLOOR_Y - 1]], sd + 7, 0.5);
}

function fix(ctx: CanvasRenderingContext2D, env: Env, x: number, id: string, done: boolean): void {
  const sd = seedOf(id);
  const y = 126;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(done ? 0 : 0.2);
  ctx.fillStyle = '#5b4332';
  fillRect(ctx, -24, 0, 48, 5, sd, 0.4);
  ctx.strokeStyle = '#a89070'; ctx.lineWidth = 1.5;
  rect(ctx, -24, 0, 48, 5, sd, 0.4);
  ctx.fillStyle = done ? '#7a6340' : '#4b3a2c';
  fillRect(ctx, -14, -9, 8, 9, sd + 1, 0.3);
  fillRect(ctx, 4, -7, 10, 7, sd + 2, 0.3);
  ctx.restore();
  if (!done) {
    // болтающийся гвоздь
    ctx.strokeStyle = '#a8493a'; ctx.lineWidth = 1.3;
    line(ctx, x - 20, y + 10, x - 20, y + 20, sd + 3, 0.3, 1);
  } else {
    ctx.fillStyle = `rgba(255,235,190,${0.18 + 0.1 * Math.sin(env.t * 2)})`;
    blob(ctx, x, y + 2, 26, 4, sd, 0.3);
  }
}

function drawer(ctx: CanvasRenderingContext2D, x: number, id: string, done: boolean): void {
  const sd = seedOf(id);
  ctx.fillStyle = '#4a382b';
  fillRect(ctx, x - 14, FLOOR_Y - 30, 28, 30, sd, 0.5);
  ctx.strokeStyle = '#a89070'; ctx.lineWidth = 1.6;
  rect(ctx, x - 14, FLOOR_Y - 30, 28, 30, sd, 0.5);
  line(ctx, x - 14, FLOOR_Y - 15, x + 14, FLOOR_Y - 15, sd + 1, 0.3, 1);
  ctx.fillStyle = '#c9b88f';
  fillRect(ctx, x - 3, FLOOR_Y - 24, 6, 2, sd + 2, 0.1);
  if (done) fillRect(ctx, x - 12, FLOOR_Y - 14, 24, 3, sd + 3, 0.1); // выдвинут
}

function heap(ctx: CanvasRenderingContext2D, env: Env, x: number, id: string): void {
  const sd = seedOf(id);
  ctx.fillStyle = '#3c3530';
  fillPoly(ctx, [[x - 34, FLOOR_Y], [x - 24, FLOOR_Y - 20], [x - 6, FLOOR_Y - 32], [x + 14, FLOOR_Y - 24], [x + 32, FLOOR_Y]], sd, 0.8);
  ctx.strokeStyle = '#8a7a66'; ctx.lineWidth = 1.4;
  polyline(ctx, [[x - 34, FLOOR_Y], [x - 24, FLOOR_Y - 20], [x - 6, FLOOR_Y - 32], [x + 14, FLOOR_Y - 24], [x + 32, FLOOR_Y]], sd, 0.8);
  line(ctx, x - 14, FLOOR_Y - 26, x - 2, FLOOR_Y - 8, sd + 1, 0.4, 1);
  line(ctx, x + 6, FLOOR_Y - 28, x + 18, FLOOR_Y - 10, sd + 2, 0.4, 1);
  const gl = 0.5 + 0.5 * Math.sin(env.t * 3 + sd);
  ctx.fillStyle = `rgba(255,230,170,${0.25 + 0.45 * gl})`;
  ctx.fillRect(x + 4, FLOOR_Y - 20 - gl * 2, 2, 2);
}

function crate(ctx: CanvasRenderingContext2D, x: number, id: string, done: boolean): void {
  const sd = seedOf(id);
  ctx.fillStyle = '#5b4332';
  fillRect(ctx, x - 20, FLOOR_Y - 30, 40, 30, sd, 0.7);
  ctx.strokeStyle = '#a89070'; ctx.lineWidth = 1.6;
  rect(ctx, x - 20, FLOOR_Y - 30, 40, 30, sd, 0.7);
  if (!done) {
    ctx.strokeStyle = '#7d756a'; ctx.lineWidth = 3;
    line(ctx, x - 20, FLOOR_Y - 18, x + 20, FLOOR_Y - 18, sd + 1, 0.5);
  } else {
    ctx.fillStyle = '#2a1f17';
    fillPoly(ctx, [[x - 20, FLOOR_Y - 30], [x - 24, FLOOR_Y - 40], [x + 16, FLOOR_Y - 42], [x + 20, FLOOR_Y - 30]], sd + 2, 0.6);
  }
}

function debris(ctx: CanvasRenderingContext2D, env: Env, x: number, id: string, big: boolean): void {
  const sd = seedOf(id);
  const hgt = big ? 70 : 50;
  ctx.fillStyle = '#3a2f26';
  fillPoly(ctx, [[x - 38, FLOOR_Y], [x - 30, FLOOR_Y - hgt * 0.6], [x - 8, FLOOR_Y - hgt], [x + 20, FLOOR_Y - hgt * 0.8], [x + 38, FLOOR_Y]], sd, 1);
  ctx.strokeStyle = '#8a7358'; ctx.lineWidth = 1.7;
  for (let i = 0; i < 4; i++) {
    const ax = x - 34 + i * 17, ay = FLOOR_Y - 4 - ((i * 13) % 20);
    line(ctx, ax, ay, ax + 28, ay - hgt * 0.7 + i * 6, sd + i, 0.9, 1);
  }
  polyline(ctx, [[x - 38, FLOOR_Y], [x - 30, FLOOR_Y - hgt * 0.6], [x - 8, FLOOR_Y - hgt], [x + 20, FLOOR_Y - hgt * 0.8], [x + 38, FLOOR_Y]], sd + 9, 0.9);
  const gl = 0.5 + 0.5 * Math.sin(env.t * 2.4 + sd);
  ctx.fillStyle = `rgba(255,230,170,${0.2 + 0.4 * gl})`;
  ctx.fillRect(x + 6, FLOOR_Y - hgt * 0.5, 2, 2);
}

function bench(ctx: CanvasRenderingContext2D, x: number, id: string, tilt: boolean, withTools: boolean): void {
  const sd = seedOf(id);
  ctx.save();
  ctx.translate(x, FLOOR_Y);
  ctx.rotate(tilt ? 0.03 : 0);
  ctx.fillStyle = '#5b4332';
  fillRect(ctx, -28, -34, 56, 7, sd, 0.5);
  ctx.strokeStyle = '#b9a98f'; ctx.lineWidth = 1.6;
  rect(ctx, -28, -34, 56, 7, sd, 0.5);
  line(ctx, -24, -27, -24, 0, sd + 1, 0.5, 1);
  line(ctx, 24, -27, 24, 0, sd + 2, 0.5, 1);
  line(ctx, -24, -14, 24, -14, sd + 3, 0.4, 1);
  if (withTools) {
    ctx.strokeStyle = '#9a8f84'; ctx.lineWidth = 2;
    line(ctx, -14, -34, -6, -44, sd + 4, 0.3, 1);
    line(ctx, 6, -34, 6, -48, sd + 5, 0.3, 1);
    line(ctx, 6, -48, 13, -48, sd + 6, 0.3, 1);
  }
  ctx.restore();
}

function hearth(ctx: CanvasRenderingContext2D, env: Env, x: number, cleared: boolean): void {
  const t = env.t;
  ctx.fillStyle = '#2b2727';
  fillRect(ctx, x - 24, FLOOR_Y - 50, 48, 50, 801, 0.8);
  ctx.strokeStyle = '#b9a98f'; ctx.lineWidth = 2;
  rect(ctx, x - 24, FLOOR_Y - 50, 48, 50, 801, 0.8);
  line(ctx, x, FLOOR_Y - 50, x, 20, 802, 0.5, 1); // дымоход
  ctx.fillStyle = '#0b0807';
  fillRect(ctx, x - 14, FLOOR_Y - 34, 28, 22, 803, 0.4);
  const k = cleared ? 1 : 0.65;
  ctx.fillStyle = `rgba(255,${150 + 40 * Math.sin(t * 7) | 0},60,${0.9 * k})`;
  fillPoly(ctx, [[x - 9, FLOOR_Y - 12], [x - 3, FLOOR_Y - 26 - 3 * Math.sin(t * 9)], [x + 2, FLOOR_Y - 18], [x + 7, FLOOR_Y - 28 - 3 * Math.sin(t * 8)], [x + 10, FLOOR_Y - 12]], 804, 0.3);
}

function mender(ctx: CanvasRenderingContext2D, env: Env, x: number, cleared: boolean): void {
  const t = env.t;
  const near = Math.abs(env.g.state.player.x - x) < 120;
  const hurt = !!env.g.state.flags['mender_hurt'];
  const bob = hurt ? 5 : Math.sin(t * 1.4) * 0.8;
  ctx.save();
  ctx.translate(x, FLOOR_Y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; blob(ctx, 0, 0, 20, 3, 811, 0.3);
  // табурет
  ctx.strokeStyle = '#8a7358'; ctx.lineWidth = 1.6;
  ctx.fillStyle = '#4a382b';
  fillRect(ctx, -14, -18, 28, 4, 812, 0.4);
  line(ctx, -11, -14, -13, 0, 813, 0.3, 1);
  line(ctx, 11, -14, 13, 0, 814, 0.3, 1);
  // сутулая фигура: фартук, свитер
  ctx.fillStyle = '#5a4a3a';
  fillPoly(ctx, [[-13, -16], [-11, -42 + bob], [-2, -52 + bob], [8, -48 + bob], [14, -16]], 815, 0.5);
  ctx.strokeStyle = '#cdb58f'; ctx.lineWidth = 1.3;
  polyline(ctx, [[-13, -16], [-11, -42 + bob], [-2, -52 + bob], [8, -48 + bob], [14, -16]], 816, 0.5, true);
  ctx.fillStyle = '#7a5530';
  fillRect(ctx, -6, -34 + bob, 14, 18, 817, 0.3);
  // голова, чуть склонена к рукам; очки поверх
  ctx.fillStyle = '#d8c3a0';
  blob(ctx, 3, -60 + bob, 6.5, 7, 818, 0.4);
  ctx.fillStyle = '#3a2d25';
  fillPoly(ctx, [[-4, -64 + bob], [3, -70 + bob], [10, -64 + bob], [8, -62 + bob], [-2, -62 + bob]], 819, 0.3);
  ctx.strokeStyle = near ? '#f0e0b0' : '#a89070'; ctx.lineWidth = 1;
  blob(ctx, 1, -59 + bob, 2.4, 2.4, 820, 0.1, false, true);
  blob(ctx, 7, -59 + bob, 2.4, 2.4, 821, 0.1, false, true);
  // руки с гаечным ключом — медленно поворачивает
  ctx.strokeStyle = '#9a8f84'; ctx.lineWidth = 2;
  const w = Math.sin(t * 1.6) * 3;
  line(ctx, 8, -30 + bob, 22 + w, -26, 822, 0.3, 1);
  line(ctx, 22 + w, -26, 26 + w, -30, 823, 0.3, 1);
  if (cleared && !hurt) {
    // чашка с паром
    ctx.fillStyle = '#c9b88f'; fillRect(ctx, 18, -38 + bob, 7, 6, 824, 0.2);
    ctx.strokeStyle = 'rgba(230,220,200,0.35)'; ctx.lineWidth = 1;
    line(ctx, 21, -40, 20 + Math.sin(t * 2) * 2, -48, 825, 0.3, 1);
  }
  ctx.restore();
}

/** Тёплые «глаза» Починщика поверх темноты не нужны — он рисуется в свете очага. */

export function drawProps(ctx: CanvasRenderingContext2D, env: Env, room: RoomDef): void {
  const s = env.g.state;
  const cleared = !!s.flags['workshop_cleared'];
  for (const f of room.fixtures) {
    const x = room.x + f.x;
    const done = s.done.includes(f.id);
    switch (f.type) {
      case 'dust': dust(ctx, env, x, f.id, done); break;
      case 'mess': mess(ctx, env, x, f.id, done); break;
      case 'fix':
        if (f.id === 'fix_w1') bench(ctx, x, f.id, !done, true); // шаткий верстак мастерской
        else fix(ctx, env, x, f.id, done);
        break;
      case 'loot':
        if (f.id === 'drawer') drawer(ctx, x, f.id, done);
        else if (f.id === 'crate') crate(ctx, x, f.id, done);
        break; // стеллаж Кладовой рисует сама комната
      case 'scavenge': heap(ctx, env, x, f.id); break;
      case 'debris':
        if (!done) debris(ctx, env, x, f.id, f.id !== 'debris_a');
        break;
      case 'bench': bench(ctx, x, f.id, false, true); break;
      case 'hearth': hearth(ctx, env, x, cleared); break;
      case 'npc': mender(ctx, env, x, cleared); break;
    }
  }
  void fillRect; void lerpColor;
}

/** Тёплый жёлтый свет в мастерской и слегка светлеющие стены задаёт renderer через `clear`. */
