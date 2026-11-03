// 人物の描画。棒人間版は render.ts の drawRunnerStick / drawHangingStick に残してある
import { GROUND, HANDS_X, HANDS_Y, Pt } from './game';

const SKIN = '#f2c29b';
const SKIN_SHADE = '#d49f77';
const SKIN_EDGE = '#9c6b4a';
const SHIRT = '#d93a2f';
const SHIRT_SHADE = '#a82a22';
const SHIRT_EDGE = '#6e1b16';
const SHORTS = '#27408b';
const SHORTS_SHADE = '#1d3068';
const SHORTS_EDGE = '#141f45';
const HAIR = '#3b2417';
const SOCK = '#f6f6f6';
const SHOE = '#fafafa';
const SHOE_EDGE = '#2b2b3a';
const SOLE = '#d93a2f';
const BAND = '#f6f6f6';
const INK = '#2b2b3a';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mix = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

interface Pose {
  head: Pt;
  shoulder: Pt;
  hip: Pt;
  /** [肩, ひじ, 手] */
  armB: Pt[];
  armF: Pt[];
  /** [腰, ひざ, 足首] */
  legB: Pt[];
  legF: Pt[];
}

/** 2関節IK。bendX>0 なら関節が +x 側に、<0 なら -x 側に曲がる */
function ik(root: Pt, target: Pt, l1: number, l2: number, bendX: number): Pt[] {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
  const base = Math.atan2(dy, dx);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const c1 = { x: root.x + l1 * Math.cos(base + a), y: root.y + l1 * Math.sin(base + a) };
  const c2 = { x: root.x + l1 * Math.cos(base - a), y: root.y + l1 * Math.sin(base - a) };
  const joint = (bendX >= 0 ? c1.x >= c2.x : c1.x <= c2.x) ? c1 : c2;
  return [root, joint, { x: root.x + Math.cos(base) * d, y: root.y + Math.sin(base) * d }];
}

/** 先細りの太い線分(縁取り付き) */
function taper(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, wa: number, wb: number, fill: string, edge: string | null): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pass = (color: string, extra: number) => {
    const ra = (wa + extra) / 2;
    const rb = (wb + extra) / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * ra, a.y + ny * ra);
    ctx.lineTo(b.x + nx * rb, b.y + ny * rb);
    ctx.lineTo(b.x - nx * rb, b.y - ny * rb);
    ctx.lineTo(a.x - nx * ra, a.y - ny * ra);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(a.x, a.y, ra, 0, Math.PI * 2);
    ctx.arc(b.x, b.y, rb, 0, Math.PI * 2);
    ctx.fill();
  };
  if (edge) pass(edge, 2.4);
  pass(fill, 0);
}

