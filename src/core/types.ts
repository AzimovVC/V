import type { Balance } from '../config/balance';

export interface Palette {
  wall: string; wallLit: string; line: string; lineLit: string;
  floor: string; floorLit: string; accent: string; accentLit: string;
}

export interface FixtureDef {
  id: string;
  type: string;
  x: number; // относительно левого края комнаты
  radius: number;
  item?: string;
  label?: string;
}

export interface RoomDef {
  id: string;
  name: string;
  feeling: string;
  tier: number;
  x: number;
  w: number;
  furnishable: boolean;
  lockedBy?: string;
  palette: Palette;
  fixtures: FixtureDef[];
}

export interface TierDef { id: string; name: string; theme: string }

export interface ItemDef { id: string; name: string; glyph: string; desc: string; effectText: string }

export interface TenantDef {
  id: string;
  name: string;
  route: string[];
  stops: Record<string, number>; // roomId → абсолютный x остановки
  lines: { steps: string[]; knock: string[]; stop: string[]; caught: string; repelled: string };
}

export type WeatherId = 'quiet' | 'drizzle' | 'storm';

export interface RoomState {
  rooted: boolean;
  muffledLeft: number; // с
  debt: number;
  work: number; // 0..1 прогресс корня
  opened: boolean; // для запертых комнат
}

/** Сохраняемое состояние. Только сериализуемое. */
export interface GameState {
  v: number;
  energy: number;
  player: { x: number; face: 1 | -1; hidden: string | null };
  rooms: Record<string, RoomState>;
  flags: Record<string, boolean>;
  abilities: string[];
  inventory: string[];
  equipped: string[];
  broken: string[];
  picked: string[];
  windowCracks: number;
  weatherShock: number; // с до конца
  weather: number; // сглаженная тяжесть 0..3
  intro: boolean;
}

export type { Balance };
