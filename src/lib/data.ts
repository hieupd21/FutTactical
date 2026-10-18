// Gói dữ liệu cầu thủ dựng sẵn trong public/data, tải khi cần (không nằm trong bundle JS).
import type { DataRow } from "@/engine/types";

export type PackId = "fc27" | "fc26";
export const PACKS: Record<PackId, { label: string; src: string; note: string }> = {
  fc27: {
    label: "Mùa 2026/27",
    src: "FC 27 (11/10/2026) + FC 26",
    note: "Đội hình và chỉ số theo FC 27 (11/10/2026), đã gồm các thương vụ hè 2026 và đội lên hạng. Tuổi, tiềm năng, lương, hợp đồng lấy từ FC 26 cho cùng cầu thủ; tân binh chưa có dữ liệu cũ được ước lượng.",
  },
  fc26: {
    label: "Mùa 2025/26",
    src: "FC 26 (19/9/2025)",
    note: "Đội hình, chỉ số, giá trị, lương và hợp đồng thật theo bộ dữ liệu FC 26 (cập nhật 19/9/2025). Gồm 5 giải lớn và 3 giải nguồn cầu thủ: Championship, Liga Portugal, Eredivisie.",
  },
};

const cache = new Map<PackId, Promise<DataRow[]>>();
export function loadPack(id: PackId): Promise<DataRow[]> {
  if (!cache.has(id)) {
    const p = fetch(`${import.meta.env.BASE_URL}data/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`Không tải được dữ liệu ${id} (${r.status}).`);
      return r.json() as Promise<DataRow[]>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}
