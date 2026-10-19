import roomsJson from './rooms.json';
import itemsJson from './items.json';
import tenantsJson from './tenants.json';
import weatherJson from './weather.json';
import textsJson from './texts.json';
import type { RoomDef, TierDef, ItemDef, TenantDef, WeatherId } from '../core/types';

export const data = {
  tiers: roomsJson.tiers as TierDef[],
  rooms: roomsJson.rooms as RoomDef[],
  items: itemsJson.items as ItemDef[],
  startItems: itemsJson.start,
  tenants: tenantsJson.tenants as TenantDef[],
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
export const WORLD_RIGHT = 1580;
export const ROOM_H = 260;
export const FLOOR_Y = 232;

export function roomAt(x: number): RoomDef {
  for (const r of data.rooms) if (x >= r.x && x < r.x + r.w) return r;
  return x < 0 ? data.rooms[0] : data.rooms[data.rooms.length - 1];
}
