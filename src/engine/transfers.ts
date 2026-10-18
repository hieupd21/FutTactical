// Toàn bộ logic chuyển nhượng: mua, mượn, tự do, ký trước, gia hạn, bán, Giám đốc thể thao, AI ↔ AI.
import { WIN_WINTER } from "./constants";
import { myWages } from "./board";
import { fmtM, fmtW } from "./format";
import { valueOf, wageBase, yearsLeft } from "./players";
import { clubPlayers, myXI, squadRank } from "./squad";
import { C, inbox, isDeadline, LG, me, myLg, news, P, S, tick, windowNow } from "./state";
import type { Club, ClubOffer, ContractOffer, Line, NegoType, Negotiation, Player, Role } from "./types";
import { clamp, pickA, r10, ri, rnd } from "./util";

export type Res = { err?: string; n?: Negotiation };

const leagueLvl = (cid: string | null): number => (cid == null ? 1.5 : LG(C(cid).lg).lvl);
const presOf = (cid: string | null): number => (cid == null ? 1 : C(cid).pres);
const absDay = (): number => S.year * 400 + S.d;

/** Mức sẵn lòng gia nhập CLB của bạn (0–100) */
export function willingness(p: Player): number {
  let w = 55 + (me().pres - presOf(p.club)) * 14 + (leagueLvl(S.me) - leagueLvl(p.club)) * 12;
  if (p.club == null) w += 25;
  if (p.mor < 40) w += 18;
  if (yearsLeft(p) <= 1) w += 10;
  if (p.nat === LG(myLg()).nat && p.club != null && C(p.club).lg !== myLg()) w += 10;
  if (p.club != null && C(p.club).rival === S.me) w -= 25;
  return clamp(Math.round(w), 0, 100);
}
export const willLbl = (w: number): string => (w >= 75 ? "Rất muốn đến" : w >= 55 ? "Sẵn sàng nghe" : w >= 35 ? "Do dự" : "Không muốn đến");

export function askFactor(p: Player): number {
  const cid = p.club;
  if (cid == null) return 0;
  const c = C(cid),
    sr = squadRank(p, cid);
  let f = sr.role === "Ngôi sao" ? 1.7 : sr.role === "Đá chính" ? 1.35 : 1.08;
  const y = yearsLeft(p);
  f *= y <= 1 ? 0.72 : y === 2 ? 0.9 : 1;
  if (c.phil === "bargain") f *= 0.95;
  if (c.phil === "young" && p.age <= 23) f *= 1.25;
  if (c.phil === "win" && sr.role !== "Dự bị") f *= 1.12;
  if (c.lg === me().lg) f *= 1.08;
  if (c.rival === S.me) f *= 1.35;
  return f;
}
/** Ước lượng tiềm năng của tuyển trạch viên (sai số giảm theo cấp tuyển trạch) */
export function scoutRange(p: Player): [number, number] {
  const err = 6 - S.scout;
  const c = p.pot + p.pbias * err * 1.6;
  return [Math.round(c - err * 1.5), Math.round(c + err * 1.5)];
}
export function feeEstimate(p: Player): [number, number] {
  const a = p.val * askFactor(p),
    e = (6 - S.scout) * 0.06;
  return [r10(a * (1 - e)), r10(a * (1 + e))];
}
export const expectedRoleAtMe = (p: Player): Role => squadRank(p, S.me).role;
const roleIdx = (r: Role): number => ["Ngôi sao", "Đá chính", "Xoay tua", "Triển vọng", "Dự bị"].indexOf(r);

export function contractAsk(p: Player, type: NegoType): ContractOffer {
  const base = wageBase(p);
  let f = 1;
  if (type !== "renew") {
    const gap = presOf(p.club) - me().pres;
    f += Math.max(0, gap) * 0.15 - Math.max(0, -gap) * 0.04 + (leagueLvl(p.club) - leagueLvl(S.me)) * 0.08;
    if (type === "free") f += 0.15;
  } else f = 1.05 + (p.mor < 40 ? 0.25 : 0) + (p.ovr - (p.ovrAtSign || p.ovr)) * 0.03;
  const exp = expectedRoleAtMe(p);
  f *= exp === "Ngôi sao" ? 1.3 : exp === "Đá chính" ? 1.1 : exp === "Dự bị" ? 0.9 : 1;
  const wage = Math.max(base, Math.round(base * f * rnd(0.95, 1.08)));
  return { wage, years: p.age < 24 ? 5 : p.age < 29 ? 4 : p.age < 32 ? 3 : 2, signon: r10(p.val * 0.04 + wage * 4), role: exp, rc: 0 };
}

