import { dateOf } from "@/engine/state";

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export function formatDate(day: number): string {
  const date = dateOf(day);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}
export function formatShortDate(day: number): string {
  const date = dateOf(day);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}
/** Tên ngắn: 2 từ cuối */
export const shortName = (fullName: string): string => fullName.split(" ").slice(-2).join(" ");
/** Màu theo thang 0–100 (tinh thần, phong độ): token --lv-1..5 đủ tương phản làm chữ lẫn chấm */
export const moraleColor = (morale: number): string =>
  `var(--lv-${morale >= 80 ? 5 : morale >= 60 ? 4 : morale >= 40 ? 3 : morale >= 20 ? 2 : 1})`;
export const stars = (count: number, maximum = 5): string =>
  "★".repeat(count) + "☆".repeat(Math.max(0, maximum - count));
export const classNames = (...classes: (string | false | null | undefined)[]): string =>
  classes.filter(Boolean).join(" ");
