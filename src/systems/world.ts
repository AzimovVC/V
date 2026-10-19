import { balance } from '../config/balance';
import { data } from '../data';
import { targetSeverity, weatherId } from '../core/state';
import type { Game } from '../core/game';

let lastWeather = '';

/** Течь, работа над корнем, погода дня. frozen — во время отката, только погода/вспышки. */
export function updateWorld(g: Game, dt: number, frozen: boolean): void {
  const { state: s, rt } = g;
  const b = balance.boiler;

  // погода
  s.weatherShock = Math.max(0, s.weatherShock - dt);
  const target = targetSeverity(s);
  const step = balance.weather.changeRate * dt;
  s.weather += Math.max(-step, Math.min(step, target - s.weather));
  const wid = weatherId(s.weather);
  if (wid !== lastWeather) {
    lastWeather = wid;
    g.bus.emit('weather:level', { id: wid });
  }
  if (wid === 'storm') {
    rt.thunderT -= dt;
    if (rt.thunderT <= 0) {
      const w = balance.weather;
      rt.thunderT = w.thunderMin + Math.random() * (w.thunderMax - w.thunderMin);
      rt.flash = 1;
      g.bus.emit('weather:thunder', { dist: 0.4 + Math.random() * 0.6 });
    }
  }
  if (frozen) return;

  // тряпка высыхает → течь возвращается сильнее (долг остался)
  const boiler = s.rooms['boiler'];
  if (boiler.muffledLeft > 0) {
    boiler.muffledLeft -= dt;
    if (boiler.muffledLeft <= 0) {
      boiler.muffledLeft = 0;
      g.toast(data.texts.pipe.leakBack);
      g.bus.emit('leak:back', { roomId: 'boiler' });
    }
  }

  // работа над корнем: нужно стоять у трубы
  if (rt.working) {
    boiler.work = Math.min(1, boiler.work + dt / b.rootWorkTime);
    if (boiler.work >= 1) completeRoot(g);
  }
}

export function completeRoot(g: Game): void {
  const s = g.state, T = data.texts;
  const r = s.rooms['boiler'];
  g.rt.working = false;
  r.rooted = true;
  r.debt = 0;
  r.muffledLeft = 0;
  r.work = 1;
  if (!s.abilities.includes('boundary')) s.abilities.push('boundary');
  if (!s.inventory.includes('stove')) s.inventory.push('stove');
  s.rooms['pantry'].opened = true;
  g.bus.emit('room:rooted', { roomId: 'boiler' });
  g.bus.emit('ability:gain', { id: 'boundary' });
  g.bus.emit('room:opened', { roomId: 'pantry' });
  g.save();
  g.ui.showMemory('Вентиль', T.pipe.rooted, () => {
    g.toast(T.pantryOpen);
  });
}
