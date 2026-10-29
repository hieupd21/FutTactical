import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import { type ReactNode, Suspense } from "react";
import { HomePage } from "@/features/home/HomePage";
import { NotificationsPage } from "@/features/club/NotificationsPage";
import { SquadPage } from "@/features/squad/SquadPage";
import { Preloader } from "@/components/Preloader";
import { type TabKey, useUi } from "@/stores/uiStore";
import { ClubHub } from "./ClubHub";
import { MarketPage } from "./lazyPages";

const PAGES: Record<TabKey, ReactNode> = {
  central: <HomePage />,
  notifications: <NotificationsPage />,
  squad: <SquadPage />,
  market: (
    <Suspense fallback={<Preloader />}>
      <MarketPage />
    </Suspense>
  ),
  club: (
    <Suspense fallback={<Preloader />}>
      <ClubHub />
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
          className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain scrollbar-thin"
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
