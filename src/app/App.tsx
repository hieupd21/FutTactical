import { useEffect } from "react";
import { TABS, TopNav } from "@/components/AppChrome";
import { Toaster } from "@/components/shadcn/sonner";
import { StartScreen } from "@/features/start/StartScreen";
import { useGame } from "@/stores/gameStore";
import { type TabKey, useUi } from "@/stores/uiStore";
import { classNames } from "@/utils/display";
import { AnimatedTabs } from "./AnimatedTabs";
import { prefetchPages } from "./lazyPages";
import { SheetHost } from "./SheetHost";
import { useBackNavigation } from "./useBackNavigation";
import { Preloader } from "@/components/Preloader";

const GRADIENT_TABS: TabKey[] = ["home", "squad", "calendar"];

export function App() {
  const status = useGame((store) => store.status);
  const currentTab = useUi((ui) => ui.currentTab);
  useBackNavigation();
  useEffect(() => {
    void useGame.getState().boot();
  }, []);
  useEffect(() => {
    if (status === "ready") prefetchPages();
  }, [status]);

  return (
    <>
      <div
        aria-hidden="true"
        className={classNames(
          "fixed inset-0 -z-10 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--info)_35%,var(--bg)),var(--bg)_45%,color-mix(in_srgb,var(--pitch)_45%,var(--bg)))] transition-opacity duration-300",
          GRADIENT_TABS.includes(currentTab) ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="mx-auto flex max-w-270 flex-col gap-6 pt-[env(safe-area-inset-top,0px)]">
        {status === "ready" && <TopNav />}
        <main className="flex flex-col gap-3.5">
          {status === "loading" && <Preloader />}
          {status === "none" && <StartScreen />}
          {status === "ready" && (
            <>
              <h1 className="sr-only">
                {TABS.find((tabItem) => tabItem.tab === currentTab)?.label ?? "Giải đấu"}
              </h1>
              <AnimatedTabs />
            </>
          )}
        </main>
      </div>
      {status === "ready" && (
        <>
          <SheetHost />
        </>
      )}
      <Toaster
        position="bottom-center"
        offset={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
      />
    </>
  );
}
