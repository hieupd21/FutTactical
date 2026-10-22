import { useEffect } from "react";
import { BottomNav, Header, TABS } from "@/components/AppChrome";
import { Toaster } from "@/components/shadcn/sonner";
import { StartScreen } from "@/features/start/StartScreen";
import { useGame } from "@/stores/gameStore";
import { useUi } from "@/stores/uiStore";
import { AnimatedTabs } from "./AnimatedTabs";
import { prefetchPages } from "./lazyPages";
import { SheetHost } from "./SheetHost";
import { useBackNavigation } from "./useBackNavigation";
import { Card } from "@/components/shadcn/card";

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
      <div className="wrap">
        <Header />
        <main className="col" style={{ gap: 14 }}>
          {status === "loading" && (
            <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
              <p className="hint">Đang tải sự nghiệp…</p>
            </Card>
          )}
          {status === "none" && <StartScreen />}
          {status === "ready" && (
            <>
              <h1 className="sr-only">
                {TABS.find((tabItem) => tabItem.tab === currentTab)?.label}
              </h1>
              <AnimatedTabs />
            </>
          )}
        </main>
      </div>
      {status === "ready" && (
        <>
          <BottomNav />
          <SheetHost />
        </>
      )}
      <Toaster
        position="bottom-center"
        offset={{ bottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}
      />
    </>
  );
}
