// Tâm lý cầu thủ: đòi ra sân, đòi ra đi, cam kết của người chơi, và cầu thủ CLB khác "thả thính" CLB của bạn.
import { ROLE_START } from "./constants";
import { moraleLbl } from "./players";
import { clubPlayers, slotPos, squadRank } from "./squad";
import { C, inbox, me, news, P, S } from "./state";
import { activeNegoFor, willingness } from "./transfers";
import type { MoodCause, Player, Role } from "./types";
import { clamp, pickA } from "./util";

/** Số trận cam kết cho đá chính; càng dài càng xoa dịu nhiều nhưng càng khó giữ lời */
export const PROMISE_OPTS = [3, 5, 8] as const;
const promiseMor = (n: number): number => (n === 3 ? 8 : n === 5 ? 11 : 14);
const promiseAllow = (n: number): number => (n >= 5 ? 1 : 0);

const startCount = (p: Player): number => p.st.reduce((a, b) => a + b, 0);

/** Lý do không hài lòng của cầu thủ đang ở CLB bạn, hoặc null nếu ổn */
function myGrievance(p: Player): MoodCause | null {
  const exp = ROLE_START[p.c!.role] ?? 0.3;
  const playtime = p.st.length >= 4 && startCount(p) / p.st.length < exp - 0.15;
  if (playtime) return squadRank(p, S.me).slots <= 1 ? "tactics" : "playtime";
  return p.mor < 20 ? "morale" : null;
}

const START_QUOTES: Record<MoodCause, ((p: Player) => string)[]> = {
  playtime: [
    (p) => `${p.n} gõ cửa phòng làm việc của bạn: "Tôi cần được thi đấu. Ngồi dự bị mãi thế này, tôi không thể phát triển."`,
    (p) => `${p.n} đứng ở cửa sau buổi tập, giọng trầm xuống: "HLV, tôi muốn biết mình còn chỗ trong kế hoạch của thầy không?"`,
  ],
  tactics: [
    (p) => `${p.n} tìm gặp bạn: "Hệ thống này gần như không có chỗ cho vị trí của tôi. Tôi muốn biết thầy định dùng tôi thế nào."`,
    (p) => `${p.n} thở dài sau buổi họp chiến thuật: "Tôi không thấy mình đâu trong sơ đồ này, thưa thầy."`,
  ],
  morale: [(p) => `${p.n} lặng lẽ để lại một lá thư trên bàn bạn: "Tôi cần nói chuyện về tương lai của mình."`],
};
const LEAVE_QUOTES: Record<MoodCause, ((p: Player) => string)[]> = {
  playtime: [
    (p) =>
      `${p.n} gửi người đại diện đến gặp bạn: "Cậu ấy không thể tiếp tục thế này. Chúng tôi muốn cậu ấy được ra đi để tìm cơ hội thi đấu."`,
  ],
  tactics: [(p) => `Người đại diện của ${p.n} đặt thẳng vấn đề: "Lối chơi này không dành cho cậu ấy. Hãy cho cậu ấy một lối thoát."`],
  morale: [(p) => `${p.n} không còn muốn ở lại. Người đại diện báo cho bạn rằng cậu ấy xin được rao bán.`],
};

function demandStart(p: Player, cause: MoodCause): void {
  p.demand = { kind: "start", d: S.d, cause };
  news(`${p.n} đang bất mãn tại ${me().n}: cậu ấy đòi được ra sân nhiều hơn.`, "rebel");
  inbox({
    t: `${p.n} đòi được ra sân`,
    b: pickA(START_QUOTES[cause])(p) + ` Tinh thần: ${moraleLbl(p.mor).toLowerCase()}.`,
    pid: p.id,
    act: "demand",
  });
}
function demandLeave(p: Player, cause: MoodCause): void {
  p.demand = { kind: "leave", d: S.d, cause };
  p.wantOut = true;
  news(`${p.n} chính thức đòi rời ${me().n}. Người đại diện đã bắt đầu tìm bến đỗ mới.`, "rebel");
  inbox({
    t: `${p.n} đòi ra đi`,
    b: pickA(LEAVE_QUOTES[cause])(p) + " Bạn có thể xoa dịu, rao bán hoặc cho mượn.",
    pid: p.id,
    act: "demand",
  });
}

