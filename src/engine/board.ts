import { sackedOffers } from "./career";
import { formatMoney, formatWage } from "./format";
import { clubPlayers, clubStrength, myLeaguePosition } from "./squad";
import { myClub, myLeagueId, news, gameState } from "./state";
import type { BoardObjective } from "./types";
import { clamp } from "./util";

export function setBoard(): void {
  const clubs = Object.values(gameState.clubs)
    .filter((club) => club.leagueId === myLeagueId())
    .sort((clubA, clubB) => clubStrength(clubB.id).power - clubStrength(clubA.id).power);
  const expectedPosition = clubs.findIndex((club) => club.id === gameState.myClubId) + 1;
  const target = clamp(expectedPosition + 2, 1, clubs.length - 3);
  gameState.board = {
    target,
    objectives: [
      {
        kind: "pos",
        label: target === 1 ? "Vô địch quốc gia" : `Cán đích trong top ${target}`,
        importance: "Rất quan trọng",
      },
      { kind: "wage", label: "Không để tổng lương vượt quỹ lương", importance: "Quan trọng" },
      {
        kind: "youth",
        label: "Cầu thủ U21 ra sân tổng cộng 15 trận",
        importance: "Trung bình",
        target: 15,
      },
      {
        kind: "sell",
        label: "Không lỗ quá 30% ngân sách chuyển nhượng đầu mùa",
        importance: "Trung bình",
        start: myClub().budget,
      },
    ],
  };
}
export const myWages = (): number =>
  clubPlayers(gameState.myClubId).reduce(
    (total, player) =>
      total +
      (player.loan ? (player.contract!.wage * player.loan.percent) / 100 : player.contract!.wage),
    0,
  );
export const youthApps = (): number =>
  clubPlayers(gameState.myClubId)
    .filter((player) => player.age <= 21)
    .reduce((total, player) => total + player.apps, 0);

export function objectiveStatus(objective: BoardObjective): {
  ok: boolean;
  text: string;
  pending?: boolean;
} {
  if (objective.kind === "pos") {
    if (!(gameState.results[myLeagueId()] || []).some(Boolean))
      return { ok: true, pending: true, text: "Mùa giải chưa bắt đầu" };
    const position = myLeaguePosition();
    return { ok: position <= gameState.board.target, text: `Đang xếp thứ ${position}` };
  }
  if (objective.kind === "wage") {
    const wages = myWages();
    return {
      ok: wages <= gameState.wageCap,
      text: `${formatWage(wages)} / ${formatWage(gameState.wageCap)}`,
    };
  }
  if (objective.kind === "youth") {
    const youthAppearances = youthApps();
    return {
      ok: youthAppearances >= (objective.target || 0),
      text: `${youthAppearances}/${objective.target} trận`,
    };
  }
  const ok = myClub().budget >= (objective.start || 0) * 0.7;
  return {
    ok,
    text: `Còn ${formatMoney(myClub().budget)} / đầu mùa ${formatMoney(objective.start || 0)}`,
  };
}
export function sack(reason: string): void {
  gameState.sacked = reason;
  news("Bạn bị sa thải. " + reason, "club");
  sackedOffers();
}
