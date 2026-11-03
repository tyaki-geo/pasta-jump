import type { Pt } from './game';

/**
 * 弓なりに曲がる向きを決め、二次ベジエの制御点を返す。
 *
 * 棒は体の推進力に押されて、上・前方(+x)へ凸になるよう曲がる。
 * 突いた直後の寝ている棒は上へ弧を描き、立ち上がるにつれて前方へ凸になる。
 * 弦に垂直な2方向のうち、「前方・上向き」を優先した側を選ぶ(地面の方へは曲げない)。
 *
 * @param bend 正: 前方・上へ凸 / 負: 逆向き。曲線の頂点のずれは bend の約半分
 * @param groundY 曲線の中央がこれより下(地面の中)に入らないようにする
 */
export function bendControlPoint(a: Pt, b: Pt, bend: number, groundY: number): Pt {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = dy / len;
  let ny = -dx / len;
  // y は下向きが正。前方(+x)と上(-y)を向く法線を選ぶ
  if (nx * 0.7 - ny < -nx * 0.7 + ny) {
    nx = -nx;
    ny = -ny;
  }
  const cx = mx + nx * bend;
  let cy = my + ny * bend;
  // 二次ベジエの中央点 = 0.25a + 0.5c + 0.25b が地面に潜らないようにする
  const maxCy = 2 * (groundY - 2) - 0.5 * (a.y + b.y);
  if (cy > maxCy) cy = maxCy;
  return { x: cx, y: cy };
}