function drawArm(ctx: CanvasRenderingContext2D, arm: Pt[], skin: string): void {
  const [s, e, h] = arm;
  taper(ctx, s, e, 9, 7.5, skin, SKIN_EDGE);
  taper(ctx, e, h, 7.5, 6, skin, SKIN_EDGE);
  ctx.fillStyle = skin;
  ctx.strokeStyle = SKIN_EDGE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawLeg(ctx: CanvasRenderingContext2D, leg: Pt[], skin: string, shorts: string, shortsEdge: string): void {
  const [hip, knee, ankle] = leg;
  // すね + ソックス
  taper(ctx, knee, ankle, 10.5, 7, skin, SKIN_EDGE);
  taper(ctx, mix(knee, ankle, 0.62), ankle, 8.4, 7.6, SOCK, SKIN_EDGE);
  // 太もも + ショートパンツ
  taper(ctx, hip, knee, 17, 12, skin, SKIN_EDGE);
  taper(ctx, hip, mix(hip, knee, 0.62), 16.5, 14, shorts, shortsEdge);
  // シューズ: 足首から前方(+x側)へ
  const dx = ankle.x - knee.x;
  const dy = ankle.y - knee.y;
  const len = Math.hypot(dx, dy) || 1;
  let fx = dy / len;
  let fy = -dx / len;
  if (fx < 0) {
    fx = -fx;
    fy = -fy;
  }
  const heel = { x: ankle.x - fx * 2.5 + (dx / len) * 1.5, y: ankle.y - fy * 2.5 + (dy / len) * 1.5 };
  const toe = { x: ankle.x + fx * 11, y: ankle.y + fy * 11 };
  taper(ctx, heel, toe, 8.5, 6.2, SHOE, SHOE_EDGE);
  // ソール
  const sx = (dx / len) * 3.4;
  const sy = (dy / len) * 3.4;
  ctx.strokeStyle = SOLE;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(heel.x + sx, heel.y + sy);
  ctx.lineTo(toe.x + sx, toe.y + sy);
  ctx.stroke();
}

function drawHead(ctx: CanvasRenderingContext2D, h: Pt): void {
  // 耳
  ctx.fillStyle = SKIN_SHADE;
  ctx.strokeStyle = SKIN_EDGE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(h.x - 3, h.y + 1.5, 2.8, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 顔
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = SKIN_EDGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, 10.5, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 髪(頭頂から後頭部)
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.ellipse(h.x - 1.5, h.y - 1.5, 12, 13.5, 0, Math.PI * 0.62, Math.PI * 1.9);
  ctx.quadraticCurveTo(h.x + 11, h.y - 12, h.x + 7.5, h.y - 7);
  ctx.quadraticCurveTo(h.x + 2, h.y - 9.5, h.x - 5, h.y - 5);
  ctx.closePath();
  ctx.fill();
  // ヘッドバンド
  ctx.strokeStyle = BAND;
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(h.x - 10.5, h.y - 4.5);
  ctx.quadraticCurveTo(h.x, h.y - 9.5, h.x + 10.2, h.y - 5.2);
  ctx.stroke();
  // 眉・目
  ctx.strokeStyle = HAIR;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(h.x + 2.5, h.y - 3.2);
  ctx.lineTo(h.x + 8, h.y - 3.6);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(h.x + 5.2, h.y - 0.4, 2.6, 2.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(h.x + 5.9, h.y - 0.3, 1.3, 0, Math.PI * 2);
  ctx.fill();
  // 鼻・口
  ctx.strokeStyle = SKIN_EDGE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(h.x + 9.6, h.y + 1.5);
  ctx.lineTo(h.x + 11.4, h.y + 3.6);
  ctx.lineTo(h.x + 9.4, h.y + 4.1);
  ctx.stroke();
  ctx.strokeStyle = '#8a3b2e';
  ctx.beginPath();
  ctx.moveTo(h.x + 4.2, h.y + 7.4);
  ctx.quadraticCurveTo(h.x + 7, h.y + 8.8, h.x + 9, h.y + 7);
  ctx.stroke();
}

function drawPose(ctx: CanvasRenderingContext2D, p: Pose): void {
  // 奥側の手足
  drawLeg(ctx, p.legB, SKIN_SHADE, SHORTS_SHADE, SHORTS_EDGE);
  drawArm(ctx, p.armB, SKIN_SHADE);
  // 首
  taper(ctx, p.shoulder, p.head, 8, 7, SKIN, SKIN_EDGE);
  // 腰のショートパンツ
  taper(ctx, mix(p.shoulder, p.hip, 0.74), p.hip, 18, 19, SHORTS, SHORTS_EDGE);
  // 胴体(タンクトップ): 胸を広く、腰を細く
  taper(ctx, p.shoulder, mix(p.shoulder, p.hip, 0.82), 25, 20, SHIRT, SHIRT_EDGE);
  // 脇のライン
  taper(ctx, mix(p.shoulder, p.hip, 0.18), mix(p.shoulder, p.hip, 0.75), 3, 3, SHIRT_SHADE, null);
  // 手前側の手足
  drawLeg(ctx, p.legF, SKIN, SHORTS, SHORTS_EDGE);
  drawArm(ctx, p.armF, SKIN);
  drawHead(ctx, p.head);
}

export function drawRunner(ctx: CanvasRenderingContext2D, x: number, cycle: number, running: boolean): void {
  const bob = running ? Math.abs(Math.sin(cycle)) * 3 : 0;
  const hip = { x, y: GROUND - 49 - bob };
  const shoulder = { x: x + 7, y: GROUND - 86 - bob };
  const target = (k: number): Pt => {
    const s = running ? Math.sin(cycle + k) : 0;
    const lift = running ? Math.max(0, Math.cos(cycle + k)) * 20 : 0;
    return { x: hip.x + s * 26, y: GROUND - 7 - lift };
  };
  const hands = { x: HANDS_X, y: HANDS_Y };
  const handsBack = { x: HANDS_X - 28, y: HANDS_Y + 5 };
  drawPose(ctx, {
    head: { x: x + 13, y: GROUND - 107 - bob },
    shoulder,
    hip,
    armB: ik(shoulder, handsBack, 15, 15, -1),
    armF: ik(shoulder, hands, 15, 15, -1),
    legB: ik(hip, target(Math.PI), 25, 25, 1),
    legF: ik(hip, target(0), 25, 25, 1),
  });
}

/** 手(x,y)でパスタにぶら下がり、体は alpha 方向(0=真下, 90°=前方, 180°=真上)へ伸びる */
export function drawHanging(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, cycle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-alpha);
  // ここからはローカル座標: 手が原点、体は真下(+y)、顔は +x 側
  const swing = Math.sin(cycle * 2);
  const shoulder = { x: -1, y: 28 };
  const hip = { x: -2, y: 68 };
  const foot = (a: number): Pt => ({ x: hip.x + Math.sin(a) * 40, y: hip.y + Math.cos(a) * 40 });
  const hands = { x: 0, y: 0 };
  drawPose(ctx, {
    head: { x: 5, y: 15 },
    shoulder,
    hip,
    armB: ik(shoulder, { x: -2, y: 0 }, 15, 15, -1),
    armF: ik(shoulder, hands, 15, 15, 1),
    legB: ik(hip, foot(-0.3 - swing * 0.25), 25, 25, 1),
    legF: ik(hip, foot(0.45 + swing * 0.25), 25, 25, 1),
  });
  ctx.restore();
}
