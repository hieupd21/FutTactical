// Dữ liệu nguồn ở data/fifacm; Vite phục vụ và xuất JSON riêng, không gói cầu thủ vào JS.
import { createFifacmPack, type FifacmDataset, type FifacmPack } from "@/engine/fifacm";
import { mockData, setMockData } from "@/engine/mockData";
import { FORMS } from "@/engine/constants";

export type PackId = "fifacm";
export const PACKS: Record<PackId, { label: string; sourceNote: string; note: string }> = {
  fifacm: {
    label: "Mùa 2026/27",
    sourceNote: "FIFACM · FC27 · 06/10/2026",
    note: "Dữ liệu bóng đá nam FC27 từ FIFACM, cập nhật 06/10/2026: 18.763 cầu thủ và 663 CLB. Giá trị, lương tuần, hợp đồng và đội hình theo nguồn. Ngân sách chuyển nhượng được game thiết lập để chơi sự nghiệp.",
  },
};

async function fetchDatasetFile<Value>(filename: string): Promise<Value> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/fifacm/${filename}.json`);
  if (!response.ok)
    throw new Error(`Không tải được dữ liệu FIFACM ${filename} (${response.status}).`);
  return response.json() as Promise<Value>;
}

const cache = new Map<PackId, Promise<FifacmPack>>();
export function loadPack(id: PackId): Promise<FifacmPack> {
  if (!cache.has(id)) {
    const loadPromise = Promise.all([
      fetchDatasetFile<FifacmDataset["players"]>("players"),
      fetchDatasetFile<FifacmDataset["clubs"]>("clubs"),
      fetchDatasetFile<FifacmDataset["leagues"]>("leagues"),
      fetchDatasetFile<FifacmDataset["nations"]>("nations"),
      fetchDatasetFile<{ snapshotDate: string }>("manifest"),
    ]).then(([players, clubs, leagues, nations, manifest]) => {
      const dataset = createFifacmPack(
        { players, clubs, leagues, nations, snapshotDate: manifest.snapshotDate },
        mockData(),
      );
      clubs.forEach((club) => {
        if (club.formation && !FORMS[club.formation])
          throw new Error(`Sơ đồ CLB ${club.label} không có trong formations.json.`);
      });
      setMockData(dataset.references);
      return dataset;
    });
    loadPromise.catch(() => cache.delete(id));
    cache.set(id, loadPromise);
  }
  return cache.get(id)!;
}
