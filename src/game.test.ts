import { describe, expect, it } from 'vitest';
import { Game, Result } from './game';
import { Settings } from './logic';

// 緑を捉えれば成功確率100%、乱数0.99なら折れない設定
const base: Settings = { barHeight: 1, moisture: 0.1, thickness: 2, length: 4 };

function make(s: Settings, rng = () => 0.99): { g: Game; results: Result[] } {
  const results: Result[] = [];
  return { g: new Game(s, (r) => results.push(r), rng), results };
}

/** 先頭から順に値を返し、尽きたら最後の値を返す乱数 */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)];
};

function step(g: Game, sec: number): void {
  for (let i = 0; i < sec * 60; i++) g.update(1 / 60);
}

/** 箱が理想位置に来るまで進めてタップ */
function plantPerfectly(g: Game): void {
  g.start();
  for (let i = 0; i < 600 && !(g.boxX !== null && g.boxX <= g.idealBoxX); i++) g.update(1 / 60);
  g.press();
}

describe('Game', () => {
  it('帯の速さは太さで決まり、太いほど遅い(幅と同じ決め方)', () => {
    const thin = make({ ...base, thickness: 1 }).g;
    const thick = make({ ...base, thickness: 3 }).g;
    thin.start();
    thick.start();
    step(thin, 1);
    step(thick, 1);
    expect(thin.speed).toBeCloseTo(thick.speed * 3);
    expect(thin.gaugeSpeed).toBeCloseTo(thick.gaugeSpeed * 3);
  });

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

  it('バーが現れる前のタップは無視される', () => {
    const { g } = make(base);
    g.start();
    step(g, 0.5);
    g.press();
    expect(g.phase).toBe('run');
  });

  it('帯から外れていても突くことはできる', () => {
    const { g } = make(base);
    g.start();
    for (let i = 0; i < 600 && !(g.plantError !== null && g.plantError <= 250); i++) g.update(1 / 60);
    g.press();
    expect(g.phase).toBe('vault');
  });

  it('乱数が折れる確率未満なら折れる', () => {
    const { g, results } = make(base, () => 0);
    plantPerfectly(g);
    expect(g.phase).toBe('vault');
    step(g, 3);
    expect(results[0]?.kind).toBe('broke');
  });

  it('折れるときは長い2本とごく短い1本の3つに折れる', () => {
    const { g } = make(base, () => 0);
    plantPerfectly(g);
    while (g.phase === 'vault') g.update(1 / 60);
    expect(g.phase).toBe('break');
    g.update(1 / 60);
    const { base: b, mid, piece, shard } = g.pole;
    if (!mid || !piece || !shard) throw new Error('3本に折れていない');
    const len = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    const lower = len(b, mid);
    const upper = len(piece[0], piece[1]);
    const small = len(shard[0], shard[1]);
    expect(small).toBeLessThan(lower * 0.3);
    expect(small).toBeLessThan(upper * 0.3);
  });

  it('バーの中心を正確に捉え、乱数が当たりなら成功', () => {
    // 順に: 折れ判定(折れない)、折れ位置、成功判定(当たり)
    const { g, results } = make(base, seq(0.99, 0.5, 0.001));
    plantPerfectly(g);
    step(g, 0.62 * 1.3);
    g.liftOff();
    expect(g.phase).toBe('fly');
    step(g, 3);
    expect(results[0]?.kind).toBe('clear');
    expect(g.barFallen).toBe(false);
  });

  it('成功確率が低く乱数が高ければバーが落ちる', () => {
    const { g, results } = make({ ...base, barHeight: 5, length: 2.5 });
    plantPerfectly(g);
    step(g, 0.62 * 1.3);
    g.liftOff();
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
