import { balance } from '../config/balance';
import { data } from '../data';
import type { Game } from '../core/game';
import { resetTenantAfter } from './tenant';

export interface Rollback { kind: 'caught' | 'blackout'; t: number; applied: boolean }

/** Откат в свою комнату. Без game over: потери, но дом цел, а малое действие остаётся. */
export function startRollback(g: Game, kind: 'caught' | 'blackout'): void {
  if (g.rt.rollback) return;
  g.rt.rollback = { kind, t: 0, applied: false };
  g.rt.resting = false;
  g.rt.working = false;
  g.rt.holding = null;
  if (kind === 'caught') g.bus.emit('tenant:caught', {});
  else g.bus.emit('player:blackout', {});
}

export function updateRollback(g: Game, dt: number): void {
  const rb = g.rt.rollback!;
  rb.t += dt;
  const half = balance.penalty.fadeTime;
  if (!rb.applied && rb.t >= half) {
    rb.applied = true;
    applyRollback(g, rb.kind);
  }
  if (rb.t >= half * 2) g.rt.rollback = null;
}

/** 0..1 затемнение экрана во время отката */
export function rollbackFade(g: Game): number {
  const rb = g.rt.rollback;
  if (!rb) return 0;
  const h = balance.penalty.fadeTime;
  return rb.t < h ? rb.t / h : Math.max(0, 2 - rb.t / h);
}

function applyRollback(g: Game, kind: 'caught' | 'blackout'): void {
  const s = g.state, p = balance.penalty;
  s.player.x = g.lampX() - 40;
  s.player.hidden = null;
  g.rt.roomId = 'myroom';
  if (kind === 'blackout') {
    s.energy = balance.energy.respawnEnergy;
    g.toast(data.texts.blackout);
    resetTenantAfter(g);
  } else {
    s.energy = Math.max(s.energy * (1 - p.energyLossFrac), Math.min(s.energy, p.energyFloor));
    if (s.windowCracks < p.windowCrackMax) {
      s.windowCracks++;
      g.bus.emit('window:crack', { n: s.windowCracks });
    }
    s.weatherShock = balance.weather.shockDuration;
    if (p.breakItemOnCaught) {
      const cands = s.equipped.filter((id) => !balance.items[id]?.fixed && !s.broken.includes(id));
      if (cands.length) {
        const id = cands[Math.floor(Math.random() * cands.length)];
        s.broken.push(id);
        g.bus.emit('item:break', { id });
      }
    }
    g.toast(data.texts.caught);
    resetTenantAfter(g, balance.tenant.afterCaughtDelay);
  }
  g.save();
}
