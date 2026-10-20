import roomsJson from './rooms.json';
import itemsJson from './items.json';
import tenantsJson from './tenants.json';
import weatherJson from './weather.json';
import npcsJson from './npcs.json';
import puzzlesJson from './puzzles.json';
import textsJson from './texts.json';
import type { RoomDef, TierDef, ItemDef, TenantDef, WeatherId, NpcDef, PipeDef } from '../core/types';

export const data = {
  tiers: roomsJson.tiers as TierDef[],
  rooms: roomsJson.rooms as RoomDef[],
  items: itemsJson.items as ItemDef[],
  materials: itemsJson.materials as ItemDef[],
  tools: itemsJson.tools as ItemDef[],
  startItems: itemsJson.start,
  npcs: npcsJson.npcs as NpcDef[],
  pipe: puzzlesJson.pipe as PipeDef,
  tenants: tenantsJson.tenants as unknown as TenantDef[],
  weather: weatherJson.levels as Record<WeatherId, { name: string; sky: [string, string]; look: string }>,
  texts: textsJson,
};

export const roomById = (id: string): RoomDef => {
  const r = data.rooms.find((x) => x.id === id);
  if (!r) throw new Error('no room ' + id);
  return r;
};
export const itemById = (id: string): ItemDef => {
  const r = data.items.find((x) => x.id === id);
  if (!r) throw new Error('no item ' + id);
  return r;
};

export const WORLD_LEFT = -170;
export const WORLD_RIGHT = 2100;
export const ROOM_H = 260;
export const FLOOR_Y = 232;

export function roomAt(x: number): RoomDef {
  for (const r of data.rooms) if (x >= r.x && x < r.x + r.w) return r;
  return x < 0 ? data.rooms[0] : data.rooms[data.rooms.length - 1];
}

/** Любая вещь по id: мебель, материал или инструмент. */
export function thingById(id: string): ItemDef {
  const r = [...data.items, ...data.materials, ...data.tools].find((x) => x.id === id);
  if (!r) throw new Error('no thing ' + id);
  return r;
}
