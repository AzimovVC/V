import { balance } from './config/balance';
import { data } from './data';
import { Game } from './core/game';
import { Input } from './core/input';
import { createState, clearSave, hasSave, loadState } from './core/state';
import { Renderer } from './render/renderer';
import { AudioEngine } from './audio/audio';
import { UI } from './ui/ui';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const audio = new AudioEngine();
const ui = new UI();
const input = new Input();

let game: Game | null = null;
// фон титульного экрана: тот же дом, без игры (состояние не сохраняется)
const demo = new Game(createState(), ui);
demo.state.weather = 2.2;
let last = performance.now();

function begin(fresh: boolean): void {
  audio.start();
  const loaded = fresh ? null : loadState();
  const state = loaded ?? createState();
  if (fresh) clearSave();
  game?.bus && audio.detach();
  game = new Game(state, ui);
  ui.bind(game, () => audio.toggleMute());
  audio.attach(game);
  input.attach(game, ui, () => (document.getElementById('btn-mute') as HTMLElement).click());
  document.getElementById('btn-mute')!.classList.toggle('off', audio.isMuted());
  document.getElementById('title')!.classList.add('gone');
  ui.show(true);
  game.save();
  // тихое приветствие вместо туториала
  if (loaded) game.toast(data.texts.welcomeBack);
  else data.texts.intro.forEach((t) => game!.toast(t));
  (window as unknown as { game: Game }).game = game;
}

document.getElementById('btn-new')!.onclick = () => begin(true);
const cont = document.getElementById('btn-continue') as HTMLButtonElement;
cont.hidden = !hasSave();
cont.onclick = () => begin(false);

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game) {
    game.update(dt);
    ui.update(dt);
    audio.update(dt);
    renderer.draw(game, dt);
  } else {
    // титульный экран: живой фон без игрока
    demo.rt.flash = Math.max(0, demo.rt.flash - dt * 2);
    if (Math.random() < dt / 9) demo.rt.flash = 1;
    renderer.draw(demo, dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// сохранить, если вкладку закрывают или сворачивают
const flush = () => game?.save();
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
void balance;
