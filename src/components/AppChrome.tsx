// Thanh điều hướng trên cùng.
import { negotiationNeedsAction } from "@/engine/actions";
import { agentLetters } from "@/engine/transfers";
import { gameState, myClub } from "@/engine/state";
import { useGameVersion } from "@/stores/gameStore";
import { type TabKey, useUi } from "@/stores/uiStore";
import { classNames } from "@/utils/display";
import { ClubBadge } from "./ClubBadge";

export const TABS = [
  { tab: "home", label: "Trang chủ" },
  { tab: "squad", label: "Đội hình" },
  { tab: "market", label: "Chuyển nhượng" },
  { tab: "calendar", label: "Lịch thi đấu" },
  { tab: "club", label: "Câu lạc bộ" },
] as const satisfies readonly { tab: TabKey; label: string }[];

export function TopNav() {
  useGameVersion();
  const currentTab = useUi((ui) => ui.currentTab);
  const unreadMessages = gameState.inbox.filter((message) => !message.read).length;
  const pendingMarketActions =
    gameState.negos.filter(negotiationNeedsAction).length + agentLetters().length;
  return (
    <nav
      aria-label="Điều hướng chính"
      className="sticky top-[env(safe-area-inset-top,0px)] z-8 flex items-center gap-2 border-b border-foreground/15 bg-background/70 backdrop-blur-xl"
    >
      <ul className="m-0 flex min-w-0 flex-1 list-none items-center gap-1 overflow-x-auto p-0 scrollbar-none">
        {TABS.map((tabItem) => {
          const isActive = currentTab === tabItem.tab;
          const badgeCount =
            tabItem.tab === "club"
              ? unreadMessages
              : tabItem.tab === "market"
                ? pendingMarketActions
                : 0;
          return (
            <li key={tabItem.tab} className="shrink-0">
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  useUi.setState({ sheet: null, swapIn: null });
                  useUi.getState().setTab(tabItem.tab);
                  window.scrollTo(0, 0);
                }}
                className={classNames(
                  "relative flex min-h-12 cursor-pointer items-center border-0 bg-transparent px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                  isActive ? "text-(--accent)" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tabItem.label}
                {badgeCount > 0 && (
                  <span className="absolute top-1.5 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-foreground px-1 font-(family-name:--f-mono) text-[11px] text-background">
                    {badgeCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="hidden shrink-0 items-center gap-2 pr-2 md:flex">
        <ClubBadge name={myClub().name} size={28} />
        <b className="max-w-40 truncate text-sm">{myClub().name}</b>
      </div>
    </nav>
  );
}
