import { balance } from '../config/balance';
import { data, roomById } from '../data';
import { totalDebt, weatherId } from '../core/state';
import { slotCount, slotsFree, toggleEquip, repairItem } from '../systems/furnish';
import type { Game } from '../core/game';

export interface ChoiceOption {
  id: string;
  label: string;
  desc: string;
  cost: string;
  disabled: string; // причина, если недоступно
  pick: () => void;
  quiet?: boolean;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Весь DOM-интерфейс: HUD, контекстная кнопка, окна выбора/памяти/мебели, тосты. */
export class UI {
  private game!: Game;
  private modal = $('modal');
  private toastEl = $('toast');
  private subEl = $('subtitle');
  private toastQ: Array<{ text: string; at: number }> = [];
  private toastT = 0;
  private subT = 0;
  private roomT = 0;
  private closeCb: (() => void) | null = null;
  private escCb: (() => void) | null = null;
  private onMute: () => boolean = () => true;

  bind(g: Game, onMute: () => boolean): void {
    this.game = g;
    this.onMute = onMute;
    g.bus.on('toast', ({ text }) => {
      this.toastQ.push({ text, at: performance.now() });
      if (this.toastQ.length > 3) this.toastQ.shift(); // не копим очередь: старое уже неважно
    });
    g.bus.on('subtitle', ({ text, who }) => {
      this.subEl.textContent = who ? `${who}: «${text}»` : text;
      this.subEl.classList.add('show');
      this.subT = balance.ui.subtitleTime;
    });
    g.bus.on('room:enter', ({ roomId }) => this.showRoomName(roomById(roomId).name));
    $('btn-furnish').onclick = () => this.showFurnish();
    $('btn-mute').onclick = () => { $('btn-mute').classList.toggle('off', !this.onMute()); };
    this.showRoomName(roomById(g.rt.roomId).name);
  }

  show(on: boolean): void {
    $('hud').hidden = !on;
    $('controls').hidden = !on;
  }

  private showRoomName(name: string): void {
    const el = $('roomname');
    el.textContent = name;
    el.classList.add('show');
    this.roomT = 3.2;
  }

