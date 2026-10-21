// Tiện ích cho test: bắt đầu sự nghiệp bằng dữ liệu thật public/data/fc27.json.
import { readFileSync } from "node:fs";
import { findLeagueByPackId } from "@/engine/mockData";
import type { DataRow } from "@/engine/types";
import { newGameReal, packClubs } from "@/engine/world";

let cachedRows: DataRow[] | null = null;
export const packRows = (): DataRow[] => {
  cachedRows ??= JSON.parse(readFileSync("public/data/fc27.json", "utf8")) as DataRow[];
  return cachedRows;
};

export function startTestGame(clubName = "Arsenal", leagueId = "EN", rookie = false): void {
  newGameReal(packRows(), leagueId, clubName, "FC 27", { rookie });
}

/** CLB yếu nhất trong các giải mô phỏng (hạng dưới nếu gói dữ liệu có) */
export function weakestRookieClub(): { leagueId: string; clubName: string } {
  const weakest = packClubs(packRows())
    .filter((packClub) => findLeagueByPackId(packClub.leagueId)!.isSimulated !== false)
    .sort((clubA, clubB) => clubA.strength - clubB.strength)[0];
  return { leagueId: findLeagueByPackId(weakest.leagueId)!.id, clubName: weakest.name };
}
