import { type ReactNode } from "react";
import { negotiationNeedsAction } from "@/engine/actions";
import { myWages } from "@/engine/board";
import {
  DEADLINE_HOURS,
  REVIEW_DAY,
  SEASON_LEN,
  SUMMER_WINDOW,
  WINTER_WINDOW,
} from "@/engine/constants";
import { formatMoney } from "@/engine/format";
import { advance, type AdvanceMode } from "@/engine/season";
import { clubStrength } from "@/engine/squad";
import {
  dateOf,
  gameState,
  getClub,
  isDeadline,
  myClub,
  myLeagueId,
  roundOn,
  windowNow,
} from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { Button } from "@/components/shadcn/button";
import { nextEventDay } from "@/lib/calendarEvents";
import { commit } from "@/stores/gameStore";
import { startMatch } from "@/stores/matchFlow";
import { toast, useUi } from "@/stores/uiStore";
import { classNames, formatLongDate } from "@/utils/display";

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

interface TransferWindowSummary {
  label: string;
  /** 0–1: đã đi được bao nhiêu của kỳ đang mở; null khi kỳ đóng */
  progress: number | null;
}

function summarizeTransferWindow(): TransferWindowSummary {
  const openWindow = windowNow();
  if (openWindow) {
    const [openingDay, closingDay] = openWindow === "summer" ? SUMMER_WINDOW : WINTER_WINDOW;
    const seasonName = openWindow === "summer" ? "hè" : "đông";
    return {
      label: isDeadline()
        ? `Deadline Day · giờ ${gameState.hour - 9}/${DEADLINE_HOURS}`
        : `Kỳ ${seasonName} · còn ${closingDay - gameState.day} ngày`,
      progress: (gameState.day - openingDay) / (closingDay - openingDay),
    };
  }
  return {
    label:
      gameState.day < WINTER_WINDOW[0]
        ? `Đóng · kỳ đông mở sau ${WINTER_WINDOW[0] - gameState.day} ngày`
        : "Đã đóng",
    progress: null,
  };
}

/** Sự kiện sắp tới: trận (huy hiệu hai đội) hoặc mốc mùa giải (icon) */
function NextEvent() {
  const next = nextEventDay();
  const upcomingMatch = nextRound();
  if (!next)
    return (
      <p className="m-0 text-base">
        {gameState.day >= REVIEW_DAY
          ? "Mùa giải đã kết thúc. Tiếp tục để sang mùa mới (1/7)."
          : "Không còn sự kiện nào trong mùa."}
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm text-muted-foreground">
        Sự kiện tiếp theo {daysUntilLabel(next.day)}
      </span>
      {next.events.map((calendarEvent, eventIndex) =>
        calendarEvent.kind === "match" && upcomingMatch ? (
          <div key={eventIndex} className="flex items-center gap-3.5">
            <div className="flex shrink-0 items-center -space-x-2">
              <ClubBadge name={getClub(upcomingMatch.fixture[0]).name} size={44} />
              <ClubBadge name={getClub(upcomingMatch.fixture[1]).name} size={44} />
            </div>
            <div className="min-w-0">
              <b className="block truncate text-lg leading-tight">{calendarEvent.opponent}</b>
              <span className="text-sm text-muted-foreground">
                Vòng {upcomingMatch.round + 1}/{gameState.fixtures[myLeagueId()].length} ·{" "}
                {calendarEvent.home ? "Sân nhà" : "Sân khách"} · sức mạnh{" "}
                {clubStrength(upcomingMatch.fixture[0]).power} vs{" "}
                {clubStrength(upcomingMatch.fixture[1]).power}
              </span>
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

function InfoRow({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const rowClassName = "flex items-baseline justify-between gap-4 py-2.5 text-left";
  const content = (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="m-0 text-right font-semibold tabular-nums">{children}</dd>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        rowClassName,
        "w-full cursor-pointer border-0 bg-transparent text-inherit hover:bg-card/30",
      )}
    >
      {content}
    </button>
  ) : (
    <div className={rowClassName}>{content}</div>
  );
}

/** Thông tin chuyển nhượng nhanh: kỳ chuyển nhượng, ngân sách, quỹ lương, đàm phán */
function QuickTransferInfo() {
  const club = myClub();
  const transferWindow = summarizeTransferWindow();
  const totalWages = myWages();
  const runningNegotiations = gameState.negos.length;
  const pendingNegotiations = gameState.negos.filter(negotiationNeedsAction).length;
  const openNegotiations = () => {
    const ui = useUi.getState();
    ui.setTab("market");
    ui.setMarketSub("nego");
  };
  return (
    <dl className="m-0 flex flex-col divide-y divide-white/15">
      <div className="flex flex-col gap-2 pb-2.5">
        <InfoRow label="Kỳ chuyển nhượng">{transferWindow.label}</InfoRow>
        {transferWindow.progress !== null && (
          <div className="h-1 overflow-hidden rounded-full bg-foreground/15" aria-hidden="true">
            <div
              className="h-full rounded-full bg-(--accent)"
              style={{ width: `${Math.round(transferWindow.progress * 100)}%` }}
            />
          </div>
        )}
      </div>
      <InfoRow label="Ngân sách">{formatMoney(club.budget)}</InfoRow>
      <InfoRow label="Quỹ lương">
        <span className={totalWages > gameState.wageCap ? "text-destructive" : undefined}>
          {Math.round(totalWages)} / {Math.round(gameState.wageCap)} k€
        </span>
      </InfoRow>
      <InfoRow label="Đàm phán" onClick={openNegotiations}>
        {runningNegotiations} đang chạy
        {pendingNegotiations > 0 && (
          <span className="text-(--accent)"> · {pendingNegotiations} cần xử lý</span>
        )}
      </InfoRow>
    </dl>
  );
}

function AdvanceButtons() {
  const isDeadlineNow = isDeadline() && !!windowNow();
  const advanceTime = (mode: AdvanceMode) => {
    commit(() => advance(mode));
    if (gameState.matchToday) toast("Hôm nay có trận đấu!");
  };
  if (gameState.matchToday)
    return (
      <div className="flex flex-wrap gap-2.5">
        <Button variant="hot" onClick={() => startMatch(true)}>
          Vào trận
        </Button>
        <Button variant="ghost" onClick={() => startMatch(false)}>
          Giả lập nhanh
        </Button>
      </div>
    );
  if (isDeadlineNow)
    return (
      <div className="flex flex-wrap gap-2.5">
        <Button variant="hot" onClick={() => advanceTime("h1")}>
          Tua 1 giờ
        </Button>
        <Button variant="ghost" onClick={() => advanceTime("h2")}>
          Tua 2 giờ
        </Button>
      </div>
    );
  return (
    <div className="flex flex-wrap gap-2.5">
      <Button variant="hot" onClick={() => advanceTime("next")}>
        Tiếp tục
      </Button>
      <Button variant="ghost" onClick={() => advanceTime("day")}>
        +1 ngày
      </Button>
    </div>
  );
}

/** Khối trái: ngày tháng năm, sự kiện kế tiếp, thông tin chuyển nhượng nhanh, nút cho thời gian trôi */
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
      <QuickTransferInfo />
      <AdvanceButtons />
    </section>
  );
}
