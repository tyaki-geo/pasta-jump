export interface Settings {
  /** バーの高さ(m) */
  barHeight: number;
  /** パスタの水分量 0.05..0.15 (0%は粉、100%は水なので現実的な範囲に制限。多いほどしなり、折れにくい) */
  moisture: number;
  /** パスタの太さ(mm) (太いほど折れにくく、タイミングの帯が狭い) */
  thickness: number;
  /** パスタの長さ(m) (長いほど折れやすい) */
  length: number;
  /** 帯(タイミングゲージ)が流れてくる速さの倍率。大きいほど速い */
  barSpeed: number;
}

export const BAR_MIN = 1;
export const BAR_MAX = 5;
export const THICKNESS_MIN = 1;
export const THICKNESS_MAX = 3;
export const LENGTH_MIN = 2.5;
export const LENGTH_MAX = 5.5;
export const MOISTURE_MIN = 0.05;
export const MOISTURE_MAX = 0.15;
export const BAR_SPEED_MIN = 0.5;
export const BAR_SPEED_MAX = 2;

export const DEFAULT_SETTINGS: Settings = {
  barHeight: 3,
  moisture: 0.1,
  thickness: 2,
  length: 4,
  barSpeed: 1,
};

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const norm = (v: number, min: number, max: number): number => clamp((v - min) / (max - min), 0, 1);

/** これ未満の確率係数になる位置は帯として表示しない(=受け付け範囲の端) */
export const VISIBLE_FACTOR = 0.08;
/** 太さ2mm(正規化0.5)のときの減衰距離λ(px)。バー中心からλ離れると確率が 1/e になる */
const BASE_DECAY_PX = 12;
/** タイミング・パラメーターともに完璧でも、越えられる確率の上限。最良設定で全体が約5%になる */
export const CLEAR_CEILING = 0.055;

export interface PastaTraits {
  /** 折れる確率 0..1 */
  breakProb: number;
  /** しなりの大きさ(px) */
  bendPx: number;
  /** 減衰距離λ(px): バー中心から離れるほど exp(-距離/λ) で確率が下がる。太いほど小さい */
  decayPx: number;
  /** 帯の表示/受け付け範囲の半幅(px) */
  outerHalf: number;
}

/** パスタのパラメーターから挙動を決める */
export function pastaTraits(s: Settings): PastaTraits {
  const m = norm(s.moisture, MOISTURE_MIN, MOISTURE_MAX);
  const t = norm(s.thickness, THICKNESS_MIN, THICKNESS_MAX);
  const l = norm(s.length, LENGTH_MIN, LENGTH_MAX);
  const decayPx = BASE_DECAY_PX * (1.5 - t);
  // 超ハードモード: ほとんどの設定でパスタは折れる。折れにくい組み合わせ(太い・湿っている・短い)は帯が狭い
  const fragility = (0.5 + l) / ((0.5 + t) * (0.5 + m));
  return {
    breakProb: clamp(0.75 * fragility ** 1.5, 0, 0.97),
    bendPx: 38 * (0.4 + 1.2 * m),
    decayPx,
    outerHalf: decayPx * Math.log(1 / VISIBLE_FACTOR),
  };
}

/** バー中心からのずれ(px)に対する確率係数。中心で1、離れるほど指数的に下がる */
export function captureFactor(errPx: number, decayPx: number): number {
  return Math.exp(-Math.abs(errPx) / decayPx);
}

/** バーが高いほど(パスタが短いほど)成功しにくい */
export function heightFactor(s: Settings): number {
  return clamp(1.4 - s.barHeight / s.length, 0.05, 1);
}

/** 超えられる確率。突く/離す両方でバーの中心を正確に捉えるほど高い */
export function clearProbability(s: Settings, plantErrPx: number, releaseErrPx: number): number {
  const { decayPx } = pastaTraits(s);
  const f = captureFactor(plantErrPx, decayPx) * captureFactor(releaseErrPx, decayPx);
  return clamp(CLEAR_CEILING * f * heightFactor(s), 0, 1);
}

export const rollBreak = (s: Settings, rng: () => number = Math.random): boolean => rng() < pastaTraits(s).breakProb;

export const rollClear = (
  s: Settings,
  plantErrPx: number,
  releaseErrPx: number,
  rng: () => number = Math.random,
): boolean => rng() < clearProbability(s, plantErrPx, releaseErrPx);

export function sanitizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    barHeight: clamp(num(raw?.barHeight, DEFAULT_SETTINGS.barHeight), BAR_MIN, BAR_MAX),
    moisture: clamp(num(raw?.moisture, DEFAULT_SETTINGS.moisture), MOISTURE_MIN, MOISTURE_MAX),
    thickness: clamp(num(raw?.thickness, DEFAULT_SETTINGS.thickness), THICKNESS_MIN, THICKNESS_MAX),
    length: clamp(num(raw?.length, DEFAULT_SETTINGS.length), LENGTH_MIN, LENGTH_MAX),
    barSpeed: clamp(num(raw?.barSpeed, DEFAULT_SETTINGS.barSpeed), BAR_SPEED_MIN, BAR_SPEED_MAX),
  };
}
