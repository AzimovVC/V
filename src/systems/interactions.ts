import { balance } from '../config/balance';
import { data, roomById } from '../data';
import { weatherId } from '../core/state';
import { repelTenant } from './tenant';
import { completeRoot } from './world';
import type { Game } from '../core/game';
import type { FixtureDef, RoomDef } from '../core/types';

export interface Action {
  id: string;
  label: string;
  icon: string;
  hold?: boolean;
  run: () => void;
}

/** Ближайший интерактивный предмет в текущей комнате. */
function nearest(g: Game): { room: RoomDef; fx: FixtureDef } | null {
  const room = roomById(g.rt.roomId);
  let best: { room: RoomDef; fx: FixtureDef; d: number } | null = null;
  for (const fx of room.fixtures) {
    const d = Math.abs(g.state.player.x - g.fixtureX(room, fx));
    if (d <= fx.radius && (!best || d < best.d)) best = { room, fx, d };
  }
  return best;
}

/** Контекстное действие для единственной кнопки. Всегда есть малое действие — «Подышать». */
export function resolveAction(g: Game): Action | null {
  const { state: s, rt } = g;
  if (rt.rollback) return null;
  if (s.player.hidden) return { id: 'unhide', label: 'Выйти', icon: '↩', run: () => g.unhide() };
  if (rt.working) return { id: 'stop', label: 'Остановиться', icon: '■', run: () => g.stopWork() };
  if (rt.resting) return { id: 'stoprest', label: 'Встать', icon: '↑', run: () => g.stopRest() };

  const near = nearest(g);
  if (near) {
    const a = fixtureAction(g, near.room, near.fx);
    if (a) return a;
  }
  return { id: 'breath', label: 'Подышать', icon: '○', hold: true, run: () => undefined };
}

function fixtureAction(g: Game, room: RoomDef, fx: FixtureDef): Action | null {
  const s = g.state, T = data.texts;

  switch (fx.type) {
    case 'lamp':
      return { id: 'rest', label: 'Отдохнуть', icon: '☼', run: () => { g.rt.resting = true; g.bus.emit('player:rest', { on: true }); } };

    case 'wardrobe':
    case 'niche':
      return {
        id: 'hide', label: 'Спрятаться', icon: '◐',
        run: () => { s.player.hidden = fx.id; s.player.x = g.fixtureX(room, fx); g.stopRest(); g.bus.emit('player:hide', { id: fx.id }); },
      };

    case 'door_out': {
      const t = g.rt.tenant;
      if (t.phase === 'knock' && s.abilities.includes('boundary')) {
        return {
          id: 'boundary', label: 'Сказать «хватит»', icon: '✋',
          run: () => {
            if (s.energy < balance.tenant.boundaryCost) { g.toast('Не хватает огонька для этих слов.'); return; }
            repelTenant(g);
          },
        };
      }
      if (s.flags['pantry_box']) {
        return {
          id: 'stairs', label: 'Подняться', icon: '⇧',
          run: () => {
            s.flags['finale'] = true;
            g.bus.emit('stairs', {});
            g.ui.showMemory(T.stairs.title, T.stairs.text, () => g.save());
          },
        };
      }
      return null;
    }

    case 'window': {
      if (s.windowCracks > 0) {
        return {
          id: 'fixwin', label: 'Заделать окно', icon: '▭',
          run: () => {
            const c = balance.penalty.windowRepairCost;
            if (s.energy < c) { g.toast('Не хватает огонька. Сначала отдохни у лампы.'); return; }
            s.energy -= c; s.windowCracks--;
            g.bus.emit('window:fix', {});
            g.toast(T.window.fixed);
            g.save();
          },
        };
      }
      return { id: 'look', label: 'Выглянуть', icon: '▭', run: () => g.toast(data.weather[weatherId(s.weather)].look) };
    }

    case 'pantry_window':
      return { id: 'listen', label: 'Постоять', icon: '▭', run: () => g.toast(T.pantryWindow) };

    case 'notebook': {
      const known = !!s.flags['memory_valve'];
      return {
        id: 'memory', label: known ? 'Перечитать' : 'Вспомнить', icon: '✎',
        run: () => {
          if (!known) {
            const c = balance.memory.notebookCost;
            if (s.energy < c) { g.toast('Не хватает огонька. Сначала отдохни у лампы.'); return; }
            s.energy -= c;
            s.flags['memory_valve'] = true;
            g.bus.emit('memory', { id: 'valve' });
            g.ui.showMemory(T.notebook.title, T.notebook.text, () => g.save());
          } else g.ui.showMemory(T.notebook.title, T.notebook.again);
        },
      };
    }

    case 'pickup': {
      if (s.picked.includes(fx.id) || !fx.item) return null;
      return {
        id: 'pickup', label: 'Подобрать', icon: '↧',
        run: () => {
          s.picked.push(fx.id);
          s.inventory.push(fx.item!);
          g.bus.emit('item:gain', { id: fx.item! });
          g.toast(T.boltTaken);
          g.save();
        },
      };
    }

    case 'pipe': {
      if (s.rooms['boiler'].rooted) return null;
      return { id: 'pipe', label: 'Труба', icon: '≋', run: () => openPipe(g) };
    }

    case 'box': {
      if (s.flags['pantry_box']) return null;
      return {
        id: 'box', label: 'Открыть коробку', icon: '▣',
        run: () => {
          const c = balance.memory.boxCost;
          if (s.energy < c) { g.toast('Не хватает огонька. Сначала отдохни у лампы.'); return; }
          s.energy -= c;
          s.flags['pantry_box'] = true;
          s.inventory.push('rug');
          g.bus.emit('item:gain', { id: 'rug' });
          g.bus.emit('memory', { id: 'box' });
          g.ui.showMemory(T.box.title, T.box.text, () => { g.toast(T.box.after); g.save(); });
        },
      };
    }
  }
  return null;
}

