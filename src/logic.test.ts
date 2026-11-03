import { describe, expect, it } from 'vitest';
import { CLEAR_CEILING, DEFAULT_SETTINGS, captureFactor, clearProbability, pastaTraits, rollBreak, sanitizeSettings } from './logic';
import type { Settings } from './logic';

const s = DEFAULT_SETTINGS;

describe('pastaTraits', () => {
  it('水分量が多いほどしなり、折れにくい', () => {
    const dry = pastaTraits({ ...s, moisture: 0 });
    const wet = pastaTraits({ ...s, moisture: 1 });
    expect(wet.bendPx).toBeGreaterThan(dry.bendPx);
    expect(wet.breakProb).toBeLessThan(dry.breakProb);
  });
  it('太いほど折れにくく、帯が狭い', () => {
    const thin = pastaTraits({ ...s, thickness: 1 });
    const thick = pastaTraits({ ...s, thickness: 3 });
    expect(thick.breakProb).toBeLessThan(thin.breakProb);
    expect(thick.decayPx).toBeLessThan(thin.decayPx);
  });
  it('長いほど折れやすい', () => {
    const short = pastaTraits({ ...s, length: 2.5 });
    const long = pastaTraits({ ...s, length: 5.5 });
    expect(long.breakProb).toBeGreaterThan(short.breakProb);
  });
  it('折れる確率は 0..1 に収まる', () => {
    for (const m of [0, 1]) for (const t of [1, 3]) for (const l of [2.5, 5.5]) {
      const p = pastaTraits({ ...s, moisture: m, thickness: t, length: l }).breakProb;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('captureFactor', () => {
  it('バー中心で1、離れるほど指数的に減る(左右対称)', () => {
    expect(captureFactor(0, 12)).toBe(1);
    expect(captureFactor(12, 12)).toBeCloseTo(Math.exp(-1));
    expect(captureFactor(-24, 12)).toBeCloseTo(Math.exp(-2));
    expect(captureFactor(36, 12) / captureFactor(24, 12)).toBeCloseTo(captureFactor(12, 12));
  });
});

describe('clearProbability', () => {
  it('完璧なタイミングでも上限(CLEAR_CEILING)を超えない', () => {
    expect(clearProbability({ ...s, barHeight: 1 }, 0, 0)).toBeCloseTo(CLEAR_CEILING);
  });
  it('突く・離すそれぞれ、中心から離れるほど指数的に下がる(積)', () => {
    const base = { ...s, barHeight: 1 };
    const { decayPx } = pastaTraits(base);
    const best = clearProbability(base, 0, 0);
    expect(clearProbability(base, decayPx, 0) / best).toBeCloseTo(Math.exp(-1));
    expect(clearProbability(base, decayPx, decayPx * 2) / best).toBeCloseTo(Math.exp(-3));
  });
  it('バーが高いほど、パスタが短いほど下がる', () => {
    expect(clearProbability({ ...s, barHeight: 5 }, 0, 0)).toBeLessThan(clearProbability({ ...s, barHeight: 2 }, 0, 0));
    expect(clearProbability({ ...s, length: 2.5 }, 0, 0)).toBeLessThan(clearProbability({ ...s, length: 5 }, 0, 0));
  });
});

describe('超ハードモード', () => {
  const survive = (x: Settings) => (1 - pastaTraits(x).breakProb) * clearProbability(x, 0, 0);
  const all: Settings[] = [];
  for (const barHeight of [1, 2, 3, 4, 5])
    for (let moisture = 0; moisture <= 1.001; moisture += 0.1)
      for (let thickness = 1; thickness <= 3.001; thickness += 0.25)
        for (let length = 2.5; length <= 5.5; length += 0.5) all.push({ barHeight, moisture, thickness, length });

  it('パラメーターもタイミングも完璧な最良ケースで成功率は約5%', () => {
    const best = Math.max(...all.map(survive));
    expect(best).toBeGreaterThan(0.04);
    expect(best).toBeLessThan(0.06);
  });
  it('初期設定は完璧に捉えても成功率が極めて低い', () => {
    expect(survive(DEFAULT_SETTINGS)).toBeLessThan(0.02);
  });
  it('帯の減衰距離は短い(λ < 20px)', () => {
    for (const x of all) expect(pastaTraits(x).decayPx).toBeLessThan(20);
  });
});

describe('rollBreak', () => {
  it('折れる確率未満の乱数で折れる', () => {
    const p = pastaTraits(s).breakProb;
    expect(rollBreak(s, () => p - 0.001)).toBe(true);
    expect(rollBreak(s, () => p)).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  it('範囲外・不正値・旧形式を丸める', () => {
    expect(sanitizeSettings({ barHeight: 99, moisture: -1, thickness: NaN, length: 100 })).toEqual({
      barHeight: 5,
      moisture: 0,
      thickness: 2,
      length: 5.5,
    });
    expect(sanitizeSettings({ breakRate: 0.3 } as never)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
