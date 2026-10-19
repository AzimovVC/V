/** Типизированная шина событий. Системы не знают друг о друге — только о событиях. */
export interface GameEvents {
  'toast': { text: string };
  'subtitle': { text: string; who?: string };
  'room:enter': { roomId: string };
  'room:rooted': { roomId: string };
  'room:opened': { roomId: string };
  'choice:muffle': { roomId: string };
  'choice:root': { roomId: string };
  'leak:back': { roomId: string };
  'ability:gain': { id: string };
  'item:gain': { id: string };
  'item:break': { id: string };
  'item:repair': { id: string };
  'player:hide': { id: string };
  'player:unhide': Record<string, never>;
  'player:rest': { on: boolean };
  'player:breath': Record<string, never>;
  'player:blackout': Record<string, never>;
  'tenant:steps': { x: number };
  'tenant:knock': { i: number };
  'tenant:voice': Record<string, never>;
  'tenant:enter': Record<string, never>;
  'tenant:repelled': Record<string, never>;
  'tenant:bolt': Record<string, never>;
  'tenant:notice': { level: number };
  'tenant:caught': Record<string, never>;
  'weather:level': { id: string };
  'weather:thunder': { dist: number };
  'window:crack': { n: number };
  'window:fix': Record<string, never>;
  'memory': { id: string };
  'ui:click': Record<string, never>;
  'stairs': Record<string, never>;
  'save': Record<string, never>;
}

type Handler<K extends keyof GameEvents> = (p: GameEvents[K]) => void;

export class EventBus {
  private map = new Map<string, Set<(p: never) => void>>();
  on<K extends keyof GameEvents>(k: K, h: Handler<K>): () => void {
    let s = this.map.get(k);
    if (!s) this.map.set(k, (s = new Set()));
    s.add(h as (p: never) => void);
    return () => s!.delete(h as (p: never) => void);
  }
  emit<K extends keyof GameEvents>(k: K, p: GameEvents[K]): void {
    this.map.get(k)?.forEach((h) => (h as Handler<K>)(p));
  }
}
