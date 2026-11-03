import { describe, expect, it } from 'vitest';
import { clearProbability, rollBreak, rollClear, sanitizeSettings, timingScore } from './logic';

const s = { barHeight: 1, breakRate: 0.3, clearRate: 1 };

describe('timingScore', () => {
  it('誤差0で1、window以上で0', () => {
    expect(timingScore(0, 10)).toBe(1);
    expect(timingScore(5, 10)).toBe(0.5);
    expect(timingScore(-10, 10)).toBe(0);
    expect(timingScore(99, 10)).toBe(0);
  });
});

describe('clearProbability', () => {
  it('完璧なタイミング・最低のバーなら clearRate そのまま', () => {
    expect(clearProbability(s, 1, 1)).toBeCloseTo(1);
  });
  it('タイミングが悪いほど下がる', () => {
    expect(clearProbability(s, 0, 0)).toBeCloseTo(0.4);
  });
  it('バーが高いほど下がる', () => {
    expect(clearProbability({ ...s, barHeight: 5 }, 1, 1)).toBeCloseTo(0.6);
  });
  it('clearRate 0 なら常に0', () => {
    expect(clearProbability({ ...s, clearRate: 0 }, 1, 1)).toBe(0);
  });
});

describe('rolls', () => {
  it('breakRate 未満の乱数で折れる', () => {
    expect(rollBreak(s, () => 0.29)).toBe(true);
    expect(rollBreak(s, () => 0.3)).toBe(false);
  });
  it('確率未満の乱数で超えられる', () => {
    expect(rollClear(s, 1, 1, () => 0.99)).toBe(true);
    expect(rollClear({ ...s, clearRate: 0.5 }, 1, 1, () => 0.5)).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  it('範囲外・不正値を丸める', () => {
    expect(sanitizeSettings({ barHeight: 99, breakRate: -1, clearRate: NaN })).toEqual({
      barHeight: 5,
      breakRate: 0,
      clearRate: 0.8,
    });
    expect(sanitizeSettings(null).barHeight).toBe(3);
  });
});
