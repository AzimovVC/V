import { balance } from '../config/balance';
import { data, roomAt, onFloor1, F1X, WORLD_RIGHT } from '../data';
import type { Game } from '../core/game';

/** Движение, смена комнат, отмена отдыха/работы при движении. */
export function updatePlayer(g: Game, dt: number): void {
  const { state: s, rt } = g;
  const p = s.player;

  if (rt.dir !== 0) {
    if (p.hidden) g.unhide();
    g.stopRest();
    p.face = rt.dir;
    const slow = s.energy < balance.energy.lowThreshold ? balance.energy.lowSpeedMult : 1;
    p.x += rt.dir * balance.player.speed * slow * dt;
    rt.walkPhase += dt * 9;
  }

  // границы мира: запертые двери и неразобранные завалы не пускают
  p.x = onFloor1(p.x) ? Math.max(F1X + 16, Math.min(F1X + 1040 - 22, p.x)) : Math.max(16, Math.min(maxReach(g), p.x));

  const room = roomAt(p.x);
  if (room.id !== rt.roomId) {
    rt.roomId = room.id;
    g.bus.emit('room:enter', { roomId: room.id });
    if (room.id === 'boiler' && !rt.shown['niche']) { rt.shown['niche'] = true; g.toast(data.texts.hints.tenantNiche); }
  }
}

/** Дальше этого x пройти нельзя: пока не открыт проход, не отперта дверь, не разобран завал. */
export function maxReach(g: Game): number {
  const s = g.state;
  let max = WORLD_RIGHT - 34;
  if (!s.rooms['pantry'].opened) max = Math.min(max, 1040 - 22);
  else if (!s.rooms['workshop'].opened) max = Math.min(max, 1560 - 22);
  for (const r of data.rooms) {
    for (const f of r.fixtures) {
      if (f.type === 'debris' && f.id.startsWith('debris_') && !s.done.includes(f.id)) max = Math.min(max, r.x + f.x - 28);
    }
  }
  return max;
}
