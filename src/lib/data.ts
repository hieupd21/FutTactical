// Gói dữ liệu cầu thủ dựng sẵn trong public/data, tải khi cần (không nằm trong bundle JS).
import type { DataRow, LowerLeagueData } from "@/engine/types";

export type PackId = "fc27";
export const PACKS: Record<PackId, { label: string; src: string; note: string }> = {
  fc27: {
    label: "Mùa 2026/27",
    src: "FC 27 (11/10/2026) + FC 26",
    note: "Đội hình và chỉ số theo FC 27 (11/10/2026), đã gồm các thương vụ hè 2026 và đội lên hạng. Tuổi, tiềm năng, lương, hợp đồng lấy từ FC 26 cho cùng cầu thủ; tân binh chưa có dữ liệu cũ được ước lượng. Các giải nguồn cầu thủ (Championship, Liga Portugal, Eredivisie) được bổ sung từ FC 26.",
  },
};

/**
 * Hạng đấu thấp của từng nước, cùng định dạng DataRow với fc27.json (league_id 17, 20, 32, 54, 60, 61).
 * File nào chưa có thì bỏ qua; có thể gộp thẳng vào fc27.json thay vì tách file.
 */
const EXTRA_FILES: Record<PackId, string[]> = {
  fc27: ["lower_england.json", "lower_germany.json", "lower_france.json", "lower_spain.json", "lower_italy.json"],
};

async function fetchExtra(file: string): Promise<DataRow[]> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
    if (!r.ok) return [];
    const j: unknown = await r.json();
    return Array.isArray(j) ? (j as DataRow[]) : [];
  } catch {
    return []; // thiếu file (máy chủ dev trả HTML) hoặc JSON hỏng
  }
}

const cache = new Map<PackId, Promise<DataRow[]>>();
export function loadPack(id: PackId): Promise<DataRow[]> {
  if (!cache.has(id)) {
    const p = Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/${id}.json`).then((r) => {
        if (!r.ok) throw new Error(`Không tải được dữ liệu ${id} (${r.status}).`);
        return r.json() as Promise<DataRow[]>;
      }),
      ...EXTRA_FILES[id].map(fetchExtra),
    ]).then(([main, ...extra]) => main.concat(...extra));
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}

let lowerCache: Promise<LowerLeagueData[]> | undefined;
/** Các hạng đấu thấp hư cấu (Hạng Ba, Hạng Tư) */
export function loadLower(): Promise<LowerLeagueData[]> {
  if (!lowerCache) {
    const p = fetch(`${import.meta.env.BASE_URL}data/lower_leagues.json`).then((r) => {
      if (!r.ok) throw new Error(`Không tải được các hạng đấu thấp (${r.status}).`);
      return r.json() as Promise<LowerLeagueData[]>;
    });
    p.catch(() => (lowerCache = undefined));
    lowerCache = p;
  }
  return lowerCache;
}
