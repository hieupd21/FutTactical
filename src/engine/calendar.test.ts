import { describe, expect, it } from "vitest";
import { MATCH0, REVIEW_DAY } from "./constants";
import { makeP } from "./players";
import { freeTier, trimFree } from "./season";
import { roundDay, roundOn, S } from "./state";
import { makeFixtures, newGame } from "./world";

describe("lịch vòng đấu theo số CLB", () => {
  it.each([34, 38, 42, 46])("giải %i vòng: ngày tăng dần, xong trước tổng kết, roundOn đảo ngược đúng", (total) => {
    newGame("EN", 0);
    const ids = Array.from({ length: total / 2 + 1 }, (_, i) => "x" + i);
    S.fx.T = makeFixtures(ids);
    expect(S.fx.T.length).toBe(total);
    let prev = MATCH0 - 1;
    for (let r = 0; r < total; r++) {
      const d = roundDay(r, total);
      expect(d).toBeGreaterThan(prev);
      expect(roundOn(d, "T")).toBe(r);
      prev = d;
    }
    expect(prev).toBeLessThan(REVIEW_DAY);
    for (let d = 0; d < 365; d++) if (roundOn(d, "T") >= 0) expect(roundDay(roundOn(d, "T"), total)).toBe(d);
  });
});

describe("giới hạn cầu thủ tự do theo tầng", () => {
  it("cắt từng tầng riêng, người hạng thấp không bị đẩy ra bởi người cao cấp", () => {
    newGame("EN", 0);
    const mk = (ovr: number): void => {
      const p = makeP("EN", "MF", ovr, 25, null);
      p.c = null;
      S.free.push(p.id);
    };
    S.free.forEach((id) => delete S.P[id]);
    S.free = [];
    for (let i = 0; i < 150; i++) mk(75);
    for (let i = 0; i < 30; i++) mk(52);
    trimFree();
    const count = (t: number): number => S.free.filter((id) => freeTier(S.P[id].ovr) === t).length;
    expect(count(2)).toBe(120);
    expect(count(0)).toBe(30);
    expect(S.free.every((id) => S.P[id])).toBe(true);
  });
});
