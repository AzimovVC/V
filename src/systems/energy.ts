import { balance } from '../config/balance';
import { data } from '../data';
import { mods, leakLevel, weatherLevelOf } from '../core/state';
import type { Game } from '../core/game';

/** Огонёк: тает вне света, растёт у лампы. Единственный ресурс. */
export function updateEnergy(g: Game, dt: number): void {
  const { state: s, rt } = g;
  const e = balance.energy;
  const m = mods(s);
  const wl = weatherLevelOf(s.weather);
  let delta = 0;

  if (rt.resting) {
    const crack = 1 - s.windowCracks * balance.penalty.restPerCrack;
    delta += e.lampRestRate * m.restMult * wl.restMult * Math.max(0.3, crack);
    if (s.energy >= e.max) g.stopRest();
  } else if (s.player.hidden) {
    delta -= e.hiddenDrain;
  } else if (!g.isLit(s.player.x)) {
    delta -= e.darkDrain * wl.drainMult * m.darkDrainMult;
    if (!rt.shown['dark']) { rt.shown['dark'] = true; g.toast(data.texts.hints.darkDrain); }
  }

  // лужа под трубой
  if (rt.roomId === 'boiler' && !s.player.hidden) {
    const leak = leakLevel(s);
    const pipeX = 520 + 190;
    if (leak > 0 && Math.abs(s.player.x - pipeX) < balance.boiler.leakPuddleRadius) {
      delta -= balance.boiler.leakDrain * leak;
    }
  }

  // работа над корнем списывает огонёк по ходу
  if (rt.working) delta -= balance.boiler.rootCost / balance.boiler.rootWorkTime;

  s.energy = Math.max(0, Math.min(e.max, s.energy + delta * dt));
  if (s.energy <= 0 && !rt.rollback) g.rollback('blackout');
}
