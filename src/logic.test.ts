import { describe, expect, it } from 'vitest';
import { DECAY, DEFAULT_SETTINGS, captureFactor, clearProbability, pastaTraits, rollBreak, sanitizeSettings } from './logic';

const s = DEFAULT_SETTINGS;

describe('pastaTraits', () => {
  it('水分量が多いほどしなり、折れにくい', () => {
    const dry = pastaTraits({ ...s, moisture: 0 });
    const wet = pastaTraits({ ...s, moisture: 1 });
    expect(wet.bendPx).toBeGreaterThan(dry.bendPx);
    expect(wet.breakProb).toBeLessThan(dry.breakProb);
  });
  it('太いほど折れにくく、緑の帯が狭い', () => {
    const thin = pastaTraits({ ...s, thickness: 1 });
    const thick = pastaTraits({ ...s, thickness: 3 });
    expect(thick.breakProb).toBeLessThan(thin.breakProb);
    expect(thick.greenHalf).toBeLessThan(thin.greenHalf);
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
  it('緑の帯の中は1、外では指数的に減る', () => {
    expect(captureFactor(0, 40)).toBe(1);
    expect(captureFactor(-40, 40)).toBe(1);
    expect(captureFactor(80, 40)).toBeCloseTo(Math.exp(-DECAY));
    expect(captureFactor(120, 40)).toBeCloseTo(Math.exp(-2 * DECAY));
  });
});

describe('clearProbability', () => {
  it('突く・離すの両方で緑を捉え、バーが低ければ100%', () => {
    expect(clearProbability({ ...s, barHeight: 1 }, 0, 0)).toBe(1);
  });
  it('どちらかが外れるほど指数的に下がる(積)', () => {
    const base = { ...s, barHeight: 1 };
    const g = pastaTraits(base).greenHalf;
    const one = clearProbability(base, g * 2, 0);
    expect(one).toBeCloseTo(Math.exp(-DECAY));
    expect(clearProbability(base, g * 2, g * 2)).toBeCloseTo(one * one);
  });
  it('バーが高いほど、パスタが短いほど下がる', () => {
    expect(clearProbability({ ...s, barHeight: 5 }, 0, 0)).toBeLessThan(clearProbability({ ...s, barHeight: 2 }, 0, 0));
    expect(clearProbability({ ...s, length: 2.5 }, 0, 0)).toBeLessThan(clearProbability({ ...s, length: 5 }, 0, 0));
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
