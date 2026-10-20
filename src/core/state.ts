import { balance } from '../config/balance';
import { data } from '../data';
import type { GameState, RoomState, WeatherId } from './types';

const SAVE_KEY = 'dom-vnutri.save.v1';
const VERSION = 2;

function newRoom(): RoomState {
  return { rooted: false, patched: false, debt: 0, opened: false };
}

export function createState(): GameState {
  const rooms: Record<string, RoomState> = {};
  for (const r of data.rooms) rooms[r.id] = newRoom();
  rooms['myroom'].opened = true;
  rooms['boiler'].opened = true;
  return {
    v: VERSION,
    energy: balance.energy.start,
    player: { x: 250, face: 1, hidden: null },
    rooms,
    flags: {},
    abilities: [],
    inventory: [...data.startItems.inventory],
    equipped: [...data.startItems.equipped],
    broken: [],
    done: [],
    mats: {},
    tools: [],
    recipes: [...balance.startRecipes],
    pipe: { rot: data.pipe.tiles.flat().map((x) => x.r), repl: data.pipe.tiles.flat().map(() => false) },
    scavN: 0,
    windowCracks: 0,
    weatherShock: 0,
    weather: balance.weather.baseSeverityByStage[0],
    intro: true,
  };
}

export function saveState(s: GameState): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* приватный режим и т.п. */ }
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* */ }
}

/** Загрузка. Пропущенное время никак не наказывается: огонёк подтягивается к «мягкому полу». */
export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.v !== VERSION) return null;
    const fresh = createState();
    const merged: GameState = { ...fresh, ...s, rooms: { ...fresh.rooms, ...s.rooms } };
    if (merged.pipe.rot.length !== fresh.pipe.rot.length) merged.pipe = fresh.pipe;
    merged.energy = Math.max(merged.energy, balance.energy.welcomeBackFloor);
    merged.player.hidden = null;
    merged.intro = false;
    return merged;
  } catch { return null; }
}

// ───────── производные величины ─────────

/** Стадия дома: 0 — ничего не починено, 1 — труба в Котельной, 2 — коробка в Кладовой. */
export function stageOf(s: GameState): number {
  if (s.flags['pantry_box']) return 2;
  if (s.rooms['boiler'].rooted) return 1;
  return 0;
}

export function totalDebt(s: GameState): number {
  let d = 0;
  for (const id in s.rooms) d += s.rooms[id].debt;
  return d;
}

export function rootedCount(s: GameState): number {
  let n = 0;
  for (const id in s.rooms) if (s.rooms[id].rooted) n++;
  return n;
}

export function targetSeverity(s: GameState): number {
  const b = balance.weather;
  const shock = Math.max(0, s.weatherShock) / b.shockDuration;
  const v = b.baseSeverityByStage[stageOf(s)] + totalDebt(s) * b.debtSeverity + shock * b.shockSeverity;
  return Math.max(0, Math.min(3, v));
}

export function weatherLevelOf(severity: number) {
  for (const l of balance.weather.levels) if (severity < l.max) return l;
  return balance.weather.levels[balance.weather.levels.length - 1];
}
export function weatherId(severity: number): WeatherId {
  return weatherLevelOf(severity).id as WeatherId;
}

/** Течь в Котельной: 0 — нет, иначе уровень 1..leakMax. */
export function leakLevel(s: GameState): number {
  const r = s.rooms['boiler'];
  if (r.rooted || r.patched) return 0;
  return Math.min(balance.boiler.leakMax, balance.boiler.leakBase + r.debt);
}

export interface Mods {
  restMult: number;
  darkDrainMult: number;
  tenantIntervalMult: number;
  boltReady: boolean;
}

/** Суммарные бонусы от обустройства (сломанное не считается). */
export function mods(s: GameState): Mods {
  const m: Mods = { restMult: 1, darkDrainMult: 1, tenantIntervalMult: 1, boltReady: false };
  for (const id of s.equipped) {
    if (s.broken.includes(id)) continue;
    const b = balance.items[id];
    if (!b) continue;
    if (b.restMult) m.restMult += b.restMult;
    if (b.darkDrainMult) m.darkDrainMult *= b.darkDrainMult;
    if (b.tenantIntervalMult) m.tenantIntervalMult *= b.tenantIntervalMult;
    if (b.blocksEntryOnce) m.boltReady = true;
  }
  return m;
}

export const TIDY_TYPES = ['dust', 'mess', 'fix'];

/** Сколько дел по уборке в комнате сделано / всего. */
export function tidyOf(s: GameState, roomId: string): { done: number; total: number } {
  const room = data.rooms.find((r) => r.id === roomId)!;
  let done = 0, total = 0;
  for (const f of room.fixtures) {
    if (!TIDY_TYPES.includes(f.type)) continue;
    total++;
    if (s.done.includes(f.id)) done++;
  }
  return { done, total };
}
export function tidyRooms(s: GameState): number {
  let n = 0;
  for (const r of data.rooms) if (s.flags['tidy_' + r.id]) n++;
  return n;
}

export function lampRadius(s: GameState): number {
  return balance.light.lampRadius + rootedCount(s) * balance.light.lampRadiusPerRoot + tidyRooms(s) * balance.light.lampRadiusPerTidy;
}

export const hasTool = (s: GameState, id: string): boolean => s.tools.includes(id);
export const matCount = (s: GameState, id: string): number => s.mats[id] ?? 0;
export function canPay(s: GameState, cost: Record<string, number>): boolean {
  for (const k in cost) if (matCount(s, k) < cost[k]) return false;
  return true;
}
export function pay(s: GameState, cost: Record<string, number>): void {
  for (const k in cost) s.mats[k] = matCount(s, k) - cost[k];
}
export function gain(s: GameState, got: Record<string, number>): void {
  for (const k in got) s.mats[k] = matCount(s, k) + got[k];
}