/** Chạy mỗi tuần: cầu thủ của bạn đòi hỏi, và cầu thủ CLB khác thả thính */
export function moodTick(): void {
  clubPlayers(S.me).forEach((p) => {
    if (p.loan || p.away || !p.c || p.promise) return;
    if (p.demand) {
      if (S.d - p.demand.d >= 14 && p.demand.kind === "start") demandLeave(p, p.demand.cause);
      return;
    }
    if (p.demandCool && S.d < p.demandCool) return;
    const g = myGrievance(p);
    if (!g) return;
    if (p.mor < 20) demandLeave(p, g);
    else if (p.mor < 55) demandStart(p, g);
  });
  interestTick();
  worldDramaTick();
}

// ---------- cầu thủ CLB khác thả thính ----------
const FLIRT: Record<MoodCause | "free", ((p: Player, club: string, to: string) => string)[]> = {
  playtime: [
    (p, c, to) => `${p.n} (${c}) nói trên báo: "Tôi muốn được đá nhiều hơn. Nghe nói ${to} đang chơi thứ bóng đá rất hấp dẫn."`,
    (p, c, to) => `Sau trận thua, ${p.n} (${c}) bình thản: "Ngồi dự bị không phải điều tôi muốn. Nếu ${to} gọi, tôi sẽ lắng nghe."`,
  ],
  tactics: [(p, c, to) => `${p.n} (${c}) tâm sự: "Sơ đồ ở đây chưa phù hợp với tôi. Tôi thích cách ${to} sử dụng vị trí của mình."`],
  morale: [
    (p, c, to) => `Một nguồn tin thân cận cho biết ${p.n} (${c}) không còn hạnh phúc, và ${to} nằm trong danh sách mơ ước của cậu ấy.`,
  ],
  free: [(p, _c, to) => `${p.n} đang tìm bến đỗ mới. Người đại diện nói cậu ấy "rất ấn tượng với dự án của ${to}".`],
};

function interestCause(p: Player): MoodCause | "free" | null {
  if (p.club == null) return "free";
  const sr = squadRank(p, p.club);
  const mySlots = slotPos(S.form).filter((x) => x === p.pos).length;
  if (p.ovr >= 65 && (sr.role === "Dự bị" || sr.role === "Xoay tua")) return "playtime";
  if (sr.slots < mySlots && sr.rank > sr.slots) return "tactics";
  if (p.mor < 35) return "morale";
  return null;
}

function interestTick(): void {
  if (Math.random() > 0.4) return;
  const pool = Object.values(S.P).filter(
    (p) =>
      p.club !== S.me &&
      p.c &&
      !p.interest &&
      !p.loan &&
      !p.away &&
      p.ovr >= me().str - 4 &&
      !activeNegoFor(p.id) &&
      willingness(p) >= 55 &&
      interestCause(p),
  );
  const free = Object.values(S.P).filter(
    (p) => p.club == null && !p.interest && p.ovr >= me().str - 6 && !activeNegoFor(p.id) && willingness(p) >= 55,
  );
  const cand = [...pool, ...free];
  if (!cand.length) return;
  const p = pickA(cand);
  const cause = interestCause(p)!;
  p.interest = { d: S.d, cause };
  const club = p.club != null ? C(p.club).n : "tự do";
  news(pickA(FLIRT[cause])(p, club, me().n), "flirt");
  if (cause === "free" || Math.random() < 0.6) {
    const bind =
      p.club != null && p.c!.exp - S.year > 1 ? " Lưu ý: cậu ấy còn hợp đồng dài hạn, bạn cần thương lượng với CLB chủ quản." : "";
    inbox({
      t: `Người đại diện của ${p.n} liên hệ`,
      b: `Người đại diện của ${p.n} (${club}) gửi thư thăm dò ý định của ${me().n}: cậu ấy sẵn sàng ngồi xuống nói chuyện.${bind}`,
      pid: p.id,
      act: "agent",
    });
  }
}