function newNego(o: Partial<Negotiation> & Pick<Negotiation, "pid" | "type" | "stage" | "msg">): Negotiation {
  const n: Negotiation = { id: "n" + S.nnid++, tension: 0, round: 0, log: [], created: tick(), ...o };
  S.negos.unshift(n);
  return n;
}
const nlog = (n: Negotiation, who: "me" | "them", t: string): void => {
  n.log.push({ who, t, at: tick() });
};
const respWait = (): number => (isDeadline() ? 1 : 24);
export const activeNegoFor = (pid: string): Negotiation | undefined =>
  S.negos.find((n) => n.pid === pid && n.stage !== "done" && n.stage !== "failed");

export function failN(n: Negotiation, why: string, coolDays = 15): void {
  n.stage = "failed";
  n.msg = why;
  nlog(n, "them", why);
  const p = P(n.pid);
  if (p) p.cool = tick() + coolDays * 24;
  if (n.buy || n.sell) inbox({ t: "Thương vụ đổ vỡ", b: why, nid: n.id, pid: n.pid });
}

// ---------- mua: thăm dò ----------
export function enquire(pid: string, type: NegoType = "transfer"): Res {
  const p = P(pid);
  if (activeNegoFor(pid)) return { err: "Đã có một thương vụ đang diễn ra với cầu thủ này." };
  if (p.club === S.me) return { err: "Cầu thủ đã thuộc CLB của bạn." };
  if (p.cool && p.cool > tick()) return { err: "CLB này tạm thời không muốn nói chuyện lại. Hãy thử sau." };
  if (p.club == null)
    return {
      n: newNego({
        pid,
        type: "free",
        buy: true,
        stage: "contract",
        ask: null,
        cAsk: contractAsk(p, "free"),
        msg: "Cầu thủ tự do, bạn có thể đàm phán hợp đồng ngay.",
      }),
    };
  if (type === "pre") {
    if (yearsLeft(p) > 1 || S.d < WIN_WINTER[0]) return { err: "Chỉ được đàm phán trước với cầu thủ còn dưới 6 tháng hợp đồng (từ 1/1)." };
    return {
      n: newNego({
        pid,
        type: "pre",
        buy: true,
        stage: "contract",
        cAsk: contractAsk(p, "free"),
        msg: "Hợp đồng sắp hết hạn: bạn có thể ký trước, cầu thủ gia nhập miễn phí từ 1/7.",
      }),
    };
  }
  const n = newNego({
    pid,
    type,
    buy: true,
    stage: "enquiry",
    seller: p.club,
    readyAt: tick() + respWait(),
    msg: "Đã gửi thư thăm dò. Chờ phản hồi.",
  });
  nlog(n, "me", type === "loan" ? "Hỏi mượn cầu thủ" : "Gửi thư thăm dò");
  return { n };
}
function processEnquiry(n: Negotiation): void {
  const p = P(n.pid);
  if (!p || p.club !== n.seller || p.club == null) {
    failN(n, "Cầu thủ không còn thuộc CLB này.");
    return;
  }
  const sr = squadRank(p, p.club),
    c = C(p.club);
  if (n.type === "loan") {
    if (sr.role === "Ngôi sao" || (sr.role === "Đá chính" && Math.random() < 0.75)) {
      failN(n, `${c.n}: "Cậu ấy nằm trong kế hoạch đội một, chúng tôi không cho mượn."`);
      return;
    }
    n.minPct = clamp(40 + (sr.role === "Đá chính" ? 30 : 0) + ri(0, 25), 30, 100);
    n.stage = "club";
    n.msg = `${c.n} đồng ý cho mượn đến hết mùa. Họ muốn bạn trả một phần lương cầu thủ.`;
    nlog(n, "them", n.msg);
    return;
  }
  if (absDay() - (p.joinedAbs || -9999) < 120) {
    failN(n, `${c.n}: "Cậu ấy vừa mới gia nhập, chúng tôi không bán."`);
    return;
  }
  if (c.rival === S.me && Math.random() < 0.5) {
    failN(n, `${c.n} từ chối thẳng: họ không làm ăn với kình địch.`, 30);
    return;
  }
  if (sr.role === "Ngôi sao" && c.pres >= me().pres && Math.random() < 0.55 && !p.c!.rc) {
    failN(n, `${c.n}: "${p.n} là trụ cột, không phải để bán."`, 20);
    return;
  }
  n.ask = r10(p.val * askFactor(p) * rnd(0.95, 1.08));
  n.stage = "club";
  const hint = feeEstimate(p);
  n.msg =
    `${c.n} sẵn sàng lắng nghe. Theo tuyển trạch viên, họ định giá khoảng ${fmtM(hint[0])}–${fmtM(hint[1])}.` +
    (p.c!.rc ? ` Cầu thủ có điều khoản giải phóng ${fmtM(p.c!.rc)}.` : "");
  nlog(n, "them", n.msg);
}

