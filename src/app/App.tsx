import { useEffect } from "react";
import { tabLabel, TopNav } from "@/components/AppChrome";
import { Toaster } from "@/components/shadcn/sonner";
import { StartScreen } from "@/features/start/StartScreen";
import { useGame } from "@/stores/gameStore";
import { useUi } from "@/stores/uiStore";
import { AnimatedTabs } from "./AnimatedTabs";
import { prefetchPages } from "./lazyPages";
import { SheetHost } from "./SheetHost";
import { useBackNavigation } from "./useBackNavigation";
import { Preloader } from "@/components/Preloader";

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
      <div aria-hidden="true" className="career-backdrop" />
      <div className="relative mx-auto flex h-full max-w-270 flex-col gap-6 overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        {status === "ready" && <TopNav />}
        <main className="flex min-h-0 flex-1 flex-col gap-3.5">
          {status === "loading" && <Preloader />}
          {status === "none" && <StartScreen />}
          {status === "ready" && (
            <>
              <h1 className="sr-only">{tabLabel(currentTab)}</h1>
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
