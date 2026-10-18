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
/** Màu theo thang 0–100 (tinh thần, phong độ) */
export const mcol = (m: number): string => (m >= 80 ? "var(--win)" : m >= 60 ? "#7fb069" : m >= 40 ? "var(--gold)" : m >= 20 ? "#e08a3c" : "var(--loss)");
export const stars = (n: number, of = 5): string => "★".repeat(n) + "☆".repeat(Math.max(0, of - n));
export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(" ");