// ---------- đề nghị với CLB bán ----------
export function offerValue(n: Negotiation, o: ClubOffer): number {
  const p = P(n.pid);
  let v = o.fee;
  if (o.inst === 2) v *= 0.96;
  if (o.inst === 3) v *= 0.92;
  v += (o.addon || 0) * 0.45;
  v += ((o.sellon || 0) / 100) * p.val * 0.6;
  if (o.swap && P(o.swap)) v += P(o.swap).val * 0.8;
  if (o.loanback) v += (n.ask || 0) * 0.06;
  if (o.timing === "next") v *= 0.98;
  return v;
}
export const canAffordNow = (o: ClubOffer): boolean => (o.inst > 1 ? o.fee / o.inst : o.fee) <= me().budget;

export function submitClubOffer(n: Negotiation, o: ClubOffer): Res {
  if (n.type === "loan") {
    n.offer = o;
    n.waiting = true;
    n.readyAt = tick() + respWait();
    nlog(n, "me", `Đề nghị trả ${o.pct}% lương`);
    return {};
  }
  if (!canAffordNow(o)) return { err: "Vượt ngân sách chuyển nhượng hiện có." };
  n.offer = o;
  n.waiting = true;
  n.readyAt = tick() + respWait();
  n.round++;
  nlog(
    n,
    "me",
    `Đề nghị ${fmtM(o.fee)}${o.inst > 1 ? ` (trả góp ${o.inst} mùa)` : ""}${o.addon ? `, thưởng ${fmtM(o.addon)}` : ""}${o.sellon ? `, ${o.sellon}% bán lại` : ""}${o.swap ? `, + ${P(o.swap).n}` : ""}${o.loanback ? ", cho mượn lại" : ""}${o.timing === "next" ? ", chuyển vào kỳ sau" : ""}`,
  );
  return {};
}
export function triggerRC(n: Negotiation): Res {
  const p = P(n.pid);
  if (!p.c?.rc) return { err: "Không có điều khoản giải phóng." };
  if (p.c.rc > me().budget) return { err: "Không đủ ngân sách để kích hoạt điều khoản." };
  n.offer = { fee: p.c.rc, inst: 1, timing: "now" };
  n.rcUsed = true;
  n.stage = "contract";
  n.cAsk = contractAsk(p, "transfer");
  n.msg = `Bạn kích hoạt điều khoản giải phóng ${fmtM(p.c.rc)}. ${C(p.club!).n} buộc phải chấp nhận.`;
  nlog(n, "me", n.msg);
  return {};
}
function processClubOffer(n: Negotiation): void {
  n.waiting = false;
  const p = P(n.pid),
    c = C(n.seller!),
    o = n.offer!;
  if (n.type === "loan") {
    if ((o.pct || 0) >= (n.minPct || 0)) {
      n.stage = "final";
      n.msg = `${c.n} đồng ý. ${p.n} sẵn sàng sang đá cho mượn.`;
    } else {
      n.tension += 25 + ((n.minPct || 0) - (o.pct || 0));
      n.msg = `${c.n}: "Chúng tôi cần ít nhất ${n.minPct}% lương được chi trả."`;
      if (n.tension >= 100) return failN(n, `${c.n} hết kiên nhẫn và rút lui.`);
    }
    nlog(n, "them", n.msg);
    return;
  }
  const ask = n.ask || 1;
  const v = offerValue(n, o),
    r = v / ask;
  if (r >= 1) {
    n.stage = "contract";
    n.cAsk = contractAsk(p, "transfer");
    n.msg = `${c.n} chấp nhận đề nghị! Giờ là đàm phán hợp đồng cá nhân với ${p.n}.`;
    n.tension = Math.max(0, n.tension - 20);
  } else if (r >= 0.85) {
    n.tension += 12 + (1 - r) * 80;
    n.ask = Math.max(r10(ask - (ask - v) * 0.35), r10(v * 1.02));
    n.counter = n.ask;
    n.msg = `${c.n} đưa ra đề nghị ngược: ${fmtM(n.ask)} (quy đổi theo cách họ tính).`;
  } else {
    n.tension += 22 + (1 - r) * 90;
    n.counter = ask;
    n.msg = `${c.n}: "Đề nghị này còn cách quá xa." Họ vẫn đòi khoảng ${fmtM(ask)}.`;
  }
  if (n.round >= 5 && n.stage === "club") n.tension += 15;
  n.tension = Math.round(Math.min(100, n.tension));
  if (n.tension >= 100) return failN(n, `${c.n} cắt đứt đàm phán. Thanh căng thẳng đã chạm đỉnh.`);
  nlog(n, "them", n.msg);
}

