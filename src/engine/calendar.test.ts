import { describe, expect, it } from "vitest";
import { FIRST_MATCH_DAY, REVIEW_DAY } from "./constants";
import { makePlayer } from "./players";
import { freeTier, trimFree } from "./season";
import { roundDay, roundOn, gameState } from "./state";
import { makeFixtures } from "./world";
import { startTestGame } from "@/test/helpers";

describe("lịch vòng đấu theo số CLB", () => {
  it.each([34, 38, 42, 46])(
    "giải %i vòng: ngày tăng dần, xong trước tổng kết, roundOn đảo ngược đúng",
    (total) => {
      startTestGame();
      const clubIds = Array.from({ length: total / 2 + 1 }, (_, i) => "x" + i);
      gameState.fixtures.T = makeFixtures(clubIds);
      expect(gameState.fixtures.T.length).toBe(total);
      let prev = FIRST_MATCH_DAY - 1;
      for (let round = 0; round < total; round++) {
        const day = roundDay(round, total);
        expect(day).toBeGreaterThan(prev);
        expect(roundOn(day, "T")).toBe(round);
        prev = day;
      }
      expect(prev).toBeLessThan(REVIEW_DAY);
      for (let day = 0; day < 365; day++)
        if (roundOn(day, "T") >= 0) expect(roundDay(roundOn(day, "T"), total)).toBe(day);
    },
  );
});

describe("giới hạn cầu thủ tự do theo tầng", () => {
  it("cắt từng tầng riêng, người hạng thấp không bị đẩy ra bởi người cao cấp", () => {
    startTestGame();
    const addFreeAgent = (ovr: number): void => {
      const player = makePlayer("EN", "MF", ovr, 25, null);
      player.contract = null;
      gameState.free.push(player.id);
    };
    gameState.free.forEach((id) => delete gameState.players[id]);
    gameState.free = [];
    for (let i = 0; i < 150; i++) addFreeAgent(75);
    for (let i = 0; i < 30; i++) addFreeAgent(52);
    trimFree();
    const count = (tier: number): number =>
      gameState.free.filter((id) => freeTier(gameState.players[id].ovr) === tier).length;
    expect(count(2)).toBe(120);
    expect(count(0)).toBe(30);
    expect(gameState.free.every((id) => gameState.players[id])).toBe(true);
  });
});
