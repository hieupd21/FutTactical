// Dòng thời gian: tua ngày/giờ, phát triển hằng tháng, Deadline Day, tổng kết & sang mùa mới.
import { myWages, objStatus, sack, setBoard } from "./board";
import { DEADLINE_HOURS, MATCH0, POSN, PROFILES, REVIEW_DAY, SEASON_LEN, WIN_SUMMER, WIN_WINTER } from "./constants";
import { fmtM } from "./format";
import { makeP, moraleLbl, ovrR, valueOf, wageBase, yearsLeft } from "./players";
import { playRound } from "./match";
import { bestXI, clubPlayers, clubStr, myPos } from "./squad";
import { C, dateOf, inbox, isDeadline, LG, me, myLg, news, P, roundOn, S, simLeagues } from "./state";
import { aiBidsTick, aiTransfersTick, moveP, processNegos, scoutRange } from "./transfers";
import type { Line } from "./types";
import { clamp, pickA, r10, ri, rnd } from "./util";
import { makeFixtures } from "./world";

export function monthTick(): void {
  Object.values(S.P).forEach((p) => {
    const pr = PROFILES[p.prof],
      [a, b] = pr.peak;
    const share = Math.min(1, p.st.length ? p.st.filter(Boolean).length / p.st.length : 0.3);
    if (p.age < a && p.ovr < p.pot) p.ovr += ((pr.rate * (p.pot - p.ovr)) / 10) * (0.5 + share) * (0.8 + p.form / 250);
    else if (p.age <= b && p.ovr < p.pot) p.ovr += 0.08 * (0.5 + share);
    else if (p.age > b) p.ovr -= pr.decl * (p.age - b + 1) * 0.12;
    if (p.age <= 24 && p.form > 72) p.pot = Math.min(93, p.pot + 0.25);
    if (p.form < 28) p.pot = Math.max(p.ovr, p.pot - 0.15);
    p.ovr = clamp(p.ovr, 35, 93);
    p.pot = Math.max(p.pot, p.ovr);
    p.val = valueOf(p);
    if (p.club !== S.me) p.mor = clamp(p.mor + rnd(-4, 4), 25, 90);
  });
  // ban lãnh đạo xem xét
  if (S.d > MATCH0) {
    const pos = myPos(),
      t = S.board.target;
    S.conf += pos <= t ? 2 : -(pos - t) * 1.5;
    if (myWages() > S.wageCap) S.conf -= 4;
    S.conf = clamp(S.conf, 0, 100);
    if (S.conf < 12) sack(`Ban lãnh đạo mất kiên nhẫn sau chuỗi kết quả không như kỳ vọng (đang xếp thứ ${pos}, mục tiêu top ${t}).`);
  }
  clubPlayers(S.me).forEach((p) => {
    if (p.mor < 20 && !p.wantOut) {
      p.wantOut = true;
      inbox({
        t: `${p.n} muốn ra đi`,
        b: `${p.n} không hài lòng (${moraleLbl(p.mor)}) vì ít được ra sân so với vai trò "${p.c!.role}". Cậu ấy đề nghị được rao bán.`,
        pid: p.id,
        act: "unhappy",
      });
    }
  });
}

function hourTick(h: number): void {
  S.h += h;
  processNegos();
  aiBidsTick(h);
  aiTransfersTick(h);
}

export function dayTick(): void {
  S.d++;
  S.h = 9;
  if (S.d >= SEASON_LEN) {
    newSeason();
    return;
  }
  const dt = dateOf(S.d);
  Object.values(S.P).forEach((p) => {
    if (p.inj > 0) p.inj--;
    p.fit = clamp(p.fit + (p.inj > 0 ? 2 : 7), 0, 100);
  });
  if (S.d === WIN_WINTER[0]) {
    applyPending(true);
    inbox({
      t: "Kỳ chuyển nhượng mùa đông mở cửa",
      b: "Mở đến hết 31/1. Từ hôm nay bạn có thể ký trước với cầu thủ còn dưới 6 tháng hợp đồng.",
    });
  }
  if (S.d === WIN_SUMMER[1] || S.d === WIN_WINTER[1])
    inbox({
      t: "Deadline Day!",
      b: `Ngày chốt sổ kéo dài ${DEADLINE_HOURS} giờ. Các CLB hành động nhanh hơn, phản hồi chỉ sau 1 giờ. Bạn có thể tua 1 hoặc 2 giờ.`,
    });
  if (S.d === WIN_SUMMER[1] + 1 || S.d === WIN_WINTER[1] + 1)
    inbox({ t: "Kỳ chuyển nhượng đóng cửa", b: "Các thương vụ đã thỏa thuận cho kỳ sau sẽ hoàn tất khi kỳ tới mở." });
  processNegos();
  aiBidsTick(24);
  aiTransfersTick(24);
  // điều khoản thưởng theo số trận
  clubPlayers(S.me).forEach((p) => {
    if (p.addon && !p.addon.paid && p.tot.apps - (p.addonBase || 0) >= p.addon.apps) {
      p.addon.paid = true;
      me().budget -= p.addon.amt;
      C(p.addon.club).budget += p.addon.amt;
      inbox({
        t: "Điều khoản thưởng kích hoạt",
        b: `${p.n} đã đá đủ ${p.addon.apps} trận. Bạn trả ${C(p.addon.club).n} ${fmtM(p.addon.amt)}.`,
      });
    }
  });
  if (dt.getDate() === 1) monthTick();
  const r = roundOn(S.d, myLg());
  if (r >= 0) {
    const m = S.fx[myLg()][r].find((x) => x.includes(S.me))!;
    S.matchToday = { h: m[0], a: m[1], round: r };
    S.stopFlag = true;
  } else playRound(S.d);
  if (S.d === REVIEW_DAY) seasonReview();
  if (S.d === 150) contractWarn();
}