// ---------- hợp đồng cá nhân ----------
export function submitContract(n: Negotiation, o: ContractOffer): Res {
  const p = P(n.pid);
  const swapP = n.offer?.swap ? P(n.offer.swap) : null;
  const extraW = o.wage - (n.type === "renew" ? p.c!.wage : 0) - (swapP ? swapP.c!.wage : 0);
  if (myWages() + extraW > S.wageCap)
    return { err: `Vượt quỹ lương (${fmtW(myWages() + extraW)} / ${fmtW(S.wageCap)}). Hãy điều chỉnh ngân sách ở tab CLB.` };
  const feeNow = n.offer && n.type !== "loan" ? (n.offer.inst > 1 ? n.offer.fee / n.offer.inst : n.offer.fee) : 0;
  if (o.signon * (n.type === "renew" ? 1 : 1.5) + feeNow > me().budget)
    return { err: "Không đủ ngân sách cho phí chuyển nhượng, lót tay và phí người đại diện." };
  n.cOffer = o;
  n.waiting = true;
  n.readyAt = tick() + respWait();
  n.round++;
  nlog(
    n,
    "me",
    `Đề nghị lương ${fmtW(o.wage)}, ${o.years} năm, lót tay ${fmtM(o.signon)}, vai trò ${o.role}${o.rc ? `, điều khoản giải phóng ${fmtM(o.rc)}` : ""}`,
  );
  return {};
}
function processContract(n: Negotiation): void {
  n.waiting = false;
  const p = P(n.pid),
    a = n.cAsk!,
    o = n.cOffer!;
  if (n.type !== "renew" && !n.willChecked) {
    n.willChecked = true;
    const w = willingness(p);
    if (w < 20 && o.wage < a.wage * 1.5) return failN(n, `${p.n}: "Tôi không muốn chuyển đến ${me().n} lúc này."`);
    if (w < 40) n.tension += 20;
  }
  if (n.type === "renew" && p.mor < 25 && Math.random() < 0.7) return failN(n, `${p.n} từ chối gia hạn. Cậu ấy muốn tìm thử thách mới.`);
  let sc =
    0.62 * Math.min(1.3, o.wage / a.wage) +
    0.2 * Math.min(1.3, (o.signon + 1) / (a.signon + 1)) +
    0.18 * (Math.abs(o.years - a.years) <= 1 ? 1 : 0.75);
  const gap = roleIdx(o.role) - roleIdx(a.role);
  if (gap >= 2) sc *= 0.82;
  else if (gap === 1) sc *= 0.95;
  else if (gap < 0) sc *= 1.03;
  if (o.rc) sc += 0.03;
  if (sc >= 1) {
    n.stage = "final";
    n.msg = `${p.n} đồng ý các điều khoản cá nhân.`;
    if (n.type !== "renew" && n.type !== "free" && n.type !== "pre" && Math.random() < 0.18) {
      const pool = Object.values(S.clubs).filter((c) => c.id !== S.me && c.id !== n.seller && c.pres >= me().pres - 1);
      if (pool.length) {
        const rv = pickA(pool);
        n.twist = { club: rv.id };
        n.msg += ` Nhưng phút chót, ${rv.n} cũng nhảy vào hỏi mua!`;
      }
    }
  } else if (sc >= 0.85) {
    n.tension += 12 + (1 - sc) * 70;
    a.wage = Math.max(Math.round(a.wage * 0.97), Math.round(o.wage * 1.02));
    n.msg = `Người đại diện: "Chúng tôi cần lương khoảng ${fmtW(a.wage)} và vai trò ${a.role}."`;
  } else {
    n.tension += 22 + (1 - sc) * 80;
    n.msg = `Người đại diện cười nhạt. Họ vẫn đòi ${fmtW(a.wage)}, ${a.years} năm, lót tay ${fmtM(a.signon)}.`;
  }
  n.tension = Math.round(Math.min(100, n.tension));
  if (n.tension >= 100) return failN(n, `Người đại diện của ${p.n} rời bàn đàm phán.`);
  nlog(n, "them", n.msg);
}

// ---------- bước cuối ----------
export function finalPush(n: Negotiation): void {
  const r = Math.random(),
    c = C(n.seller!);
  if (r < 0.5) {
    n.offer!.fee = r10(n.offer!.fee * 0.92);
    n.pushed = true;
    n.msg = `${c.n} miễn cưỡng giảm 8%: phí còn ${fmtM(n.offer!.fee)}.`;
  } else if (r < 0.85) {
    n.pushed = true;
    n.msg = `${c.n} giữ nguyên giá. Không mất gì, nhưng cũng không được gì.`;
  } else return failN(n, `${c.n} phật ý vì bị ép giá phút chót và rút khỏi thương vụ.`);
  nlog(n, "them", n.msg);
}
export function resolveTwist(n: Negotiation, raise: boolean): void {
  const rv = C(n.twist!.club),
    o = n.offer!;
  if (raise) {
    if (n.type === "loan") o.pct = Math.min(100, (o.pct || 0) + 10);
    else o.fee = r10(o.fee * 1.1);
    if (n.type !== "loan" && !canAffordNow(o)) return failN(n, `Không đủ ngân sách để trả thêm. ${P(n.pid).n} chọn ${rv.n}.`);
    n.twist = null;
    n.msg = `Bạn tăng 10%. ${C(n.seller!).n} chọn bạn thay vì ${rv.n}.`;
  } else if (Math.random() < 0.5) {
    n.twist = null;
    n.msg = `${P(n.pid).n} vẫn chọn ${me().n}. Một ván cược thành công!`;
  } else {
    const p = P(n.pid);
    moveP(p, rv.id);
    rv.budget -= o.fee;
    C(n.seller!).budget += o.fee;
    p.c = { ...p.c!, exp: S.year + 3 };
    news(`${p.n} gia nhập ${rv.n} sau khi ${me().n} chậm chân.`, "transfer");
    return failN(n, `${p.n} đã chọn ${rv.n}.`);
  }
  nlog(n, "them", n.msg);
}

