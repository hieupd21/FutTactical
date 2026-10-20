import { sackedOffers } from "./career";
import { fmtM, fmtW } from "./format";
import { clubPlayers, clubStr, myPos } from "./squad";
import { me, myLg, news, S } from "./state";
import type { BoardObjective } from "./types";
import { clamp } from "./util";

export function setBoard(): void {
  const lc = Object.values(S.clubs)
    .filter((c) => c.lg === myLg())
    .sort((a, b) => clubStr(b.id).pow - clubStr(a.id).pow);
  const exp = lc.findIndex((c) => c.id === S.me) + 1;
  const target = clamp(exp + 2, 1, lc.length - 3);
  S.board = {
    target,
    objs: [
      { k: "pos", n: target === 1 ? "Vô địch quốc gia" : `Cán đích trong top ${target}`, imp: "Rất quan trọng" },
      { k: "wage", n: "Không để tổng lương vượt quỹ lương", imp: "Quan trọng" },
      { k: "youth", n: "Cầu thủ U21 ra sân tổng cộng 15 trận", imp: "Trung bình", target: 15 },
      { k: "sell", n: "Không lỗ quá 30% ngân sách chuyển nhượng đầu mùa", imp: "Trung bình", start: me().budget },
    ],
  };
}
export const myWages = (): number => clubPlayers(S.me).reduce((s, p) => s + (p.loan ? (p.c!.wage * p.loan.pct) / 100 : p.c!.wage), 0);
export const youthApps = (): number =>
  clubPlayers(S.me)
    .filter((p) => p.age <= 21)
    .reduce((s, p) => s + p.apps, 0);

export function objStatus(o: BoardObjective): { ok: boolean; txt: string; pending?: boolean } {
  if (o.k === "pos") {
    if (!(S.res[myLg()] || []).some(Boolean)) return { ok: true, pending: true, txt: "Mùa giải chưa bắt đầu" };
    const p = myPos();
    return { ok: p <= S.board.target, txt: `Đang xếp thứ ${p}` };
  }
  if (o.k === "wage") {
    const w = myWages();
    return { ok: w <= S.wageCap, txt: `${fmtW(w)} / ${fmtW(S.wageCap)}` };
  }
  if (o.k === "youth") {
    const a = youthApps();
    return { ok: a >= (o.target || 0), txt: `${a}/${o.target} trận` };
  }
  const ok = me().budget >= (o.start || 0) * 0.7;
  return { ok, txt: `Còn ${fmtM(me().budget)} / đầu mùa ${fmtM(o.start || 0)}` };
}
export function sack(why: string): void {
  S.sacked = why;
  news("Bạn bị sa thải. " + why, "club");
  sackedOffers();
}
