// Tiện ích cho test: dùng cùng bộ FIFACM với sự nghiệp mới trong ứng dụng.
import { readFileSync } from "node:fs";
import { findLeagueByPackId, mockData, setMockData } from "@/engine/mockData";
import { createFifacmPack, type FifacmDataset, type FifacmPack } from "@/engine/fifacm";
import type { DataRow } from "@/engine/types";
import { newGameReal, packClubs } from "@/engine/world";

let cachedPack: FifacmPack | undefined;
export function fifacmPack(): FifacmPack {
  if (!cachedPack) {
    const read = <Value>(filename: string): Value =>
      JSON.parse(readFileSync(`data/fifacm/${filename}.json`, "utf8")) as Value;
    cachedPack = createFifacmPack(
      {
        players: read<FifacmDataset["players"]>("players"),
        clubs: read<FifacmDataset["clubs"]>("clubs"),
        leagues: read<FifacmDataset["leagues"]>("leagues"),
        nations: read<FifacmDataset["nations"]>("nations"),
        snapshotDate: read<{ snapshotDate: string }>("manifest").snapshotDate,
      },
      mockData(),
    );
  }
  setMockData(cachedPack.references);
  return cachedPack;
}
export const packRows = (): DataRow[] => fifacmPack().rows;

export function startTestGame(clubName = "Arsenal", leagueId = "EN", rookie = false): void {
  const dataset = fifacmPack();
  newGameReal(dataset.rows, leagueId, clubName, "FIFACM FC27 · 06/10/2026", { rookie, dataset });
}

/** CLB yếu nhất trong các giải mô phỏng (hạng dưới nếu gói dữ liệu có) */
export function weakestRookieClub(): { leagueId: string; clubName: string } {
  const dataset = fifacmPack();
  const weakest = packClubs(dataset.rows, dataset)
    .filter((packClub) => findLeagueByPackId(packClub.leagueId)!.isSimulated !== false)
    .sort((clubA, clubB) => clubA.strength - clubB.strength)[0];
  return { leagueId: findLeagueByPackId(weakest.leagueId)!.id, clubName: weakest.name };
}