export function moveP(p: Player, to: string | null): void {
  if (p.club != null) {
    const c = C(p.club);
    c.ids = c.ids.filter((x) => x !== p.id);
  } else S.free = S.free.filter((x) => x !== p.id);
  p.club = to;
  if (to != null) C(to).ids.push(p.id);
  else S.free.push(p.id);
  p.joined = S.d;
  p.joinedAbs = absDay();
  p.st = [];
  p.listed = false;
  p.loanList = false;
  p.wantOut = false;
  p.ovrAtSign = p.ovr;
  if (S.xi.includes(p.id)) S.xi = S.xi.map((x) => (x === p.id ? null : x));
  p.val = valueOf(p);
}

export function completeBuy(n: Negotiation): void {
  const p = P(n.pid),
    o: ClubOffer = n.offer || { fee: 0, inst: 1, timing: "now" },
    co = n.cOffer;
  const seller = n.seller != null ? C(n.seller) : null;
  if (n.type === "loan") {
    moveP(p, S.me);
    p.loan = { from: n.seller!, pct: o.pct || 0 };
    p.c!.role = expectedRoleAtMe(p);
    news(`${p.n} đến ${me().n} theo dạng cho mượn từ ${seller!.n} (bạn trả ${o.pct}% lương).`, "transfer");
  } else if (co) {
    const nowFee = o.inst > 1 ? r10(o.fee / o.inst) : o.fee,
      agent = r10(co.signon * 0.5);
    me().budget -= nowFee + co.signon + agent;
    if (seller) {
      seller.budget += o.fee;
      for (let k = 1; k < o.inst; k++) S.liab.push({ y: S.year + k, amt: r10(o.fee / o.inst), to: seller.n, pid: p.id });
    }
    if (o.swap && P(o.swap) && seller) {
      const sp = P(o.swap);
      moveP(sp, seller.id);
      news(`${sp.n} chuyển sang ${seller.n} trong thương vụ trao đổi.`, "transfer");
    }
    const from = p.club;
    const nowOK = (n.type === "free" || (!!windowNow() && o.timing !== "next")) && n.type !== "pre";
    if (nowOK) {
      moveP(p, S.me);
      p.c = { wage: co.wage, exp: S.year + co.years, rc: co.rc || 0, role: co.role };
      p.joinedFee = o.fee;
      if (o.sellon && from) p.sellOn = { club: from, pct: o.sellon };
      if (o.addon && from) p.addon = { club: from, amt: o.addon, apps: 20, paid: false };
      p.addonBase = p.tot.apps;
      if (o.loanback && from) {
        p.away = { club: from, until: "end" };
        p.club = S.me;
      }
    } else {
      p.reserved = true;
      S.pending.push({ pid: p.id, from, c: { wage: co.wage, exp: S.year + co.years, rc: co.rc || 0, role: co.role }, o, type: n.type });
    }
    p.hist.push({ y: S.year, from: from != null ? C(from).n : "Tự do", to: me().n, fee: o.fee });
    news(
      `${me().n} ${nowOK ? "chiêu mộ" : "thỏa thuận chiêu mộ"} ${p.n} từ ${from != null ? C(from).n : "thị trường tự do"} với giá ${o.fee ? fmtM(o.fee) : "0 đồng"}${nowOK ? "" : " (gia nhập kỳ chuyển nhượng tới)"}${o.loanback ? ", cho mượn lại đến hết mùa" : ""}.`,
      "transfer",
    );
  }
  n.stage = "done";
  n.msg = "Thương vụ hoàn tất!";
  nlog(n, "them", n.msg);
  if (S.xi.filter(Boolean).length < 11) myXI();
}

