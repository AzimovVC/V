import { balance } from '../config/balance';
import { thingById } from '../data';
import { canPay, pay, gain } from '../core/state';
import type { Game } from '../core/game';

export const recipeName = (id: string): string => thingById(id).name;
export function costText(cost: Record<string, number>): string {
  return Object.keys(cost).map((k) => `${thingById(k).name} ×${cost[k]}`).join(', ');
}

export function ownsAlready(g: Game, id: string): boolean {
  const r = balance.recipes[id], s = g.state;
  if (r.kind === 'tool') return s.tools.includes(id);
  if (r.kind === 'item') return s.inventory.includes(id);
  return false;
}

/** Сделать вещь на верстаке. Возвращает текст ошибки или null. */
export function craft(g: Game, id: string): string | null {
  const s = g.state, r = balance.recipes[id];
  if (!r || !s.recipes.includes(id)) return 'Не знаю, как это делается.';
  if (ownsAlready(g, id)) return 'Это у тебя уже есть.';
  if (!canPay(s, r.cost)) return 'Не хватает материалов.';
  pay(s, r.cost);
  if (r.kind === 'tool') s.tools.push(id);
  else if (r.kind === 'item') s.inventory.push(id);
  else gain(s, { [id]: r.qty });
  g.bus.emit('craft', { id });
  g.save();
  return null;
}
