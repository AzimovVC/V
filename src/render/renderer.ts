import { balance } from '../config/balance';
import { roomAt, roomById, WORLD_LEFT, WORLD_RIGHT } from '../data';
import { weatherId } from '../core/state';
import { rollbackFade } from '../systems/penalty';
import type { Game } from '../core/game';
import { setBoil } from './sketch';
import { drawEyes, drawWorld, type Env } from './world';

/**
 * Рендер: камера по горизонтали, дом в разрезе, слой темноты со «светлыми дырами»
 * от лампы/печи/огонька, тёплое свечение, виньетка и зерно.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dark = document.createElement('canvas');
  private dctx = this.dark.getContext('2d')!;
  private vig = document.createElement('canvas');
  private grain: CanvasPattern | null = null;
  private w = 0; private h = 0; private dpr = 1;
  private camX = 250;
  private clear: Record<string, number> = { myroom: 0, boiler: 0, pantry: 0 };
  private t = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.makeGrain();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private makeGrain(): void {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const img = x.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    this.grain = this.ctx.createPattern(c, 'repeat');
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, Math.floor(window.innerWidth * this.dpr));
    this.h = Math.max(1, Math.floor(window.innerHeight * this.dpr));
    this.canvas.width = this.dark.width = this.vig.width = this.w;
    this.canvas.height = this.dark.height = this.vig.height = this.h;
    const v = this.vig.getContext('2d')!;
    const gr = v.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.72)');
    v.fillStyle = gr;
    v.fillRect(0, 0, this.w, this.h);
  }

  /** Целевая «расчищенность» комнат (плавно догоняется). */
  private clearTarget(g: Game, id: string): number {
    const s = g.state;
    if (id === 'boiler') return s.rooms['boiler'].rooted ? 1 : 0;
    if (id === 'pantry') return s.flags['pantry_box'] ? 1 : s.rooms['pantry'].opened ? 0.55 : 0;
    return Math.min(1, (s.rooms['boiler'].rooted ? 0.5 : 0) + (s.flags['pantry_box'] ? 0.5 : 0));
  }

  draw(g: Game, dt: number): void {
    this.t += dt;
    const { ctx, w, h } = this;
    const s = g.state;
    setBoil(Math.floor(this.t * 7) % 3);

    for (const id in this.clear) {
      const tg = this.clearTarget(g, id);
      this.clear[id] += Math.max(-dt * 0.35, Math.min(dt * 0.35, tg - this.clear[id]));
    }

    // камера
    const aspect = w / h;
    const viewW = aspect < 0.9 ? 420 : 700;
    const scale = w / viewW;
    const half = viewW / 2;
    const target = s.player.x + s.player.face * 26;
    const minC = WORLD_LEFT + half - 10, maxC = WORLD_RIGHT - half + 10;
    const cl = (v: number) => (minC > maxC ? (minC + maxC) / 2 : Math.max(minC, Math.min(maxC, v)));
    this.camX += (cl(target) - this.camX) * Math.min(1, dt * 3.5);
    this.camX = cl(this.camX);
    const anchor = aspect < 0.9 ? 0.4 : 0.42;
    const camY = 130;
    const offX = w / 2 - this.camX * scale;
    const offY = h * anchor - camY * scale;

    const wid = weatherId(s.weather);
    const env: Env = {
      g, t: this.t, clear: this.clear, sev: s.weather, wid,
      viewL: -offX / scale - 20, viewR: (w - offX) / scale + 20, viewT: -offY / scale - 20,
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#080605';
    ctx.fillRect(0, 0, w, h);

    ctx.setTransform(scale, 0, 0, scale, offX, offY);
    drawWorld(ctx, env);

    // ───── темнота с дырами света ─────
    const dc = this.dctx;
    dc.globalCompositeOperation = 'source-over';
    dc.setTransform(1, 0, 0, 1, 0, 0);
    const low = s.energy < balance.energy.lowThreshold ? (1 - s.energy / balance.energy.lowThreshold) * 0.06 : 0;
    dc.fillStyle = `rgba(4,3,5,${Math.min(0.96, balance.light.darkness + low)})`;
    dc.fillRect(0, 0, w, h);
    dc.globalCompositeOperation = 'destination-out';
    dc.setTransform(scale, 0, 0, scale, offX, offY);
    const hole = (x: number, y: number, r: number, a = 1) => {
      const gr = dc.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(0.5, `rgba(0,0,0,${a * 0.78})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = gr;
      dc.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const flick = 1 + 0.03 * Math.sin(this.t * 9) + 0.02 * Math.sin(this.t * 23);
    for (const l of g.lightSources()) hole(l.x, l.y, l.r * flick * (l.kind === 'lamp' ? 1.15 : 1));
    if (!s.player.hidden) {
      const fr = balance.light.flameMin + (balance.light.flameMax - balance.light.flameMin) * (s.energy / balance.energy.max);
      hole(s.player.x + s.player.face * 10, 188, fr * flick * (s.energy < balance.energy.lowThreshold ? 0.9 + 0.1 * Math.sin(this.t * 30) : 1), 0.95);
    }
    // тёплый подсвет окон: слабая подсветка ближе к стеклу
    hole(440, 66, 90, 0.35);
    if (s.rooms['pantry'].opened) hole(1040 + 370, 66, 110, 0.5);
    if (g.rt.flash > 0) hole(440, 66, 220, g.rt.flash * 0.6);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.dark, 0, 0);

    // ───── свечение (поверх) ─────
    ctx.globalCompositeOperation = 'lighter';
    ctx.setTransform(scale, 0, 0, scale, offX, offY);
    const glow = (x: number, y: number, r: number, rgb: string, a: number) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const l of g.lightSources()) {
      glow(l.x, l.y, l.r * 0.9 * flick, l.kind === 'window' ? '180,200,230' : '255,170,80', l.kind === 'window' ? 0.07 : 0.15);
    }
    if (!s.player.hidden) glow(s.player.x + s.player.face * 10, 190, 60, '255,190,90', 0.14 * (0.4 + s.energy / balance.energy.max));
    ctx.globalCompositeOperation = 'source-over';

    // глаза поверх темноты
    drawEyes(ctx, env);

    // вспышка молнии на небо
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (g.rt.flash > 0 && wid === 'storm') {
      ctx.fillStyle = `rgba(210,225,255,${g.rt.flash * 0.1})`;
      ctx.fillRect(0, 0, w, h);
    }
    // виньетка + зерно
    ctx.drawImage(this.vig, 0, 0);
    if (this.grain) {
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.globalCompositeOperation = 'overlay';
      ctx.translate(Math.floor(Math.random() * 128), Math.floor(Math.random() * 128));
      ctx.fillStyle = this.grain;
      ctx.fillRect(-128, -128, w + 256, h + 256);
      ctx.restore();
    }
    // фейд отката
    const f = rollbackFade(g);
    if (f > 0) {
      ctx.fillStyle = `rgba(4,3,4,${Math.min(1, f)})`;
      ctx.fillRect(0, 0, w, h);
    }
    void roomAt; void roomById;
  }
}
