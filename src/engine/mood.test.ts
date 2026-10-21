import { beforeEach, describe, expect, it } from "vitest";
import { moodTick, respondDemand, trackPromise } from "./mood";
import { clubPlayers } from "./squad";
import { gameState } from "./state";
import { startTestGame } from "@/test/helpers";

beforeEach(() => startTestGame());

const pick = () =>
  clubPlayers(gameState.myClubId).find((player) => !player.loan && player.contract)!;

describe("tâm lý cầu thủ", () => {
  it("ít được ra sân và tinh thần thấp thì đòi ra sân, rồi cam kết xoa dịu", () => {
    const player = pick();
    player.contract!.role = "Ngôi sao";
    player.recentStarts = [0, 0, 0, 0, 0, 0];
    player.morale = 40;
    moodTick();
    expect(player.demand?.kind).toBe("start");
    respondDemand(player.id, { action: "promise", starts: 3 });
    expect(player.demand).toBeNull();
    expect(player.promise?.left).toBe(3);
    expect(player.morale).toBeGreaterThan(40);
  });

  it("giữ lời thì tinh thần tăng, thất hứa thì đòi ra đi", () => {
    const player = pick();
    player.promise = { kind: "start", left: 2, missed: 0, allowedMisses: 0 };
    player.morale = 50;
    trackPromise(player, true);
    trackPromise(player, true);
    expect(player.promise).toBeNull();
    expect(player.morale).toBe(60);
    player.promise = { kind: "start", left: 3, missed: 0, allowedMisses: 0 };
    trackPromise(player, false);
    expect(player.promise).toBeNull();
    expect(player.demand?.kind).toBe("leave");
    expect(player.wantOut).toBe(true);
  });

  it("đòi ra đi: đồng ý rao bán hoặc cho mượn", () => {
    const player = pick();
    player.demand = { kind: "leave", day: gameState.day, cause: "playtime" };
    player.wantOut = true;
    respondDemand(player.id, { action: "sell" });
    expect(player.listed).toBe(true);
    expect(player.demand).toBeNull();
    player.demand = { kind: "leave", day: gameState.day, cause: "playtime" };
    respondDemand(player.id, { action: "loan" });
    expect(player.loanList).toBe(true);
    expect(player.listed).toBe(false);
  });
});
