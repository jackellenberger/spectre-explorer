import { Matrix, Point } from '../types';

export const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0];

// Affine matrix inverse
export function inv(T: Matrix): Matrix {
  const det = T[0] * T[4] - T[1] * T[3];
  return [
    T[4] / det,
    -T[1] / det,
    (T[1] * T[5] - T[2] * T[4]) / det,
    -T[3] / det,
    T[0] / det,
    (T[2] * T[3] - T[0] * T[5]) / det,
  ];
}

// Affine matrix multiply
export function mul(A: Matrix, B: Matrix): Matrix {
  return [
    A[0] * B[0] + A[1] * B[3],
    A[0] * B[1] + A[1] * B[4],
    A[0] * B[2] + A[1] * B[5] + A[2],

    A[3] * B[0] + A[4] * B[3],
    A[3] * B[1] + A[4] * B[4],
    A[3] * B[2] + A[4] * B[5] + A[5],
  ];
}

export function padd(p: Point, q: Point): Point {
  return { x: p.x + q.x, y: p.y + q.y };
}

export function psub(p: Point, q: Point): Point {
  return { x: p.x - q.x, y: p.y - q.y };
}

export function pframe(o: Point, p: Point, q: Point, a: number, b: number): Point {
  return { x: o.x + a * p.x + b * q.x, y: o.y + a * p.y + b * q.y };
}

// Rotation matrix
export function trot(ang: number): Matrix {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [c, -s, 0, s, c, 0];
}

// Translation matrix
export function ttrans(tx: number, ty: number): Matrix {
  return [1, 0, tx, 0, 1, ty];
}

// Scale matrix
export function tscale(sx: number, sy: number = sx): Matrix {
  return [sx, 0, 0, 0, sy, 0];
}

export function transTo(p: Point, q: Point): Matrix {
  return ttrans(q.x - p.x, q.y - p.y);
}

export function rotAbout(p: Point, ang: number): Matrix {
  return mul(ttrans(p.x, p.y), mul(trot(ang), ttrans(-p.x, -p.y)));
}

// Matrix * point
export function transPt(M: Matrix, P: Point): Point {
  return {
    x: M[0] * P.x + M[1] * P.y + M[2],
    y: M[3] * P.x + M[4] * P.y + M[5],
  };
}

export function toRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

export function mag(x: number, y: number): number {
    return Math.sqrt(x * x + y * y);
}

// Ray-casting algorithm for point in polygon
export function isPointInPoly(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    
    const intersect = ((yi > pt.y) !== (yj > pt.y))
        && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}