// ---------- cam kết ----------
/** Gọi sau mỗi trận của CLB bạn: cầu thủ có cam kết được đá chính thì tính, khỏe mà không đá thì tính là lỡ hẹn */
export function trackPromise(p: Player, started: boolean): void {
  const pr = p.promise;
  if (!pr) return;
  if (started) pr.left--;
  else if (p.inj <= 0) pr.missed++;
  if (pr.missed > pr.allow) {
    p.promise = null;
    p.mor = clamp(p.mor - 15, 0, 100);
    p.demandCool = 0;
    demandLeave(p, "playtime");
  } else if (pr.left <= 0) {
    p.promise = null;
    p.mor = clamp(p.mor + 10, 0, 100);
    news(`${p.n} hài lòng vì bạn đã giữ lời: cậu ấy được ra sân đúng như cam kết.`, "club");
  }
}

// ---------- người chơi trả lời ----------
export type DemandChoice =
  | { a: "promise"; n: (typeof PROMISE_OPTS)[number] }
  | { a: "promote" }
  | { a: "persuade" }
  | { a: "refuse" }
  | { a: "sell" }
  | { a: "loan" }
  | { a: "hold" };

const LADDER: Role[] = ["Dự bị", "Xoay tua", "Đá chính", "Ngôi sao"];
/** Vai trò cao hơn một bậc, hoặc null nếu đã ở đỉnh */
export function nextRole(r: Role): Role | null {
  if (r === "Triển vọng") return "Xoay tua";
  const i = LADDER.indexOf(r);
  return i >= 0 && i < LADDER.length - 1 ? LADDER[i + 1] : null;
}
/** Xác suất xoa dịu thành công một yêu cầu ra đi bằng cam kết */
export const appeaseChance = (p: Player, n: number): number => clamp(0.4 + n * 0.04 + p.mor / 200, 0, 0.9);

/** Người chơi phản hồi yêu cầu của cầu thủ. Trả về câu mô tả kết quả. */
export function respondDemand(pid: string, c: DemandChoice): { msg: string } {
  const p = P(pid);
  const d = p.demand;
  if (!d) return { msg: "Không còn yêu cầu nào." };
  const clear = (cool: number) => {
    p.demand = null;
    p.demandCool = S.d + cool;
  };
  const promise = (n: number) => {
    p.promise = { kind: "start", left: n, missed: 0, allow: promiseAllow(n) };
    p.st = [];
  };
  if (c.a === "promise") {
    if (d.kind === "start") {
      promise(c.n);
      p.mor = clamp(p.mor + promiseMor(c.n), 0, 100);
      clear(30);
      return { msg: `${p.n} gật đầu: "Tôi sẽ chờ xem thầy giữ lời." Hãy cho cậu ấy đá chính ${c.n} trận tới.` };
    }
    if (Math.random() < appeaseChance(p, c.n)) {
      promise(c.n);
      p.wantOut = false;
      p.mor = clamp(p.mor + promiseMor(c.n) + 2, 0, 100);
      clear(30);
      return { msg: `${p.n} cân nhắc rồi đồng ý ở lại: "Tôi tin thầy lần này." Cậu ấy sẽ đá chính ${c.n} trận tới.` };
    }
    p.mor = clamp(p.mor - 2, 0, 100);
    p.demand = { ...d, d: S.d };
    return { msg: `${p.n} lắc đầu: "Lời hứa suông thôi chưa đủ." Cậu ấy vẫn muốn ra đi.` };
  }
  if (c.a === "promote") {
    const nr = nextRole(p.c!.role);
    if (!nr) return { msg: "Cậu ấy đã ở vai trò cao nhất." };
    p.c!.role = nr;
    p.mor = clamp(p.mor + 10, 0, 100);
    clear(30);
    return { msg: `${p.n} được nâng lên vai trò "${nr}". Cậu ấy mỉm cười, nhưng sẽ chờ xem thầy có xếp mình đá đủ không.` };
  }
  if (c.a === "persuade") {
    p.mor = clamp(p.mor + 3, 0, 100);
    if (Math.random() < 0.4) {
      clear(14);
      return { msg: `${p.n} im lặng một lúc rồi chấp nhận: "Tôi sẽ cố gắng chờ cơ hội."` };
    }
    p.demand = null;
    demandLeave(p, d.cause);
    return { msg: `${p.n} không bị thuyết phục. Cậu ấy quay sang đòi được ra đi.` };
  }
  if (c.a === "sell") {
    p.listed = true;
    p.loanList = false;
    p.mor = clamp(p.mor + 5, 0, 100);
    clear(60);
    return { msg: `Bạn đồng ý rao bán ${p.n}. Các CLB sẽ sớm liên hệ.` };
  }
  if (c.a === "loan") {
    p.loanList = true;
    p.listed = false;
    p.mor = clamp(p.mor + 5, 0, 100);
    clear(60);
    return { msg: `Bạn đồng ý cho ${p.n} đi mượn. Các CLB sẽ sớm liên hệ.` };
  }
  // refuse (đòi ra sân) hoặc hold (đòi ra đi): giữ nguyên quyết định
  p.mor = clamp(p.mor - (c.a === "hold" ? 12 : 10), 0, 100);
  if (c.a === "hold") p.wantOut = true;
  clear(c.a === "hold" ? 60 : 30);
  return { msg: `${p.n} cúi đầu rời phòng, không nói thêm lời nào. Tinh thần của cậu ấy sa sút.` };
}

