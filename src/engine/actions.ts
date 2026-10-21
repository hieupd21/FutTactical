// Các thao tác nhỏ của người chơi (đổi đội hình, vai trò, rao bán, ngân sách…). UI chỉ gọi qua đây, không sửa S trực tiếp.
import { setBoard } from "./board";
import { acceptOffer, declineOffer, switchClub } from "./career";
import { ROLES } from "./constants";
import { formatMoney } from "./format";
import { applyPending } from "./season";
import { bestLineup, myLineup } from "./squad";
import { getClub, myClub, getNegotiation, getPlayer, gameState, tick } from "./state";
import type { Formation, Negotiation, Role, Tactic } from "./types";
import { clamp } from "./util";

export const scoutCost = (): number => 1500 * gameState.scout;
export const BUDGET_STEP = 1000; // 1 tr €
export const WAGE_STEP = 19; // 19k €/tuần

export function setFormation(formation: Formation): void {
  gameState.form = formation;
  gameState.lineup = bestLineup(gameState.myClubId, formation);
}
/** Chiến thuật mặc định của bạn khi vào trận */
export function setMyTactic(tactic: Tactic): void {
  gameState.tactic = { ...tactic };
}
export function autoLineup(): void {
  gameState.lineup = bestLineup(gameState.myClubId, gameState.form);
}
/** Đưa cầu thủ pid vào vị trí slot; nếu cậu ấy đã đá chính thì hoán đổi hai vị trí */
export function swapInto(playerId: string, slot: number): void {
  const lineup = myLineup().slice();
  const j = lineup.indexOf(playerId);
  if (j >= 0) [lineup[slot], lineup[j]] = [lineup[j], lineup[slot]];
  else lineup[slot] = playerId;
  gameState.lineup = lineup;
}
/** Đổi vai trò. Trả về true nếu cầu thủ phật ý vì bị hạ vai trò */
export function setRole(playerId: string, role: Role): boolean {
  const player = getPlayer(playerId);
  const previousRole = player.contract!.role;
  player.contract!.role = role;
  const demoted = ROLES.indexOf(role) > ROLES.indexOf(previousRole);
  player.morale = clamp(player.morale + (demoted ? -8 : 5), 0, 100);
  return demoted;
}
export function toggleShortlist(playerId: string): void {
  const i = gameState.shortlist.indexOf(playerId);
  if (i >= 0) gameState.shortlist.splice(i, 1);
  else gameState.shortlist.push(playerId);
}
export function toggleListed(playerId: string): boolean {
  const player = getPlayer(playerId);
  player.listed = !player.listed;
  if (player.listed) player.loanList = false;
  return !!player.listed;
}
export function toggleLoanList(playerId: string): boolean {
  const player = getPlayer(playerId);
  player.loanList = !player.loanList;
  if (player.loanList) player.listed = false;
  return !!player.loanList;
}
export function reallocate(direction: "toWage" | "toFee"): void {
  if (direction === "toWage") {
    myClub().budget -= BUDGET_STEP;
    gameState.wageCap += WAGE_STEP;
  } else {
    myClub().budget += BUDGET_STEP;
    gameState.wageCap -= WAGE_STEP;
  }
}
export function hireScout(): string {
  myClub().budget -= scoutCost();
  gameState.scout++;
  return `Đã thuê trưởng bộ phận tuyển trạch ${gameState.scout} sao (${formatMoney(scoutCost())} cho lần nâng cấp tới).`;
}
export function quitNego(id: string): void {
  const negotiation = getNegotiation(id);
  if (!negotiation) return;
  negotiation.stage = "failed";
  negotiation.message = "Bạn đứng dậy khỏi bàn đàm phán. Thương vụ khép lại.";
  negotiation.log.push({ author: "me", text: negotiation.message, tickAt: tick() });
}
export function renamePlayer(playerId: string, name: string): void {
  const trimmedName = name.trim();
  if (trimmedName) getPlayer(playerId).name = trimmedName;
}
export function renameClub(clubId: string, name: string): void {
  const trimmedName = name.trim();
  if (trimmedName) getClub(clubId).name = trimmedName;
}
export function renameLeague(leagueId: string, name: string): void {
  const trimmedName = name.trim();
  if (trimmedName) gameState.leagueNames[leagueId] = trimmedName;
}
export function readMessage(id: string): void {
  const message = gameState.inbox.find((item) => item.id === id);
  if (message) message.read = true;
}
export function readAll(): void {
  gameState.inbox.forEach((message) => (message.read = true));
}

// ---------- bộ chọn dùng cho UI ----------
export const isClosed = (negotiation: Negotiation): boolean =>
  negotiation.stage === "done" || negotiation.stage === "failed";
/** Thương vụ đang chờ bạn ra quyết định */
export const negotiationNeedsAction = (negotiation: Negotiation): boolean =>
  !isClosed(negotiation) &&
  !negotiation.waiting &&
  negotiation.stage !== "enquiry" &&
  negotiation.stage !== "dof" &&
  (!!negotiation.isBuyOffer ||
    negotiation.type === "renew" ||
    (!!negotiation.isSellOffer && negotiation.stage === "offer"));

export function stageText(negotiation: Negotiation): string {
  if (negotiation.isSellOffer && negotiation.stage === "offer")
    return negotiation.type === "loanout"
      ? `${getClub(negotiation.buyer!).name} muốn mượn · ${negotiation.percent}% lương`
      : `${getClub(negotiation.buyer!).name} trả ${formatMoney(negotiation.fee || 0)}`;
  if (negotiation.type === "renew")
    return negotiation.stage === "final"
      ? "Đồng ý gia hạn, chờ bạn ký"
      : negotiation.stage === "done"
        ? "Hoàn tất"
        : negotiation.stage === "failed"
          ? "Đổ vỡ"
          : "Đàm phán gia hạn";
  const toastByKey: Record<string, string> = {
    enquiry: "Đang chờ phản hồi thăm dò",
    dof: "Giám đốc thể thao đang đàm phán",
    club: negotiation.waiting
      ? "Chờ CLB phản hồi"
      : negotiation.type === "loan"
        ? "Đàm phán mượn"
        : "Đàm phán với CLB",
    contract: negotiation.waiting ? "Chờ người đại diện" : "Đàm phán hợp đồng",
    final: negotiation.twist ? "CLB khác nhảy vào!" : "Chờ bạn chốt",
    done: "Hoàn tất",
    failed: "Đổ vỡ",
  };
  return toastByKey[negotiation.stage] || negotiation.stage;
}

/** Nhận lời mời dẫn dắt CLB khác; chuyển sang khi mùa mới bắt đầu */
export const acceptJob = (clubId: string): string => acceptOffer(clubId);
export const declineJob = (clubId: string): void => declineOffer(clubId);
/** Sau khi bị sa thải: nhận ngay một CLB trong số các đội ngỏ lời */
export function takeNewJob(clubId: string): string {
  if (!gameState.sacked || !(gameState.offers ?? []).some((jobOffer) => jobOffer.clubId === clubId))
    return "Lời mời này không còn hiệu lực.";
  applyPending();
  switchClub(clubId);
  gameState.review = null;
  gameState.lineup = bestLineup(gameState.myClubId, gameState.form);
  setBoard();
  return `Bạn đã nhận ghế HLV trưởng ${getClub(clubId).name}`;
}
