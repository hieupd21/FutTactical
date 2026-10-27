import { describe, expect, it } from "vitest";
import {
  canSwapInto,
  mySlotPositions,
  OFF_POSITION_PENALTY,
  playablePositions,
  positionPenalty,
  ratingAtSlot,
} from "./squad";
import { fifacmPositionLine } from "./fifacm";
import { dynamicRating } from "./players";
import { clubPlayers } from "./squad";
import { gameState } from "./state";
import { startTestGame } from "@/test/helpers";

describe("phạt trái vị trí", () => {
  it("đứng đúng vị trí chơi được thì không bị trừ, vị trí chi tiết khác trong cùng tuyến bị trừ ít, trái tuyến bị trừ nhiều hơn", () => {
    startTestGame();
    const defender = clubPlayers(gameState.myClubId).find(
      (player) => fifacmPositionLine(playablePositions(player)[0] ?? "") === "DF",
    )!;
    expect(defender).toBeDefined();
    const bestPosition = playablePositions(defender)[0];
    expect(positionPenalty(defender, bestPosition)).toBe(0);
    expect(ratingAtSlot(defender, bestPosition)).toBe(dynamicRating(defender));
    const unlistedSameLine = ["LB", "RB", "CB"].find(
      (position) => !playablePositions(defender).includes(position),
    )!;
    expect(positionPenalty(defender, unlistedSameLine)).toBe(OFF_POSITION_PENALTY);
    expect(ratingAtSlot(defender, "ST")).toBeLessThan(ratingAtSlot(defender, unlistedSameLine));
  });

  it("ô L*/R* tính như vị trí gốc: CB đứng LCB/RCB, CM đứng LCM/RCM, ST đứng LS/RS không bị trừ", () => {
    startTestGame();
    const players = Object.values(gameState.players);
    const withPosition = (position: string) =>
      players.find((player) => playablePositions(player).includes(position))!;
    const cases: [string, string[]][] = [
      ["CB", ["LCB", "RCB"]],
      ["CM", ["LCM", "RCM"]],
      ["CDM", ["LDM", "RDM"]],
      ["CAM", ["LAM", "RAM"]],
      ["ST", ["LS", "RS", "CF"]],
      ["LB", ["LWB"]],
      ["RB", ["RWB"]],
    ];
    cases.forEach(([position, slotNames]) => {
      const player = withPosition(position);
      slotNames.forEach((slotName) => expect(positionPenalty(player, slotName), slotName).toBe(0));
    });
  });

  it("thủ môn không vào được ô khác và cầu thủ khác không vào được ô GK", () => {
    startTestGame();
    const slotNames = mySlotPositions();
    const goalkeeperSlot = slotNames.indexOf("GK");
    const outfieldSlot = slotNames.findIndex((name) => name !== "GK");
    const lineupIds = gameState.lineup.filter((id): id is string => !!id);
    const goalkeeperId = lineupIds.find((id) => gameState.players[id].pos === "GK")!;
    const outfielderId = lineupIds.find((id) => gameState.players[id].pos !== "GK")!;
    expect(canSwapInto(goalkeeperId, outfieldSlot)).toBe(false);
    expect(canSwapInto(outfielderId, goalkeeperSlot)).toBe(false);
    expect(canSwapInto(goalkeeperId, goalkeeperSlot)).toBe(true);
  });
});
