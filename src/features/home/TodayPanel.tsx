import { HandCoins, Mail, type LucideIcon } from "lucide-react";
import { Fragment, useCallback, useState } from "react";
import { negotiationNeedsAction } from "@/engine/actions";
import { REVIEW_DAY, SEASON_LEN } from "@/engine/constants";
import { advance, type AdvanceMode } from "@/engine/season";
import { table } from "@/engine/squad";
import { agentLetters } from "@/engine/transfers";
import {
  dateOf,
  gameState,
  getClub,
  isDeadline,
  leagueName,
  myLeagueId,
  roundOn,
  windowNow,
} from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { LeagueBadge } from "@/components/LeagueBadge";
import { Button } from "@/components/shadcn/button";
import { nextEventDay } from "@/lib/calendarEvents";
import { commit } from "@/stores/gameStore";
import { startMatch } from "@/stores/matchFlow";
import { toast, useUi } from "@/stores/uiStore";
import { formatLongDate, formatShortDate } from "@/utils/display";
import { AdvanceCalendar } from "./AdvanceCalendar";

function nextRound() {
  const leagueId = myLeagueId();
  for (let day = gameState.day + (gameState.matchToday ? 0 : 1); day < SEASON_LEN; day++) {
    const round = roundOn(day, leagueId);
    if (round >= 0)
      return {
        round,
        fixture: gameState.fixtures[leagueId][round].find((fixtureClubIds) =>
          fixtureClubIds.includes(gameState.myClubId),
        )!,
      };
  }
  return null;
}

const daysUntilLabel = (day: number): string =>
  day === gameState.day
    ? "hôm nay"
    : day - gameState.day === 1
      ? "ngày mai"
      : `sau ${day - gameState.day} ngày`;

/** Chỉ báo sự kiện trong vòng một tuần tới */
const UPCOMING_WINDOW_DAYS = 7;