  // ───────── покадровое обновление ─────────
  update(dt: number): void {
    const g = this.game;
    if (!g) return;
    const s = g.state, rt = g.rt;

    // огонёк
    const frac = s.energy / balance.energy.max;
    ($('energy-fill') as HTMLElement).style.transform = `scaleX(${frac.toFixed(3)})`;
    $('energy').classList.toggle('low', s.energy < balance.energy.lowThreshold);

    // чипы
    $('chip-weather').textContent = data.weather[weatherId(s.weather)].name;
    const debt = totalDebt(s);
    const chip = $('chip-debt');
    chip.hidden = debt <= 0;
    chip.textContent = `долг ${debt}`;

    // мебель
    const room = roomById(rt.roomId);
    $('btn-furnish').hidden = !(room.furnishable && !rt.modal);

    // контекстное действие
    const a = rt.action;
    const btn = $('btn-act');
    btn.classList.toggle('none', !a);
    $('act-icon').textContent = a?.icon ?? '';
    $('act-label').textContent = a?.label ?? '';
    let prog = 0;
    if (a?.id === 'breath') prog = rt.breathCd > 0 ? 0 : rt.breathHold / balance.energy.breathTime;
    ($('act-prog') as HTMLElement).style.width = `${Math.round(prog * 100)}%`;

    // шкала «заметил»
    const n = rt.tenant.notice;
    const nEl = $('notice');
    nEl.style.opacity = n > 0.02 ? '1' : '0';
    (nEl.querySelector('i') as HTMLElement).style.width = `${Math.round(n * 52)}px`;

    // работа над корнем
    const w = $('work');
    w.classList.toggle('show', rt.working);
    if (rt.working) {
      $('work-label').textContent = data.texts.pipe.working;
      ($('work-fill') as HTMLElement).style.transform = `scaleX(${s.rooms['boiler'].work.toFixed(3)})`;
    }

    // тосты по очереди
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove('show');
    } else if (this.toastQ.length && !rt.modal) {
      const now = performance.now();
      while (this.toastQ.length && now - this.toastQ[0].at > balance.ui.toastMaxAge * 1000) this.toastQ.shift();
      const next = this.toastQ.shift();
      if (next) {
        this.toastEl.textContent = next.text;
        this.toastEl.classList.add('show');
        this.toastT = balance.ui.toastTime;
      }
    }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.subEl.classList.remove('show'); }
    if (this.roomT > 0) { this.roomT -= dt; if (this.roomT <= 0) $('roomname').classList.remove('show'); }
  }

  // ───────── окна ─────────
  private open(html: string): HTMLElement {
    this.modal.innerHTML = `<div class="card">${html}</div>`;
    this.modal.hidden = false;
    this.game.setModal(true);
    return this.modal.firstElementChild as HTMLElement;
  }

  closeModal(): void {
    if (this.modal.hidden) return;
    this.modal.hidden = true;
    this.modal.innerHTML = '';
    this.escCb = null;
    this.game.setModal(false);
    const cb = this.closeCb;
    this.closeCb = null;
    cb?.();
  }

  isModalOpen(): boolean { return !this.modal.hidden; }
  /** Esc / «назад» */
  escape(): void { if (this.escCb) this.escCb(); else this.closeModal(); }

  showMemory(title: string, text: string, onClose?: () => void): void {
    const card = this.open(`<h2>${title}</h2><p>${text}</p><div class="row"><button class="btn" id="m-ok">Хорошо</button></div>`);
    this.closeCb = onClose ?? null;
    const ok = card.querySelector('#m-ok') as HTMLButtonElement;
    ok.onclick = () => { this.game.bus.emit('ui:click', {}); this.closeModal(); };
    ok.focus();
  }

  showChoice(title: string, text: string, options: ChoiceOption[]): void {
    const html = `<h2>${title}</h2><p>${text}</p>` + options.map((o, i) =>
      `<button class="opt${o.quiet ? ' quiet' : ''}" data-i="${i}" ${o.disabled ? 'disabled' : ''}>
        <b>${o.label}</b>${o.desc ? `<span class="desc">${o.desc}</span>` : ''}
        ${o.cost ? `<span class="cost">${o.cost}</span>` : ''}${o.disabled ? `<span class="why">${o.disabled}</span>` : ''}
      </button>`).join('');
    const card = this.open(html);
    this.escCb = () => this.closeModal();
    card.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => {
      b.onclick = () => {
        const o = options[Number(b.dataset.i)];
        if (o.disabled) return;
        this.game.bus.emit('ui:click', {});
        this.closeModal();
        o.pick();
      };
    });
  }

  showFurnish(): void {
    const g = this.game;
    if (g.rt.modal && this.modal.hidden) return;
    const render = (msg = '') => {
      const s = g.state, id = 'myroom';
      const total = slotCount(id);
      const slots: string[] = [];
      for (let i = 0; i < total; i++) {
        const eq = s.equipped[i];
        if (!eq) { slots.push('<div class="slot">пусто</div>'); continue; }
        const it = data.items.find((x) => x.id === eq)!;
        const br = s.broken.includes(eq);
        slots.push(`<div class="slot full ${br ? 'broken' : ''}"><span class="g">${it.glyph}</span>${it.name}${br ? '<br>сломано' : ''}</div>`);
      }
      const list = s.inventory.map((iid) => {
        const it = data.items.find((x) => x.id === iid)!;
        const on = s.equipped.includes(iid), br = s.broken.includes(iid), fixed = !!balance.items[iid]?.fixed;
        const cost = balance.items[iid]?.repairCost ?? 0;
        const btn = fixed ? '<span class="t">на месте</span>'
          : br ? `<button data-act="repair" data-id="${iid}">Починить −${cost}</button>`
          : `<button data-act="toggle" data-id="${iid}">${on ? 'Убрать' : 'Поставить'}</button>`;
        return `<div class="item"><span class="g">${it.glyph}</span><span class="t"><b>${it.name}</b>${it.desc}<br><em>${it.effectText}</em></span>${on && br && !fixed ? `<button data-act="repair" data-id="${iid}">Починить −${cost}</button>` : btn}</div>`;
      }).join('');
      const card = this.open(`<h2>Моя комната</h2>
        <p class="muted">Слотов хватает не на всё. Свободно: ${slotsFree(g, id)} из ${total}. ${msg}</p>
        <div class="slots">${slots.join('')}</div>${list}
        <div class="row" style="margin-top:12px"><button class="btn" id="f-ok">Готово</button></div>`);
      this.closeCb = () => g.save();
      this.escCb = () => this.closeModal();
      (card.querySelector('#f-ok') as HTMLButtonElement).onclick = () => this.closeModal();
      card.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => {
        b.onclick = () => {
          g.bus.emit('ui:click', {});
          const iid = b.dataset.id!;
          const err = b.dataset.act === 'repair' ? repairItem(g, iid) : toggleEquip(g, iid);
          const cb = this.closeCb;
          this.closeCb = null;
          render(err ?? '');
          this.closeCb = cb;
        };
      });
    };
    render();
  }
}
