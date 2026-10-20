import { useEffect } from "react";
import { BottomNav, Header, TABS } from "@/components/AppChrome";
import { Toaster } from "@/components/shadcn/sonner";
import { StartScreen } from "@/features/start/StartScreen";
import { useImages } from "@/lib/images";
import { useGame } from "@/stores/gameStore";
import { useUi } from "@/stores/uiStore";
import { AnimatedTabs } from "./AnimatedTabs";
import { prefetchPages } from "./lazyPages";
import { SheetHost } from "./SheetHost";
import { useBackNavigation } from "./useBackNavigation";
import { Card } from "@/components/shadcn/card";

export function App() {
  const status = useGame((s) => s.status);
  const tab = useUi((s) => s.tab);
  useBackNavigation();
  useEffect(() => {
    void useGame.getState().boot();
    void useImages.getState().load();
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
              <h1 className="sr-only">{TABS.find((t) => t.k === tab)?.l}</h1>
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
      <Toaster position="bottom-center" offset={{ bottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }} />
    </>
  );
}
