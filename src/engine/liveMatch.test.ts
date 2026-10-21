import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  autoRest,
  buildSim,
  effectiveRating,
  MAX_SUBS,
  newLive,
  nextPause,
  setTactic,
  stepLive,
  substitute,
} from "./liveMatch";
import { simMatch } from "./match";
import { gameState } from "./state";
import type { Tactic } from "./types";
import { startTestGame } from "@/test/helpers";

const SIMULATION_RUNS = 500;
const heal = (): void =>
  Object.values(gameState.players).forEach((player) => (player.injuryDays = 0));
function pair(): [string, string] {
  const clubs = Object.values(gameState.clubs).filter(
    (club) => club.leagueId === gameState.clubs[gameState.myClubId].leagueId,
  );
  return [clubs[1].id, clubs[2].id];
}
function liveAvg(homeId: string, awayId: string, tactic?: Tactic, awayTactic?: Tactic) {
  let goals = 0,
    homeExpectedGoals = 0,
    reds = 0;
  for (let i = 0; i < SIMULATION_RUNS; i++) {
    const liveSim = newLive(homeId, awayId, true);
    if (tactic) liveSim.sides[0].tactic = tactic;
    if (awayTactic) liveSim.sides[1].tactic = awayTactic;
    stepLive(liveSim, liveSim.ticks.length);
    goals += liveSim.homeGoals + liveSim.awayGoals;
    homeExpectedGoals += liveSim.expectedGoals[0];
    reds += liveSim.events.filter((event) => event.isRedCard).length;
  }
  return {
    goals: goals / SIMULATION_RUNS,
    homeExpectedGoals: homeExpectedGoals / SIMULATION_RUNS,
    reds: reds / SIMULATION_RUNS,
  };
}

describe("trận trực tiếp", () => {
  beforeAll(() => {
    startTestGame();
  });
  beforeEach(heal);

  it("số bàn trung bình khớp đường mô phỏng nhanh", () => {
    const [homeId, awayId] = pair();
    let fast = 0;
    for (let i = 0; i < SIMULATION_RUNS; i++) {
      const matchSim = simMatch(homeId, awayId);
      fast += matchSim.homeGoals + matchSim.awayGoals;
      heal();
    }
    const live = liveAvg(homeId, awayId).goals;
    expect(Math.abs(live - fast / SIMULATION_RUNS)).toBeLessThan(0.45);
  });

  it("chiến thuật tấn công tạo nhiều cơ hội hơn", () => {
    const [homeId, awayId] = pair();
    const att = liveAvg(
      homeId,
      awayId,
      { ment: "att", press: "mid" },
      { ment: "bal", press: "mid" },
    ).homeExpectedGoals;
    const def = liveAvg(
      homeId,
      awayId,
      { ment: "def", press: "mid" },
      { ment: "bal", press: "mid" },
    ).homeExpectedGoals;
    expect(att).toBeGreaterThan(def * 1.1);
  });

  it("thẻ đỏ hiếm, trận kết thúc với phút bù giờ", () => {
    const [homeId, awayId] = pair();
    const averages = liveAvg(homeId, awayId);
    expect(averages.reds).toBeLessThan(0.4);
    const liveSim = newLive(homeId, awayId, true);
    expect(liveSim.ticks.length).toBeGreaterThanOrEqual(93);
  });

  it("điểm dừng, thể lực và thay người", () => {
    const [homeId, awayId] = pair();
    const liveSim = newLive(homeId, awayId, false);
    liveSim.sides[0].isAuto = false; // giả lập bạn là chủ nhà
    liveSim.mySide = 0;
    expect(nextPause(liveSim)).toBe(liveSim.pauses[0]);
    stepLive(liveSim, nextPause(liveSim));
    const side = liveSim.sides[0];
    const start = side.lineup.find((id, i) => id && i > 0 && !side.removed.includes(id))!;
    expect(side.fatigue[start]).toBeGreaterThan(0);
    const incoming = side.bench[side.bench.length - 1];
    const before = side.subsLeft;
    if (!side.removed.includes(start)) expect(substitute(liveSim, 0, start, incoming)).toBeNull();
    expect(side.subsLeft).toBe(before - 1);
    expect(side.lineup).toContain(incoming);
    expect(substitute(liveSim, 0, start, incoming)).not.toBeNull(); // đã rời sân / không còn trong dự bị
    expect(effectiveRating(side, incoming, "MF")).toBeGreaterThan(0);
    setTactic(liveSim, 0, { ment: "att", press: "high" });
    expect(liveSim.events.some((event) => event.tacticChange)).toBe(true);
  });

  it("không quá 5 lượt thay người và buildSim đủ số liệu", () => {
    const [homeId, awayId] = pair();
    const liveSim = newLive(homeId, awayId, true);
    stepLive(liveSim, liveSim.ticks.length);
    expect(liveSim.sides[0].subsLeft).toBeGreaterThanOrEqual(0);
    expect(MAX_SUBS - liveSim.sides[0].subsLeft).toBeLessThanOrEqual(MAX_SUBS);
    const matchSim = buildSim(liveSim);
    expect(matchSim.homeGoals + matchSim.awayGoals).toBe(
      liveSim.events.filter((event) => event.goal).length,
    );
    expect(matchSim.possession).toBeGreaterThan(20);
    expect(matchSim.manOfTheMatch).toBeTruthy();
    expect(Object.values(matchSim.minutes!).every((minutes) => minutes >= 1 && minutes <= 90)).toBe(
      true,
    );
    autoRest(liveSim);
  });
});
