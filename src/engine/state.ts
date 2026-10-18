// Trạng thái game đang chạy. Engine thao tác trực tiếp trên S (mutable) — tầng React đăng ký lắng nghe qua store.
import { DEADLINE_HOURS, FICT_LEAGUES, MATCH0, MATCH_GAP, WIN_SUMMER, WIN_WINTER } from "./constants";
import type { Club, GameState, InboxMessage, League, Negotiation, NewsItem, Player, TransferWindow } from "./types";

export let S: GameState = null as unknown as GameState;
export let LEAGUES: League[] = FICT_LEAGUES;

export function setState(s: GameState | null): void {
  S = s as GameState;
  LEAGUES = s && s.leagueMeta ? s.leagueMeta : FICT_LEAGUES;
}
export function setLeagues(l: League[]): void {
  LEAGUES = l;
}
export const hasGame = (): boolean => !!S;

export const LG = (id: string): League => LEAGUES.find((l) => l.id === id) as League;
export const simLeagues = (): League[] => LEAGUES.filter((l) => l.sim !== false);
export const lgName = (id: string): string => (S && S.lgN && S.lgN[id]) || LG(id).n;

export const P = (id: string): Player => S.P[id];
export const C = (id: string): Club => S.clubs[id];
export const me = (): Club => S.clubs[S.me];
export const myLg = (): string => me().lg;
export const N = (id: string): Negotiation | undefined => S.negos.find((n) => n.id === id);

// ---------- lịch ----------
export function dateOf(d: number): Date {
  const x = new Date(S.year, 6, 1);
  x.setDate(x.getDate() + d);
  return x;
}
export function windowNow(d: number = S.d): TransferWindow {
  if (d >= WIN_SUMMER[0] && d <= WIN_SUMMER[1]) return "summer";
  if (d >= WIN_WINTER[0] && d <= WIN_WINTER[1]) return "winter";
  return null;
}
export const isDeadline = (d: number = S.d): boolean => d === WIN_SUMMER[1] || d === WIN_WINTER[1];
export const deadlineOver = (): boolean => S.h >= 9 + DEADLINE_HOURS;
/** Thời điểm tuyệt đối trong mùa, tính bằng giờ */
export const tick = (): number => S.d * 24 + S.h;
export function roundOn(d: number, lg: string): number {
  if (!S.fx[lg]) return -1;
  const r = (d - MATCH0) / MATCH_GAP;
  return Number.isInteger(r) && r >= 0 && r < S.fx[lg].length ? r : -1;
}

// ---------- tin tức & hộp thư ----------
export function news(t: string, k: NewsItem["k"] = "gen"): void {
  S.news.unshift({ t, k, d: S.d, y: S.year });
  S.news = S.news.slice(0, 80);
}
export function inbox(m: Omit<InboxMessage, "id" | "d" | "h" | "y" | "read">): InboxMessage {
  const full: InboxMessage = { ...m, id: "m" + S.nnid++, d: S.d, h: S.h, y: S.year, read: false };
  S.inbox.unshift(full);
  S.inbox = S.inbox.slice(0, 60);
  S.stopFlag = true;
  return full;
}
