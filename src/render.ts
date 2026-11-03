import {
  BAR_OFFSET,
  Game,
  GROUND,
  H,
  HANDS_X,
  HANDS_Y,
  GAUGE_SPEED,
  GAUGE_TARGET_X,
  PLANT_REACH,
  PLANT_WINDOW,
  VAULT_TIME,
  POLE_LEN,
  Pt,
  RELEASE_IDEAL,
  RELEASE_WINDOW,
  W,
} from './game';

const GAUGE_X0 = 100;
const GAUGE_H = 22;
const PASTA = '#f2c94c';
const PASTA_EDGE = '#b8892a';
const SKIN = '#ffe0bd';
const INK = '#2b2b3a';

function line(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function pasta(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, bend = 0): void {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // 進行方向と逆(後ろ・下)へしなる
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (dy / len) * bend;
  const cy = my - (dx / len) * bend;
  for (const [color, width] of [[PASTA_EDGE, 8], [PASTA, 5]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.stroke();
  }
}

function drawHanging(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, cycle: number): void {
  const d = { x: Math.sin(alpha), y: Math.cos(alpha) };
  const at = (k: number, dir = d): Pt => ({ x: x + dir.x * k, y: y + dir.y * k });
  const shoulder = at(22);
  const hip = at(60);
  const swing = Math.sin(cycle * 2) * 0.25;
  const leg = (a: number): Pt => {
    const dir = { x: Math.sin(alpha + a), y: Math.cos(alpha + a) };
    return { x: hip.x + dir.x * 42, y: hip.y + dir.y * 42 };
  };
  line(ctx, [{ x, y }, shoulder], INK, 4);
  line(ctx, [shoulder, hip], INK, 5);
  line(ctx, [hip, leg(0.3 + swing)], INK, 4);
  line(ctx, [hip, leg(-0.3 - swing)], INK, 4);
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(shoulder.x + d.x * 8, shoulder.y + d.y * 8, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawRunner(ctx: CanvasRenderingContext2D, x: number, cycle: number, running: boolean): void {
  const hip = { x, y: GROUND - 50 };
  const shoulder = { x: x + 6, y: GROUND - 88 };
  const head = { x: x + 11, y: GROUND - 104 };
  const leg = (k: number): Pt[] => {
    const s = running ? Math.sin(cycle + k) : 0;
    const lift = running ? Math.max(0, Math.cos(cycle + k)) * 16 : 0;
    const foot = { x: hip.x + s * 28, y: GROUND - lift };
    const knee = { x: (hip.x + foot.x) / 2 + 10, y: (hip.y + foot.y) / 2 - 2 };
    return [hip, knee, foot];
  };
  line(ctx, leg(0), INK, 5);
  line(ctx, leg(Math.PI), INK, 5);
  line(ctx, [hip, shoulder], INK, 6);
  const back = running ? Math.sin(cycle) * 18 : 0;
  line(ctx, [shoulder, { x: shoulder.x - 6 + back, y: shoulder.y + 26 }], INK, 4);
  line(ctx, [shoulder, { x: HANDS_X, y: HANDS_Y }], INK, 4);
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawBackground(ctx: CanvasRenderingContext2D, g: Game): void {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#8fd3ff');
  sky.addColorStop(1, '#e8f7ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // 遠景の丘(ゆっくりスクロール)
  ctx.fillStyle = '#b9e4b0';
  const off = -((g.scroll * 0.2) % 400);
  for (let i = -1; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(off + i * 400 + 150, GROUND, 220, 90, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#7dc46a';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#6ab058';
  const dash = 80;
  const o = -(g.scroll % (dash * 2));
  for (let x = o; x < W; x += dash * 2) ctx.fillRect(x, GROUND + 18, dash, 5);
}

function drawBarAndBox(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.boxX === null) return;
  const bx = g.boxX;
  // 突き箱
  ctx.fillStyle = '#4a3b2e';
  ctx.fillRect(bx - 22, GROUND - 4, 44, 14);
  // バー: 支柱 + 横木(奥行き表現で右へ少し伸ばす)
  const x = bx + BAR_OFFSET;
  const y = g.barY;
  ctx.fillStyle = '#9aa3ad';
  ctx.fillRect(x - 3, y - 4, 6, GROUND - y + 4);
  ctx.fillRect(x + 60 - 3, y - 4, 6, GROUND - y + 4);
  ctx.fillStyle = '#7b8590';
  ctx.fillRect(x - 12, GROUND - 2, 24, 4);
  const drop = g.barDrop;
  ctx.save();
  ctx.translate(0, drop);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(x - 2, y - 3, 64, 6);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 8 + i * 16, y - 3, 8, 6);
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${g.settings.barHeight.toFixed(1)}m`, x + 70, y + 5);
  // マット
  ctx.fillStyle = '#4d7fd6';
  ctx.fillRect(x + 80, GROUND - 24, 160, 24);
  ctx.fillStyle = '#6a99ea';
  ctx.fillRect(x + 80, GROUND - 24, 160, 6);
}

function drawPole(ctx: CanvasRenderingContext2D, g: Game): void {
  const p = g.pole;
  if (p.kind === 'carry') {
    const a = { x: HANDS_X - 40, y: HANDS_Y - Math.sin(p.tipAngle) * 40 };
    const b = { x: HANDS_X + POLE_LEN * Math.cos(p.tipAngle) - 30, y: HANDS_Y + POLE_LEN * Math.sin(p.tipAngle) };
    // 先端が伸びきった位置を維持しつつ手元を後ろに残す
    pasta(ctx, a, { x: HANDS_X + (b.x - HANDS_X) + 30, y: b.y }, -4);
  } else if (p.kind === 'vault') {
    pasta(ctx, p.base, p.top, p.bend);
  } else if (p.kind === 'broken' && p.mid && p.piece) {
    pasta(ctx, p.base, p.mid, 0);
    pasta(ctx, p.piece[0], p.piece[1], 0);
  }
}

function drawZone(ctx: CanvasRenderingContext2D, cx: number, y: number, outer: number, inner: number): void {
  ctx.fillStyle = 'rgba(255,176,32,0.85)';
  ctx.fillRect(cx - outer, y, outer * 2, GAUGE_H);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(cx - inner, y, inner * 2, GAUGE_H);
}

/** 地面のゲージ。固定バーに緑ゾーンが重なる瞬間が理想 */
function drawGauge(ctx: CanvasRenderingContext2D, g: Game): void {
  const err = g.plantError;
  let center: number | null = null;
  let outer = 0;
  if (g.phase === 'run' && err !== null) {
    center = GAUGE_TARGET_X + err;
    outer = PLANT_WINDOW;
  } else if (g.phase === 'vault') {
    center = GAUGE_TARGET_X + (RELEASE_IDEAL - g.vaultU) * VAULT_TIME * GAUGE_SPEED;
    outer = RELEASE_WINDOW * VAULT_TIME * GAUGE_SPEED;
  }
  if (center === null) return;
  const x0 = GAUGE_X0;
  const x1 = GAUGE_TARGET_X + PLANT_REACH;
  const y = GROUND + 34;
  ctx.fillStyle = 'rgba(30,40,60,0.75)';
  ctx.fillRect(x0, y, x1 - x0, GAUGE_H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y, x1 - x0, GAUGE_H);
  ctx.clip();
  drawZone(ctx, center, y, outer, outer * 0.4);
  ctx.restore();
  // 固定バー
  ctx.fillStyle = '#fff';
  ctx.fillRect(GAUGE_TARGET_X - 3, y - 8, 6, GAUGE_H + 16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(GAUGE_TARGET_X - 3, y - 8, 6, GAUGE_H + 16);
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game): void {
  let text = '';
  if (g.phase === 'run') {
    text = g.boxX === null ? 'ダッシュ！' : '緑がバーに重なったらタップして押しっぱなし！';
  } else if (g.phase === 'vault') {
    text = '緑がバーに重なったら指を離せ！';
  }
  if (!text) return;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeText(text, W / 2, 40);
  ctx.fillText(text, W / 2, 40);
}

export function draw(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, g);
  drawBarAndBox(ctx, g);
  drawPole(ctx, g);
  const b = g.body;
  if (b.kind === 'run' || b.kind === 'trip') {
    ctx.save();
    ctx.translate(b.x, GROUND);
    ctx.rotate(b.tilt);
    ctx.translate(-b.x, -GROUND);
    drawRunner(ctx, b.x, b.cycle, g.phase === 'run' || g.phase === 'miss');
    ctx.restore();
  } else {
    drawHanging(ctx, b.x, b.y, b.alpha, b.cycle);
  }
  drawGauge(ctx, g);
  drawHud(ctx, g);
}

