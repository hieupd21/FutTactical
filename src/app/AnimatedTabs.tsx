import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import { type ReactNode, Suspense } from "react";
import { HomePage } from "@/features/home/HomePage";
import { SquadPage } from "@/features/squad/SquadPage";
import { type TabKey, useUi } from "@/stores/uiStore";
import { ClubPage, LeaguePage, MarketPage } from "./lazyPages";

const PAGES: Record<TabKey, ReactNode> = {
  home: <HomePage />,
  squad: <SquadPage />,
  market: (
    <Suspense fallback={null}>
      <MarketPage />
    </Suspense>
  ),
  league: (
    <Suspense fallback={null}>
      <LeaguePage />
    </Suspense>
  ),
  club: (
    <Suspense fallback={null}>
      <ClubPage />
    </Suspense>
  ),
};

export function AnimatedTabs() {
  const currentTab = useUi((ui) => ui.currentTab);
  const reduce = useReducedMotion();
  const offsetY = reduce ? 0 : 10;

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={currentTab}
          className="col"
          style={{ gap: 14 }}
          initial={{ opacity: 0, y: offsetY }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -offsetY }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {PAGES[currentTab]}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
