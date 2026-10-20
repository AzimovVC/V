import { balance } from '../config/balance';
import { data, roomById, thingById } from '../data';
import { weatherId, tidyOf, hasTool, canPay, pay, gain, matCount } from '../core/state';
import { repelTenant } from './tenant';
import type { Game } from '../core/game';
import type { FixtureDef, NpcTalk, RoomDef } from '../core/types';

export interface Action {
  id: string;
  label: string;
  icon: string;
  hold?: boolean;
  run: () => void;
}

/** Ближайшие интерактивные точки в текущей комнате (по возрастанию расстояния). */
function candidates(g: Game): Array<{ room: RoomDef; fx: FixtureDef }> {
  const room = roomById(g.rt.roomId);
  return room.fixtures
    .map((fx) => ({ room, fx, d: Math.abs(g.state.player.x - g.fixtureX(room, fx)) }))
    .filter((c) => c.d <= c.fx.radius)
    .sort((a, b) => a.d - b.d);
}

/** Контекстное действие для единственной кнопки. Всегда есть малое действие — «Подышать». */
export function resolveAction(g: Game): Action | null {
  const { state: s, rt } = g;
  if (rt.rollback) return null;
  if (s.player.hidden) return { id: 'unhide', label: 'Выйти', icon: '↩', run: () => g.unhide() };
  if (rt.resting) return { id: 'stoprest', label: 'Встать', icon: '↑', run: () => g.stopRest() };

  for (const c of candidates(g)) {
    const a = fixtureAction(g, c.room, c.fx);
    if (a) return a;
  }
  return { id: 'breath', label: 'Подышать', icon: '○', hold: true, run: () => undefined };
}

const tired = (g: Game) => g.toast('Не хватает огонька. Сначала отдохни у лампы.');
function spend(g: Game, c: number): boolean {
  if (g.state.energy < c) { tired(g); return false; }
  g.state.energy -= c;
  return true;
}
const matsText = (m: Record<string, number>): string => Object.keys(m).map((k) => `${thingById(k).name} ×${m[k]}`).join(', ');

