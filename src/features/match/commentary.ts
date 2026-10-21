// liveSimời bình luận cho từng sự kiện trận đấu (chọn mẫu câu theo phút để cùng một sự kiện luôn ra cùng một câu).
import { getClub, getPlayer } from "@/engine/state";
import type { LiveSim, MatchEvent } from "@/engine/types";
import { shortName } from "@/utils/display";

export type EvKind =
  | "goal"
  | "pen"
  | "save"
  | "post"
  | "block"
  | "off"
  | "yellow"
  | "red"
  | "inj"
  | "var"
  | "sub"
  | "tac";

const playerShortName = (id?: string): string =>
  id && getPlayer(id) ? shortName(getPlayer(id).name) : "?";
const pick = <T>(options: readonly T[], seed: number): T =>
  options[Math.abs(seed) % options.length];

export function kindOf(event: MatchEvent): EvKind {
  if (event.goal) return event.isPenalty ? "pen" : "goal";
  if (event.varDisallowed) return "var";
  if (event.miss)
    return event.missKind === "save"
      ? "save"
      : event.missKind === "post"
        ? "post"
        : event.missKind === "block"
          ? "block"
          : "off";
  if (event.card) return event.isRedCard ? "red" : "yellow";
  if (event.injured) return "inj";
  if (event.subbedIn) return "sub";
  return "tac";
}

export const clockOf = (event: MatchEvent): string =>
  event.stoppageMinute ? `${event.minute}+${event.stoppageMinute}'` : `${event.minute}'`;

const GOAL = [
  (playerName: string, teamName: string) => `VÀO! ${playerName} ghi bàn cho ${teamName}`,
  (playerName: string, teamName: string) =>
    `${playerName} dứt điểm chính xác, ${teamName} vươn lên`,
  (playerName: string, teamName: string) =>
    `Bàn thắng! ${playerName} đưa bóng vào lưới cho ${teamName}`,
  (playerName: string, teamName: string) =>
    `${playerName} không bỏ lỡ, lưới rung lên cho ${teamName}`,
];
const SAVE = [
  (playerName: string, goalkeeperName: string) =>
    `${playerName} sút mạnh, ${goalkeeperName} bay người cản phá`,
  (playerName: string, goalkeeperName: string) =>
    `${goalkeeperName} xuất sắc cứu thua trước cú dứt điểm của ${playerName}`,
  (playerName: string, goalkeeperName: string) =>
    `${playerName} căng người sút, ${goalkeeperName} gạt bóng ra ngoài`,
];
const POST = [
  (playerName: string) => `${playerName} sút trúng xà ngang!`,
  (playerName: string) => `Cột dọc từ chối ${playerName}!`,
];
const BLOCK = [
  (playerName: string) => `${playerName} bị hậu vệ chặn đứng`,
  (playerName: string) => `${playerName} dứt điểm, bóng dội ra từ hàng thủ`,
];
const OFF_TARGET_LINES = [
  (playerName: string) => `${playerName} sút chệch cột`,
  (playerName: string) => `${playerName} dứt điểm, bóng bay vọt xà`,
  (playerName: string) => `${playerName} dứt điểm nhưng không trúng đích`,
];
const YELLOW = [
  (playerName: string) => `${playerName} nhận thẻ vàng`,
  (playerName: string) => `Trọng tài rút thẻ vàng cho ${playerName}`,
];

/** Câu bình luận cho sự kiện thứ i */
export function describe(liveSim: LiveSim, event: MatchEvent, i: number): string {
  const seed = event.minute + i;
  const team = getClub(liveSim.sides[event.side].club).name;
  const kind = kindOf(event);
  switch (kind) {
    case "goal":
      return (
        pick(GOAL, seed)(playerShortName(event.goal), team) +
        (event.assist ? ` (kiến tạo: ${playerShortName(event.assist)})` : "")
      );
    case "pen":
      return `PENALTY! ${playerShortName(event.goal)} sút thành bàn cho ${team}`;
    case "save":
      return event.isPenalty
        ? `Penalty của ${playerShortName(event.miss)} bị thủ môn cản phá!`
        : pick(SAVE, seed)(
            playerShortName(event.miss),
            event.goalkeeper ? playerShortName(event.goalkeeper) : "thủ môn",
          );
    case "post":
      return pick(POST, seed)(playerShortName(event.miss));
    case "block":
      return pick(BLOCK, seed)(playerShortName(event.miss));
    case "off":
      return event.isPenalty
        ? `${playerShortName(event.miss)} đá hỏng penalty!`
        : pick(OFF_TARGET_LINES, seed)(playerShortName(event.miss));
    case "yellow":
      return pick(YELLOW, seed)(playerShortName(event.card));
    case "red":
      return event.isSecondYellow
        ? `${playerShortName(event.card)} nhận thẻ vàng thứ hai và bị đuổi khỏi sân`
        : `Thẻ đỏ trực tiếp! ${playerShortName(event.card)} rời sân`;
    case "inj":
      return `${playerShortName(event.injured)} dính chấn thương (${event.days} ngày)`;
    case "var":
      return `VAR vào cuộc, bàn thắng của ${playerShortName(event.varDisallowed)} bị hủy`;
    case "sub":
      return `${team} thay người: ${playerShortName(event.subbedIn)} vào, ${playerShortName(event.subbedOut)} ra`;
    default:
      return `${team} chuyển sang ${event.tacticChange}`;
  }
}

/** Dòng ghi bàn gọn dưới tỷ số: "Saka 23', 67' (P)" */
export function scorers(liveSim: LiveSim, sideIndex: 0 | 1, tick: number): string {
  const goalsByPlayer = new Map<string, string[]>();
  liveSim.events.forEach((event) => {
    if (
      !event.goal ||
      event.side !== sideIndex ||
      liveSim.ticks.findIndex(
        ([minute, stoppageMinute]) =>
          minute === event.minute && stoppageMinute === (event.stoppageMinute ?? 0),
      ) +
        1 >
        tick
    )
      return;
    goalsByPlayer.set(event.goal, [
      ...(goalsByPlayer.get(event.goal) ?? []),
      clockOf(event) + (event.isPenalty ? " (P)" : ""),
    ]);
  });
  return [...goalsByPlayer]
    .map(([id, goalsList]) => `${playerShortName(id)} ${goalsList.join(", ")}`)
    .join(" · ");
}
