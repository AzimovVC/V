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
  needs?: string; // инструмент, без которого точка не открывается
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

export interface ItemDef { id: string; name: string; glyph: string; desc: string; effectText?: string }

export interface NpcTalk {
  id: string;
  text: string;
  when?: string[];
  unless?: string[];
  teach?: string[];
  flag?: string;
  tea?: boolean;
  repeatable?: boolean;
  taught?: string;
}
export interface NpcDef { id: string; name: string; room: string; talks: NpcTalk[]; idle: string[] }

export type TileKind = 'straight' | 'elbow';
export interface PipeTile { t: TileKind; r: number; broken?: boolean }
export interface PipeDef { cols: number; rows: number; inRow: number; outRow: number; solution: [number, number, number][]; tiles: PipeTile[][] }

export interface TenantDef {
  id: string;
  stops: Record<string, number>; // roomId → абсолютный x остановки
  entrances: Array<{ id: 'door' | 'vent' | 'window'; x: number; kind: 'knock' | 'scratch' | 'tap'; weight: number; route: string[]; warn: string }>;
  critique?: { route: string[]; pause: number; lines: Array<{ who: string; text: string }>; after: string };
  lines: { steps: string[]; knock: string[]; scratch: string[]; tap: string[]; stop: string[]; caught: string; repelled: string };
}

export type WeatherId = 'quiet' | 'drizzle' | 'storm';

export interface RoomState {
  rooted: boolean;
  patched: boolean; // заплатка стоит (держится, пока не заметят; долг остаётся)
  debt: number;
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
  done: string[]; // id точек: найдено / разобрано / убрано
  mats: Record<string, number>; // материалы
  tools: string[]; // инструменты
  recipes: string[]; // известные рецепты верстака
  pipe: { rot: number[]; repl: boolean[] }; // головоломка трубы
  scavN: number; // сколько раз рылись в куче
  windowCracks: number;
  weatherShock: number; // с до конца
  weather: number; // сглаженная тяжесть 0..3
  intro: boolean;
}

export type { Balance };
