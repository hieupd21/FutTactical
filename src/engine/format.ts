/** Tiền tính bằng nghìn € → "12,5 tr €" hoặc "850k €" */
export function fmtM(k: number): string {
  k = Math.round(k);
  const a = Math.abs(k);
  const s = k < 0 ? "−" : "";
  if (a >= 1000) {
    const v = (a / 1000).toFixed(a >= 100000 ? 0 : a >= 10000 ? 1 : 2).replace(/\.?0+$/, "").replace(".", ",");
    return `${s}${v} tr €`;
  }
  return `${s}${a}k €`;
}

/** Lương tính bằng nghìn € / tuần */
export const fmtW = (w: number): string => `${Math.round(w)}k €/tuần`;