/** Sự kiện sắp tới: trận (huy hiệu hai đội) hoặc mốc mùa giải (icon) */
function NextEvent() {
  const next = nextEventDay();
  const upcomingMatch = nextRound();
  const leagueRanks = new Map(
    table(myLeagueId()).map((tableRow, rowIndex) => [tableRow.id, `Hạng ${rowIndex + 1}`] as const),
  );
  if (!next)
    return (
      <p className="m-0 text-base">
        {gameState.day >= REVIEW_DAY
          ? "Mùa giải đã kết thúc. Tiếp tục để sang mùa mới (1/7)."
          : "Không còn sự kiện nào trong mùa."}
      </p>
    );
  if (next.day - gameState.day > UPCOMING_WINDOW_DAYS)
    return (
      <p className="m-0 text-sm text-muted-foreground">Chưa có sự kiện nào trong 7 ngày tới</p>
    );
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm text-muted-foreground">
        Sự kiện tiếp theo {daysUntilLabel(next.day)}
      </span>
      {next.events.map((calendarEvent, eventIndex) =>
        calendarEvent.kind === "match" && upcomingMatch ? (
          <div key={eventIndex} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-3">
              <LeagueBadge leagueId={myLeagueId()} size={36} />
              <b className="text-lg">{leagueName(myLeagueId())}</b>
              <span className="text-sm text-muted-foreground">
                {formatShortDate(calendarEvent.day)}
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
              {upcomingMatch.fixture.map((clubId, sideIndex) => (
                <Fragment key={clubId}>
                  {sideIndex === 1 && (
                    <b className="font-(family-name:--f-display) text-2xl font-extrabold text-muted-foreground">
                      VS
                    </b>
                  )}
                  <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      {leagueRanks.get(clubId)}
                    </span>
                    <ClubBadge name={getClub(clubId).name} size={104} />
                    <span className="max-w-full font-(family-name:--f-display) text-base leading-tight font-extrabold uppercase text-balance md:text-lg">
                      {getClub(clubId).name}
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        ) : calendarEvent.kind === "mark" ? (
          <div key={eventIndex} className="flex items-center gap-3.5">
            <calendarEvent.icon size={28} strokeWidth={2} aria-hidden="true" className="shrink-0" />
            <div className="min-w-0">
              <b className="block truncate text-lg leading-tight">{calendarEvent.title}</b>
              <span className="text-sm text-muted-foreground">{calendarEvent.subtitle}</span>
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function ActivityRow({
  icon: Icon,
  title,
  onOpen,
}: {
  icon: LucideIcon;
  title: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full cursor-pointer items-center gap-4 border-0 bg-transparent px-1 py-3 text-left text-inherit transition-colors hover:bg-card/40"
      >
        <Icon className="size-7 shrink-0" strokeWidth={1.75} aria-hidden />
        <b className="text-base">{title}</b>
      </button>
    </li>
  );
}

/** Việc cần xử lý: đề nghị mua/bán đang chờ bạn và lời thả thính của cầu thủ CLB khác */
function ActivityList() {
  const pendingOffers = gameState.negos.filter(
    (negotiation) =>
      negotiationNeedsAction(negotiation) && (negotiation.isBuyOffer || negotiation.isSellOffer),
  );
  const flirtingPlayers = agentLetters();
  const openNegotiations = () => {
    const ui = useUi.getState();
    ui.setTab("market");
    ui.setMarketSub("nego");
  };
  if (!pendingOffers.length && !flirtingPlayers.length)
    return (
      <p className="m-0 text-sm text-muted-foreground">Chưa có đề nghị hay thư thăm dò nào.</p>
    );
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-white/15 p-0">
      {pendingOffers.length > 0 && (
        <ActivityRow
          icon={HandCoins}
          title={`${pendingOffers.length} đề nghị mua/bán`}
          onOpen={() =>
            pendingOffers.length === 1
              ? useUi.getState().openNego(pendingOffers[0].id)
              : openNegotiations()
          }
        />
      )}
      {flirtingPlayers.length > 0 && (
        <ActivityRow
          icon={Mail}
          title={`${flirtingPlayers.length} cầu thủ thả thính`}
          onOpen={openNegotiations}
        />
      )}
    </ul>
  );
}

function AdvanceButtons() {
  const isDeadlineNow = isDeadline() && !!windowNow();
  const [calendarTrip, setCalendarTrip] = useState<{ fromDate: Date; toDate: Date } | null>(null);
  const advanceTime = (mode: AdvanceMode) => {
    const fromDate = dateOf(gameState.day);
    const fromYear = gameState.year;
    const isDayAdvance = mode === "next" || mode === "day";
    commit(() => advance(mode));
    if (gameState.matchToday) toast("Hôm nay có trận đấu!");
    const toDate = dateOf(gameState.day);
    if (isDayAdvance && !gameState.sacked && (gameState.year !== fromYear || toDate > fromDate))
      setCalendarTrip({ fromDate, toDate });
  };
  const closeCalendar = useCallback(() => setCalendarTrip(null), []);
  const buttons = gameState.matchToday ? (
    <div className="flex flex-wrap gap-2.5">
      <Button variant="hot" onClick={() => startMatch(true)}>
        Vào trận
      </Button>
      <Button variant="ghost" onClick={() => startMatch(false)}>
        Giả lập nhanh
      </Button>
    </div>
  ) : isDeadlineNow ? (
    <div className="flex flex-wrap gap-2.5">
      <Button variant="hot" onClick={() => advanceTime("h1")}>
        Tua 1 giờ
      </Button>
      <Button variant="ghost" onClick={() => advanceTime("h2")}>
        Tua 2 giờ
      </Button>
    </div>
  ) : (
    <div className="flex flex-wrap gap-2.5">
      <Button variant="hot" onClick={() => advanceTime("next")}>
        Tiếp tục
      </Button>
      <Button variant="ghost" onClick={() => advanceTime("day")}>
        +1 ngày
      </Button>
    </div>
  );
  return (
    <>
      {buttons}
      {calendarTrip && (
        <AdvanceCalendar
          fromDate={calendarTrip.fromDate}
          toDate={calendarTrip.toDate}
          onDone={closeCalendar}
        />
      )}
    </>
  );
}

/** Khối trái: ngày tháng năm, trận/mốc trong 7 ngày tới, nút cho thời gian trôi, đề nghị và thư thả thính */
export function TodayPanel() {
  return (
    <section className="flex flex-col gap-6 py-2">
      <h2 className="m-0 font-(family-name:--f-display) text-3xl leading-tight font-extrabold text-balance md:text-4xl">
        {formatLongDate(gameState.day)}
        <span className="block font-medium text-muted-foreground">
          {dateOf(gameState.day).getFullYear()}
        </span>
      </h2>
      <NextEvent />
      <AdvanceButtons />
      <ActivityList />
    </section>
  );
}
