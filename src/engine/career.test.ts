import { beforeEach, describe, expect, it } from "vitest";
import { sack } from "./board";
import { takeNewJob } from "./actions";
import {
  acceptOffer,
  clubRequirement,
  jobOffersTick,
  myReputation,
  NEWBIE_REPUTATION,
} from "./career";
import { playMyMatch } from "./match";
import { advance } from "./season";
import { clubPlayers } from "./squad";
import { getClub, myClub, gameState, simLeagues } from "./state";
import { startTestGame, weakestRookieClub } from "@/test/helpers";

function playSeason(): void {
  const year = gameState.year;
  let guard = 0;
  while (gameState.year === year && guard++ < 2000 && !gameState.sacked) {
    if (gameState.matchToday) playMyMatch();
    else advance("next");
  }
}

describe("sự nghiệp HLV mới từ đội yếu nhất", () => {
  beforeEach(() => {
    const { leagueId, clubName } = weakestRookieClub();
    startTestGame(clubName, leagueId, true);
  });

  it("HLV mới dẫn đội yếu nhất có đủ cầu thủ và đủ lịch thi đấu", () => {
    expect(myReputation()).toBe(NEWBIE_REPUTATION);
    expect(simLeagues().length).toBeGreaterThanOrEqual(5);
    expect(gameState.fixtures[myClub().leagueId].length).toBeGreaterThanOrEqual(30);
    expect(clubPlayers(gameState.myClubId).length).toBeGreaterThanOrEqual(20);
  });

  it("lời mời chỉ đến từ CLB mạnh hơn trong tầm uy tín, nhận lời thì đổi đội khi mùa mới bắt đầu", () => {
    // chơi tới ngày tổng kết như thật; sa thải do thành tích không phải điều cần kiểm tra ở đây
    let guard = 0;
    while (gameState.day < 335 && guard++ < 2000) {
      if (gameState.matchToday) playMyMatch();
      else advance("next");
      gameState.sacked = false;
      gameState.boardConfidence = 60;
    }
    gameState.managerReputation = 75;
    const current = clubRequirement(myClub());
    jobOffersTick(1, 5);
    expect(gameState.offers!.length).toBeGreaterThan(0);
    gameState.offers!.forEach((jobOffer) => {
      expect(clubRequirement(getClub(jobOffer.clubId))).toBeGreaterThan(current);
      expect(clubRequirement(getClub(jobOffer.clubId))).toBeLessThanOrEqual(75);
    });
    const toClubId = gameState.offers![0].clubId;
    acceptOffer(toClubId);
    playSeason();
    expect(gameState.myClubId).toBe(toClubId);
    expect(gameState.job).toBeNull();
    expect(gameState.boardConfidence).toBe(60);
  });

  it("bị sa thải vẫn có đội ngỏ lời và nhận việc được ngay", () => {
    gameState.managerReputation = 30;
    sack("thử nghiệm");
    expect(gameState.sacked).toBeTruthy();
    expect(myReputation()).toBe(20);
    expect(gameState.offers!.length).toBeGreaterThan(0);
    takeNewJob(gameState.offers![0].clubId);
    expect(gameState.sacked).toBe(false);
    expect(gameState.offers).toEqual([]);
  });
});
