import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { FORMS } from "./constants";
import {
  createFifacmPack,
  fifacmPositionLine,
  type FifacmDataset,
  type FifacmPack,
} from "./fifacm";
import { setMockData } from "./mockData";
import { myWages } from "./board";
import { newGameReal, packClubs } from "./world";
import { gameState, myClub } from "./state";
import { myLineup, slotPositions } from "./squad";
import { valueOf } from "./players";
import { simMatch } from "./match";

const readDataset = <Value>(filename: string): Value =>
  JSON.parse(readFileSync(`data/fifacm/${filename}.json`, "utf8")) as Value;
const dataset: FifacmDataset = {
  players: readDataset("players"),
  clubs: readDataset("clubs"),
  leagues: readDataset("leagues"),
  nations: readDataset("nations"),
  snapshotDate: readDataset<{ snapshotDate: string }>("manifest").snapshotDate,
};
let pack: FifacmPack;

beforeAll(() => {
  pack = createFifacmPack(dataset);
});

describe("dữ liệu FIFACM trong sự nghiệp", () => {
  it("giữ đủ cầu thủ, CLB, giải và tham chiếu quốc tịch", () => {
    expect(pack.rows).toHaveLength(18763);
    expect(pack.clubByName.size).toBe(663);
    setMockData(pack.references);
    expect(packClubs(pack.rows, pack)).toHaveLength(663);
    expect(
      Object.values(pack.references.leagues.countries).flatMap((country) => country.leagues),
    ).toHaveLength(36);
    const premierLeague = Object.values(pack.references.leagues.countries)
      .flatMap((country) => country.leagues)
      .find((league) => league.packId === 13)!;
    expect(premierLeague.id).toBe("fl13");
    expect(premierLeague.name).toBe("England Premier League");
    expect(premierLeague.level).toBeCloseTo(4, 0);
    const simulatedLeagueIds = Object.values(pack.references.leagues.countries)
      .flatMap((country) => country.leagues)
      .filter((league) => league.isSimulated)
      .map((league) => league.packId)
      .sort((idA, idB) => idA - idB);
    expect(simulatedLeagueIds).toEqual([13, 14, 16, 17, 19, 20, 31, 32, 53, 54, 60, 61, 2076]);
  });

  it("khởi tạo đúng đội, lương, giá trị, hợp đồng, điều khoản và cầu thủ tự do", () => {
    newGameReal(pack.rows, "fl13", "Arsenal", "FIFACM FC27", { dataset: pack });
    expect(gameState.dataProvider).toBe("fifacm");
    expect(gameState.year).toBe(2026);
    expect(Object.keys(gameState.players)).toHaveLength(18763);
    expect(Object.keys(gameState.clubs)).toHaveLength(663);
    expect(gameState.free).toHaveLength(219);
    dataset.players.forEach((source) => {
      const player = gameState.players[`f${source.id}`];
      expect(player.sourceId).toBe(source.id);
      expect(player.nationId).toBe(source.nationality.id);
      expect(player.age).toBe(source.age);
      expect(player.pot).toBe(source.potential);
      expect(player.marketValue).toBe(source.valueEur / 1000);
      expect(player.club).toBe(source.clubId === null ? null : `fc${source.clubId}`);
      if (source.clubId === null) expect(player.contract).toBeNull();
      else {
        expect(player.contract?.wage).toBe(source.wageEur / 1000);
        expect(player.contract?.expiryYear).toBe(source.contractYear);
        expect(player.contract?.releaseClause).toBe(source.releaseClauseEur / 1000);
      }
    });
    const sourceClub = dataset.clubs.find((club) => club.id === 1)!;
    expect(myClub().sourceId).toBe(1);
    expect(myClub().form).toBe(sourceClub.formation);
    expect(myWages()).toBeCloseTo(sourceClub.weeklyWageEur / 1000);
    expect(gameState.wageCap).toBeGreaterThan(myWages());
    expect(myClub().budget).toBeGreaterThan(0);
    expect(new Set(myLineup())).toEqual(
      new Set(sourceClub.startingXI.map((slot) => `f${slot.playerId}`)),
    );
    myLineup().forEach((playerId, slotIndex) => {
      const sourceSlot = sourceClub.startingXI.find((slot) => `f${slot.playerId}` === playerId)!;
      expect(fifacmPositionLine(sourceSlot.position)).toBe(
        slotPositions(gameState.form)[slotIndex],
      );
    });
    expect(Number.isFinite(valueOf(gameState.players.f231747))).toBe(true);
    dataset.clubs.forEach((source) => {
      const club = gameState.clubs[`fc${source.id}`];
      expect(new Set(club.playerIds)).toEqual(new Set(source.playerIds.map((id) => `f${id}`)));
      expect(club.form).toBe(source.formation);
    });
  });

  it("sơ đồ dữ liệu đều có 11 vị trí và có thể mô phỏng trận đấu", () => {
    newGameReal(pack.rows, "fl13", "Arsenal", "FIFACM FC27", { dataset: pack });
    expect(Object.keys(FORMS)).toHaveLength(22);
    Object.keys(FORMS).forEach((formation) => {
      expect(slotPositions(formation as keyof typeof FORMS)).toHaveLength(11);
    });
    const clubIds = Object.keys(gameState.clubs);
    const result = simMatch(clubIds[0], clubIds[1]);
    expect(result.homeGoals).toBeGreaterThanOrEqual(0);
    expect(result.awayGoals).toBeGreaterThanOrEqual(0);
  });

  it("không âm thầm bỏ cầu thủ khi tham chiếu CLB bị lỗi", () => {
    const broken = { ...dataset, players: [{ ...dataset.players[0], clubId: -1 }] };
    expect(() => createFifacmPack(broken)).toThrow("không hợp lệ");
  });
});
