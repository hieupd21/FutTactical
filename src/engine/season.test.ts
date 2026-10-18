import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { myWages } from "./board";
import { playMyMatch } from "./match";
import { advance } from "./season";
import { clubPlayers, table } from "./squad";
import { me, myLg, S, simLeagues } from "./state";
import { completeBuy, enquire, submitClubOffer } from "./transfers";
import type { DataRow } from "./types";
import { newGame, newGameReal } from "./world";

const pack = (f: string): DataRow[] => JSON.parse(readFileSync(resolve(__dirname, "../../public/data", f), "utf8"));

function playSeason(): void {
  const startYear = S.year;
  let guard = 0;
  while (S.year === startYear && guard++ < 2000 && !S.sacked) {
    if (S.matchToday) playMyMatch();
    else advance("next");
  }
}

describe("engine", () => {
  it("thế giới hư cấu chạy trọn một mùa", () => {
    newGame("EN", 3);
    expect(Object.keys(S.clubs).length).toBeGreaterThan(80);
    playSeason();
    if (!S.sacked) {
      expect(S.year).toBe(2027);
      expect(S.seasonLog.length).toBe(1);
      expect(clubPlayers(S.me).length).toBeGreaterThanOrEqual(18);
    }
  });

  it("dữ liệu FC 27 khởi tạo đúng và chạy trọn một mùa", () => {
    const rows = pack("fc27.json");
    newGameReal(rows, "EN", "Arsenal", "FC 27");
    expect(S.year).toBe(2026);
    expect(me().n).toBe("Arsenal");
    simLeagues().forEach((lg) => expect(S.fx[lg.id].length).toBeGreaterThan(30));
    expect(myWages()).toBeLessThanOrEqual(S.wageCap);
    playSeason();
    if (!S.sacked) {
      expect(S.year).toBe(2027);
      const t = table(myLg());
      expect(t.every((r) => r.p === 0)).toBe(true);
      expect(S.aiDone).toBeGreaterThan(0);
    }
  });

  it("thương vụ mua qua điều khoản đàm phán hoàn tất được", () => {
    newGameReal(pack("fc27.json"), "EN", "Arsenal", "FC 27");
    me().budget = 500000;
    S.wageCap = 99999;
    const target = Object.values(S.P).find((p) => p.club && p.club !== S.me && p.ovr >= 70 && p.ovr <= 76)!;
    const r = enquire(target.id, "transfer");
    expect(r.err).toBeUndefined();
    const n = r.n!;
    for (let i = 0; i < 3 && n.stage === "enquiry"; i++) advance("day");
    if (n.stage === "club") {
      submitClubOffer(n, { fee: n.ask! * 1.1, inst: 1, timing: "now" });
      advance("day");
      expect(["contract", "failed"]).toContain(n.stage);
      if ((n.stage as string) === "contract") {
        n.cOffer = { ...n.cAsk!, rc: 0 };
        n.stage = "final";
        completeBuy(n);
        expect(target.club).toBe(S.me);
      }
    }
  });
});
