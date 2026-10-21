import { mockData } from "@/engine/mockData";
// Màu áo đặc trưng [màu chính, màu phụ] và mã viết tắt nằm trong public/data/club_visuals.json. Huy hiệu là thiết kế chung (khiên + họa tiết + chữ), không mô phỏng huy hiệu thật.

export function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
const PALETTE: [string, string][] = [
  ["#1f4e9c", "#ffffff"],
  ["#c0262d", "#ffffff"],
  ["#111111", "#ffffff"],
  ["#0f7a43", "#ffffff"],
  ["#f2c200", "#1b1b1b"],
  ["#5b2d8e", "#ffffff"],
  ["#e86a1c", "#111111"],
  ["#2b9bd6", "#ffffff"],
];
export const clubColors = (name: string): [string, string] =>
  mockData().clubVisuals.colors[name] || PALETTE[hashString(name) % PALETTE.length];

export function clubCode(name: string): string {
  if (mockData().clubVisuals.shortCodes[name]) return mockData().clubVisuals.shortCodes[name];
  const words = name
    .replace(/[0-9.&]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word &&
        !/^(FC|AC|CF|SC|RC|RCD|CA|AS|OGC|SV|TSG|VfB|VfL|FSV|AFC|SL|CP|UD|SCO|AJ|ESTAC|de|del|la|le)$/i.test(
          word,
        ),
    );
  if (!words.length) return name.slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
export function luminance(hexColor: string): number {
  const rgb = parseInt(hexColor.slice(1), 16);
  return (0.299 * ((rgb >> 16) & 255) + 0.587 * ((rgb >> 8) & 255) + 0.114 * (rgb & 255)) / 255;
}
