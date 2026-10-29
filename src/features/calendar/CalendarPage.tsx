import { memo, useMemo } from "react";
import { SEASON_LEN, SUMMER_WINDOW, WINTER_WINDOW } from "@/engine/constants";
import { dateOf, getClub, getLeague, myLeagueId, gameState, windowNow } from "@/engine/state";
import { type CalendarEvent, eventsOnDay, myMatchOnDay } from "@/lib/calendarEvents";
import { MatchResultBadge } from "@/components/MatchResultBadge";
import { useGameVersion } from "@/stores/gameStore";
import { ClubBadge } from "@/components/ClubBadge";
import { classNames, formatDate } from "@/utils/display";

const WEEKDAY_HEADERS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

interface CalendarMonth {
  label: string;
  /** chỉ số ngày của ô đầu tiên trong lưới (có thể âm / vượt mùa: ô của tháng kề bên) */
  gridStartDay: number;
  daysInMonth: number;
  leadingBlanks: number;
}

/** Chia mùa (ngày 0..SEASON_LEN-1) thành các tháng dương lịch để dựng lưới */
function buildMonths(): CalendarMonth[] {
  const months: CalendarMonth[] = [];
  let currentKey = -1;
  for (let day = 0; day < SEASON_LEN; day++) {
    const date = dateOf(day);
    const monthKey = date.getFullYear() * 12 + date.getMonth();
    if (monthKey !== currentKey) {
      currentKey = monthKey;
      const leadingBlanks = (date.getDay() + 6) % 7;
      months.push({
        label: `Tháng ${date.getMonth() + 1} · ${date.getFullYear()}`,
        gridStartDay: day - leadingBlanks,
        daysInMonth: 0,
        leadingBlanks,
      });
    }
    months[months.length - 1].daysInMonth++;
  }
  return months;
}

const countdownLabel = (day: number): string =>
  day === gameState.day
    ? "Hôm nay"
    : day - gameState.day === 1
      ? "Ngày mai"
      : day > gameState.day
        ? `Còn ${day - gameState.day} ngày`
        : "Đã qua";

const CalendarCell = memo(function CalendarCell({
  day,
  events,
  isInMonth,
}: {
  day: number;
  events: CalendarEvent[];
  isInMonth: boolean;
}) {
  if (!isInMonth)
    return (
      <div
        aria-hidden="true"
        className="aspect-4/5 rounded-lg bg-card/15 md:aspect-auto p-1 text-xl font-extrabold leading-none text-muted-foreground/50"
      >
        {dateOf(day).getDate()}
      </div>
    );
  const match = myMatchOnDay(day);
  const mark = events.find((calendarEvent) => calendarEvent.kind === "mark");
  const isToday = day === gameState.day;
  const isPast = day < gameState.day;
  return (
    <div
      aria-label={`${formatDate(day)}${events.length ? ", có sự kiện" : ""}`}
      className={classNames(
        "relative flex aspect-4/5 min-h-0 flex-col md:aspect-auto shadow-sm items-start justify-between rounded-lg border p-1 text-left",
        match && "border-(--accent) bg-(--accent)/20",
        !match && "border-white/20 bg-card/40 ",
        isPast && "opacity-60",
        isToday && "ring-2 ring-foreground",
      )}
    >
      <span className="text-xl font-extrabold leading-none tabular-nums">
        {day === gameState.day ? "•" : ""}
        {dateOf(day).getDate()}
      </span>
      {match && (
        <>
          <span
            title={match.isHome ? "Sân nhà" : "Sân khách"}
            className="absolute top-1 right-1 grid size-5 place-items-center rounded-full border border-foreground/60 text-[10px] leading-none font-bold"
          >
            {match.isHome ? "H" : "A"}
          </span>
          <span className="flex w-full items-end justify-between gap-1">
            {match.result ? <MatchResultBadge result={match.result} /> : <span />}
            <ClubBadge name={match.opponentName} size={52} />
          </span>
        </>
      )}
      {!match && mark?.kind === "mark" && (
        <mark.icon
          size={14}
          strokeWidth={2.25}
          aria-hidden="true"
          className="text-muted-foreground"
        />
      )}
    </div>
  );
});

/** Ngày còn lại tới lúc kỳ chuyển nhượng đóng (đang mở) hoặc mở (đang đóng, còn kỳ đông phía trước) */
function transferWindowStatus(day: number): { label: string; days: number } | null {
  const openWindow = windowNow(day);
  if (openWindow) {
    const [, closingDay] = openWindow === "summer" ? SUMMER_WINDOW : WINTER_WINDOW;
    return { label: "Kỳ chuyển nhượng đang mở · còn tới khi đóng", days: closingDay - day };
  }
  if (day < WINTER_WINDOW[0])
    return { label: "Kỳ chuyển nhượng đóng · còn tới khi mở", days: WINTER_WINDOW[0] - day };
  return null;
}

