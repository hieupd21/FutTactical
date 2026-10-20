import { beforeEach, describe, expect, it } from "vitest";
import { moodTick, respondDemand, trackPromise } from "./mood";
import { clubPlayers } from "./squad";
import { S } from "./state";
import { newGame } from "./world";

beforeEach(() => newGame("EN", 3));

const pick = () => clubPlayers(S.me).find((p) => !p.loan && p.c)!;

describe("tâm lý cầu thủ", () => {
  it("ít được ra sân và tinh thần thấp thì đòi ra sân, rồi cam kết xoa dịu", () => {
    const p = pick();
    p.c!.role = "Ngôi sao";
    p.st = [0, 0, 0, 0, 0, 0];
    p.mor = 40;
    moodTick();
    expect(p.demand?.kind).toBe("start");
    respondDemand(p.id, { a: "promise", n: 3 });
    expect(p.demand).toBeNull();
    expect(p.promise?.left).toBe(3);
    expect(p.mor).toBeGreaterThan(40);
  });

  it("giữ lời thì tinh thần tăng, thất hứa thì đòi ra đi", () => {
    const p = pick();
    p.promise = { kind: "start", left: 2, missed: 0, allow: 0 };
    p.mor = 50;
    trackPromise(p, true);
    trackPromise(p, true);
    expect(p.promise).toBeNull();
    expect(p.mor).toBe(60);
    p.promise = { kind: "start", left: 3, missed: 0, allow: 0 };
    trackPromise(p, false);
    expect(p.promise).toBeNull();
    expect(p.demand?.kind).toBe("leave");
    expect(p.wantOut).toBe(true);
  });

  it("đòi ra đi: đồng ý rao bán hoặc cho mượn", () => {
    const p = pick();
    p.demand = { kind: "leave", d: S.d, cause: "playtime" };
    p.wantOut = true;
    respondDemand(p.id, { a: "sell" });
    expect(p.listed).toBe(true);
    expect(p.demand).toBeNull();
    p.demand = { kind: "leave", d: S.d, cause: "playtime" };
    respondDemand(p.id, { a: "loan" });
    expect(p.loanList).toBe(true);
    expect(p.listed).toBe(false);
  });
});
