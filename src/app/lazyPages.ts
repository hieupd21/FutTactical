// Màn hình nạp theo yêu cầu để chunk đầu nhẹ; sau khi vào game thì nạp sẵn lúc rảnh để vẫn mở được khi mất mạng.
import { lazy } from "react";

const loaders = {
  market: () =>
    import("@/features/market/MarketPage").then((loadedModule) => ({
      default: loadedModule.MarketPage,
    })),
  calendar: () =>
    import("@/features/calendar/CalendarPage").then((loadedModule) => ({
      default: loadedModule.CalendarPage,
    })),
  league: () =>
    import("@/features/league/LeaguePage").then((loadedModule) => ({
      default: loadedModule.LeaguePage,
    })),
  club: () =>
    import("@/features/club/ClubPage").then((loadedModule) => ({ default: loadedModule.ClubPage })),
  nego: () =>
    import("@/features/negotiation/NegoSheet").then((loadedModule) => ({
      default: loadedModule.NegoSheet,
    })),
  match: () =>
    import("@/features/match/MatchSheet").then((loadedModule) => ({
      default: loadedModule.MatchSheet,
    })),
};

export const MarketPage = lazy(loaders.market);
export const CalendarPage = lazy(loaders.calendar);
export const LeaguePage = lazy(loaders.league);
export const ClubPage = lazy(loaders.club);
export const NegoSheet = lazy(loaders.nego);
export const MatchSheet = lazy(loaders.match);

/** Nạp trước mọi chunk khi trình duyệt rảnh */
export function prefetchPages(): void {
  const preloadAll = () =>
    Object.values(loaders).forEach((load) => void load().catch(() => undefined));
  if ("requestIdleCallback" in window) window.requestIdleCallback(preloadAll);
  else setTimeout(preloadAll, 1500);
}
