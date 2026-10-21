export const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);
export const randomInt = (min: number, max: number): number =>
  Math.floor(randomBetween(min, max + 1));
export const pickRandom = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
/** Làm tròn tới bội số 10 (nghìn €), tối thiểu 10 */
export const roundToTen = (value: number): number => Math.max(10, Math.round(value / 10) * 10);
