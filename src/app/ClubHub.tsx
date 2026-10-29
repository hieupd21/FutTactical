// Tab Câu lạc bộ: ba khối (bảng xếp hạng, lịch thi đấu, thông tin CLB); bấm một khối để mở màn tương ứng.
import { ChevronLeft } from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { formatMoney, formatWage } from "@/engine/format";
import { clubStrength, table } from "@/engine/squad";
import { dateOf, getClub, gameState, leagueName, myClub, myLeagueId } from "@/engine/state";
import { SEASON_LEN } from "@/engine/constants";
import { myMatchOnDay } from "@/lib/calendarEvents";
import { classNames, formatShortDate } from "@/utils/display";
import { ClubBadge } from "@/components/ClubBadge";
import { MatchResultBadge } from "@/components/MatchResultBadge";
import { Preloader } from "@/components/Preloader";
import { useGameVersion } from "@/stores/gameStore";
import { type ClubView, useUi } from "@/stores/uiStore";
import { CalendarPage, ClubPage, LeaguePage } from "./lazyPages";

const CARD_CLASS =
  "flex min-h-[28rem] min-w-0 cursor-pointer flex-col items-center gap-4 rounded-2xl border border-white/20 bg-card/40 p-5 text-center text-foreground shadow-lg backdrop-blur-xl transition-colors hover:border-(--accent) hover:bg-card/60";

const VIEW_TITLE: Record<Exclude<ClubView, "hub">, string> = {
  standings: "Bảng xếp hạng",
  calendar: "Lịch thi đấu",
  info: "Thông tin câu lạc bộ",
};

function HubCard({
  title,
  onOpen,
  children,
}: {
  title: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onOpen} className={classNames(CARD_CLASS)}>
      <h2 className="m-0 text-xl font-bold">{title}</h2>
      {children}
    </button>
  );
}

const FORM_LABEL = { W: "T", D: "H", L: "B" } as const;

