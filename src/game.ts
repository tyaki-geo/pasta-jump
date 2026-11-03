import { Settings, clamp, clearProbability, rollBreak, rollClear, timingScore } from './logic';

// 論理座標(800x450)。描画側で画面サイズに合わせて拡大縮小する
export const W = 800;
export const H = 450;
export const GROUND = 380;
export const PPM = 60; // 1mあたりのpx
export const POLE_LEN = 240;
export const PLAYER_X = 160;
export const HANDS_X = PLAYER_X + 25;
export const HANDS_Y = GROUND - 76;

const THETA0 = (-75 * Math.PI) / 180;
const THETA1 = (70 * Math.PI) / 180;
/** このx位置に箱が来たときが突きの理想タイミング */
export const IDEAL_BOX_X = HANDS_X + POLE_LEN * Math.sin(-THETA0);
export const PLANT_WINDOW = 100;
/** 突きを受け付ける範囲(理想位置からの手前側px)。ゲージの表示範囲と同じ */
export const PLANT_REACH = 300;
/** 地面ゲージ: 固定バーの位置と、緑ゾーンが流れる速さ(px/s) */
export const GAUGE_TARGET_X = 260;
export const GAUGE_SPEED = 300;
export const VAULT_TIME = 1.3;
export const RELEASE_IDEAL = 0.62;
export const RELEASE_WINDOW = 0.25;
export const BAR_OFFSET = 30; // 箱からバーまでの距離

const BOX_SPAWN_TIME = 1.0;
const BOX_SPAWN_X = 860;
const MAX_SPEED = 260;
const GRAVITY = 900;

export type Phase = 'ready' | 'run' | 'vault' | 'break' | 'fly' | 'miss' | 'done';
export type ResultKind = 'clear' | 'knocked' | 'broke' | 'miss';

export interface Result {
  kind: ResultKind;
  message: string;
  /** 折れる確率(%表示用) */
  breakRate: number;
  /** 超えられる確率。突けなかった場合は null */
  clearProb: number | null;
}

export interface Pt {
  x: number;
  y: number;
}

export type BodyKind = 'run' | 'hang' | 'fly' | 'fall' | 'trip';

export interface Body {
  kind: BodyKind;
  /** run: 足元x。それ以外: 手の位置 */
  x: number;
  y: number;
  /** 手から体へ向かう角度(0=真下, 90°=前方, 180°=真上) */
  alpha: number;
  cycle: number;
  /** trip: 転倒角度 */
  tilt: number;
}

export interface Pole {
  kind: 'carry' | 'vault' | 'broken';
  /** carry: 先端の下がり角(rad) */
  tipAngle: number;
  base: Pt;
  top: Pt;
  bend: number;
  /** broken: 折れた上半分の両端 */
  piece?: [Pt, Pt];
  mid?: Pt;
}