export function renew(pid: string): Res {
  const p = P(pid);
  if (activeNegoFor(pid)) return { err: "Đang có đàm phán với cầu thủ này." };
  return {
    n: newNego({
      pid,
      type: "renew",
      buy: false,
      stage: "contract",
      cAsk: contractAsk(p, "renew"),
      msg: `Đàm phán gia hạn với ${p.n}. Hợp đồng hiện tại hết hạn 30/6/${p.c!.exp}.`,
    }),
  };
}
export function completeRenew(n: Negotiation): void {
  const p = P(n.pid),
    co = n.cOffer!;
  me().budget -= co.signon;
  p.c = { wage: co.wage, exp: S.year + co.years, rc: co.rc || 0, role: co.role };
  p.ovrAtSign = p.ovr;
  p.mor = clamp(p.mor + 10, 0, 100);
  n.stage = "done";
  n.msg = "Gia hạn thành công.";
  news(`${p.n} gia hạn hợp đồng với ${me().n} đến 30/6/${p.c.exp}.`, "club");
}

// ---------- bán: AI hỏi mua cầu thủ của bạn ----------
export function aiBidsTick(hours: number): void {
  if (!windowNow()) return;
  const mult = ((isDeadline() ? 4 : 1) * hours) / 24;
  clubPlayers(S.me).forEach((p) => {
    if (p.loan || activeNegoFor(p.id) || p.inj > 20) return;
    if (absDay() - (p.joinedAbs || -9999) < 45 && !p.listed) return;
    const ch = 0.006 * mult * (p.listed ? 5 : 1) * (p.wantOut ? 2 : 1) * (p.ovr > 65 ? 1.6 : 1);
    if (Math.random() > ch) return;
    const buyers = Object.values(S.clubs).filter((c) => c.id !== S.me && c.budget >= p.val * 0.8 && Math.abs(c.str - p.ovr) <= 8);
    if (!buyers.length) return;
    const b = pickA(buyers);
    const fee = r10(p.val * (p.listed ? rnd(0.78, 1) : rnd(0.88, 1.15)));
    const n = newNego({
      pid: p.id,
      type: "transfer",
      sell: true,
      buyer: b.id,
      stage: "offer",
      fee,
      inst: Math.random() < 0.25 ? 2 : 1,
      max: r10(fee * rnd(1.05, 1.35)),
      msg: `${b.n} gửi đề nghị ${fmtM(fee)} cho ${p.n}.`,
    });
    nlog(n, "them", n.msg);
    inbox({
      t: `Lời đề nghị cho ${p.n}`,
      b: `${b.n} (${LG(b.lg).n}) đề nghị ${fmtM(fee)}${(n.inst || 1) > 1 ? " trả góp 2 mùa" : ""}. Giá trị ước tính: ${fmtM(p.val)}.`,
      nid: n.id,
      pid: p.id,
    });
  });
  clubPlayers(S.me)
    .filter((p) => p.loanList && !activeNegoFor(p.id))
    .forEach((p) => {
      if (Math.random() > 0.03 * mult * 3) return;
      const pool = Object.values(S.clubs).filter((c) => c.id !== S.me && c.str <= p.ovr + 6);
      if (!pool.length) return;
      const b = pickA(pool);
      const n = newNego({
        pid: p.id,
        type: "loanout",
        sell: true,
        buyer: b.id,
        stage: "offer",
        pct: ri(50, 100),
        msg: `${b.n} muốn mượn ${p.n} đến hết mùa.`,
      });
      nlog(n, "them", n.msg);
      inbox({ t: `Đề nghị mượn ${p.n}`, b: `${b.n} muốn mượn ${p.n} đến hết mùa, trả ${n.pct}% lương.`, nid: n.id, pid: p.id });
    });
}

export const MIN_SQUAD = 18;

