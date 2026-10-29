// Tiện ích cho test: dùng cùng bộ FIFACM với sự nghiệp mới trong ứng dụng.
import { readFileSync } from "node:fs";
import { findLeagueByPackId, setMockData } from "@/engine/mockData";
import { createFifacmPack, type FifacmDataset, type FifacmPack } from "@/engine/fifacm";
import { newGameReal, packClubs } from "@/engine/world";

/** ID giải Premier League trong dữ liệu FIFACM (13) theo quy ước `fl<id>` */
const PREMIER_LEAGUE_ID = "fl13";

let cachedPack: FifacmPack | undefined;
function fifacmPack(): FifacmPack {
  if (!cachedPack) {
    const read = <Value>(filename: string): Value =>
      JSON.parse(readFileSync(`data/fifacm/${filename}.json`, "utf8")) as Value;
    cachedPack = createFifacmPack({
      players: read<FifacmDataset["players"]>("players"),
      clubs: read<FifacmDataset["clubs"]>("clubs"),
      leagues: read<FifacmDataset["leagues"]>("leagues"),
      nations: read<FifacmDataset["nations"]>("nations"),
      snapshotDate: read<{ snapshotDate: string }>("manifest").snapshotDate,
    });
  }
  setMockData(cachedPack.references);
  return cachedPack;
}

export function startTestGame(
  clubName = "Arsenal",
  leagueId = PREMIER_LEAGUE_ID,
  rookie = false,
): void {
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

/** Bắt đầu sự nghiệp ở chế độ "CLB của tôi": CLB mới thế chỗ removedClubName */
export function startTestCustomGame(
  customName: string,
  removedClubName = "Arsenal",
  leagueId = PREMIER_LEAGUE_ID,
): void {
  const dataset = fifacmPack();
  newGameReal(dataset.rows, leagueId, removedClubName, "FIFACM FC27 · 06/10/2026", {
    rookie: false,
    dataset,
    customClub: { name: customName, logoDataUrl: null },
  });
}
