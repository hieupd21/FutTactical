// Các thao tác nhỏ của người chơi (đổi đội hình, vai trò, rao bán, ngân sách…). UI chỉ gọi qua đây, không sửa S trực tiếp.
import { ROLES } from "./constants";
import { fmtM } from "./format";
import { bestXI, myXI } from "./squad";
import { C, me, N, P, S, tick } from "./state";
import type { Formation, Negotiation, Role } from "./types";
import { clamp } from "./util";

export const scoutCost = (): number => 1500 * S.scout;
export const BUDGET_STEP = 1000; // 1 tr €
export const WAGE_STEP = 19; // 19k €/tuần

export function setFormation(f: Formation): void {
  S.form = f;
  S.xi = bestXI(S.me, f);
}
export function autoXI(): void {
  S.xi = bestXI(S.me, S.form);
}
/** Đưa cầu thủ pid vào vị trí slot; nếu cậu ấy đã đá chính thì hoán đổi hai vị trí */
export function swapInto(pid: string, slot: number): void {
  const xi = myXI().slice();
  const j = xi.indexOf(pid);
  if (j >= 0) [xi[slot], xi[j]] = [xi[j], xi[slot]];
  else xi[slot] = pid;
  S.xi = xi;
}
/** Đổi vai trò. Trả về true nếu cầu thủ phật ý vì bị hạ vai trò */
export function setRole(pid: string, role: Role): boolean {
  const p = P(pid);
  const old = p.c!.role;
  p.c!.role = role;
  const demoted = ROLES.indexOf(role) > ROLES.indexOf(old);
  p.mor = clamp(p.mor + (demoted ? -8 : 5), 0, 100);
  return demoted;
}
export function toggleShortlist(pid: string): void {
  const i = S.shortlist.indexOf(pid);
  if (i >= 0) S.shortlist.splice(i, 1);
  else S.shortlist.push(pid);
}
export function toggleListed(pid: string): boolean {
  const p = P(pid);
  p.listed = !p.listed;
  if (p.listed) p.loanList = false;
  return !!p.listed;
}
export function toggleLoanList(pid: string): boolean {
  const p = P(pid);
  p.loanList = !p.loanList;
  if (p.loanList) p.listed = false;
  return !!p.loanList;
}
export function reallocate(dir: "toWage" | "toFee"): void {
  if (dir === "toWage") { me().budget -= BUDGET_STEP; S.wageCap += WAGE_STEP; }
  else { me().budget += BUDGET_STEP; S.wageCap -= WAGE_STEP; }
}
export function hireScout(): string {
  me().budget -= scoutCost();
  S.scout++;
  return `Đã thuê trưởng bộ phận tuyển trạch ${S.scout} sao (${fmtM(scoutCost())} cho lần nâng cấp tới).`;
}
export function quitNego(id: string): void {
  const n = N(id);
  if (!n) return;
  n.stage = "failed";
  n.msg = "Bạn đã rút khỏi thương vụ.";
  n.log.push({ who: "me", t: n.msg, at: tick() });
}
export function renamePlayer(pid: string, name: string): void {
  const v = name.trim();
  if (v) P(pid).n = v;
}
export function renameClub(cid: string, name: string): void {
  const v = name.trim();
  if (v) C(cid).n = v;
}
export function renameLeague(lg: string, name: string): void {
  const v = name.trim();
  if (v) S.lgN[lg] = v;
}
export function readMessage(id: string): void {
  const m = S.inbox.find((x) => x.id === id);
  if (m) m.read = true;
}
export function readAll(): void {
  S.inbox.forEach((m) => (m.read = true));
}

// ---------- bộ chọn dùng cho UI ----------
export const isClosed = (n: Negotiation): boolean => n.stage === "done" || n.stage === "failed";
/** Thương vụ đang chờ bạn ra quyết định */
export const needsAct = (n: Negotiation): boolean =>
  !isClosed(n) && !n.waiting && n.stage !== "enquiry" && n.stage !== "dof" && (!!n.buy || n.type === "renew" || (!!n.sell && n.stage === "offer"));

export function stageTxt(n: Negotiation): string {
  if (n.sell && n.stage === "offer") return n.type === "loanout" ? `${C(n.buyer!).n} muốn mượn · ${n.pct}% lương` : `${C(n.buyer!).n} trả ${fmtM(n.fee || 0)}`;
  if (n.type === "renew") return n.stage === "final" ? "Đồng ý gia hạn, chờ bạn ký" : n.stage === "done" ? "Hoàn tất" : n.stage === "failed" ? "Đổ vỡ" : "Đàm phán gia hạn";
  const m: Record<string, string> = {
    enquiry: "Đang chờ phản hồi thăm dò",
    dof: "Giám đốc thể thao đang đàm phán",
    club: n.waiting ? "Chờ CLB phản hồi" : n.type === "loan" ? "Đàm phán mượn" : "Đàm phán với CLB",
    contract: n.waiting ? "Chờ người đại diện" : "Đàm phán hợp đồng",
    final: n.twist ? "CLB khác nhảy vào!" : "Chờ bạn chốt",
    done: "Hoàn tất",
    failed: "Đổ vỡ",
  };
  return m[n.stage] || n.stage;
}
