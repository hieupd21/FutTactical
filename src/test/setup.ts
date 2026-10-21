// Vitest: nạp dữ liệu mock từ public/data/*.json thay cho fetch của trình duyệt.
import { readFileSync } from "node:fs";
import { type MockData, setMockData } from "@/engine/mockData";

const read = <T>(file: string): T => JSON.parse(readFileSync(`public/data/${file}`, "utf8")) as T;

setMockData({
  nationalities: read("nationalities.json"),
  leagues: read("leagues.json"),
  clubVisuals: read("club_visuals.json"),
} satisfies MockData);
