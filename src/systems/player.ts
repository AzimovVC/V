import { balance } from '../config/balance';
import { data, roomAt, WORLD_RIGHT } from '../data';
import type { Game } from '../core/game';

/** Движение, смена комнат, отмена отдыха/работы при движении. */
export function updatePlayer(g: Game, dt: number): void {
  const { state: s, rt } = g;
  const p = s.player;

  if (rt.dir !== 0) {
    if (p.hidden) g.unhide();
    g.stopRest();
    g.stopWork();
    p.face = rt.dir;
    const slow = s.energy < balance.energy.lowThreshold ? balance.energy.lowSpeedMult : 1;
    p.x += rt.dir * balance.player.speed * slow * dt;
    rt.walkPhase += dt * 9;
  }

  // границы мира: запертая Кладовая не пускает
  const pantryOpen = s.rooms['pantry'].opened;
  const maxX = pantryOpen ? WORLD_RIGHT - 34 : 1040 - 22;
  p.x = Math.max(16, Math.min(maxX, p.x));

  const room = roomAt(p.x);
  if (room.id !== rt.roomId) {
    rt.roomId = room.id;
    g.bus.emit('room:enter', { roomId: room.id });
    if (room.id === 'boiler' && !rt.shown['niche']) { rt.shown['niche'] = true; g.toast(data.texts.hints.tenantNiche); }
  }
}
