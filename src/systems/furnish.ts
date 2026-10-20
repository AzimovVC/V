import { balance } from '../config/balance';
import { data } from '../data';
import { canPay, pay } from '../core/state';
import type { Game } from '../core/game';

export function slotCount(roomId: string): number { return balance.furnish.slots[roomId] ?? 0; }
export function slotsFree(g: Game, roomId: string): number { return slotCount(roomId) - g.state.equipped.length; }

/** Поставить/убрать предмет. Сломанный предмет занимает слот, но бонуса не даёт. */
export function toggleEquip(g: Game, id: string): string | null {
  const s = g.state;
  if (balance.items[id]?.fixed) return null;
  if (s.equipped.includes(id)) {
    s.equipped = s.equipped.filter((x) => x !== id);
    return null;
  }
  if (slotsFree(g, 'myroom') <= 0) return 'Слотов нет — сначала убери что-то другое.';
  s.equipped.push(id);
  return null;
}

export function repairItem(g: Game, id: string): string | null {
  const s = g.state, cost = balance.items[id]?.repair ?? {};
  if (!s.broken.includes(id)) return null;
  if (!canPay(s, cost)) return 'Не хватает материалов.';
  pay(s, cost);
  s.broken = s.broken.filter((x) => x !== id);
  g.bus.emit('item:repair', { id });
  g.save();
  return null;
}

export function itemName(id: string): string { return data.items.find((i) => i.id === id)?.name ?? id; }
