import { describe, expect, it } from 'vitest';
import { GROUND } from './game';
import { bendControlPoint } from './pole';

/** 二次ベジエの中央点 */
const mid = (a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x,
  y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y,
});
const base = { x: 400, y: GROUND };

describe('bendControlPoint', () => {
  it('突いた直後(棒が寝ている)は上へ弧を描き、地面の方へは曲がらない', () => {
    const top = { x: 400 - 232, y: GROUND - 62 };
    const c = bendControlPoint(base, top, 60, GROUND);
    const m = mid(base, c, top);
    expect(m.y).toBeLessThan((base.y + top.y) / 2); // 弦より上
    expect(m.y).toBeLessThanOrEqual(GROUND - 2);
  });
  it('立っている棒は前方(+x)へ凸になる', () => {
    const top = { x: 400, y: GROUND - 240 };
    const c = bendControlPoint(base, top, 40, GROUND);
    expect(mid(base, c, top).x).toBeGreaterThan(400);
  });
  it('斜めに立ち上がる途中も前方・上側へ凸になる', () => {
    const top = { x: 400 - 150, y: GROUND - 190 };
    const c = bendControlPoint(base, top, 40, GROUND);
    const m = mid(base, c, top);
    expect(m.x).toBeGreaterThan((base.x + top.x) / 2);
    expect(m.y).toBeLessThan((base.y + top.y) / 2);
  });
  it('どの角度でも、しなりの量が同じなら弦からのずれの大きさは同じ', () => {
    for (const deg of [-75, -40, 0, 40, 70]) {
      const t = (deg * Math.PI) / 180;
      const top = { x: base.x + 240 * Math.sin(t), y: GROUND - 240 * Math.cos(t) };
      const c = bendControlPoint(base, top, 40, GROUND + 1000); // 地面クランプなし
      const m = mid(base, c, top);
      const chordMid = { x: (base.x + top.x) / 2, y: (base.y + top.y) / 2 };
      expect(Math.hypot(m.x - chordMid.x, m.y - chordMid.y)).toBeCloseTo(20);
    }
  });
  it('地面にめり込まない(強いしなりでも)', () => {
    for (const deg of [-85, -75, -60, 80]) {
      const t = (deg * Math.PI) / 180;
      const top = { x: base.x + 240 * Math.sin(t), y: GROUND - 240 * Math.cos(t) };
      const c = bendControlPoint(base, top, 300, GROUND);
      expect(mid(base, c, top).y).toBeLessThanOrEqual(GROUND - 2 + 1e-9);
    }
  });
  it('負のbendは逆向き', () => {
    const top = { x: 400, y: GROUND - 240 };
    expect(mid(base, bendControlPoint(base, top, -40, GROUND), top).x).toBeLessThan(400);
  });
});
