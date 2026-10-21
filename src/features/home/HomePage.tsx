import { negotiationNeedsAction, stageText } from "@/engine/actions";
import {
  DEADLINE_HOURS,
  REVIEW_DAY,
  SEASON_LEN,
  SUMMER_WINDOW,
  WINTER_WINDOW,
} from "@/engine/constants";
import { advance, type AdvanceMode } from "@/engine/season";
import { clubStrength } from "@/engine/squad";
import {
  getClub,
  isDeadline,
  myLeagueId,
  getPlayer,
  roundOn,
  gameState,
  windowNow,
} from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { useGame, useGameVersion, commit } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { formatDate } from "@/utils/display";
import { FixtureStrip } from "./FixtureStrip";
import { InboxCard, NewsCard } from "./InboxNews";
import { JobOffersCard, OfferList } from "./JobOffers";
import { startMatch } from "@/stores/matchFlow";
import { Button } from "@/components/shadcn/button";
import { buttonVariants } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";

function nextRound() {
  const leagueId = myLeagueId();
  for (let day = gameState.day + (gameState.matchToday ? 0 : 1); day < SEASON_LEN; day++) {
    const round = roundOn(day, leagueId);
    if (round >= 0)
      return {
        day: day,
        round: round,
        fixture: gameState.fixtures[leagueId][round].find((fixtureClubIds) =>
          fixtureClubIds.includes(gameState.myClubId),
        )!,
      };
  }
  return null;
}

function TodayCard() {
  const matchToday = gameState.matchToday,
    transferWindow = windowNow(),
    isDeadlineNow = isDeadline() && !!transferWindow;
  const upcomingMatch = nextRound();
  const winTxt = transferWindow
    ? isDeadlineNow
      ? `Deadline Day · giờ ${gameState.hour - 9}/${DEADLINE_HOURS}`
      : `Kỳ chuyển nhượng ${transferWindow === "summer" ? "hè" : "đông"} · còn ${(transferWindow === "summer" ? SUMMER_WINDOW[1] : WINTER_WINDOW[1]) - gameState.day} ngày`
    : gameState.day < WINTER_WINDOW[0]
      ? `Kỳ chuyển nhượng đông mở sau ${WINTER_WINDOW[0] - gameState.day} ngày`
      : "Kỳ chuyển nhượng đã đóng";
  const advanceTime = (mode: AdvanceMode) => {
    commit(() => advance(mode));
    if (gameState.matchToday) toast("Hôm nay có trận đấu!");
  };
  return (
    <div className="today">
      <div className="row between">
        <span className="date">{formatDate(gameState.day)}</span>
        <span className="win">{winTxt}</span>
      </div>
      {isDeadlineNow && (
        <div className="dl">
          {Array.from({ length: DEADLINE_HOURS }, (_, i) => (
            <i key={i} className={i < gameState.hour - 9 ? "on" : ""} />
          ))}
        </div>
      )}
      {upcomingMatch ? (
        <>
          <div className="nm">
            <b className="tmn">
              <ClubBadge name={getClub(upcomingMatch.fixture[0]).name} size={34} />
              <span>{getClub(upcomingMatch.fixture[0]).name}</span>
            </b>
            <span className="mono">
              {matchToday ? "HÔM NAY" : `${upcomingMatch.day - gameState.day} ngày`}
            </span>
            <b className="r tmn">
              <ClubBadge name={getClub(upcomingMatch.fixture[1]).name} size={34} />
              <span>{getClub(upcomingMatch.fixture[1]).name}</span>
            </b>
          </div>
          <span className="hint dim">
            Vòng {upcomingMatch.round + 1}/{gameState.fixtures[myLeagueId()].length} ·{" "}
            {upcomingMatch.fixture[0] === gameState.myClubId ? "Sân nhà" : "Sân khách"} · sức mạnh{" "}
            {clubStrength(upcomingMatch.fixture[0]).power} vs{" "}
            {clubStrength(upcomingMatch.fixture[1]).power}
          </span>
        </>
      ) : gameState.day >= REVIEW_DAY ? (
        <span>Mùa giải đã kết thúc. Tiếp tục để sang mùa mới (1/7).</span>
      ) : null}
      {matchToday ? (
        <div className="row">
          <Button variant="hot" style={{ flex: 1 }} onClick={() => startMatch(true)}>
            Vào trận
          </Button>
          <Button variant="onInk" onClick={() => startMatch(false)}>
            Giả lập nhanh
          </Button>
        </div>
      ) : isDeadlineNow ? (
        <div className="row">
          <Button variant="hot" style={{ flex: 1 }} onClick={() => advanceTime("h1")}>
            Tua 1 giờ
          </Button>
          <Button variant="onInk" onClick={() => advanceTime("h2")}>
            Tua 2 giờ
          </Button>
        </div>
      ) : (
        <div className="row">
          <Button variant="hot" style={{ flex: 1 }} onClick={() => advanceTime("next")}>
            Tiếp tục
          </Button>
          <Button variant="onInk" onClick={() => advanceTime("day")}>
            +1 ngày
          </Button>
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  useGameVersion();
  const reset = useGame((store) => store.reset);
  const { openNego } = useUi();
  if (gameState.sacked) {
    return (
      <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
        <h2>Bạn đã bị sa thải</h2>
        <p>{gameState.sacked}</p>
        {(gameState.offers ?? []).length > 0 ? (
          <>
            <p className="hint">
              Uy tín của bạn giảm, nhưng vẫn có CLB chịu giao ghế. Nhận một lời mời để tiếp tục sự
              nghiệp:
            </p>
            <OfferList sacked />
          </>
        ) : (
          <p className="hint">Sự nghiệp kéo dài {gameState.seasonLog.length} mùa giải.</p>
        )}
        <Button variant="ghost" onClick={() => void reset()}>
          Bắt đầu sự nghiệp mới
        </Button>
      </Card>
    );
  }
  const acts = gameState.negos.filter(negotiationNeedsAction);
  return (
    <div className="grid2">
      <div className="col">
        <TodayCard />
        <JobOffersCard />
        {acts.length > 0 && (
          <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
            <h3>Cần bạn xử lý ({acts.length})</h3>
            {acts.map((negotiation) => (
              <button
                key={negotiation.id}
                className="need"
                onClick={() => openNego(negotiation.id)}
              >
                <span>
                  <b>{getPlayer(negotiation.playerId)?.name ?? "?"}</b>
                  <br />
                  <span className="hint">{stageText(negotiation)}</span>
                </span>
                <span className={buttonVariants({ variant: "hot", size: "sm" })}>Mở</span>
              </button>
            ))}
          </Card>
        )}
        <FixtureStrip />
      </div>
      <div className="col">
        <InboxCard />
        <NewsCard />
      </div>
    </div>
  );
}
