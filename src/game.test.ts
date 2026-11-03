import { describe, expect, it } from 'vitest';
import { Game, IDEAL_BOX_X, Result } from './game';
import { Settings } from './logic';

const base: Settings = { barHeight: 3, breakRate: 0, clearRate: 1 };

function make(s: Settings, rng = () => 0): { g: Game; results: Result[] } {
  const results: Result[] = [];
  return { g: new Game(s, (r) => results.push(r), rng), results };
}

function step(g: Game, sec: number): void {
  for (let i = 0; i < sec * 60; i++) g.update(1 / 60);
}

/** 箱が理想位置に来るまで進めてタップ */
function plantPerfectly(g: Game): void {
  g.start();
  for (let i = 0; i < 600 && !(g.boxX !== null && g.boxX <= IDEAL_BOX_X); i++) g.update(1 / 60);
  g.input();
}

describe('Game', () => {
  it('最初はバーが無く、一定時間走ると現れる', () => {
    const { g } = make(base);
    g.start();
    expect(g.boxX).toBeNull();
    step(g, 1.2);
    expect(g.boxX).not.toBeNull();
  });

  it('タップしないとタイミングを逃して失敗する', () => {
    const { g, results } = make(base);
    g.start();
    step(g, 8);
    expect(results[0]?.kind).toBe('miss');
  });

  it('早すぎるタップは無視される', () => {
    const { g } = make(base);
    g.start();
    step(g, 1.1);
    g.input();
    expect(g.phase).toBe('run');
  });

  it('折れる確率100%なら折れる', () => {
    const { g, results } = make({ ...base, breakRate: 1 }, () => 0);
    plantPerfectly(g);
    expect(g.phase).toBe('vault');
    step(g, 3);
    expect(results[0]?.kind).toBe('broke');
  });

  it('完璧なタイミングかつ超えられる確率100%なら成功', () => {
    const { g, results } = make(base);
    plantPerfectly(g);
    step(g, 0.62 * 1.3);
    g.input();
    expect(g.phase).toBe('fly');
    step(g, 3);
    expect(results[0]?.kind).toBe('clear');
    expect(g.barFallen).toBe(false);
  });

  it('超えられる確率0%ならバーが落ちる', () => {
    const { g, results } = make({ ...base, clearRate: 0 });
    plantPerfectly(g);
    step(g, 0.62 * 1.3);
    g.input();
    step(g, 3);
    expect(results[0]?.kind).toBe('knocked');
    expect(g.barFallen).toBe(true);
  });

  it('手を離さないと自動で離れる', () => {
    const { g, results } = make(base);
    plantPerfectly(g);
    step(g, 4);
    expect(results.length).toBe(1);
  });
});
