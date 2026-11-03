export interface Settings {
  /** バーの高さ(m) */
  barHeight: number;
  /** パスタが折れる確率 0..1 */
  breakRate: number;
  /** 折れなかった場合に超えられる確率(タイミング・高さ補正前) 0..1 */
  clearRate: number;
}

export const BAR_MIN = 1;
export const BAR_MAX = 5;

export const DEFAULT_SETTINGS: Settings = {
  barHeight: 3,
  breakRate: 0.2,
  clearRate: 0.8,
};

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** 誤差が0なら1、window以上なら0になる線形スコア */
export function timingScore(error: number, window: number): number {
  return clamp(1 - Math.abs(error) / window, 0, 1);
}

/**
 * 超えられる確率。clearRate にタイミング(0.4〜1.0倍)とバーの高さ(1.0〜0.6倍)の補正をかける。
 * 補正を入れるのでタイミングとバーの高さが結果に効く。
 */
export function clearProbability(s: Settings, plantScore: number, releaseScore: number): number {
  const timing = (plantScore + releaseScore) / 2;
  const heightFactor = 1 - 0.1 * (s.barHeight - BAR_MIN);
  return clamp(s.clearRate * (0.4 + 0.6 * timing) * heightFactor, 0, 1);
}

export const rollBreak = (s: Settings, rng: () => number = Math.random): boolean => rng() < s.breakRate;

export const rollClear = (
  s: Settings,
  plantScore: number,
  releaseScore: number,
  rng: () => number = Math.random,
): boolean => rng() < clearProbability(s, plantScore, releaseScore);

export function sanitizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    barHeight: clamp(num(raw?.barHeight, DEFAULT_SETTINGS.barHeight), BAR_MIN, BAR_MAX),
    breakRate: clamp(num(raw?.breakRate, DEFAULT_SETTINGS.breakRate), 0, 1),
    clearRate: clamp(num(raw?.clearRate, DEFAULT_SETTINGS.clearRate), 0, 1),
  };
}