function StandingsPreview() {
  const leagueId = myLeagueId();
  const tableRows = table(leagueId);
  const myPosition = tableRows.findIndex((tableRow) => tableRow.id === gameState.myClubId);
  const firstShown = Math.max(0, Math.min(myPosition - 1, tableRows.length - 7));
  const shownRows = tableRows.slice(firstShown, firstShown + 7);
  return (
    <>
      <span className="text-sm font-semibold text-(--win)">{leagueName(leagueId)}</span>
      <ul className="m-0 flex w-full list-none flex-col p-0 text-left">
        {shownRows.map((tableRow, rowIndex) => {
          const clubName = getClub(tableRow.id).name;
          return (
            <li
              key={tableRow.id}
              className={classNames(
                "flex items-center gap-3 border-b border-foreground/15 py-2",
                tableRow.id === gameState.myClubId && "font-bold text-(--accent)",
              )}
            >
              <span className="w-5 tabular-nums">{firstShown + rowIndex + 1}</span>
              <ClubBadge name={clubName} size={28} />
              <span className="min-w-0 flex-1 truncate">{clubName}</span>
              <span className="form">
                {tableRow.form.slice(-1).map((formResult) => (
                  <i key="latest" className={formResult}>
                    {FORM_LABEL[formResult]}
                  </i>
                ))}
              </span>
              <b className="w-7 text-right tabular-nums">{tableRow.points}</b>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function CalendarPreview() {
  const currentMonth = dateOf(gameState.day).getMonth();
  const monthMatches: { day: number; match: NonNullable<ReturnType<typeof myMatchOnDay>> }[] = [];
  for (let day = 0; day < SEASON_LEN; day++) {
    if (dateOf(day).getMonth() !== currentMonth) continue;
    const match = myMatchOnDay(day);
    if (match) monthMatches.push({ day, match });
  }
  const lastPlayedMatch = (() => {
    for (let day = gameState.day; day >= 0; day--) {
      const match = myMatchOnDay(day);
      if (match?.result) return match;
    }
    return null;
  })();
  return (
    <>
      <span className="text-sm font-semibold text-(--win)">Tháng {currentMonth + 1}</span>
      <ul className="m-0 flex w-full list-none flex-col p-0 text-left">
        {monthMatches.map(({ day, match }) => (
          <li
            key={day}
            className={classNames(
              "flex items-center gap-3 border-b border-foreground/15 py-2",
              day < gameState.day && "text-muted-foreground",
            )}
          >
            <span className="w-10 text-sm tabular-nums">{formatShortDate(day)}</span>
            <ClubBadge name={match.opponentName} size={28} />
            <span className="min-w-0 flex-1 truncate">{match.opponentName}</span>
            {match.result ? (
              <>
                <b className="text-sm text-foreground tabular-nums">
                  {match.result.ownGoals}–{match.result.opponentGoals}
                </b>
                <span className="form">
                  <i className={match.result.outcome}>{FORM_LABEL[match.result.outcome]}</i>
                </span>
              </>
            ) : null}
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-foreground/60 text-[10px] font-bold">
              {match.isHome ? "H" : "A"}
            </span>
          </li>
        ))}
        {!monthMatches.length && (
          <li className="py-2 text-sm text-muted-foreground">Không có trận nào trong tháng này.</li>
        )}
      </ul>
      {lastPlayedMatch?.result && (
        <div className="mt-auto flex w-full items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Kết quả trận đấu trước</span>
          <span className="flex items-center gap-2">
            <ClubBadge name={lastPlayedMatch.opponentName} size={28} />
            <MatchResultBadge result={lastPlayedMatch.result} />
          </span>
        </div>
      )}
    </>
  );
}

function InfoPreview() {
  const squadPlayers = Object.values(gameState.players).filter(
    (player) => player.club === gameState.myClubId,
  );
  const averageAge = squadPlayers.length
    ? squadPlayers.reduce((totalAge, player) => totalAge + player.age, 0) / squadPlayers.length
    : 0;
  const injuredCount = squadPlayers.filter((player) => player.injuryDays > 0).length;
  const infoRows: [string, string, string?][] = [
    ["Ngân sách", formatMoney(myClub().budget), "text-(--win)"],
    ["Quỹ lương", formatWage(gameState.wageCap)],
    ["Sức mạnh", `${clubStrength(gameState.myClubId).power}`],
    ["Cầu thủ", `${squadPlayers.length}`],
    ["Tuổi trung bình", averageAge.toFixed(1)],
    ["Chấn thương", `${injuredCount}`],
  ];
  return (
    <>
      <ClubBadge name={myClub().name} size={64} />
      <b className="text-lg">{myClub().name}</b>
      <dl className="m-0 grid w-full grid-cols-2 gap-x-2 gap-y-4 text-sm">
        {infoRows.map(([label, value, valueClassName]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={classNames("m-0 font-bold", valueClassName)}>{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function ClubHub() {
  useGameVersion();
  const clubView = useUi((ui) => ui.clubView);
  const setClubView = useUi((ui) => ui.setClubView);

  if (clubView === "hub")
    return (
      <div className="my-auto grid gap-4 md:grid-cols-3">
        <HubCard title="Bảng xếp hạng" onOpen={() => setClubView("standings")}>
          <StandingsPreview />
        </HubCard>
        <HubCard title="Lịch thi đấu" onOpen={() => setClubView("calendar")}>
          <CalendarPreview />
        </HubCard>
        <HubCard title="Thông tin câu lạc bộ" onOpen={() => setClubView("info")}>
          <InfoPreview />
        </HubCard>
      </div>
    );

  return (
    <div className={classNames("flex flex-col gap-3", clubView === "calendar" && "min-h-0 flex-1")}>
      <button
        type="button"
        onClick={() => setClubView("hub")}
        className="flex w-fit cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Câu lạc bộ · {VIEW_TITLE[clubView]}
      </button>
      <Suspense fallback={<Preloader />}>
        {clubView === "standings" && <LeaguePage />}
        {clubView === "calendar" && <CalendarPage />}
        {clubView === "info" && <ClubPage />}
      </Suspense>
    </div>
  );
}