export function respondSell(n: Negotiation, action: "accept" | "reject" | "counter", counter = 0): Res {
  const p = P(n.pid),
    b = C(n.buyer!);
  if (action === "reject") {
    n.stage = "failed";
    n.msg = "Bạn đã từ chối.";
    nlog(n, "me", n.msg);
    return {};
  }
  if (n.type === "loanout") {
    if (action === "accept") {
      moveP(p, n.buyer!);
      p.away = null;
      p.loanOut = { to: n.buyer!, from: S.me, pct: n.pct || 0 };
      p.homeClub = S.me;
      news(`${p.n} được cho ${b.n} mượn đến hết mùa.`, "transfer");
      n.stage = "done";
      n.msg = "Đã cho mượn.";
    }
    return {};
  }
  const max = n.max || 0;
  if (action === "counter") {
    nlog(n, "me", `Phản giá ${fmtM(counter)}`);
    if (counter <= max) {
      n.fee = counter;
      action = "accept";
    } else if (counter <= max * 1.15) {
      n.tension += 25;
      n.fee = max;
      n.msg = `${b.n} nâng lên ${fmtM(max)}. Đây là mức cuối của họ.`;
      nlog(n, "them", n.msg);
      if (n.tension >= 100) failN(n, `${b.n} rút lui.`);
      return {};
    } else {
      n.tension += 40;
      n.msg = `${b.n} cho rằng mức giá quá cao.`;
      nlog(n, "them", n.msg);
      if (n.tension >= 100) failN(n, `${b.n} rút lui.`);
      return {};
    }
  }
  if (clubPlayers(S.me).filter((x) => !x.loan).length <= MIN_SQUAD)
    return { err: `Đội cần tối thiểu ${MIN_SQUAD} cầu thủ. Hãy mua thêm trước khi bán.` };
  const ok = b.pres >= me().pres - 1 || p.mor < 45 || p.wantOut || Math.random() < 0.5;
  if (!ok) {
    failN(n, `${p.n} từ chối chuyển đến ${b.n} vì không thấy đó là bước tiến.`);
    return {};
  }
  const fee = n.fee || 0,
    inst = n.inst || 1;
  let got = fee;
  if (p.sellOn) {
    const cut = r10((fee * p.sellOn.pct) / 100);
    got -= cut;
    news(`${C(p.sellOn.club).n} nhận ${fmtM(cut)} nhờ điều khoản ${p.sellOn.pct}% bán lại.`, "transfer");
    C(p.sellOn.club).budget += cut;
  }
  me().budget += inst > 1 ? r10(got / inst) : got;
  for (let k = 1; k < inst; k++) S.liab.push({ y: S.year + k, amt: -r10(got / inst), to: b.n, pid: p.id });
  b.budget -= fee;
  p.hist.push({ y: S.year, from: me().n, to: b.n, fee });
  moveP(p, b.id);
  p.c!.exp = Math.max(p.c!.exp, S.year + 3);
  p.sellOn = null;
  p.addon = null;
  news(`${p.n} rời ${me().n} để gia nhập ${b.n} với giá ${fmtM(fee)}.`, "transfer");
  n.stage = "done";
  n.msg = `Đã bán cho ${b.n} với giá ${fmtM(fee)}.`;
  nlog(n, "them", n.msg);
  return {};
}

// ---------- Giám đốc thể thao đàm phán thay ----------
export function delegate(pid: string, maxFee: number): Res {
  const r = enquire(pid, "transfer");
  if (r.err || !r.n) return r;
  const n = r.n;
  n.dof = { max: maxFee };
  n.readyAt = tick() + (isDeadline() ? 2 : 48);
  n.stage = "dof";
  n.msg = `Giám đốc thể thao đang đàm phán, trần ${fmtM(maxFee)}.`;
  nlog(n, "me", n.msg);
  return r;
}
function processDof(n: Negotiation): void {
  const p = P(n.pid);
  if (!p || p.club == null || p.club === S.me) return failN(n, "Thương vụ không còn khả thi.");
  const fee = r10(p.val * askFactor(p) * rnd(0.92, 1.08));
  if (fee > n.dof!.max || fee > me().budget)
    return failN(n, `Giám đốc thể thao báo cáo: ${C(p.club).n} đòi khoảng ${fmtM(fee)}, vượt trần bạn đặt.`);
  if (willingness(p) < 25) return failN(n, `Giám đốc thể thao báo cáo: ${p.n} không muốn chuyển đến.`);
  const a = contractAsk(p, "transfer");
  n.seller = p.club;
  n.offer = { fee, inst: 1, timing: "now" };
  n.cOffer = { wage: Math.round(a.wage * 1.03), years: a.years, signon: a.signon, role: a.role, rc: 0 };
  if (myWages() + n.cOffer.wage > S.wageCap) return failN(n, "Giám đốc thể thao báo cáo: lương cầu thủ đòi vượt quỹ lương.");
  completeBuy(n);
  inbox({ t: `Giám đốc thể thao chốt ${p.n}`, b: `Phí ${fmtM(fee)}, lương ${fmtW(n.cOffer.wage)}, ${a.years} năm.`, pid: p.id });
}

// ---------- AI mua bán với nhau ----------
/** Vị trí yếu nhất của CLB: tuyến có điểm trung bình các cầu thủ hàng đầu thấp nhất. */
function weakestLine(buyer: Club): { pos: Line; v: number } {
  return (["GK", "DF", "MF", "FW"] as Line[])
    .map((pos) => {
      const k = pos === "GK" ? 1 : 3;
      return {
        pos,
        v:
          clubPlayers(buyer.id)
            .filter((p) => p.pos === pos)
            .sort((a, b) => b.ovr - a.ovr)
            .slice(0, k)
            .reduce((s, p) => s + p.ovr, 0) / k,
      };
    })
    .sort((a, b) => a.v - b.v)[0];
}