function openPipe(g: Game): void {
  const s = g.state, b = balance.boiler, T = data.texts.pipe;
  const room = s.rooms['boiler'];
  const muffled = room.muffledLeft > 0;
  const mCost = b.muffleCost + b.muffleCostPerDebt * room.debt;
  const known = !!s.flags['memory_valve'];
  const resumed = room.work > 0;

  g.ui.showChoice(T.title, T.text, [
    {
      id: 'muffle', label: T.muffle.label, desc: T.muffle.desc,
      cost: `−${mCost} огонька · держит ≈${b.muffleDuration} с · долг +${b.muffleDebt}` + (room.debt ? ` (сейчас ${room.debt})` : ''),
      disabled: muffled ? 'Уже заткнуто.' : s.energy < mCost ? 'Не хватает огонька.' : '',
      pick: () => {
        s.energy -= mCost;
        room.muffledLeft = b.muffleDuration;
        room.debt += b.muffleDebt;
        g.bus.emit('choice:muffle', { roomId: 'boiler' });
        g.toast(T.muffled);
        g.save();
      },
    },
    {
      id: 'root', label: resumed ? 'Продолжить разбираться' : T.root.label, desc: T.root.desc,
      cost: `−${b.rootCost} огонька · ≈${b.rootWorkTime} с на месте · навсегда · даёт способность`,
      disabled: !known ? data.texts.hints.rootNeedsMemory : s.energy < b.rootMinEnergy ? 'Лучше сначала набраться сил у лампы.' : '',
      pick: () => {
        g.bus.emit('choice:root', { roomId: 'boiler' });
        g.rt.working = true;
        g.toast(T.working);
        if (room.work >= 1) completeRoot(g);
      },
    },
    { id: 'leave', label: T.leave, desc: '', cost: '', disabled: '', pick: () => undefined, quiet: true },
  ]);
}