function contractWarn(): void {
  const ex = clubPlayers(S.me).filter((p) => yearsLeft(p) <= 1 && !p.loan);
  if (ex.length)
    inbox({
      t: "Hợp đồng sắp hết hạn",
      b: `${ex.length} cầu thủ hết hạn hợp đồng vào 30/6: ${ex.map((p) => p.n).join(", ")}. Từ 1/1, CLB khác có thể ký trước với họ.`,
    });
}

export type AdvanceMode = "next" | "day" | "h1" | "h2" | "skipDL";
/** Tua thời gian. "next" = đến sự kiện tiếp theo, "day" = 1 ngày, "h1"/"h2" = giờ trong Deadline Day */
export function advance(mode: AdvanceMode): void {
  if (S.sacked || S.matchToday) return;
  S.stopFlag = false;
  if (isDeadline() && S.h < 9 + DEADLINE_HOURS && mode !== "skipDL") {
    hourTick(mode === "h2" ? 2 : 1);
    if (S.h >= 9 + DEADLINE_HOURS) {
      inbox({ t: "Hết giờ!", b: "Kỳ chuyển nhượng đã đóng." });
      dayTick();
    }
    return;
  }
  let guard = 0;
  do {
    dayTick();
    guard++;
    if (mode === "day") break;
  } while (!S.stopFlag && !S.matchToday && !isDeadline() && guard < 60 && !S.sacked);
}

/** Hoàn tất các thương vụ đã thỏa thuận cho kỳ sau. Mùa đông: giữ lại các hợp đồng ký trước (gia nhập 1/7) */
export function applyPending(winter = false): void {
  const keep = S.pending.filter((x) => winter && x.type === "pre");
  S.pending.forEach((x) => {
    const p = P(x.pid);
    if (!p || (winter && x.type === "pre")) return;
    const from = p.club;
    p.reserved = false;
    moveP(p, S.me);
    p.c = x.c;
    p.joinedFee = x.o.fee;
    if (x.o.sellon && from != null) p.sellOn = { club: from, pct: x.o.sellon };
    if (x.o.addon && from != null) p.addon = { club: from, amt: x.o.addon, apps: 20, paid: false };
    p.addonBase = p.tot.apps;
    news(`${p.n} chính thức ra mắt ${me().n}.`, "transfer");
  });
  S.pending = keep;
}

export const leagueSize = (): number => S.fx[myLg()].length / 2 + 1;

function seasonReview(): void {
  const pos = myPos(),
    t = S.board.target;
  let dc = 0;
  const lines: string[] = [];
  const W = { pos: 18, wage: 8, youth: 6, sell: 6 };
  S.board.objs.forEach((o) => {
    const st = objStatus(o);
    const w = W[o.k];
    dc += st.ok ? w : -w * (o.k === "pos" ? Math.max(1, pos - t) : 1);
    lines.push(`${st.ok ? "✓" : "✗"} ${o.n}: ${st.txt}`);
  });
  S.conf = clamp(S.conf + dc, 0, 100);
  const nT = leagueSize();
  const prize = r10((nT + 1 - pos) * 900 + me().pres * 3000);
  S.review = { pos, dc, prize, lines };
  inbox({
    t: `Tổng kết mùa ${S.year}/${S.year + 1}`,
    b: `Xếp hạng ${pos}/${nT}. ${lines.join(" · ")}. Niềm tin ban lãnh đạo ${dc >= 0 ? "+" : ""}${Math.round(dc)} → ${Math.round(S.conf)}. Tiền thưởng xếp hạng ${fmtM(prize)} sẽ cộng vào ngân sách mùa tới.`,
  });
  if (S.conf < 15) sack(`Không đạt mục tiêu mùa giải (xếp thứ ${pos}, mục tiêu top ${t}).`);
}