// ---------- chuyện của các CLB khác ----------
const REBEL: Record<MoodCause, ((p: Player, c: string) => string)[]> = {
  playtime: [
    (p, c) => `${p.n} nổi giận vì ngồi dự bị: cậu ấy đòi rời ${c} ngay trong kỳ chuyển nhượng tới.`,
    (p, c) => `Phòng thay đồ ${c} dậy sóng: ${p.n} công khai phàn nàn về thời gian thi đấu.`,
  ],
  tactics: [(p, c) => `${p.n} bất đồng với HLV ${c} về chiến thuật và bị loại khỏi buổi tập chung.`],
  morale: [(p, c) => `${p.n} (${c}) mất hứng thú với bóng đá ở đây và yêu cầu được ra đi.`],
};

/** Mỗi tuần có thể có một cầu thủ CLB khác thả thính một đội khác, nổi loạn hoặc làm hòa */
function worldDramaTick(): void {
  const pop = Object.values(S.P).filter((p) => p.club != null && p.club !== S.me && p.c && !p.loan && !p.away && p.ovr >= 70);
  // làm hòa
  const rebels = pop.filter((p) => p.wantOut);
  if (rebels.length && Math.random() < 0.4) {
    const p = pickA(rebels);
    p.wantOut = false;
    p.mor = clamp(p.mor + 15, 0, 100);
    news(`${p.n} làm hòa với ${C(p.club!).n} sau cuộc nói chuyện thẳng thắn: cậu ấy sẽ ở lại.`, "rebel");
  }
  // nổi loạn
  if (Math.random() < 0.3) {
    const c = pickA(pop.filter((p) => !p.wantOut && interestCause(p) && interestCause(p) !== "free"));
    if (c) {
      const cause = interestCause(c) as MoodCause;
      c.wantOut = true;
      c.mor = clamp(c.mor - 10, 0, 100);
      news(pickA(REBEL[cause])(c, C(c.club!).n), "rebel");
    }
  }
  // thả thính CLB khác
  if (Math.random() < 0.3) {
    const c = pickA(pop.filter((p) => interestCause(p) === "playtime" || interestCause(p) === "morale"));
    if (c) {
      const cause = interestCause(c) as MoodCause;
      const from = C(c.club!);
      const to = pickA(Object.values(S.clubs).filter((x) => x.id !== from.id && x.id !== S.me && x.pres >= from.pres));
      if (to) news(pickA(FLIRT[cause])(c, from.n, to.n), "flirt");
    }
  }
}