interface Flight {
  p0: Pt;
  apex: Pt;
  land: Pt;
  d1: number;
  d2: number;
  clear: boolean;
  t: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Game {
  phase: Phase = 'ready';
  t = 0;
  runTime = 0;
  speed = 0;
  scroll = 0;
  boxX: number | null = null;
  vaultU = 0;
  barFallen = false;
  barDrop = 0;
  result: Result | null = null;
  body: Body = { kind: 'run', x: PLAYER_X, y: GROUND, alpha: 0, cycle: 0, tilt: 0 };
  pole: Pole = { kind: 'carry', tipAngle: -0.15, base: { x: 0, y: GROUND }, top: { x: 0, y: 0 }, bend: 0 };

  private plantScore = 0;
  private willBreak = false;
  private breakU = 0.5;
  private baseX = 0;
  private theta0 = THETA0;
  private flight: Flight | null = null;
  private barVy = 0;
  private fall: { a: Pt; va: Pt; p1: Pt; v1: Pt; p2: Pt; v2: Pt; mid: Pt } | null = null;
  private releaseTheta = 0;
  private plantResultProb: number | null = null;

  constructor(
    public settings: Settings,
    public onFinish: (r: Result) => void,
    private rng: () => number = Math.random,
  ) {
    this.reset();
  }

  get barY(): number {
    return GROUND - this.settings.barHeight * PPM;
  }

  get barX(): number {
    return (this.boxX ?? BOX_SPAWN_X) + BAR_OFFSET;
  }

  /** 箱の位置と理想位置のずれ(+: まだ遠い) */
  get plantError(): number | null {
    return this.boxX === null ? null : this.boxX - IDEAL_BOX_X;
  }

  reset(): void {
    this.phase = 'ready';
    this.t = 0;
    this.runTime = 0;
    this.speed = 0;
    this.scroll = 0;
    this.boxX = null;
    this.vaultU = 0;
    this.barFallen = false;
    this.barDrop = 0;
    this.barVy = 0;
    this.result = null;
    this.flight = null;
    this.fall = null;
    this.body = { kind: 'run', x: PLAYER_X, y: GROUND, alpha: 0, cycle: 0, tilt: 0 };
    this.pole = { kind: 'carry', tipAngle: -0.15, base: { x: 0, y: GROUND }, top: { x: 0, y: 0 }, bend: 0 };
  }

  start(): void {
    this.reset();
    this.phase = 'run';
  }

  /** 押した: 走行中ならパスタを突く(以降、離すまで握り続ける) */
  press(): void {
    if (this.phase === 'run') this.tryPlant();
  }

  /** 離した: 跳躍中ならパスタから手を離す */
  liftOff(): void {
    if (this.phase === 'vault') this.release();
  }

  update(dt: number): void {
    this.t += dt;
    switch (this.phase) {
      case 'run':
        this.updateRun(dt);
        break;
      case 'vault':
        this.updateVault(dt);
        break;
      case 'break':
        this.updateBreak(dt);
        break;
      case 'fly':
        this.updateFly(dt);
        break;
      case 'miss':
        this.updateMiss(dt);
        break;
      default:
        break;
    }
    this.updateBar(dt);
  }

  // --- run ---

  private updateRun(dt: number): void {
    this.runTime += dt;
    this.speed = Math.min(MAX_SPEED, 100 + this.runTime * 120);
    this.advanceWorld(dt);
    if (this.boxX === null && this.runTime >= BOX_SPAWN_TIME) this.boxX = BOX_SPAWN_X;
    this.updateRunPose();
    const err = this.plantError;
    if (err !== null && err < -PLANT_WINDOW) this.startMiss();
  }

  private advanceWorld(dt: number): void {
    this.scroll += this.speed * dt;
    if (this.boxX !== null) this.boxX -= this.speed * dt;
    this.body.cycle += this.speed * dt * 0.045;
  }

  private updateRunPose(): void {
    this.body.kind = 'run';
    this.body.x = PLAYER_X;
    this.body.y = GROUND;
    // 箱が近づくほどパスタの先端が下がる(突きのタイミングの目安)
    const err = this.plantError;
    const near = err === null ? 0 : clamp(1 - err / 200, 0, 1);
    this.pole.kind = 'carry';
    this.pole.tipAngle = lerp(-0.15, Math.asin((GROUND - HANDS_Y) / POLE_LEN), near) + Math.sin(this.body.cycle * 2) * 0.02;
  }

  private tryPlant(): void {
    const err = this.plantError;
    if (err === null || err > PLANT_REACH) return; // 箱がまだ遠い: 無視
    this.plantScore = timingScore(err, PLANT_WINDOW);
    this.willBreak = rollBreak(this.settings, this.rng);
    this.breakU = 0.3 + this.rng() * 0.35;
    this.baseX = this.boxX as number;
    this.theta0 = -Math.asin(clamp((this.baseX - HANDS_X) / POLE_LEN, -1, 1));
    this.phase = 'vault';
    this.t = 0;
    this.vaultU = 0;
    this.speed = 0;
    this.updateVault(0);
  }

  // --- vault ---

  private vaultGeometry(u: number): { top: Pt; theta: number; bend: number } {
    const theta = lerp(this.theta0, THETA1, u);
    const bend = Math.sin(Math.PI * clamp(u, 0, 1));
    const len = POLE_LEN * (1 - 0.15 * bend);
    return { top: { x: this.baseX + len * Math.sin(theta), y: GROUND - len * Math.cos(theta) }, theta, bend: bend * 38 };
  }

  private updateVault(dt: number): void {
    this.vaultU = Math.min(1, this.vaultU + dt / VAULT_TIME);
    const g = this.vaultGeometry(this.vaultU);
    // 突いた直後は手の位置からなめらかにパスタの軌道へ移す
    const k = clamp(this.t / 0.2, 0, 1);
    g.top = { x: lerp(HANDS_X, g.top.x, k), y: lerp(HANDS_Y, g.top.y, k) };
    this.pole = { kind: 'vault', tipAngle: 0, base: { x: this.baseX, y: GROUND }, top: g.top, bend: g.bend };
    this.body = {
      kind: 'hang',
      x: g.top.x,
      y: g.top.y,
      alpha: lerp((10 * Math.PI) / 180, (170 * Math.PI) / 180, this.vaultU),
      cycle: this.vaultU * 6,
      tilt: 0,
    };
    if (this.willBreak && this.vaultU >= this.breakU) {
      this.startBreak();
    } else if (this.vaultU >= 1) {
      this.releaseWith(0); // 離し損ね
    }
  }

  private release(): void {
    this.releaseWith(timingScore(this.vaultU - RELEASE_IDEAL, RELEASE_WINDOW));
  }

  private releaseWith(releaseScore: number): void {
    const prob = clearProbability(this.settings, this.plantScore, releaseScore);
    const clear = rollClear(this.settings, this.plantScore, releaseScore, this.rng);
    this.plantResultProb = prob;
    const p0 = { x: this.body.x, y: this.body.y };
    const barX = this.baseX + BAR_OFFSET;
    // 成功: バーの上を通る / 失敗: バーより下を通ってバーに当たる
    const apexY = clear ? Math.min(p0.y - 10, this.barY - 45) : Math.max(p0.y - 5, this.barY + 30);
    const apex = { x: barX + 20, y: apexY };
    const land = { x: barX + 150, y: GROUND - 30 };
    this.flight = {
      p0,
      apex,
      land,
      d1: clear ? 0.5 : 0.35,
      d2: 0.55,
      clear,
      t: 0,
    };
    this.phase = 'fly';
    this.t = 0;
    this.releaseTheta = lerp(this.theta0, THETA1, this.vaultU);
  }

  // --- break ---

  private startBreak(): void {
    const { base, top } = this.pole;
    const mid = { x: (base.x + top.x) / 2, y: (base.y + top.y) / 2 };
    this.fall = {
      a: { x: top.x, y: top.y },
      va: { x: 70, y: -140 },
      p1: { ...mid },
      v1: { x: 20, y: -80 },
      p2: { ...top },
      v2: { x: 70, y: -140 },
      mid,
    };
    this.phase = 'break';
    this.t = 0;
  }

  private updateBreak(dt: number): void {
    const f = this.fall;
    if (!f) return;
    const step = (p: Pt, v: Pt, floor: number) => {
      v.y += GRAVITY * dt;
      p.x += v.x * dt;
      p.y = Math.min(floor, p.y + v.y * dt);
      if (p.y >= floor) v.x = v.y = 0;
    };
    step(f.a, f.va, GROUND - 40);
    step(f.p1, f.v1, GROUND - 4);
    step(f.p2, f.v2, GROUND - 4);
    this.body = {
      kind: 'fall',
      x: f.a.x,
      y: f.a.y,
      alpha: lerp((60 * Math.PI) / 180, (110 * Math.PI) / 180, clamp(this.t / 0.6, 0, 1)),
      cycle: 0,
      tilt: 0,
    };
    this.pole = {
      kind: 'broken',
      tipAngle: 0,
      base: { x: this.baseX, y: GROUND },
      top: f.a,
      bend: 0,
      mid: f.mid,
      piece: [f.p1, f.p2],
    };
    if (this.t >= 1.4) this.finish('broke', 'パスタが折れた！', null);
  }

  // --- fly ---

  private updateFly(dt: number): void {
    const fl = this.flight;
    if (!fl) return;
    fl.t += dt;
    const total = fl.d1 + fl.d2;
    let x: number;
    let y: number;
    if (fl.t < fl.d1) {
      const s = fl.t / fl.d1;
      x = lerp(fl.p0.x, fl.apex.x, s);
      y = lerp(fl.p0.y, fl.apex.y, 1 - (1 - s) * (1 - s));
    } else {
      const s = Math.min(1, (fl.t - fl.d1) / fl.d2);
      x = lerp(fl.apex.x, fl.land.x, s);
      y = lerp(fl.apex.y, fl.land.y, s * s);
    }
    const p = clamp(fl.t / total, 0, 1);
    const deg = fl.clear ? lerp(170, 265, p) : lerp(170, 215, p);
    this.body = { kind: 'fly', x, y, alpha: (deg * Math.PI) / 180, cycle: 0, tilt: 0 };
    // 手放し後のパスタは前方へ倒れる
    const th = lerp(this.releaseTheta, 1.45, p * p);
    this.pole = {
      kind: 'vault',
      tipAngle: 0,
      base: { x: this.baseX, y: GROUND },
      top: { x: this.baseX + POLE_LEN * Math.sin(th), y: GROUND - POLE_LEN * Math.cos(th) },
      bend: 0,
    };
    if (!fl.clear && fl.t >= fl.d1 * 0.9 && !this.barFallen) this.barFallen = true;
    if (fl.t >= total + 0.7) {
      const prob = this.plantResultProb;
      if (fl.clear) this.finish('clear', `${this.settings.barHeight.toFixed(1)}mを超えた！`, prob);
      else this.finish('knocked', 'バーに当たって落ちた…', prob);
    }
  }

  private updateBar(dt: number): void {
    if (!this.barFallen) return;
    this.barVy += GRAVITY * dt;
    this.barDrop = Math.min(GROUND - this.barY - 3, this.barDrop + this.barVy * dt);
  }

  // --- miss ---

  private startMiss(): void {
    this.phase = 'miss';
    this.t = 0;
  }

  private updateMiss(dt: number): void {
    this.speed = Math.max(0, this.speed - (MAX_SPEED / 0.7) * dt);
    this.advanceWorld(dt);
    this.updateRunPose();
    if (this.t >= 0.7) {
      this.body.kind = 'trip';
      this.body.tilt = clamp((this.t - 0.7) / 0.35, 0, 1) * (Math.PI / 2);
    }
    if (this.t >= 1.6) this.finish('miss', 'タイミングを逃した…', null);
  }

  private finish(kind: ResultKind, message: string, clearProb: number | null): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.result = { kind, message, breakRate: this.settings.breakRate, clearProb };
    this.onFinish(this.result);
  }
}
