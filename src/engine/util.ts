export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
export const ri = (a: number, b: number): number => Math.floor(rnd(a, b + 1));
export const pickA = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
/** Làm tròn tới bội số 10 (nghìn €), tối thiểu 10 */
export const r10 = (v: number): number => Math.max(10, Math.round(v / 10) * 10);
