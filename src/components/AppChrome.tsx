// Thanh điều hướng trên cùng.
import { negotiationNeedsAction } from "@/engine/actions";
import { agentLetters } from "@/engine/transfers";
import { gameState } from "@/engine/state";
import { useGameVersion } from "@/stores/gameStore";
import { type TabKey, useUi } from "@/stores/uiStore";
import { classNames } from "@/utils/display";

export interface ScreenTab {
  tab: TabKey;
  label: string;
}
export interface Screen {
  screen: string;
  label: string;
  tabs: readonly ScreenTab[];
}

/** Mỗi màn hình có menu phụ riêng; `currentTab` là mục đang mở trong menu phụ đó. */
export const SCREENS: readonly Screen[] = [
  {
    screen: "home",
    label: "Trang chủ",
    tabs: [
      { tab: "central", label: "Trung tâm" },
      { tab: "notifications", label: "Thông báo" },
      { tab: "squad", label: "Đội hình" },
      { tab: "market", label: "Chuyển nhượng" },
      { tab: "club", label: "Câu lạc bộ" },
    ],
  },
];

export function screenOfTab(tab: TabKey): Screen {
  return (
    SCREENS.find((screen) => screen.tabs.some((screenTab) => screenTab.tab === tab)) ?? SCREENS[0]
  );
}

export function tabLabel(tab: TabKey): string {
  return screenOfTab(tab).tabs.find((screenTab) => screenTab.tab === tab)?.label ?? "";
}

function openTab(tab: TabKey): void {
  useUi.setState({ sheet: null, swapIn: null });
  useUi.getState().setTab(tab);
  useUi.getState().setClubView("hub");
  window.scrollTo(0, 0);
}

export function TopNav() {
  useGameVersion();
  const currentTab = useUi((ui) => ui.currentTab);
  const currentScreen = screenOfTab(currentTab);
  const badgeCounts: Partial<Record<TabKey, number>> = {
    notifications: gameState.inbox.filter((message) => !message.read).length,
    market: gameState.negos.filter(negotiationNeedsAction).length + agentLetters().length,
  };
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-8 flex flex-col border-b border-foreground/15">
      <nav aria-label={`Menu ${currentScreen.label}`}>
        <ul className="m-0 flex list-none items-center gap-1 overflow-x-auto p-0 px-1 scrollbar-none">
          {currentScreen.tabs.map((screenTab) => {
            const isActive = currentTab === screenTab.tab;
            const badgeCount = badgeCounts[screenTab.tab] ?? 0;
            return (
              <li key={screenTab.tab} className="shrink-0">
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => openTab(screenTab.tab)}
                  className={classNames(
                    "relative flex min-h-10 cursor-pointer items-center border-0 bg-transparent px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                    isActive ? "text-(--accent)" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {screenTab.label}
                  {badgeCount > 0 && (
                    <span className="absolute top-0.5 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-foreground px-1 font-(family-name:--f-mono) text-[11px] text-background">
                      {badgeCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