/** CLB AI ký cầu thủ tự do (không phí, quanh năm): cầu thủ chỉ đồng ý nếu CLB đủ tầm và họ giúp đội mạnh lên. */
function aiFreeAgentsTick(hours: number): void {
  if (!S.free.length) return;
  const tries = Math.max(1, Math.round((hours / 24) * 4));
  const others = Object.values(S.clubs).filter((c) => c.id !== S.me);
  for (let t = 0; t < tries; t++) {
    const buyer = pickA(others);
    if (buyer.ids.length >= 27 || Math.random() > 0.3) continue;
    const need = weakestLine(buyer);
    const pool = S.free
      .map(P)
      .filter(
        (p) =>
          p &&
          p.pos === need.pos &&
          p.ovr >= need.v + 1 &&
          p.ovr <= buyer.str + 7 &&
          !activeNegoFor(p.id) &&
          !S.pending.some((x) => x.pid === p.id),
      );
    const p = buyer.phil === "young" ? pool.sort((a, b) => a.age - b.age)[0] : pickA(pool);
    if (!p) continue;
    const wage = Math.round(Math.max(p.c?.wage ?? 0, wageBase(p)));
    if (buyer.budget < wage * 20) continue;
    buyer.budget -= wage * 10;
    moveP(p, buyer.id);
    p.c = { wage, exp: S.year + ri(1, 3), rc: 0, role: "Xoay tua" };
    p.hist.push({ y: S.year, from: "Tự do", to: buyer.n, fee: 0 });
    S.aiDone++;
    if (buyer.lg === myLg() || p.ovr >= 75) news(`${p.n} gia nhập ${buyer.n} theo dạng tự do.`, "transfer");
  }
}

export function aiTransfersTick(hours: number): void {
  aiFreeAgentsTick(hours);
  if (!windowNow()) return;
  const tries = Math.max(1, Math.round((((isDeadline() ? 3 : 1) * hours) / 24) * 5));
  const others = Object.values(S.clubs).filter((c) => c.id !== S.me);
  for (let t = 0; t < tries; t++) {
    const buyer = pickA(others);
    if (Math.random() > 0.35) continue;
    const need = weakestLine(buyer);
    const pool = Object.values(S.P).filter(
      (p) =>
        p.club != null &&
        p.club !== S.me &&
        p.club !== buyer.id &&
        p.pos === need.pos &&
        p.ovr >= need.v + 1 &&
        p.ovr <= buyer.str + 7 &&
        C(p.club).pres <= buyer.pres + 1 &&
        !p.homeClub &&
        !p.reserved &&
        !activeNegoFor(p.id) &&
        absDay() - (p.joinedAbs || -9999) > 150 &&
        C(p.club).ids.length > 20 &&
        C(p.club).rival !== buyer.id,
    );
    if (buyer.phil === "young") pool.sort((a, b) => a.age - b.age);
    const p = pool.length ? (buyer.phil === "young" ? pool[0] : pickA(pool)) : null;
    if (!p) continue;
    const fee = r10(p.val * askFactor(p) * rnd(0.9, 1.05));
    if (fee > buyer.budget) continue;
    const from = C(p.club!);
    buyer.budget -= fee;
    from.budget += fee;
    moveP(p, buyer.id);
    p.c!.exp = S.year + ri(2, 4);
    p.c!.wage = Math.round(p.c!.wage * 1.1);
    p.hist.push({ y: S.year, from: from.n, to: buyer.n, fee });
    S.aiDone++;
    if (buyer.lg === myLg() || from.lg === myLg() || fee > 30000)
      news(`${p.n} chuyển từ ${from.n} sang ${buyer.n} (${fmtM(fee)}).`, "transfer");
  }
}

// ---------- xử lý phản hồi theo thời gian ----------
export function processNegos(): void {
  const t = tick();
  S.negos.forEach((n) => {
    if (n.stage === "done" || n.stage === "failed" || (!n.readyAt && !n.waiting)) return;
    if (n.readyAt && t >= n.readyAt) {
      const st = n.stage;
      n.readyAt = null;
      if (n.buy && n.seller != null && st !== "enquiry" && st !== "dof" && P(n.pid) && P(n.pid).club !== n.seller) {
        failN(n, `${P(n.pid).n} đã chuyển sang CLB khác trước khi thương vụ hoàn tất.`);
        return;
      }
      if (st === "enquiry") processEnquiry(n);
      else if (st === "dof") processDof(n);
      else if (st === "club" && n.waiting) processClubOffer(n);
      else if (st === "contract" && n.waiting) processContract(n);
      if (n.buy || n.type === "renew") {
        n.fresh = true;
        S.stopFlag = true;
      }
    }
  });
  S.negos.forEach((n) => {
    if (n.sell && n.stage === "offer" && t - n.created > 72) {
      n.stage = "failed";
      n.msg = "Đề nghị đã hết hạn.";
    }
  });
  S.negos = S.negos
    .filter((n) => !((n.stage === "done" || n.stage === "failed") && t - (n.log.length ? n.log[n.log.length - 1].at : n.created) > 24 * 20))
    .slice(0, 40);
}
