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
  const tab = useUi((s) => s.tab);
  const reduce = useReducedMotion();
  const dy = reduce ? 0 : 10;

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={tab}
          className="col"
          style={{ gap: 14 }}
          initial={{ opacity: 0, y: dy }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -dy }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {PAGES[tab]}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
