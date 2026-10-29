import { ChevronLeft, ChevronRight, Newspaper } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { gameState } from "@/engine/state";
import { classNames, formatShortDate } from "@/utils/display";
import { NEWS_KIND_LABEL } from "./newsKinds";

const CAROUSEL_NEWS_COUNT = 5;
const AUTO_ADVANCE_MS = 7000;

/** Khối phải: carousel 5 tin mới nhất, tự chuyển sau vài giây và dừng khi rê chuột */
export function NewsCarousel() {
  const latestNews = gameState.news.slice(0, CAROUSEL_NEWS_COUNT);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const newsCount = latestNews.length;
  const shownIndex = Math.min(activeIndex, Math.max(newsCount - 1, 0));
  const showNext = () => setActiveIndex((shownIndex + 1) % newsCount);
  const showPrevious = () => setActiveIndex((shownIndex - 1 + newsCount) % newsCount);

  useEffect(() => {
    if (newsCount < 2 || isPaused || prefersReducedMotion) return;
    const timerId = window.setTimeout(
      () => setActiveIndex((shownIndex + 1) % newsCount),
      AUTO_ADVANCE_MS,
    );
    return () => window.clearTimeout(timerId);
  }, [newsCount, shownIndex, isPaused, prefersReducedMotion]);

  if (!newsCount)
    return (
      <section className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-white/20 bg-card/40 p-6 text-center text-muted-foreground shadow-lg backdrop-blur-xl">
        <Newspaper className="size-10" aria-hidden />
        <p className="m-0">Chưa có tin nào. Tiếp tục để thế giới chuyển động.</p>
      </section>
    );

  const shownNews = latestNews[shownIndex];
  const slideOffsetX = prefersReducedMotion ? 0 : 24;
  return (
    <section
      aria-label="Tin mới nhất"
      aria-roledescription="carousel"
      className="flex min-w-0 flex-col gap-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative flex min-h-80 flex-col overflow-hidden rounded-2xl border border-white/20 bg-card/40 shadow-lg backdrop-blur-xl lg:min-h-96">
        <AnimatePresence mode="wait" initial={false}>
          <m.article
            key={shownIndex}
            className="flex flex-1 flex-col justify-between gap-6 p-6"
            initial={{ opacity: 0, x: slideOffsetX }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -slideOffsetX }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-(--accent)">
                {NEWS_KIND_LABEL[shownNews.kind]}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatShortDate(shownNews.day)}
              </span>
            </header>
            <p className="m-0 font-(family-name:--f-display) text-2xl leading-snug font-extrabold text-balance">
              {shownNews.text}
            </p>
            <span className="text-sm text-muted-foreground tabular-nums">
              {shownIndex + 1} / {newsCount}
            </span>
          </m.article>
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Tin trước"
          onClick={showPrevious}
          className="grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex items-center gap-2">
          {latestNews.map((_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              aria-label={`Tin ${dotIndex + 1}`}
              aria-current={dotIndex === shownIndex}
              onClick={() => setActiveIndex(dotIndex)}
              className={classNames(
                "h-2 cursor-pointer rounded-full border-0 p-0 transition-all",
                dotIndex === shownIndex ? "w-5 bg-(--accent)" : "w-2 bg-foreground/30",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Tin sau"
          onClick={showNext}
          className="grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </section>
  );
}
