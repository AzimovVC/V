import { balance } from '../config/balance';
import { leakLevel } from '../core/state';
import { localX, onFloor1 } from '../data';
import type { Game } from '../core/game';

const MUTE_KEY = 'dom-vnutri.muted';

/**
 * Процедурный звук (Web Audio), без файлов. Звук важнее картинки:
 *  — постоянные слои (дождь, ветер, гул, лампа, давление трубы, тишина Кладовой)
 *    микшируются по комнате игрока и тяжести погоды;
 *  — разовые звуки (стук, шаги, капли, гром) приходят событиями из шины.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private reverb!: GainNode;
  private noise!: AudioBuffer;
  private layers: Record<string, GainNode> = {};
  private lampFilter!: BiquadFilterNode;
  private muted = false;
  private game: Game | null = null;
  private dripT = 1;
  private beatT = 1;
  private offs: Array<() => void> = [];

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* */ }
  }

  isMuted(): boolean { return this.muted; }
  toggleMute(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* */ }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return !this.muted;
  }

  /** Вызывать из жеста пользователя (браузеры не дают звук раньше). */
  start(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(comp).connect(ctx.destination);

    // «воздух дома»: два коротких отражения
    this.reverb = ctx.createGain();
    this.reverb.gain.value = 0.5;
    const d1 = ctx.createDelay(0.5), d2 = ctx.createDelay(0.5), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    d1.delayTime.value = 0.11; d2.delayTime.value = 0.19; fb.gain.value = 0.38;
    lp.type = 'lowpass'; lp.frequency.value = 1600;
    this.reverb.connect(d1); this.reverb.connect(d2);
    d1.connect(lp); d2.connect(lp); lp.connect(fb); fb.connect(d1);
    lp.connect(this.master);

    // белый шум
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const ch = this.noise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;

    this.buildLayers();
    void ctx.resume();
  }

  attach(g: Game): void {
    this.detach();
    this.game = g;
    const on = g.bus.on.bind(g.bus);
    this.offs.push(
      on('ui:click', () => this.blip(520, 0.05)),
      on('tenant:knock', ({ i, kind, x }) => (kind === 'scratch' ? this.scratch(i, x) : kind === 'tap' ? this.glassTap(i, x) : this.knock(i))),
      on('tenant:steps', ({ x }) => this.step(x)),
      on('stairs:step', () => this.stairStep()),
      on('tenant:voice', () => this.mutter()),
      on('tenant:enter', () => this.thud(70, 0.5, 0.25, -0.6)),
      on('tenant:bolt', () => { this.crack(); this.thud(60, 0.5, 0.3, -0.6); }),
      on('tenant:repelled', () => this.boundary()),
      on('tenant:caught', () => this.sting()),
      on('player:hide', () => this.creak()),
      on('player:unhide', () => this.creak()),
      on('player:rest', ({ on: v }) => { if (v) this.chord([196, 247, 294], 1.2, 3.5, 0.05); }),
      on('player:breath', () => this.breathSound()),
      on('player:blackout', () => this.fall()),
      on('weather:thunder', ({ dist }) => this.thunder(dist)),
      on('patch', () => this.cloth()),
      on('patch:torn', () => { this.crack(); this.drip(1, 0); }),
      on('loot', () => { this.rummage(); this.tone(880, 'sine', 0.5, 0.05, { at: 0.2 }); }),
      on('scavenge', () => this.rummage()),
      on('debris', () => { this.crack(); this.thud(90, 0.5, 0.35, 0.2); this.rummage(); }),
      on('craft', () => { this.tap(); this.chime(); }),
      on('tidy', ({ kind }) => (kind === 'dust' ? this.cloth() : kind === 'fix' ? this.tap() : this.rummage())),
      on('room:tidy', () => this.chord([262, 330, 392, 523], 1.4, 5, 0.06)),
      on('key', () => { this.tone(1320, 'sine', 0.3, 0.08); this.tone(990, 'sine', 0.5, 0.06, { at: 0.12 }); this.creak(); }),
      on('pipe:turn', () => this.thud(130, 0.12, 0.25, 0)),
      on('pipe:fit', () => { this.crack(); this.chime(); }),
      on('talk', () => { this.tone(180, 'sine', 0.35, 0.05, { glide: 150 }); this.tone(210, 'sine', 0.3, 0.04, { glide: 170, at: 0.4 }); }),
      on('room:rooted', () => { this.chord([196, 247, 294, 392], 1.8, 6, 0.08); }),
      on('room:opened', () => this.creak()),
      on('item:gain', () => this.chime()),
      on('item:break', () => this.crack()),
      on('item:repair', () => this.tap()),
      on('window:crack', () => this.glass()),
      on('window:fix', () => this.tap()),
      on('memory', () => this.chord([220, 277, 330], 1.4, 4, 0.05)),
      on('ability:gain', () => this.chord([330, 440, 554], 0.6, 3, 0.05)),
    );
  }
  detach(): void { this.offs.forEach((f) => f()); this.offs = []; this.game = null; }

  // ───────── постоянные слои ─────────
  private buildLayers(): void {
    const ctx = this.ctx!;
    const mk = (name: string, node: AudioNode) => {
      const g = ctx.createGain(); g.gain.value = 0;
      node.connect(g).connect(this.master);
      this.layers[name] = g;
    };
    const noiseSrc = () => {
      const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(); return s;
    };
    const filt = (type: BiquadFilterType, f: number, q = 0.7) => {
      const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
    };

    // дождь
    const r = noiseSrc(), rb = filt('bandpass', 3400, 0.5), rh = filt('highpass', 900);
    r.connect(rb).connect(rh);
    mk('rain', rh);

    // ветер с «дыханием»
    const w = noiseSrc(), wl = filt('lowpass', 420, 1.2);
    w.connect(wl);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.11; lg.gain.value = 260;
    lfo.connect(lg).connect(wl.frequency); lfo.start();
    mk('wind', wl);

    // гул дома: три низких голоса
    const drone = ctx.createGain();
    const droneF = filt('lowpass', 240);
    [[55, 'sine'], [82.7, 'sine'], [110.6, 'triangle']].forEach(([f, t]) => {
      const o = ctx.createOscillator(); o.type = t as OscillatorType; o.frequency.value = f as number; o.start(); o.connect(drone);
    });
    drone.connect(droneF);
    mk('drone', droneF);

    // лампа: тихое гудение с потрескиванием
    this.lampFilter = filt('lowpass', 900);
    const lo = ctx.createOscillator(); lo.frequency.value = 100; lo.start();
    const lo2 = ctx.createOscillator(); lo2.frequency.value = 200.7; lo2.type = 'triangle'; lo2.start();
    lo.connect(this.lampFilter); lo2.connect(this.lampFilter);
    mk('lamp', this.lampFilter);

    // давление трубы (пока не расчищена): низкая пила, тремоло
    const pipe = ctx.createOscillator(); pipe.type = 'sawtooth'; pipe.frequency.value = 48; pipe.start();
    const pf = filt('lowpass', 130, 1.5);
    pipe.connect(pf);
    const tl = ctx.createOscillator(), tg = ctx.createGain();
    tl.frequency.value = 3.1; tg.gain.value = 40; tl.connect(tg).connect(pf.frequency); tl.start();
    mk('pressure', pf);

    // тёплый пад: появляется с расчисткой, «тишина» Кладовой
    const pad = ctx.createGain();
    [196, 246.9, 293.7, 392].forEach((f, i) => {
      const o = ctx.createOscillator(); o.frequency.value = f * (1 + i * 0.0008); o.start(); o.connect(pad);
    });
    const padF = filt('lowpass', 900);
    pad.connect(padF);
    mk('pad', padF);

    // тревожная пара (Критик рядом)
    const tn = ctx.createGain();
    [233.1, 246.9].forEach((f) => { const o = ctx.createOscillator(); o.frequency.value = f; o.start(); o.connect(tn); });
    const tf = filt('lowpass', 500);
    tn.connect(tf);
    mk('tension', tf);
  }

  // ───────── покадровая микшировка ─────────
  update(dt: number): void {
    const ctx = this.ctx, g = this.game;
    if (!ctx || !g) return;
    const s = g.state, rt = g.rt;
    const sev = Math.min(1, s.weather / 3);
    const room = rt.roomId;
    const pantryQuiet = room === 'pantry' && s.rooms['pantry'].opened;
    const expo = room === 'myroom' ? 1 : room === 'boiler' ? 0.35 : pantryQuiet ? 0 : 0.2;
    const t = ctx.currentTime;
    const set = (name: string, v: number, tc = 0.5) => this.layers[name]?.gain.setTargetAtTime(v, t, tc);

    set('rain', expo * (0.015 + 0.2 * Math.pow(sev, 1.3)), 0.8);
    set('wind', expo * (0.01 + 0.22 * sev), 0.8);

    const rooted = g.rooted();
    set('drone', pantryQuiet ? 0.015 : 0.085 * (1 - 0.35 * rooted), 0.8);

    const lampD = Math.abs(s.player.x - g.lampX());
    set('lamp', room === 'myroom' ? 0.05 * Math.max(0.2, 1 - lampD / 320) : 0.006, 0.4);

    const nearPipe = room === 'boiler' ? Math.max(0.15, 1 - Math.abs(s.player.x - 710) / 400) : room === 'myroom' ? 0.06 : 0;
    set('pressure', s.rooms['boiler'].rooted ? 0 : 0.11 * nearPipe * (s.rooms['boiler'].patched ? 0.4 : 1), 0.6);

    set('pad', (pantryQuiet ? 0.055 : 0) + rooted * 0.012 + (rt.resting ? 0.02 : 0), 1.2);

    const tp = rt.tenant.phase;
    const tens = tp === 'away' ? 0 : tp === 'steps' ? 0.2 : tp === 'knock' ? 0.55 : 0.8;
    set('tension', 0.05 * tens + rt.tenant.notice * 0.09, 0.4);

    // капель
    const leak = leakLevel(s);
    this.dripT -= dt;
    if (leak > 0 && this.dripT <= 0 && !pantryQuiet) {
      this.dripT = (1.5 / leak) * (0.7 + Math.random() * 0.6);
      const dx = 710 - s.player.x;
      const vol = room === 'boiler' ? 1 / (1 + Math.abs(dx) / 220) : room === 'myroom' ? 0.18 : 0;
      if (vol > 0.03) this.drip(vol, Math.max(-1, Math.min(1, dx / 500)));
    }
    // сердцебиение при слабом огоньке
    const low = balance.energy.lowThreshold;
    this.beatT -= dt;
    if (s.energy < low && this.beatT <= 0 && !rt.rollback) {
      const k = 1 - s.energy / low;
      this.beatT = 1.1 - 0.4 * k;
      this.thud(52, 0.16, 0.22 * k, 0);
      setTimeout(() => this.thud(46, 0.14, 0.14 * k, 0), 170);
    }
  }

  // ───────── разовые звуки ─────────
  private out(pan: number): AudioNode {
    const ctx = this.ctx!;
    if (!ctx.createStereoPanner) return this.master;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.master);
    const send = ctx.createGain(); send.gain.value = 0.35; p.connect(send).connect(this.reverb);
    return p;
  }

  private tone(freq: number, type: OscillatorType, dur: number, vol: number, opts: { glide?: number; pan?: number; attack?: number; at?: number; lp?: number } = {}): void {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + (opts.at ?? 0), a = opts.attack ?? 0.005;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = o;
    if (opts.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); node = f; }
    node.connect(g).connect(this.out(opts.pan ?? 0));
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  private burst(dur: number, vol: number, type: BiquadFilterType, freq: number, opts: { q?: number; pan?: number; at?: number; sweep?: number } = {}): void {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + (opts.at ?? 0);
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = opts.q ?? 0.8;
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(this.out(opts.pan ?? 0));
    s.start(t0, Math.random() * 2, dur + 0.05);
  }

  private thud(freq: number, dur: number, vol: number, pan: number): void {
    this.tone(freq * 1.6, 'sine', dur, vol, { glide: freq, pan });
    this.burst(dur * 0.4, vol * 0.7, 'lowpass', 380, { pan });
  }

  private blip(f: number, vol: number): void { this.tone(f, 'sine', 0.07, vol); }
  private tap(): void { for (let i = 0; i < 3; i++) this.burst(0.05, 0.25, 'bandpass', 1500, { at: i * 0.22, q: 2 }); }
  private chime(): void { this.tone(660, 'sine', 1.1, 0.1); this.tone(990, 'sine', 1.4, 0.06, { at: 0.08 }); }

  private knock(i: number): void {
    const v = 0.5 + 0.2 * i;
    this.burst(0.07, v, 'lowpass', 1100, { pan: -0.7 });
    this.tone(150, 'sine', 0.18, v * 0.9, { glide: 70, pan: -0.7 });
    this.burst(0.05, v * 0.5, 'bandpass', 700, { pan: -0.7, at: 0.11, q: 1.5 });
  }

  private panOf(x: number): number {
    const g = this.game;
    return g ? Math.max(-1, Math.min(1, (localX(x) - localX(g.state.player.x)) / 420)) : 0;
  }

  /** Расстояние до источника звука: на другом этаже глуше и дальше. */
  private dist(x: number): number {
    const px = this.game?.state.player.x ?? 0;
    return Math.abs(localX(x) - localX(px)) + (onFloor1(x) !== onFloor1(px) ? 220 : 0);
  }

  /** Шаги по лестнице: глухие, неровные. */
  private stairStep(): void {
    const v = 0.34;
    this.burst(0.08, v, 'lowpass', 420, { pan: -0.2 });
    this.tone(70, 'sine', 0.1, v * 0.8, { glide: 45, pan: -0.2 });
  }

  /** Скрежет по металлу решётки: шипящий шум с дрожащим фильтром. */
  private scratch(i: number, x: number): void {
    const v = (0.22 + 0.12 * i) / (1 + this.dist(x) / 300);
    const pan = this.panOf(x);
    this.burst(0.28, v, 'highpass', 2600, { pan });
    this.burst(0.2, v * 0.8, 'bandpass', 3800, { pan, at: 0.22, q: 3 });
    this.tone(95, 'sawtooth', 0.3, v * 0.25, { glide: 70, pan });
  }

  /** Сухой стук ногтем по стеклу. */
  private glassTap(i: number, x: number): void {
    const v = (0.3 + 0.15 * i) / (1 + this.dist(x) / 300);
    const pan = this.panOf(x);
    this.tone(1900, 'sine', 0.05, v * 0.6, { glide: 1500, pan });
    this.burst(0.03, v * 0.5, 'highpass', 3000, { pan });
    this.tone(1900, 'sine', 0.05, v * 0.4, { glide: 1500, pan, at: 0.16 });
  }

  private step(x: number): void {
    const g = this.game; if (!g) return;
    const d = this.dist(x);
    const inside = x >= 0;
    const vol = (inside ? 0.5 : 0.28) / (1 + d / 240);
    const lp = inside ? 520 : 260; // за стеной глуше
    this.burst(0.09, vol, 'lowpass', lp, { pan: this.panOf(x) });
    this.tone(60, 'sine', 0.12, vol * 0.8, { glide: 40, pan: this.panOf(x) });
  }

  private mutter(): void {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime;
    const f0 = 95 + Math.random() * 25;
    [1, 1.007].forEach((m) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * m, t0);
      o.frequency.linearRampToValueAtTime(f0 * m * 0.82, t0 + 1.1);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(600, t0); f.frequency.linearRampToValueAtTime(950, t0 + 0.5); f.frequency.linearRampToValueAtTime(520, t0 + 1.1); f.Q.value = 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.15);
      g.gain.setTargetAtTime(0.04, t0 + 0.35, 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
      o.connect(f).connect(g).connect(this.out(-0.4));
      o.start(t0); o.stop(t0 + 1.3);
    });
  }

  private drip(vol: number, pan: number): void {
    const f = 700 + Math.random() * 500;
    this.tone(f, 'sine', 0.16, 0.16 * vol, { glide: f * 0.45, pan, lp: 2400 });
    this.tone(f * 2.01, 'sine', 0.06, 0.04 * vol, { pan });
  }

  private thunder(dist: number): void {
    const g = this.game; if (!g) return;
    const pantryQuiet = g.rt.roomId === 'pantry' && g.state.rooms['pantry'].opened;
    const room = g.rt.roomId === 'myroom' ? 1 : 0.55;
    const v = (pantryQuiet ? 0.12 : 0.55) * room * (1.1 - dist * 0.5);
    const at = dist * 1.6;
    this.burst(0.35, v * 0.8, 'highpass', 900, { at: at - 0.3 > 0 ? at - 0.3 : 0, q: 0.5 }); // треск перед раскатом
    this.burst(3.6, v, 'lowpass', 520, { at, sweep: 60, q: 0.7 });
    this.tone(48, 'sine', 3, v * 0.7, { at, glide: 32, attack: 0.15 });
  }

  private chord(freqs: number[], attack: number, dur: number, vol: number): void {
    freqs.forEach((f, i) => this.tone(f, 'sine', dur, vol / (1 + i * 0.25), { attack, at: i * 0.07 }));
  }

  private creak(): void {
    this.tone(210, 'sawtooth', 0.35, 0.06, { glide: 150, lp: 420 });
    this.burst(0.3, 0.12, 'bandpass', 500, { sweep: 300, q: 3 });
  }
  private rummage(): void { for (let i = 0; i < 4; i++) this.burst(0.06, 0.22, 'bandpass', 900 + i * 260, { at: i * 0.09, q: 1.2 }); }
  private cloth(): void { this.burst(0.5, 0.25, 'lowpass', 700, { sweep: 300 }); }
  private crack(): void { this.burst(0.06, 0.6, 'bandpass', 1600, { q: 2 }); this.burst(0.05, 0.4, 'bandpass', 900, { at: 0.07, q: 2 }); }
  private glass(): void { this.burst(0.5, 0.45, 'highpass', 3500, { q: 0.6 }); this.tone(2300, 'sine', 0.5, 0.04, { glide: 1900 }); }
  private breathSound(): void { this.burst(1.6, 0.14, 'lowpass', 700, { sweep: 250 }); }
  private fall(): void { this.tone(220, 'sine', 2.2, 0.12, { glide: 55 }); this.burst(1.8, 0.12, 'lowpass', 500, { sweep: 80 }); }
  private sting(): void {
    this.thud(46, 1.2, 0.6, 0);
    this.tone(110, 'sawtooth', 1.6, 0.09, { lp: 350 });
    this.tone(116.5, 'sawtooth', 1.6, 0.09, { lp: 350 });
    this.glass();
  }
  private boundary(): void {
    this.tone(196, 'sine', 1.4, 0.12, { glide: 392, attack: 0.1 });
    this.tone(294, 'sine', 1.4, 0.09, { glide: 588, attack: 0.1 });
    this.burst(0.5, 0.15, 'lowpass', 900, { pan: -0.5, at: 0.2 });
  }
}
