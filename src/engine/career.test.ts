import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { sack } from "./board";
import { takeNewJob } from "./actions";
import { acceptOffer, clubReq, jobOffersTick, myRep, REP_NEWBIE } from "./career";
import { playMyMatch } from "./match";
import { advance } from "./season";
import { clubPlayers } from "./squad";
import { C, me, S, simLeagues } from "./state";
import type { DataRow, LowerLeagueData } from "./types";
import { newGameReal } from "./world";

const data = <T>(f: string): T => JSON.parse(readFileSync(resolve(__dirname, "../../public/data", f), "utf8")) as T;
const lower = data<LowerLeagueData[]>("lower_leagues.json");

function playSeason(): void {
  const y = S.year;
  let guard = 0;
  while (S.year === y && guard++ < 2000 && !S.sacked) {
    if (S.matchToday) playMyMatch();
    else advance("next");
  }
}

describe("sự nghiệp HLV từ hạng dưới", () => {
  beforeEach(() => {
    newGameReal(data<DataRow[]>("fc27.json"), "EN4", "Tilbury City", "FC 27", { lower, rookie: true });
  });

  it("HLV mới dẫn một đội hạng Tư có đủ cầu thủ và lịch 38 vòng", () => {
    expect(me().lg).toBe("EN4");
    expect(myRep()).toBe(REP_NEWBIE);
    expect(simLeagues().map((l) => l.id)).toEqual(expect.arrayContaining(["EN3", "EN4", "EN"]));
    expect(S.fx.EN4.length).toBe(38);
    expect(clubPlayers(S.me).length).toBeGreaterThanOrEqual(20);
    expect(clubReq(me())).toBeLessThanOrEqual(REP_NEWBIE);
  });

  it("lời mời chỉ đến từ CLB mạnh hơn trong tầm uy tín, nhận lời thì đổi đội khi mùa mới bắt đầu", () => {
    // chơi tới ngày tổng kết như thật; sa thải do thành tích không phải điều cần kiểm tra ở đây
    let guard = 0;
    while (S.d < 335 && guard++ < 2000) {
      if (S.matchToday) playMyMatch();
      else advance("next");
      S.sacked = false;
      S.conf = 60;
    }
    S.rep = 40;
    const cur = clubReq(me());
    jobOffersTick(1, 5);
    expect(S.offers!.length).toBeGreaterThan(0);
    S.offers!.forEach((o) => {
      expect(clubReq(C(o.cid))).toBeGreaterThan(cur);
      expect(clubReq(C(o.cid))).toBeLessThanOrEqual(40);
    });
    const to = S.offers![0].cid;
    acceptOffer(to);
    playSeason();
    expect(S.me).toBe(to);
    expect(S.job).toBeNull();
    expect(S.conf).toBe(60);
  });

  it("bị sa thải vẫn có đội ngỏ lời và nhận việc được ngay", () => {
    S.rep = 30;
    sack("thử nghiệm");
    expect(S.sacked).toBeTruthy();
    expect(myRep()).toBe(20);
    expect(S.offers!.length).toBeGreaterThan(0);
    takeNewJob(S.offers![0].cid);
    expect(S.sacked).toBe(false);
    expect(S.offers).toEqual([]);
  });
});
