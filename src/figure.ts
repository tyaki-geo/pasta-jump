// 人物の描画。棒人間版は render.ts の drawRunner / drawHanging に残してある
import { GROUND, HANDS_X, HANDS_Y, Pt } from './game';

const SKIN = '#f5c9a0';
const SKIN_SHADE = '#d9a77c';
const SHIRT = '#e8483b';
const SHIRT_SHADE = '#c0392b';
const SHORTS = '#2c3e8f';
const SHORTS_SHADE = '#222f70';
const HAIR = '#4a2f1d';
const SHOE = '#f4f4f4';
const OUTLINE = '#2b2b3a';

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

function stroke(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

const mix = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function drawLeg(ctx: CanvasRenderingContext2D, leg: Pt[], skin: string, shorts: string): void {
  const [hip, knee, foot] = leg;
  stroke(ctx, [knee, foot], skin, 8);
  stroke(ctx, [hip, knee], skin, 10);
  stroke(ctx, [hip, mix(hip, knee, 0.65)], shorts, 15); // ショートパンツ
  // シューズ(進行方向=足先の向きは前腕から足への向き+前方)
  const dx = foot.x - knee.x;
  const dy = foot.y - knee.y;
  const len = Math.hypot(dx, dy) || 1;
  // 足首から進行方向(体の前)へ少し伸ばす: 脛に垂直な方向のうち +x 側
  let nx = dy / len;
  let ny = -dx / len;
  if (nx < 0) {
    nx = -nx;
    ny = -ny;
  }
  stroke(ctx, [foot, { x: foot.x + nx * 9, y: foot.y + ny * 9 }], OUTLINE, 9);
  stroke(ctx, [foot, { x: foot.x + nx * 9, y: foot.y + ny * 9 }], SHOE, 6);
}

function drawArm(ctx: CanvasRenderingContext2D, arm: Pt[], skin: string): void {
  stroke(ctx, arm, skin, 7);
  const hand = arm[arm.length - 1];
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawHead(ctx: CanvasRenderingContext2D, h: Pt): void {
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 髪(頭の上〜後ろ)
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 11.5, Math.PI * 0.55, Math.PI * 1.85);
  ctx.closePath();
  ctx.fill();
  // 目
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(h.x + 5, h.y - 1, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawPose(ctx: CanvasRenderingContext2D, p: Pose): void {
  drawLeg(ctx, p.legB, SKIN_SHADE, SHORTS_SHADE);
  drawArm(ctx, p.armB, SKIN_SHADE);
  // 胴体(タンクトップ)
  stroke(ctx, [p.shoulder, p.hip], SHIRT_SHADE, 22);
  stroke(ctx, [p.shoulder, mix(p.shoulder, p.hip, 0.85)], SHIRT, 19);
  drawLeg(ctx, p.legF, SKIN, SHORTS);
  drawArm(ctx, p.armF, SKIN);
  drawHead(ctx, p.head);
}

export function drawRunner(ctx: CanvasRenderingContext2D, x: number, cycle: number, running: boolean): void {
  const hip = { x, y: GROUND - 50 };
  const shoulder = { x: x + 6, y: GROUND - 88 };
  const leg = (k: number): Pt[] => {
    const s = running ? Math.sin(cycle + k) : 0;
    const lift = running ? Math.max(0, Math.cos(cycle + k)) * 16 : 0;
    const foot = { x: hip.x + s * 28, y: GROUND - 6 - lift };
    const knee = { x: (hip.x + foot.x) / 2 + 10, y: (hip.y + foot.y) / 2 - 2 };
    return [hip, knee, foot];
  };
  const back = running ? Math.sin(cycle) * 18 : 0;
  const hand = { x: shoulder.x - 6 + back, y: shoulder.y + 28 };
  const hands = { x: HANDS_X, y: HANDS_Y };
  drawPose(ctx, {
    head: { x: x + 11, y: GROUND - 106 },
    shoulder,
    hip,
    armB: [shoulder, { x: (shoulder.x + hand.x) / 2 - 4, y: (shoulder.y + hand.y) / 2 + 2 }, hand],
    armF: [shoulder, { x: (shoulder.x + hands.x) / 2, y: (shoulder.y + hands.y) / 2 + 10 }, hands],
    legB: leg(Math.PI),
    legF: leg(0),
  });
}

/** 手(x,y)でパスタにぶら下がり、体は alpha 方向(0=真下, 90°=前方, 180°=真上)へ伸びる */
export function drawHanging(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, cycle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-alpha);
  // ここからはローカル座標: 手が原点、体は真下(+y)、顔は +x 側
  const swing = Math.sin(cycle * 2) * 0.3;
  const shoulder = { x: 0, y: 26 };
  const hip = { x: 0, y: 64 };
  const leg = (a: number): Pt[] => {
    const knee = { x: hip.x + Math.sin(a) * 22, y: hip.y + Math.cos(a) * 22 };
    const foot = { x: knee.x + Math.sin(a - 0.7) * 22, y: knee.y + Math.cos(a - 0.7) * 22 };
    return [hip, knee, foot];
  };
  const hands = { x: 0, y: 0 };
  drawPose(ctx, {
    head: { x: 5, y: 24 },
    shoulder,
    hip,
    armB: [{ x: -3, y: 26 }, { x: -5, y: 13 }, { x: -2, y: 0 }],
    armF: [{ x: 3, y: 26 }, { x: 6, y: 13 }, hands],
    legB: leg(-0.25 - swing),
    legF: leg(0.35 + swing),
  });
  ctx.restore();
}
