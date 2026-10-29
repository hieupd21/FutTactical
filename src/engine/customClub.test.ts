import { describe, expect, it } from "vitest";
import { mockData } from "./mockData";
import { playMyMatch } from "./match";
import { advance } from "./season";
import { clubPlayers } from "./squad";
import { gameState, getLeague, myClub, simLeagues } from "./state";
import { startTestCustomGame, startTestGame } from "@/test/helpers";

function playSeason(): void {
  const startYear = gameState.year;
  let guard = 0;
  while (gameState.year === startYear && guard++ < 2000 && !gameState.sacked) {
    if (gameState.matchToday) playMyMatch();
    else advance("next");
  }
}

describe("CLB của tôi", () => {
  it("CLB tự tạo thế chỗ đội bị loại và thừa hưởng nguyên đội hình", () => {
    startTestGame();
    const arsenalSquadSize = clubPlayers(gameState.myClubId).length;
    startTestCustomGame("Sân Cỏ FC");
    expect(myClub().name).toBe("Sân Cỏ FC");
    expect(Object.values(gameState.clubs).some((club) => club.name === "Arsenal")).toBe(false);
    expect(clubPlayers(gameState.myClubId).length).toBe(arsenalSquadSize);
  });
});

describe("lên/xuống hạng", () => {
  it("cuối mùa đổi chỗ đội cuối bảng hạng trên với đội đầu bảng hạng dưới, giữ nguyên số đội mỗi giải", () => {
    startTestGame();
    const sizeBefore = Object.fromEntries(
      simLeagues().map((league) => [
        league.id,
        Object.values(gameState.clubs).filter((club) => club.leagueId === league.id).length,
      ]),
    );
    const leagueBefore = Object.fromEntries(
      Object.values(gameState.clubs).map((club) => [club.id, club.leagueId]),
    );
    playSeason();
    simLeagues().forEach((league) =>
      expect(
        Object.values(gameState.clubs).filter((club) => club.leagueId === league.id).length,
      ).toBe(sizeBefore[league.id]),
    );
    const moved = Object.values(gameState.clubs).filter(
      (club) => leagueBefore[club.id] !== club.leagueId,
    );
    // chỉ kiểm tra được khi quốc gia của giải đầu có nhiều hạng được mô phỏng
    const countries = Object.values(mockData().leagues.countries);
    const hasLowerTier = countries.some(
      (country) => country.leagues.filter((league) => league.isSimulated !== false).length > 1,
    );
    if (hasLowerTier) {
      expect(moved.length).toBeGreaterThan(0);
      moved.forEach((club) => expect(getLeague(club.leagueId)).toBeDefined());
    }
  });
});
