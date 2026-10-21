// Nạp toàn bộ dữ liệu mock từ public/data/*.json một lần, rồi đưa vào kho của engine.
import { type MockData, setMockData } from "@/engine/mockData";

export const MOCK_FILES = {
  nationalities: "nationalities.json",
  leagues: "leagues.json",
  clubVisuals: "club_visuals.json",
} as const;

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!response.ok) throw new Error(`Không tải được dữ liệu ${file} (${response.status}).`);
  return (await response.json()) as T;
}

let pending: Promise<void> | undefined;
export function loadMockData(): Promise<void> {
  if (!pending) {
    pending = Promise.all([
      fetchJson<MockData["nationalities"]>(MOCK_FILES.nationalities),
      fetchJson<MockData["leagues"]>(MOCK_FILES.leagues),
      fetchJson<MockData["clubVisuals"]>(MOCK_FILES.clubVisuals),
    ]).then(([nationalities, leagues, clubVisuals]) => {
      setMockData({ nationalities, leagues, clubVisuals });
    });
    pending.catch(() => {
      pending = undefined;
    });
  }
  return pending;
}
