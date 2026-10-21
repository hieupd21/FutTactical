/** Tiền tính bằng nghìn € → "12,5 tr €" hoặc "850k €" */
export function formatMoney(thousands: number): string {
  thousands = Math.round(thousands);
  const absolute = Math.abs(thousands);
  const sign = thousands < 0 ? "−" : "";
  if (absolute >= 1000) {
    const text = (absolute / 1000)
      .toFixed(absolute >= 100000 ? 0 : absolute >= 10000 ? 1 : 2)
      .replace(/\.?0+$/, "")
      .replace(".", ",");
    return `${sign}${text} tr €`;
  }
  return `${sign}${absolute}k €`;
}

/** Lương tính bằng nghìn € / tuần */
export const formatWage = (wage: number): string => `${Math.round(wage)}k €/tuần`;
