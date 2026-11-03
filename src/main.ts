import './style.css';
import { Game, Result } from './game';
import { clearProbability, pastaTraits } from './logic';
import { draw } from './render';
import { loadSettings, saveSettings } from './storage';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

const canvas = $<HTMLCanvasElement>('canvas');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas is not supported');
const overlay = $('overlay');
const message = $('message');
const stats = $('stats');
const startButton = $<HTMLButtonElement>('start');
const inputs = {
  bar: $<HTMLInputElement>('bar'),
  moisture: $<HTMLInputElement>('moisture'),
  thickness: $<HTMLInputElement>('thickness'),
  length: $<HTMLInputElement>('length'),
};

const settings = loadSettings();
inputs.bar.value = String(settings.barHeight);
inputs.moisture.value = String(Math.round(settings.moisture * 100));
inputs.thickness.value = String(settings.thickness);
inputs.length.value = String(settings.length);

function syncSettings(): void {
  settings.barHeight = Number(inputs.bar.value);
  settings.moisture = Number(inputs.moisture.value) / 100;
  settings.thickness = Number(inputs.thickness.value);
  settings.length = Number(inputs.length.value);
  $('o-bar').textContent = `${settings.barHeight.toFixed(1)} m`;
  $('o-moisture').textContent = `${inputs.moisture.value} %`;
  $('o-thickness').textContent = `${settings.thickness.toFixed(1)} mm`;
  $('o-length').textContent = `${settings.length.toFixed(1)} m`;
  const t = pastaTraits(settings);
  $('traits').textContent =
    `折れる確率 ${Math.round(t.breakProb * 100)}% / しなり ${Math.round(t.bendPx)} / 緑の帯 ${Math.round(t.greenHalf * 2)}px` +
    ` / 完璧に捉えても成功率 ${Math.round((1 - t.breakProb) * clearProbability(settings, 0, 0) * 100)}%`;
  saveSettings(settings);
}
for (const el of Object.values(inputs)) el.addEventListener('input', syncSettings);
syncSettings();

function onFinish(r: Result): void {
  message.textContent = r.message;
  const parts = [`折れる確率 ${Math.round(r.breakProb * 100)}%`];
  if (r.clearProb !== null) parts.push(`この跳躍の成功率 ${Math.round(r.clearProb * 100)}%`);
  stats.textContent = parts.join(' / ');
  startButton.textContent = 'もう一度';
  setTimeout(() => overlay.classList.remove('hidden'), 400);
}

const game = new Game(settings, onFinish);

function start(): void {
  overlay.classList.add('hidden');
  game.start();
}
startButton.addEventListener('click', start);

// 突く=押す、離す=指を離す。ゲーム中のみ受け付ける。
// 長押し中にブラウザが pointercancel を出す端末があるため、タッチは touch イベントで処理し、
// pointer イベントはマウス/ペンのみにする。
const stage = $('stage');
const gameActive = () => overlay.classList.contains('hidden');

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  game.press();
});
for (const type of ['pointerup', 'pointercancel'] as const) {
  canvas.addEventListener(type, (e) => {
    if (e.pointerType === 'touch') return;
    game.liftOff();
  });
}

stage.addEventListener(
  'touchstart',
  (e) => {
    if (!gameActive()) return;
    e.preventDefault(); // スクロール・拡大・長押しメニューを抑止
    if (e.touches.length === 1) game.press();
  },
  { passive: false },
);
for (const type of ['touchend', 'touchcancel'] as const) {
  stage.addEventListener(
    type,
    (e) => {
      if (!gameActive()) return;
      e.preventDefault();
      if (e.touches.length === 0) game.liftOff();
    },
    { passive: false },
  );
}
// 長押しのコンテキストメニュー・選択を無効化
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || !overlay.classList.contains('hidden')) return;
  e.preventDefault();
  game.press();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') game.liftOff();
});

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  draw(ctx as CanvasRenderingContext2D, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
