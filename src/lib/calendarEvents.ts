import { ArrowLeftRight, Clock, Flag, Lock, type LucideIcon } from "lucide-react";
import { DEADLINE_HOURS, REVIEW_DAY, SEASON_LEN } from "@/engine/constants";
import { getClub, gameState, isDeadline, myLeagueId, roundOn, windowNow } from "@/engine/state";

export type CalendarEvent =
  | { kind: "match"; day: number; round: number; opponent: string; home: boolean }
  | { kind: "mark"; day: number; icon: LucideIcon; title: string; subtitle: string };

/** Các sự kiện trong một ngày: trận của CLB mình, mở/đóng kỳ chuyển nhượng, Deadline Day, tổng kết mùa */
export function eventsOnDay(day: number): CalendarEvent[] {
  if (day < gameState.day || day >= SEASON_LEN) return [];
  const leagueId = myLeagueId();
  const events: CalendarEvent[] = [];
  const transferWindow = windowNow(day);
  if (day > gameState.day) {
    if (transferWindow && !windowNow(day - 1))
      events.push({
        kind: "mark",
        day,
        icon: ArrowLeftRight,
        title: "Mở kỳ chuyển nhượng",
        subtitle: transferWindow === "summer" ? "Kỳ hè" : "Kỳ đông",
      });
    if (isDeadline(day) && transferWindow)
      events.push({
        kind: "mark",
        day,
        icon: Clock,
        title: "Deadline Day",
        subtitle: `${DEADLINE_HOURS} giờ cuối`,
      });
    if (!transferWindow && windowNow(day - 1) && !isDeadline(day - 1))
      events.push({
        kind: "mark",
        day,
        icon: Lock,
        title: "Đóng kỳ chuyển nhượng",
        subtitle: "Hết hạn",
      });
    if (day === REVIEW_DAY)
      events.push({
        kind: "mark",
        day,
        icon: Flag,
        title: "Tổng kết mùa",
        subtitle: "Đánh giá của ban lãnh đạo",
      });
  }
  if (day > gameState.day || gameState.matchToday) {
    const round = roundOn(day, leagueId);
    const fixture =
      round >= 0
        ? gameState.fixtures[leagueId][round].find((fixtureClubIds) =>
            fixtureClubIds.includes(gameState.myClubId),
          )
        : undefined;
    if (fixture)
      events.push({
        kind: "match",
        day,
        round,
        opponent: getClub(fixture[0] === gameState.myClubId ? fixture[1] : fixture[0]).name,
        home: fixture[0] === gameState.myClubId,
      });
  }
  return events;
}

/** Ngày gần nhất (kể cả hôm nay nếu có trận) còn sự kiện, kèm các sự kiện của ngày đó */
export function nextEventDay(): { day: number; events: CalendarEvent[] } | null {
  for (let day = gameState.day; day < SEASON_LEN; day++) {
    const events = eventsOnDay(day);
    if (events.length) return { day, events };
  }
  return null;
}

export interface MyMatchOnDay {
  opponentName: string;
  isHome: boolean;
  /** có khi trận đã diễn ra */
  result: { ownGoals: number; opponentGoals: number; outcome: "W" | "D" | "L" } | null;
}

/** Trận của CLB bạn vào ngày đó trong mùa hiện tại, kể cả trận đã đá (kèm tỷ số) */
export function myMatchOnDay(day: number): MyMatchOnDay | null {
  if (day < 0 || day >= SEASON_LEN) return null;
  const leagueId = myLeagueId();
  const round = roundOn(day, leagueId);
  if (round < 0) return null;
  const fixture = gameState.fixtures[leagueId][round].find((fixtureClubIds) =>
    fixtureClubIds.includes(gameState.myClubId),
  );
  if (!fixture) return null;
  const isHome = fixture[0] === gameState.myClubId;
  const matchResult = gameState.results[leagueId]?.[round]?.find(
    (roundResult) => roundResult.homeId === fixture[0] && roundResult.awayId === fixture[1],
  );
  const ownGoals = matchResult ? (isHome ? matchResult.homeGoals : matchResult.awayGoals) : 0;
  const opponentGoals = matchResult ? (isHome ? matchResult.awayGoals : matchResult.homeGoals) : 0;
  return {
    opponentName: getClub(isHome ? fixture[1] : fixture[0]).name,
    isHome,
    result: matchResult
      ? {
          ownGoals,
          opponentGoals,
          outcome: ownGoals > opponentGoals ? "W" : ownGoals < opponentGoals ? "L" : "D",
        }
      : null,
  };
}
