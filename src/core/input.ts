import type { Game } from './game';
import type { UI } from '../ui/ui';

/** Ввод: экранные ◀ ▶ + одна контекстная кнопка; клавиатура как дополнение. */
export class Input {
  private left = false;
  private right = false;
  private kLeft = false;
  private kRight = false;
  private game: Game | null = null;
  private ui: UI | null = null;
  private onMute: () => void = () => undefined;

  constructor() {
    this.hold('btn-left', (v) => { this.left = v; this.apply(); });
    this.hold('btn-right', (v) => { this.right = v; this.apply(); });
    this.hold('btn-act', (v) => {
      if (!this.game) return;
      if (v) this.game.actionDown(); else this.game.actionUp();
    });

    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    // запрет контекстного меню/жестов на мобильных
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  attach(g: Game, ui: UI, onMute: () => void): void {
    this.game = g; this.ui = ui; this.onMute = onMute;
    this.releaseAll();
  }
  detach(): void { this.game = null; }

  private releaseAll(): void {
    this.left = this.right = this.kLeft = this.kRight = false;
    this.apply();
    this.game?.actionUp();
  }

  private apply(): void {
    if (!this.game) return;
    const l = this.left || this.kLeft, r = this.right || this.kRight;
    this.game.setDir(l && !r ? -1 : r && !l ? 1 : 0);
  }

  /** Удержание кнопки через pointer events: работает с мультитачем (идти + нажимать действие). */
  private hold(id: string, cb: (down: boolean) => void): void {
    const el = document.getElementById(id) as HTMLElement;
    const up = (e: PointerEvent) => {
      if (!el.classList.contains('down')) return;
      el.classList.remove('down');
      try { el.releasePointerCapture(e.pointerId); } catch { /* */ }
      cb(false);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('down');
      cb(true);
    });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  private key(e: KeyboardEvent, down: boolean): void {
    const k = e.code;
    if (down && k === 'Escape') { this.ui?.escape(); return; }
    if (down && k === 'KeyM') { this.onMute(); return; }
    if (!this.game) return;
    const modal = this.ui?.isModalOpen();
    if (modal) return; // в окнах — обычные кнопки (Tab/Enter)

    if (k === 'ArrowLeft' || k === 'KeyA') { this.kLeft = down; this.apply(); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'KeyD') { this.kRight = down; this.apply(); e.preventDefault(); }
    else if (k === 'Space' || k === 'KeyE' || k === 'Enter' || k === 'ArrowUp' || k === 'KeyW') {
      e.preventDefault();
      if (e.repeat) return;
      if (down) this.game.actionDown(); else this.game.actionUp();
    } else if (down && k === 'KeyB') {
      document.getElementById('btn-bag')?.click();
    } else if (down && k === 'KeyF') {
      document.getElementById('btn-furnish')?.click();
    }
  }
}
