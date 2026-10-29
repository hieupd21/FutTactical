import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dateOf } from "@/engine/state";
import { type MyMatchOnDay, myMatchOnDay } from "@/lib/calendarEvents";
import { MatchResultBadge } from "@/components/MatchResultBadge";
import { ClubBadge } from "@/components/ClubBadge";
import { classNames } from "@/utils/display";

const WEEKDAY_HEADERS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const GRID_CELL_COUNT = 42;
const TOTAL_TRAVEL_MS = 3400;
const MIN_STEP_MS = 50;
const MAX_STEP_MS = 420;
const START_DELAY_MS = 450; // chờ lịch mở xong rồi mới bắt đầu trượt
const HOLD_AFTER_ARRIVAL_MS = 900;

const dayKey = (date: Date): number =>
  date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate();

/** Trận của CLB bạn vào ngày đó (chỉ ngày thuộc mùa hiện tại mới có lịch) */
function findMatchOn(date: Date): MyMatchOnDay | null {
  const dayIndex = Math.round((date.getTime() - dateOf(0).getTime()) / 86_400_000);
  return myMatchOnDay(dayIndex);
}

/** Các ngày liên tiếp từ ngày xuất phát tới ngày đến (gồm cả hai đầu) */
function listDaysBetween(fromDate: Date, toDate: Date): Date[] {
  const days = [fromDate];
  let cursor = fromDate;
  while (dayKey(cursor) < dayKey(toDate) && days.length < 400) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    days.push(cursor);
  }
  return days;
}

function buildMonthCells(monthDate: Date): Date[] {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  return Array.from(
    { length: GRID_CELL_COUNT },
    (_, cellIndex) =>
      new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1 - leadingBlanks + cellIndex),
  );
}

/** Lớp phủ lịch: con trỏ trượt từ ngày hiện tại tới ngày mới rồi tự đóng */
export function AdvanceCalendar({
  fromDate,
  toDate,
  onDone,
}: {
  fromDate: Date;
  toDate: Date;
  onDone: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [travelDays] = useState(() => listDaysBetween(fromDate, toDate));
  const [isOpen, setIsOpen] = useState(true);
  const [stepIndex, setStepIndex] = useState(prefersReducedMotion ? travelDays.length - 1 : 0);
  const isArrived = stepIndex >= travelDays.length - 1;
  const cursorDate = travelDays[stepIndex];

  useEffect(() => {
    if (!isOpen) return;
    const stepMs = Math.min(
      MAX_STEP_MS,
      Math.max(MIN_STEP_MS, TOTAL_TRAVEL_MS / travelDays.length),
    );
    const waitMs = isArrived ? HOLD_AFTER_ARRIVAL_MS : stepIndex === 0 ? START_DELAY_MS : stepMs;
    const timerId = window.setTimeout(
      isArrived ? () => setIsOpen(false) : () => setStepIndex(stepIndex + 1),
      waitMs,
    );
    return () => window.clearTimeout(timerId);
  }, [stepIndex, isArrived, isOpen, travelDays.length]);

  const cells = buildMonthCells(cursorDate);
  const cursorKey = dayKey(cursorDate);
  const fadeDuration = prefersReducedMotion ? 0 : 0.35;
  return createPortal(
    <AnimatePresence onExitComplete={onDone}>
      {isOpen && (
        <m.div
          key="advance-calendar"
          role="dialog"
          aria-label="Lịch thời gian"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fadeDuration, ease: "easeOut" }}
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-md"
        >
          <m.div
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: fadeDuration, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-[90vh] w-[80vw] flex-col gap-4 rounded-3xl border border-white/20 bg-card/80 p-5 shadow-lg backdrop-blur-xl md:p-8"
          >
            <h2 className="m-0 text-center font-(family-name:--f-display) text-2xl font-extrabold md:text-4xl">
              Tháng {cursorDate.getMonth() + 1} · {cursorDate.getFullYear()}
            </h2>
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-1.5 text-center md:gap-2">
              {WEEKDAY_HEADERS.map((weekdayHeader) => (
                <span
                  key={weekdayHeader}
                  className="text-sm font-semibold text-muted-foreground md:text-base"
                >
                  {weekdayHeader}
                </span>
              ))}
              {cells.map((cellDate) => {
                const cellKey = dayKey(cellDate);
                if (cellDate.getMonth() !== cursorDate.getMonth())
                  return (
                    <div
                      key={cellKey}
                      aria-hidden="true"
                      className="rounded-lg bg-card/15 p-2 text-left text-lg font-extrabold leading-none text-muted-foreground/50 md:text-2xl"
                    >
                      {cellDate.getDate()}
                    </div>
                  );
                const isCursor = cellKey === cursorKey;
                const match = findMatchOn(cellDate);
                return (
                  <div
                    key={cellKey}
                    className={classNames(
                      "relative flex min-h-0 flex-col items-start justify-between rounded-lg border p-2 text-left shadow-sm transition-opacity duration-300",
                      match && "border-(--accent) bg-(--accent)/20",
                      !match && "border-white/20 bg-card/40",
                      cellKey < cursorKey && "opacity-45",
                    )}
                  >
                    {isCursor && (
                      <m.span
                        layoutId="advance-calendar-cursor"
                        transition={{ type: "spring", stiffness: 220, damping: 30 }}
                        className="pointer-events-none absolute -inset-0.5 z-10 rounded-xl ring-4 ring-foreground"
                      />
                    )}
                    <span className="text-lg leading-none font-extrabold tabular-nums md:text-2xl">
                      {cellDate.getDate()}
                    </span>
                    {match && (
                      <>
                        <span
                          title={match.isHome ? "Sân nhà" : "Sân khách"}
                          className="absolute top-2 right-2 grid size-6 place-items-center rounded-full border border-foreground/60 text-xs leading-none font-bold"
                        >
                          {match.isHome ? "H" : "A"}
                        </span>
                        <span className="flex w-full items-end justify-between gap-1">
                          {match.result ? (
                            <MatchResultBadge result={match.result} size="lg" />
                          ) : (
                            <span />
                          )}
                          <ClubBadge name={match.opponentName} size={68} />
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
