import { balance } from '../config/balance';
import { data, roomAt } from '../data';
import { mods, totalDebt, leakLevel, weatherLevelOf } from '../core/state';
import type { Game } from '../core/game';

export type TenantPhase = 'away' | 'steps' | 'knock' | 'enter' | 'patrol' | 'leave';

export interface TenantRT {
  phase: TenantPhase;
  timer: number;
  x: number;
  knocks: number;
  finalKnock: boolean;
  routeIdx: number;
  pause: number; // >0 — стоит на остановке
  arrived: boolean;
  notice: number; // 0..1 шкала «заметил»
  delayMult: number; // разовый множитель до следующего визита
  stepT: number;
  lineIdx: number;
}

const def = () => data.tenants[0];

export function newTenantRT(_g: Game): TenantRT {
  return {
    phase: 'away', timer: balance.tenant.firstVisitDelay, x: -200, knocks: 0, finalKnock: false,
    routeIdx: 0, pause: 0, arrived: false, notice: 0, delayMult: 1, stepT: 0, lineIdx: 0,
  };
}

/** Интервал до следующего визита: погода, долг, течь и ковёр — всё в одном месте. */
export function nextInterval(g: Game): number {
  const t = balance.tenant, s = g.state;
  const base = t.minInterval + Math.random() * (t.maxInterval - t.minInterval);
  const debtF = Math.max(t.minIntervalFactor, 1 / (1 + totalDebt(s) * t.debtIntervalRate));
  const leakF = 1 / (1 + leakLevel(s) * balance.boiler.leakTenantNoise);
  return base * weatherLevelOf(s.weather).tenantIntervalMult * mods(s).tenantIntervalMult * debtF * leakF * g.rt.tenant.delayMult;
}

/** После отката: сбросить жильца. seconds — через сколько вернётся (по умолчанию обычный интервал). */
export function resetTenantAfter(g: Game, seconds?: number): void {
  const t = g.rt.tenant;
  t.phase = 'away'; t.x = -200; t.knocks = 0; t.finalKnock = false; t.routeIdx = 0;
  t.pause = 0; t.arrived = false; t.notice = 0; t.delayMult = 1;
  t.timer = seconds ?? nextInterval(g);
}

function say(g: Game, kind: 'knock' | 'stop'): void {
  const t = g.rt.tenant;
  const lines = def().lines[kind];
  g.bus.emit('tenant:voice', {});
  g.bus.emit('subtitle', { text: lines[t.lineIdx++ % lines.length], who: def().name });
}

function startLeaving(g: Game): void { g.rt.tenant.phase = 'leave'; g.rt.tenant.notice = 0; }

/** Отпор из расчищенной комнаты: способность «Граница». Без насилия — жилец просто отступает. */
export function repelTenant(g: Game): void {
  const t = g.rt.tenant;
  g.state.energy -= balance.tenant.boundaryCost;
  t.delayMult = balance.tenant.afterBoundaryDelayMult;
  startLeaving(g);
  g.bus.emit('tenant:repelled', {});
  g.toast(data.texts.boundaryUsed);
}

export function updateTenant(g: Game, dt: number): void {
  const t = g.rt.tenant, tb = balance.tenant, s = g.state;
  const T = def();

  switch (t.phase) {
    case 'away': {
      t.timer -= dt;
      if (t.timer <= 0) {
        t.phase = 'steps'; t.timer = 0; t.x = -190; t.stepT = 0;
        g.bus.emit('subtitle', { text: T.lines.steps[0] });
        if (!g.rt.shown['steps']) { g.rt.shown['steps'] = true; g.toast(data.texts.hints.tenantSteps); }
      }
      break;
    }
    case 'steps': {
      t.timer += dt;
      t.x = -190 + 160 * Math.min(1, t.timer / tb.stepsTime);
      t.stepT -= dt;
      if (t.stepT <= 0) { t.stepT = 0.62; g.bus.emit('tenant:steps', { x: t.x }); }
      if (t.timer >= tb.stepsTime) { t.phase = 'knock'; t.timer = 0.5; t.knocks = 0; t.finalKnock = false; t.x = -30; }
      break;
    }
    case 'knock': {
      t.timer -= dt;
      if (t.timer <= 0) {
        if (t.finalKnock) { resolveEntry(g); break; }
        t.knocks++;
        g.bus.emit('tenant:knock', { i: t.knocks });
        if (t.knocks === 1 || t.knocks === tb.knockCount) say(g, 'knock');
        t.timer = tb.knockInterval;
        if (t.knocks >= tb.knockCount) { t.finalKnock = true; t.timer = tb.knockInterval * 1.2; }
      }
      break;
    }
    case 'enter': {
      t.x += tb.walkSpeed * dt;
      if (t.x >= 40) { t.phase = 'patrol'; t.routeIdx = 0; t.arrived = false; t.pause = 0; }
      break;
    }
    case 'patrol': {
      const roomId = T.route[t.routeIdx];
      const stopX = T.stops[roomId];
      if (!t.arrived) {
        const dir = Math.sign(stopX - t.x);
        t.x += dir * tb.walkSpeed * dt;
        t.stepT -= dt;
        if (t.stepT <= 0) { t.stepT = 0.7; g.bus.emit('tenant:steps', { x: t.x }); }
        if (Math.abs(stopX - t.x) < 4) { t.arrived = true; t.pause = tb.pauseAtStop; say(g, 'stop'); }
      } else {
        t.pause -= dt;
        if (t.pause <= 0) {
          t.routeIdx++; t.arrived = false;
          if (t.routeIdx >= T.route.length) startLeaving(g);
        }
      }
      break;
    }
    case 'leave': {
      t.x -= tb.leaveSpeed * dt;
      t.stepT -= dt;
      if (t.stepT <= 0 && t.x > -40) { t.stepT = 0.5; g.bus.emit('tenant:steps', { x: t.x }); }
      if (t.x <= -190) { t.phase = 'away'; t.timer = nextInterval(g); t.delayMult = 1; t.notice = 0; }
      break;
    }
  }

  // замечает ли он «Я»
  const inside = (t.phase === 'enter' || t.phase === 'patrol' || t.phase === 'leave') && t.x >= 0;
  let seen = false;
  if (inside && !s.player.hidden && roomAt(t.x).id === roomAt(s.player.x).id) {
    seen = Math.abs(t.x - s.player.x) < tb.sightRange;
  }
  const prev = t.notice;
  if (seen) t.notice = Math.min(1, t.notice + dt / tb.noticeTime);
  else t.notice = Math.max(0, t.notice - dt * tb.noticeDecay / tb.noticeTime);
  if (Math.floor(prev * 4) !== Math.floor(t.notice * 4)) g.bus.emit('tenant:notice', { level: t.notice });
  if (t.notice >= 1) g.rollback('caught');
}

function resolveEntry(g: Game): void {
  const t = g.rt.tenant;
  if (mods(g.state).boltReady) {
    g.state.broken.push('bolt');
    g.bus.emit('tenant:bolt', {});
    g.bus.emit('item:break', { id: 'bolt' });
    g.toast(data.texts.boltHeld);
    t.delayMult = balance.tenant.boltRepelsDelayMult;
    startLeaving(g);
    return;
  }
  t.phase = 'enter';
  g.bus.emit('tenant:enter', {});
}