export function newSeason(): void {
  const prize = S.review ? S.review.prize : 0;
  S.year++;
  S.d = 0;
  S.h = 9;
  // cho mượn trở về
  Object.values(S.P).forEach((p) => {
    if (p.loan) {
      const from = p.loan.from;
      p.loan = null;
      moveP(p, from);
    }
    if (p.homeClub) {
      const h = p.homeClub;
      p.homeClub = null;
      p.loanOut = null;
      moveP(p, h);
    }
    if (p.away) p.away = null;
  });
  // hợp đồng hết hạn
  Object.values(S.P).forEach((p) => {
    p.age++;
    p.apps = 0;
    p.goals = 0;
    if (p.club != null && p.c && p.c.exp <= S.year && !S.pending.some((x) => x.pid === p.id)) {
      if (p.club === S.me) {
        news(`${p.n} rời CLB theo dạng tự do khi hết hợp đồng.`, "club");
        moveP(p, null);
        p.c = null;
      } else if (Math.random() < 0.65) {
        p.c.exp = S.year + ri(1, 3);
        p.c.wage = Math.round(Math.max(p.c.wage, wageBase(p)));
      } else {
        moveP(p, null);
        p.c = null;
      }
    }
  });
  // giải nghệ
  Object.values(S.P).forEach((p) => {
    if (p.age >= 34 && Math.random() < (p.age - 33) * 0.3) {
      if (p.club === S.me) news(`${p.n} giải nghệ ở tuổi ${p.age}.`, "club");
      if (p.club != null) C(p.club).ids = C(p.club).ids.filter((x) => x !== p.id);
      S.free = S.free.filter((x) => x !== p.id);
      S.shortlist = S.shortlist.filter((x) => x !== p.id);
      delete S.P[p.id];
    }
  });
  // cầu thủ tự do: tối đa 120, gán hợp đồng ảo để thương lượng
  S.free = S.free.filter((id) => S.P[id]);
  S.free.forEach((id) => {
    const p = P(id);
    if (!p.c) p.c = { wage: wageBase(p), exp: S.year, rc: 0, role: "Xoay tua" };
  });
  if (S.free.length > 120) {
    S.free.sort((a, b) => P(b).ovr - P(a).ovr);
    S.free.slice(120).forEach((id) => delete S.P[id]);
    S.free = S.free.slice(0, 120);
  }
  // CLB AI: bổ sung cầu thủ trẻ, ngân sách mới, cập nhật sức mạnh
  Object.values(S.clubs).forEach((c) => {
    if (c.id !== S.me) {
      while (c.ids.length < 23) {
        const p = makeP(LG(c.lg).nat, pickA<Line>(["GK", "DF", "DF", "MF", "MF", "FW"]), Math.round(c.str - ri(8, 14)), ri(17, 19), c.id);
        p.c!.role = "Triển vọng";
        c.ids.push(p.id);
      }
      c.budget = r10(c.budget * 0.5 + 4000 * Math.pow(c.pres, 2.2) * rnd(0.8, 1.2));
    }
    c.str = Math.round(clamp(clubStr(c.id).pow, 45, 85));
  });
  // học viện: 2 cầu thủ trẻ mỗi mùa (thêm nếu đội quá mỏng)
  const need = Math.max(2, 20 - clubPlayers(S.me).length);
  for (let i = 0; i < need; i++) {
    const p = makeP(LG(myLg()).nat, pickA<Line>(["DF", "MF", "FW"]), Math.round(me().str - ri(12, 18)), 17, S.me);
    p.c!.role = "Triển vọng";
    p.c!.wage = 3;
    me().ids.push(p.id);
    inbox({
      t: "Học viện đôn lên cầu thủ trẻ",
      b: `${p.n} (${POSN[p.pos]}, ${ovrR(p)}, tiềm năng ước tính ${scoutRange(p).join("–")}) ký hợp đồng chuyên nghiệp đầu tiên.`,
      pid: p.id,
    });
  }
  applyPending();
  // ngân sách
  const due = S.liab.filter((l) => l.y === S.year).reduce((s, l) => s + l.amt, 0);
  S.liab = S.liab.filter((l) => l.y > S.year);
  const alloc = r10(4000 * Math.pow(me().pres, 2) * (S.conf / 60));
  me().budget = r10(me().budget + alloc + prize - due);
  S.wageCap = Math.round(Math.max(S.wageCap, myWages() * 1.05));
  S.seasonLog.unshift({ y: S.year - 1, pos: S.review ? S.review.pos : null });
  if (S.review) {
    const nT = leagueSize();
    if (S.review.pos <= 2) me().pres = Math.min(5, me().pres + 1);
    if (S.review.pos >= nT - 3) me().pres = Math.max(1, me().pres - 1);
  }
  Object.values(S.P).forEach((p) => (p.val = valueOf(p)));
  simLeagues().forEach((lg) => {
    S.fx[lg.id] = makeFixtures(
      Object.values(S.clubs)
        .filter((c) => c.lg === lg.id)
        .map((c) => c.id),
    );
    S.res[lg.id] = [];
  });
  S.review = null;
  S.xi = bestXI(S.me, S.form);
  setBoard();
  inbox({
    t: `Mùa giải ${S.year}/${S.year + 1} bắt đầu`,
    b: `Ngân sách chuyển nhượng ${fmtM(me().budget)} (gồm phân bổ ${fmtM(alloc)}, thưởng ${fmtM(prize)}${due ? `, trừ trả góp ${fmtM(due)}` : ""}). Kỳ chuyển nhượng hè mở đến 31/8.`,
  });
}
