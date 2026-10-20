import { balance } from '../config/balance';
import { data, roomAt, roomById } from '../data';
import { EventBus } from './events';
import { saveState, stageOf, lampRadius, rootedCount } from './state';
import type { GameState, FixtureDef, RoomDef } from './types';
import type { UI } from '../ui/ui';
import { resolveAction, type Action } from '../systems/interactions';
import { updatePlayer } from '../systems/player';
import { updateEnergy } from '../systems/energy';
import { updateWorld } from '../systems/world';
import { updateTenant, newTenantRT, type TenantRT } from '../systems/tenant';
import { startRollback, updateRollback, type Rollback } from '../systems/penalty';

export interface Runtime {
  dir: -1 | 0 | 1;
  resting: boolean;
  holding: string | null; // id удерживаемого действия («breath»)
  breathHold: number;
  breathCd: number;
  modal: boolean;
  roomId: string;
  tenant: TenantRT;
  rollback: Rollback | null;
  action: Action | null;
  thunderT: number;
  flash: number; // вспышка молнии 0..1
  elapsed: number;
  saveT: number;
  shown: Record<string, boolean>; // разовые подсказки (не сохраняются)
  walkPhase: number;
}

export interface LightSource { x: number; y: number; r: number; kind: 'lamp' | 'furnace' | 'window' | 'hearth' }

export class Game {
  readonly bus = new EventBus();
  readonly rt: Runtime;

  constructor(public state: GameState, public ui: UI) {
    this.rt = {
      dir: 0, resting: false, holding: null, breathHold: 0, breathCd: 0,
      modal: false, roomId: roomAt(state.player.x).id, tenant: newTenantRT(this), rollback: null,
      action: null, thunderT: 8, flash: 0, elapsed: 0, saveT: 0, shown: {}, walkPhase: 0,
    };
  }

  // ───────── цикл ─────────
  update(dt: number): void {
    const rt = this.rt;
    rt.elapsed += dt;
    rt.flash = Math.max(0, rt.flash - dt * 2.2);
    if (rt.rollback) { updateRollback(this, dt); updateWorld(this, dt, true); return; }
    if (rt.modal) { rt.action = null; return; }

    updatePlayer(this, dt);
    updateEnergy(this, dt);
    updateWorld(this, dt, false);
    updateTenant(this, dt);
    this.tickBreath(dt);
    rt.action = resolveAction(this);

    rt.saveT += dt;
    if (rt.saveT > balance.ui.autosaveEvery) { rt.saveT = 0; this.save(); }
  }

  private tickBreath(dt: number): void {
    const rt = this.rt, e = balance.energy;
    rt.breathCd = Math.max(0, rt.breathCd - dt);
    if (rt.holding === 'breath' && rt.breathCd <= 0) {
      rt.breathHold += dt;
      if (rt.breathHold >= e.breathTime) {
        rt.breathHold = 0;
        rt.breathCd = e.breathCooldown;
        this.state.energy = Math.min(e.max, this.state.energy + e.breathGain);
        this.bus.emit('player:breath', {});
        if (!rt.shown['breath']) { rt.shown['breath'] = true; this.toast(data.texts.breath); }
      }
    } else if (rt.holding !== 'breath') rt.breathHold = 0;
  }

  // ───────── ввод ─────────
  actionDown(): void {
    const a = this.rt.action;
    if (!a) return;
    this.bus.emit('ui:click', {});
    if (a.hold) this.rt.holding = a.id;
    else a.run();
  }
  actionUp(): void { this.rt.holding = null; }
  setDir(d: -1 | 0 | 1): void { this.rt.dir = d; }

  // ───────── помощники ─────────
  toast(text: string): void { this.bus.emit('toast', { text }); }
  save(): void { saveState(this.state); this.bus.emit('save', {}); }
  setModal(on: boolean): void { this.rt.modal = on; if (on) { this.rt.dir = 0; this.rt.holding = null; } }

  unhide(): void {
    if (!this.state.player.hidden) return;
    this.state.player.hidden = null;
    this.bus.emit('player:unhide', {});
  }
  stopRest(): void { if (this.rt.resting) { this.rt.resting = false; this.bus.emit('player:rest', { on: false }); } }

  fixtureX(room: RoomDef, fx: FixtureDef): number { return room.x + fx.x; }
  lampX(): number { return roomById('myroom').x + 250; }

  lightSources(): LightSource[] {
    const s = this.state, L = balance.light, out: LightSource[] = [];
    out.push({ x: this.lampX(), y: 62, r: lampRadius(s), kind: 'lamp' });
    if (s.rooms['boiler'].rooted) out.push({ x: 520 + 300, y: 170, r: L.furnaceRadius, kind: 'furnace' });
    if (s.rooms['pantry'].opened) out.push({ x: 1040 + 370, y: 80, r: L.pantryWindowRadius, kind: 'window' });
    if (s.rooms['workshop'].opened) out.push({ x: 1560 + 385, y: 170, r: s.flags['workshop_cleared'] ? L.hearthRadiusCleared : L.hearthRadius, kind: 'hearth' });
    return out;
  }
  isLit(x: number): boolean {
    return this.lightSources().some((l) => Math.abs(x - l.x) < l.r * 0.85);
  }

  stage(): number { return stageOf(this.state); }
  rooted(): number { return rootedCount(this.state); }

  rollback(kind: 'caught' | 'blackout'): void { startRollback(this, kind); }
}
