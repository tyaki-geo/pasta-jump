export interface Settings {
  /** バーの高さ(m) */
  barHeight: number;
  /** パスタの水分量 0..1 (多いほどしなり、折れにくい) */
  moisture: number;
  /** パスタの太さ(mm) (太いほど折れにくく、タイミングの帯が狭い) */
  thickness: number;
  /** パスタの長さ(m) (長いほど折れやすい) */
  length: number;
}

export const BAR_MIN = 1;
export const BAR_MAX = 5;
export const THICKNESS_MIN = 1;
export const THICKNESS_MAX = 3;
export const LENGTH_MIN = 2.5;
export const LENGTH_MAX = 5.5;

export const DEFAULT_SETTINGS: Settings = {
  barHeight: 3,
  moisture: 0.5,
  thickness: 2,
  length: 4,
};

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const norm = (v: number, min: number, max: number): number => clamp((v - min) / (max - min), 0, 1);

/** 緑の帯から外れたときの指数減衰の速さ(帯の半幅あたり) */
export const DECAY = 1.2;
/** これ未満の確率係数になる位置は帯として表示しない(=受け付け範囲の端) */
export const VISIBLE_FACTOR = 0.08;
/** 太さ2mm(正規化0.5)のときの緑の帯の半幅(px)。超ハードモードなのでごく狭い */
const BASE_GREEN_HALF = 12;

export interface PastaTraits {
  /** 折れる確率 0..1 */
  breakProb: number;
  /** しなりの大きさ(px) */
  bendPx: number;
  /** 緑の帯の半幅(px) */
  greenHalf: number;
  /** 帯の表示/受け付け範囲の半幅(px) */
  outerHalf: number;
}

/** パスタのパラメーターから挙動を決める */
export function pastaTraits(s: Settings): PastaTraits {
  const m = clamp(s.moisture, 0, 1);
  const t = norm(s.thickness, THICKNESS_MIN, THICKNESS_MAX);
  const l = norm(s.length, LENGTH_MIN, LENGTH_MAX);
  const greenHalf = BASE_GREEN_HALF * (1.5 - t);
  // 超ハードモード: ほとんどの設定でパスタは折れる。折れにくい組み合わせ(太い・湿っている・短い)は帯が狭い
  const fragility = (0.5 + l) / ((0.5 + t) * (0.5 + m));
  return {
    breakProb: clamp(0.75 * fragility ** 1.5, 0, 0.97),
    bendPx: 38 * (0.4 + 1.2 * m),
    greenHalf,
    outerHalf: greenHalf * (1 + Math.log(1 / VISIBLE_FACTOR) / DECAY),
  };
}

/** 緑の帯の中なら1、外れると指数的に下がる係数 */
export function captureFactor(errPx: number, greenHalf: number): number {
  const e = Math.abs(errPx) / greenHalf;
  return e <= 1 ? 1 : Math.exp(-DECAY * (e - 1));
}

/** バーが高いほど(パスタが短いほど)成功しにくい */
export function heightFactor(s: Settings): number {
  return clamp(1.4 - s.barHeight / s.length, 0.05, 1);
}

/** 超えられる確率。突く/離す両方で緑を正確に捉えるほど高い */
export function clearProbability(s: Settings, plantErrPx: number, releaseErrPx: number): number {
  const { greenHalf } = pastaTraits(s);
  return clamp(captureFactor(plantErrPx, greenHalf) * captureFactor(releaseErrPx, greenHalf) * heightFactor(s), 0, 1);
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
    moisture: clamp(num(raw?.moisture, DEFAULT_SETTINGS.moisture), 0, 1),
    thickness: clamp(num(raw?.thickness, DEFAULT_SETTINGS.thickness), THICKNESS_MIN, THICKNESS_MAX),
    length: clamp(num(raw?.length, DEFAULT_SETTINGS.length), LENGTH_MIN, LENGTH_MAX),
  };
}
