import './style.css';
import { Game, Result } from './game';
import { clearProbability } from './logic';
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
const barInput = $<HTMLInputElement>('bar');
const breakInput = $<HTMLInputElement>('break');
const clearInput = $<HTMLInputElement>('clear');
const startButton = $<HTMLButtonElement>('start');

const settings = loadSettings();
barInput.value = String(settings.barHeight);
breakInput.value = String(Math.round(settings.breakRate * 100));
clearInput.value = String(Math.round(settings.clearRate * 100));

function syncSettings(): void {
  settings.barHeight = Number(barInput.value);
  settings.breakRate = Number(breakInput.value) / 100;
  settings.clearRate = Number(clearInput.value) / 100;
  $('o-bar').textContent = `${settings.barHeight.toFixed(1)} m`;
  $('o-break').textContent = `${breakInput.value} %`;
  $('o-clear').textContent = `${clearInput.value} %`;
  saveSettings(settings);
}
for (const el of [barInput, breakInput, clearInput]) el.addEventListener('input', syncSettings);
syncSettings();

function onFinish(r: Result): void {
  message.textContent = r.message;
  const best = clearProbability(settings, 1, 1);
  const parts = [`折れる確率 ${Math.round(r.breakRate * 100)}%`];
  parts.push(r.clearProb === null ? `最良時の成功率 ${Math.round(best * 100)}%` : `この跳躍の成功率 ${Math.round(r.clearProb * 100)}%`);
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

// 突く=押す、離す=指を離す。ゲーム中のみ受け付ける
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  game.press();
});
for (const type of ['pointerup', 'pointercancel'] as const) {
  canvas.addEventListener(type, (e) => {
    e.preventDefault();
    game.liftOff();
  });
}
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