/** Cột trái: thông tin ngày đang chọn (ngày, giải, sự kiện chính, trạng thái kỳ chuyển nhượng) */
function DayDetail({ day }: { day: number }) {
  const events = eventsOnDay(day);
  const windowStatus = transferWindowStatus(day);
  const date = dateOf(day);
  return (
    <aside className="flex flex-col items-center gap-3 rounded-2xl border border-white/20 bg-card/40 p-4 text-center shadow-lg backdrop-blur-xl md:sticky md:top-3">
      <div>
        <b className="block text-sm uppercase tracking-wide">{formatDate(day)}</b>
        <span className="text-xs text-muted-foreground">
          {date.getFullYear()} · {countdownLabel(day)}
        </span>
      </div>
      <b className="text-base">{getLeague(myLeagueId()).name}</b>
      {events.length === 0 && (
        <span className="py-6 text-xs text-muted-foreground">Không có sự kiện</span>
      )}
      {events.map((calendarEvent, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          {calendarEvent.kind === "match" ? (
            <>
              <ClubBadge name={calendarEvent.opponent} size={72} />
              <b className="text-lg">{calendarEvent.opponent}</b>
              <span className="text-xs text-muted-foreground">
                Vòng {calendarEvent.round + 1} · {calendarEvent.home ? "Sân nhà" : "Sân khách"}
              </span>
            </>
          ) : (
            <>
              <span className="grid size-16 place-items-center rounded-full border border-border text-muted-foreground">
                <calendarEvent.icon size={30} strokeWidth={2} aria-hidden="true" />
              </span>
              <b className="text-base">{calendarEvent.title}</b>
              <span className="text-xs text-muted-foreground">{calendarEvent.subtitle}</span>
            </>
          )}
        </div>
      ))}
      {windowStatus && (
        <div className="mt-1 flex w-full flex-col items-center gap-1 border-t border-border pt-3">
          <span className="text-xs font-semibold text-(--win)">{windowStatus.label}</span>
          <b className="text-2xl tabular-nums">{windowStatus.days} ngày</b>
        </div>
      )}
    </aside>
  );
}

/** Lịch tháng dạng lưới (như Career Mode): ô trận đổ màu, cột trái là chi tiết hôm nay */
export function CalendarPage() {
  const version = useGameVersion();
  const months = useMemo(buildMonths, [version]);
  const monthIndex = Math.max(
    0,
    months.findIndex(
      (calendarMonth) =>
        gameState.day >= calendarMonth.gridStartDay + calendarMonth.leadingBlanks &&
        gameState.day <
          calendarMonth.gridStartDay + calendarMonth.leadingBlanks + calendarMonth.daysInMonth,
    ),
  );
  const month = months[monthIndex];
  const eventsByDay = useMemo(
    () => Array.from({ length: 42 }, (_, cellIndex) => eventsOnDay(month.gridStartDay + cellIndex)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version báo gameState đã đổi
    [version, month.gridStartDay],
  );
  const last = gameState.lastMatch?.result;
  const rowCount = Math.ceil((month.leadingBlanks + month.daysInMonth) / 7);
  const firstDayOfMonth = month.gridStartDay + month.leadingBlanks;

  return (
    <section
      aria-labelledby="calendar-heading"
      className="flex flex-col gap-3 md:min-h-0 md:flex-1"
    >
      <h3 id="calendar-heading">Lịch thi đấu · {month.label}</h3>
      <div className="flex flex-col gap-3 md:grid md:min-h-0 md:flex-1 md:grid-cols-[18rem_minmax(0,1fr)] md:items-stretch md:gap-5">
        <div className="md:order-2 md:h-full md:min-h-0">
          <div
            className="grid grid-cols-7 gap-1 md:h-full md:grid-rows-(--calendar-rows)"
            style={
              {
                "--calendar-rows": `auto repeat(${rowCount}, minmax(0, 1fr))`,
              } as React.CSSProperties
            }
          >
            {WEEKDAY_HEADERS.map((weekdayLabel) => (
              <span
                key={weekdayLabel}
                className="text-center text-[10px] font-semibold text-muted-foreground"
              >
                {weekdayLabel}
              </span>
            ))}
            {Array.from({ length: rowCount * 7 }, (_, cellIndex) => {
              const day = month.gridStartDay + cellIndex;
              const isInMonth = day >= firstDayOfMonth && day < firstDayOfMonth + month.daysInMonth;
              return (
                <CalendarCell
                  key={cellIndex}
                  day={day}
                  isInMonth={isInMonth}
                  events={eventsByDay[cellIndex]}
                />
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-3 md:order-1 md:self-start">
          <DayDetail day={gameState.day} />
          {last && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold">Vừa đá</span>
              <ClubBadge name={getClub(last.homeId).name} size={18} />
              <b className="mono text-foreground">
                {last.homeGoals}–{last.awayGoals}
              </b>
              <ClubBadge name={getClub(last.awayId).name} size={18} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