function fixtureAction(g: Game, room: RoomDef, fx: FixtureDef): Action | null {
  const s = g.state, T = data.texts;
  const done = s.done.includes(fx.id);
  const needTool = (): Action | null => {
    if (!fx.needs || hasTool(s, fx.needs)) return null;
    const nm = thingById(fx.needs).name;
    return { id: 'locked', label: fx.label ?? 'Не поддаётся', icon: '✕', run: () => g.toast(`Нужен инструмент: ${nm.toLowerCase()}. Его можно сделать на верстаке.`) };
  };

  switch (fx.type) {
    case 'lamp':
    case 'hearth':
      return { id: 'rest', label: fx.type === 'lamp' ? 'Отдохнуть' : 'Посидеть у огня', icon: fx.type === 'lamp' ? '☼' : '♨', run: () => { g.rt.resting = true; g.bus.emit('player:rest', { on: true }); } };

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
        const cost = balance.penalty.windowRepair;
        return {
          id: 'fixwin', label: 'Заделать окно', icon: '▭',
          run: () => {
            if (!canPay(s, cost)) { g.toast(`Нужно: ${matsText(cost).toLowerCase()}.`); return; }
            pay(s, cost); s.windowCracks--;
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
            if (!spend(g, balance.memory.notebookCost)) return;
            s.flags['memory_valve'] = true;
            g.bus.emit('memory', { id: 'valve' });
            g.ui.showMemory(T.notebook.title, T.notebook.text, () => g.save());
          } else g.ui.showMemory(T.notebook.title, T.notebook.again);
        },
      };
    }

    // ───── находки ─────
    case 'loot': {
      if (done) return null;
      const lk = needTool(); if (lk) return lk;
      return {
        id: 'loot', label: fx.label ? `Обыскать: ${fx.label.toLowerCase()}` : 'Обыскать', icon: '⌕',
        run: () => {
          const got = balance.loot[fx.id] ?? {};
          gain(s, got);
          s.done.push(fx.id);
          g.bus.emit('loot', { id: fx.id });
          g.toast(`Нашёл: ${matsText(got).toLowerCase()}.`);
          g.save();
        },
      };
    }

    case 'scavenge':
      return {
        id: 'scavenge', label: 'Порыться в хламе', icon: '⌕',
        run: () => {
          if (!spend(g, balance.scavenge.cost)) return;
          const cyc = balance.scavenge.cycle;
          const id = cyc[s.scavN++ % cyc.length];
          gain(s, { [id]: 1 });
          g.bus.emit('scavenge', {});
          g.toast(`В хламе нашлось: ${thingById(id).name.toLowerCase()}.`);
        },
      };

    // ───── завалы ─────
    case 'debris': {
      if (done) return null;
      const lk = needTool(); if (lk) return lk;
      const c = balance.clear[fx.id];
      return {
        id: 'debris', label: `Разобрать${fx.label ? ': ' + fx.label.toLowerCase() : ''}`, icon: 'ʃ',
        run: () => {
          if (!spend(g, c.cost)) return;
          s.done.push(fx.id);
          gain(s, c.yield);
          g.bus.emit('debris', { id: fx.id });
          g.toast(`Разобрано. Осталось пригодное: ${matsText(c.yield).toLowerCase()}.`);
          afterDebris(g, fx.id, c.opens);
        },
      };
    }

    case 'door_lock': {
      if (done) return null;
      const lk = needTool();
      if (lk) return { ...lk, label: 'Заперто', run: () => g.toast(T.doorLocked) };
      return {
        id: 'unlock', label: 'Отпереть', icon: '⚷',
        run: () => {
          s.done.push(fx.id);
          s.rooms['workshop'].opened = true;
          g.bus.emit('key', {});
          g.bus.emit('room:opened', { roomId: 'workshop' });
          g.toast(T.doorOpened);
          g.save();
        },
      };
    }

    // ───── верстак и рюкзак ─────
    case 'bench':
      return { id: 'bench', label: 'Верстак', icon: '⚒', run: () => g.ui.showCraft() };

    // ───── уборка ─────
    case 'dust':
    case 'mess':
    case 'fix': {
      if (done) return null;
      const tb = balance.tidy[fx.type];
      if (tb.tool && !hasTool(s, tb.tool)) {
        const nm = thingById(tb.tool).name.toLowerCase();
        return { id: 'locked', label: fx.label ?? 'Нужен инструмент', icon: '✕', run: () => g.toast(`Нужен инструмент: ${nm}. Его можно сделать на верстаке.`) };
      }
      const verb = fx.type === 'dust' ? 'Смахнуть' : fx.type === 'mess' ? 'Расставить' : 'Поправить';
      return {
        id: 'tidy', label: `${verb}: ${(fx.label ?? '').toLowerCase()}`, icon: fx.type === 'dust' ? '⌇' : fx.type === 'mess' ? '⊟' : '⚒',
        run: () => {
          if (tb.mats && !canPay(s, tb.mats)) { g.toast(`Нужно: ${matsText(tb.mats).toLowerCase()}.`); return; }
          if (!spend(g, tb.cost)) return;
          if (tb.mats) pay(s, tb.mats);
          s.done.push(fx.id);
          if (Object.keys(tb.yield).length) { gain(s, tb.yield); g.toast(`Под вещами нашлось: ${matsText(tb.yield).toLowerCase()}.`); }
          g.bus.emit('tidy', { kind: fx.type });
          const t = tidyOf(s, room.id);
          if (t.done >= t.total && !s.flags['tidy_' + room.id]) {
            s.flags['tidy_' + room.id] = true;
            g.bus.emit('room:tidy', { roomId: room.id });
            g.toast(T.tidyDone.replace('{room}', room.name.toLowerCase()));
          } else if (!g.rt.shown['tidy1']) { g.rt.shown['tidy1'] = true; g.toast(T.tidyHint); }
          g.save();
        },
      };
    }

    // ───── труба ─────
    case 'pipe': {
      if (s.rooms['boiler'].rooted) return null;
      return { id: 'pipe', label: 'Труба', icon: '≋', run: () => openPipe(g) };
    }

    case 'box': {
      if (s.flags['pantry_box']) return null;
      return {
        id: 'box', label: 'Открыть коробку', icon: '▣',
        run: () => {
          if (!spend(g, balance.memory.boxCost)) return;
          s.flags['pantry_box'] = true;
          if (!s.tools.includes('old_key')) s.tools.push('old_key');
          g.bus.emit('item:gain', { id: 'old_key' });
          g.bus.emit('memory', { id: 'box' });
          g.ui.showMemory(T.box.title, T.box.text, () => { g.toast(T.box.after); g.save(); });
        },
      };
    }

    case 'npc':
      return { id: 'talk', label: 'Поговорить', icon: '☺', run: () => talkTo(g, fx.id) };
  }
  return null;
}

