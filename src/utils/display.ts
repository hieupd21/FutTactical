import { dateOf } from "@/engine/state";

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export function dstr(d: number): string {
  const x = dateOf(d);
  return `${DOW[x.getDay()]} ${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`;
}
export function shortD(d: number): string {
  const x = dateOf(d);
  return `${x.getDate()}/${x.getMonth() + 1}`;
}
/** Tên ngắn: 2 từ cuối */
export const sn = (n: string): string => n.split(" ").slice(-2).join(" ");
/** Màu theo thang 0–100 (tinh thần, phong độ): token --lv-1..5 đủ tương phản làm chữ lẫn chấm */
export const mcol = (m: number): string => `var(--lv-${m >= 80 ? 5 : m >= 60 ? 4 : m >= 40 ? 3 : m >= 20 ? 2 : 1})`;
export const stars = (n: number, of = 5): string => "★".repeat(n) + "☆".repeat(Math.max(0, of - n));
export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(" ");
