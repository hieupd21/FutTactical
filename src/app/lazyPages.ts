// Màn hình nạp theo yêu cầu để chunk đầu nhẹ; sau khi vào game thì nạp sẵn lúc rảnh để vẫn mở được khi mất mạng.
import { lazy } from "react";

const loaders = {
  market: () => import("@/features/market/MarketPage").then((m) => ({ default: m.MarketPage })),
  league: () => import("@/features/league/LeaguePage").then((m) => ({ default: m.LeaguePage })),
  club: () => import("@/features/club/ClubPage").then((m) => ({ default: m.ClubPage })),
  nego: () => import("@/features/negotiation/NegoSheet").then((m) => ({ default: m.NegoSheet })),
  match: () => import("@/features/match/MatchSheet").then((m) => ({ default: m.MatchSheet })),
};

export const MarketPage = lazy(loaders.market);
export const LeaguePage = lazy(loaders.league);
export const ClubPage = lazy(loaders.club);
export const NegoSheet = lazy(loaders.nego);
export const MatchSheet = lazy(loaders.match);

/** Nạp trước mọi chunk khi trình duyệt rảnh */
export function prefetchPages(): void {
  const run = () => Object.values(loaders).forEach((load) => void load().catch(() => undefined));
  if ("requestIdleCallback" in window) window.requestIdleCallback(run);
  else setTimeout(run, 1500);
}