/** После разбора завала: открыть проход, отметить расчищенную мастерскую. */
function afterDebris(g: Game, id: string, opens?: string): void {
  const s = g.state, T = data.texts;
  if (opens) {
    s.rooms[opens].opened = true;
    g.bus.emit('room:opened', { roomId: opens });
    g.toast(T.pantryOpen);
  }
  const w = ['debris_a', 'debris_b', 'debris_c'];
  if (w.includes(id) && w.every((x) => s.done.includes(x)) && !s.flags['workshop_cleared']) {
    s.flags['workshop_cleared'] = true;
    g.bus.emit('room:rooted', { roomId: 'workshop' });
    g.toast(T.workshopCleared);
  }
  g.save();
}

// ───────── Починщик ─────────

function talkTo(g: Game, npcFixtureId: string): void {
  const s = g.state;
  const npc = data.npcs.find((n) => n.id === npcFixtureId)!;
  const flags = s.flags;
  const ok = (t: NpcTalk) =>
    (t.when ?? []).every((f) => flags[f]) && !(t.unless ?? []).some((f) => flags[f]);
  const fresh = npc.talks.find((t) => ok(t) && !flags['talk_' + t.id]);
  const talk = fresh ?? npc.talks.find((t) => ok(t) && t.repeatable);
  g.bus.emit('talk', { id: npc.id });
  if (!talk) {
    const line = npc.idle[Math.floor(Math.random() * npc.idle.length)];
    g.ui.showMemory(npc.name, line);
    return;
  }
  flags['talk_' + talk.id] = true;
  if (talk.flag) flags[talk.flag] = true;
  g.ui.showMemory(npc.name, talk.text, () => {
    for (const r of talk.teach ?? []) if (!s.recipes.includes(r)) s.recipes.push(r);
    if (talk.tea) {
      s.energy = Math.min(balance.energy.max, Math.max(s.energy, balance.mender.teaEnergy));
      g.bus.emit('item:gain', { id: 'tea' });
    }
    if (talk.taught) g.toast(talk.taught);
    g.save();
  });
}

// ───────── Труба: заплатка или настоящий ремонт ─────────

function openPipe(g: Game): void {
  const s = g.state, b = balance.boiler, T = data.texts.pipe;
  const room = s.rooms['boiler'];
  const rags = b.patchRags + b.patchRagsPerDebt * room.debt;
  const known = !!s.flags['memory_valve'];
  const wrench = hasTool(s, 'wrench');

  g.ui.showChoice(T.title, T.text, [
    {
      id: 'patch', label: T.patch.label, desc: T.patch.desc,
      cost: `Тряпки ×${rags} (есть ${matCount(s, 'rag')}) · долг +${b.patchDebt}` + (room.debt ? ` (сейчас ${room.debt})` : ''),
      disabled: room.patched ? 'Уже заделано.' : matCount(s, 'rag') < rags ? 'Не хватает тряпок.' : '',
      pick: () => {
        pay(s, { rag: rags });
        room.patched = true;
        room.debt += b.patchDebt;
        g.bus.emit('patch', { roomId: 'boiler' });
        g.toast(T.patched);
        g.save();
      },
    },
    {
      id: 'repair', label: T.repair.label, desc: T.repair.desc,
      cost: `Нужны: ключ и патрубки ×2 (есть ${matCount(s, 'pipepart')}) · насовсем · даёт способность`,
      disabled: !known ? data.texts.hints.rootNeedsMemory : !wrench ? 'Нужен гаечный ключ. Его можно сделать на верстаке.' : '',
      pick: () => g.ui.showPipe(),
    },
    { id: 'leave', label: T.leave, desc: '', cost: '', disabled: '', pick: () => undefined, quiet: true },
  ]);
}
