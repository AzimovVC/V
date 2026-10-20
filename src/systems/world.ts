import { data } from '../data';
import { targetSeverity, weatherId } from '../core/state';
import { balance } from '../config/balance';
import type { Game } from '../core/game';

let lastWeather = '';

/** Погода дня. frozen — во время отката, только погода/вспышки. */
export function updateWorld(g: Game, dt: number, _frozen: boolean): void {
  const { state: s, rt } = g;

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
}

/** Головоломка решена: вода нашла дорогу. Заплатка и долг уходят, труба затихает насовсем. */
export function completePipe(g: Game): void {
  const s = g.state, T = data.texts;
  const r = s.rooms['boiler'];
  r.rooted = true;
  r.debt = 0;
  r.patched = false;
  if (!s.abilities.includes('boundary')) s.abilities.push('boundary');
  g.bus.emit('room:rooted', { roomId: 'boiler' });
  g.bus.emit('ability:gain', { id: 'boundary' });
  g.save();
  g.ui.showMemory('Вода нашла дорогу', T.pipe.rooted, () => g.toast(T.pipe.rootedAfter));
}
