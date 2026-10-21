import { ArrowLeftRight, Clock, Flag, Lock, type LucideIcon } from "lucide-react";
import { DEADLINE_HOURS, REVIEW_DAY, SEASON_LEN } from "@/engine/constants";
import { getClub, isDeadline, myLeagueId, roundOn, gameState, windowNow } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { classNames, formatShortDate } from "@/utils/display";

type Ev =
  | { kind: "match"; day: number; round: number; opponent: string; home: boolean }
  | { kind: "mark"; day: number; icon: LucideIcon; title: string; subtitle: string };

/** Các mốc sắp tới của mùa: trận của CLB mình, mở kỳ chuyển nhượng, Deadline Day, tổng kết mùa */
function upcoming(limit: number): Ev[] {
  const leagueId = myLeagueId(),
    events: Ev[] = [];
  for (
    let day = gameState.day + (gameState.matchToday ? 0 : 1);
    day < SEASON_LEN && events.length < limit;
    day++
  ) {
    const transferWindow = windowNow(day);
    if (day > gameState.day && transferWindow && !windowNow(day - 1))
      events.push({
        kind: "mark",
        day,
        icon: ArrowLeftRight,
        title: "Mở kỳ chuyển nhượng",
        subtitle: transferWindow === "summer" ? "Kỳ hè" : "Kỳ đông",
      });
    if (day > gameState.day && isDeadline(day) && transferWindow)
      events.push({
        kind: "mark",
        day,
        icon: Clock,
        title: "Deadline Day",
        subtitle: `${DEADLINE_HOURS} giờ cuối`,
      });
    if (day > gameState.day && !transferWindow && windowNow(day - 1) && !isDeadline(day - 1))
      events.push({
        kind: "mark",
        day,
        icon: Lock,
        title: "Đóng kỳ chuyển nhượng",
        subtitle: "Hết hạn",
      });
    if (day === REVIEW_DAY && day > gameState.day)
      events.push({
        kind: "mark",
        day,
        icon: Flag,
        title: "Tổng kết mùa",
        subtitle: "Đánh giá của ban lãnh đạo",
      });
    const round = roundOn(day, leagueId);
    const fixture =
      round >= 0
        ? gameState.fixtures[leagueId][round].find((fixtureClubIds) =>
            fixtureClubIds.includes(gameState.myClubId),
          )
        : undefined;
    if (fixture)
      events.push({
        kind: "match",
        day,
        round,
        opponent: getClub(fixture[0] === gameState.myClubId ? fixture[1] : fixture[0]).name,
        home: fixture[0] === gameState.myClubId,
      });
  }
  return events.slice(0, limit);
}

const when = (day: number): string =>
  day === gameState.day
    ? "Hôm nay"
    : day - gameState.day === 1
      ? "Ngày mai"
      : `Còn ${day - gameState.day} ngày`;

/** Dải lịch cuộn ngang: trận vừa đá (nếu có) rồi các mốc sắp tới; thẻ đầu tiên sắp tới có viền nhấn */
export function FixtureStrip() {
  const last = gameState.lastMatch?.result;
  const events = upcoming(6);
  if (!last && !events.length) return null;
  return (
    <section aria-labelledby="fxs-h" className="col" style={{ gap: 8 }}>
      <h3 id="fxs-h">Lịch sắp tới</h3>
      <ul className="fxs" tabIndex={0} aria-label="Lịch sắp tới, cuộn ngang để xem thêm">
        {last && (
          <li className="fx past">
            <span className="fx-d">Vừa đá</span>
            <span className="fx-t">
              <ClubBadge name={getClub(last.homeId).name} size={22} />
              <b className="mono">
                {last.homeGoals}–{last.awayGoals}
              </b>
              <ClubBadge name={getClub(last.awayId).name} size={22} />
            </span>
            <span className="fx-s">
              {getClub(last.homeId).name} – {getClub(last.awayId).name}
            </span>
          </li>
        )}
        {events.map((calendarEvent, i) => (
          <li key={`${calendarEvent.day}-${i}`} className={classNames("fx", i === 0 && "next")}>
            <span className="fx-d">
              {when(calendarEvent.day)} · {formatShortDate(calendarEvent.day)}
            </span>
            {calendarEvent.kind === "match" ? (
              <>
                <span className="fx-t">
                  <ClubBadge name={calendarEvent.opponent} size={22} />
                  <b>{calendarEvent.opponent}</b>
                </span>
                <span className="fx-s">
                  Vòng {calendarEvent.round + 1} · {calendarEvent.home ? "Sân nhà" : "Sân khách"}
                </span>
              </>
            ) : (
              <>
                <span className="fx-t">
                  <calendarEvent.icon size={18} strokeWidth={2.25} aria-hidden="true" />
                  <b>{calendarEvent.title}</b>
                </span>
                <span className="fx-s">{calendarEvent.subtitle}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
