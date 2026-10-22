// Trạng thái game đang chạy. Engine thao tác trực tiếp trên S (mutable) — tầng React đăng ký lắng nghe qua store.
import { FIRST_MATCH_DAY, MATCH_GAP, MAX_WEEKLY, SUMMER_WINDOW, WINTER_WINDOW } from "./constants";
import type {
  Club,
  GameState,
  InboxKind,
  InboxMessage,
  League,
  Negotiation,
  NewsItem,
  Player,
  TransferWindow,
} from "./types";

export let gameState: GameState = null as unknown as GameState;
export let LEAGUES: League[] = [];

export function setState(state: GameState | null): void {
  gameState = state as GameState;
  LEAGUES = state?.leagueMeta ?? [];
}
export function setLeagues(leagues: League[]): void {
  LEAGUES = leagues;
}

export const getLeague = (id: string): League =>
  LEAGUES.find((league) => league.id === id) as League;
export const simLeagues = (): League[] => LEAGUES.filter((league) => league.isSimulated !== false);
export const leagueName = (id: string): string =>
  (gameState && gameState.leagueNames && gameState.leagueNames[id]) || getLeague(id).name;

export const getPlayer = (id: string): Player => gameState.players[id];
export const getClub = (id: string): Club => gameState.clubs[id];
export const myClub = (): Club => gameState.clubs[gameState.myClubId];
export const myLeagueId = (): string => myClub().leagueId;
export const getNegotiation = (id: string): Negotiation | undefined =>
  gameState.negos.find((negotiation) => negotiation.id === id);

// ---------- lịch ----------
export function dateOf(day: number): Date {
  const date = new Date(gameState.year, 6, 1);
  date.setDate(date.getDate() + day);
  return date;
}
export function windowNow(day: number = gameState.day): TransferWindow {
  if (day >= SUMMER_WINDOW[0] && day <= SUMMER_WINDOW[1]) return "summer";
  if (day >= WINTER_WINDOW[0] && day <= WINTER_WINDOW[1]) return "winter";
  return null;
}
export const isDeadline = (day: number = gameState.day): boolean =>
  day === SUMMER_WINDOW[1] || day === WINTER_WINDOW[1];
/** Thời điểm tuyệt đối trong mùa, tính bằng giờ */
export const tick = (): number => gameState.day * 24 + gameState.hour;
/** Ngày đá của vòng r trong giải có `total` vòng. Mỗi tuần một vòng; giải quá dài (trên MAX_WEEKLY vòng) dồn lịch để vẫn kết thúc trước ngày tổng kết */
export function roundDay(round: number, total: number): number {
  if (total <= MAX_WEEKLY) return FIRST_MATCH_DAY + round * MATCH_GAP;
  return FIRST_MATCH_DAY + Math.floor((round * (MAX_WEEKLY - 1) * MATCH_GAP) / (total - 1));
}
export function roundOn(day: number, leagueId: string): number {
  if (!gameState.fixtures[leagueId]) return -1;
  const total = gameState.fixtures[leagueId].length;
  if (total <= MAX_WEEKLY) {
    const round = (day - FIRST_MATCH_DAY) / MATCH_GAP;
    return Number.isInteger(round) && round >= 0 && round < total ? round : -1;
  }
  const round = Math.round(
    ((day - FIRST_MATCH_DAY) * (total - 1)) / ((MAX_WEEKLY - 1) * MATCH_GAP),
  );
  return round >= 0 && round < total && roundDay(round, total) === day ? round : -1;
}

// ---------- tin tức & hộp thư ----------
export function news(text: string, kind: NewsItem["kind"] = "gen"): void {
  gameState.news.unshift({ text, kind, day: gameState.day, year: gameState.year });
  gameState.news = gameState.news.slice(0, 400);
}
export function inbox(
  message: Omit<InboxMessage, "id" | "day" | "hour" | "year" | "read" | "kind"> & {
    kind: InboxKind;
  },
): InboxMessage {
  const full: InboxMessage = {
    ...message,
    id: "m" + gameState.nextRecordNumber++,
    day: gameState.day,
    hour: gameState.hour,
    year: gameState.year,
    read: false,
  };
  gameState.inbox.unshift(full);
  gameState.inbox = gameState.inbox.slice(0, 60);
  gameState.stopFlag = true;
  return full;
}
