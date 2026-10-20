import { needsAct, stageTxt } from "@/engine/actions";
import { DEADLINE_HOURS, REVIEW_DAY, SEASON_LEN, WIN_SUMMER, WIN_WINTER } from "@/engine/constants";
import { advance, type AdvanceMode } from "@/engine/season";
import { clubStr } from "@/engine/squad";
import { C, isDeadline, myLg, P, roundOn, S, windowNow } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { useGame, useGameVersion, commit } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { dstr } from "@/utils/display";
import { FixtureStrip } from "./FixtureStrip";
import { InboxCard, NewsCard } from "./InboxNews";
import { JobOffersCard, OfferList } from "./JobOffers";
import { startMatch } from "@/stores/matchFlow";
import { Button } from "@/components/shadcn/button";
import { buttonVariants } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";

function nextRound() {
  const L = myLg();
  for (let d = S.d + (S.matchToday ? 0 : 1); d < SEASON_LEN; d++) {
    const r = roundOn(d, L);
    if (r >= 0) return { d, r, m: S.fx[L][r].find((x) => x.includes(S.me))! };
  }
  return null;
}

function TodayCard() {
  const mt = S.matchToday,
    win = windowNow(),
    dl = isDeadline() && !!win;
  const nr = nextRound();
  const winTxt = win
    ? dl
      ? `Deadline Day · giờ ${S.h - 9}/${DEADLINE_HOURS}`
      : `Kỳ chuyển nhượng ${win === "summer" ? "hè" : "đông"} · còn ${(win === "summer" ? WIN_SUMMER[1] : WIN_WINTER[1]) - S.d} ngày`
    : S.d < WIN_WINTER[0]
      ? `Kỳ chuyển nhượng đông mở sau ${WIN_WINTER[0] - S.d} ngày`
      : "Kỳ chuyển nhượng đã đóng";
  const go = (mode: AdvanceMode) => {
    commit(() => advance(mode));
    if (S.matchToday) toast("Hôm nay có trận đấu!");
  };
  return (
    <div className="today">
      <div className="row between">
        <span className="date">{dstr(S.d)}</span>
        <span className="win">{winTxt}</span>
      </div>
      {dl && (
        <div className="dl">
          {Array.from({ length: DEADLINE_HOURS }, (_, i) => (
            <i key={i} className={i < S.h - 9 ? "on" : ""} />
          ))}
        </div>
      )}
      {nr ? (
        <>
          <div className="nm">
            <b className="tmn">
              <ClubBadge name={C(nr.m[0]).n} size={34} />
              <span>{C(nr.m[0]).n}</span>
            </b>
            <span className="mono">{mt ? "HÔM NAY" : `${nr.d - S.d} ngày`}</span>
            <b className="r tmn">
              <ClubBadge name={C(nr.m[1]).n} size={34} />
              <span>{C(nr.m[1]).n}</span>
            </b>
          </div>
          <span className="hint dim">
            Vòng {nr.r + 1}/{S.fx[myLg()].length} · {nr.m[0] === S.me ? "Sân nhà" : "Sân khách"} · sức mạnh {clubStr(nr.m[0]).pow} vs{" "}
            {clubStr(nr.m[1]).pow}
          </span>
        </>
      ) : S.d >= REVIEW_DAY ? (
        <span>Mùa giải đã kết thúc. Tiếp tục để sang mùa mới (1/7).</span>
      ) : null}
      {mt ? (
        <div className="row">
          <Button variant="hot" style={{ flex: 1 }} onClick={() => startMatch(true)}>
            Vào trận
          </Button>
          <Button variant="onInk" onClick={() => startMatch(false)}>
            Giả lập nhanh
          </Button>
        </div>
      ) : dl ? (
        <div className="row">
          <Button variant="hot" style={{ flex: 1 }} onClick={() => go("h1")}>
            Tua 1 giờ
          </Button>
          <Button variant="onInk" onClick={() => go("h2")}>
            Tua 2 giờ
          </Button>
        </div>
      ) : (
        <div className="row">
          <Button variant="hot" style={{ flex: 1 }} onClick={() => go("next")}>
            Tiếp tục
          </Button>
          <Button variant="onInk" onClick={() => go("day")}>
            +1 ngày
          </Button>
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  useGameVersion();
  const reset = useGame((s) => s.reset);
  const { openNego } = useUi();
  if (S.sacked) {
    return (
      <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
        <h2>Bạn đã bị sa thải</h2>
        <p>{S.sacked}</p>
        {(S.offers ?? []).length > 0 ? (
          <>
            <p className="hint">Uy tín của bạn giảm, nhưng vẫn có CLB chịu giao ghế. Nhận một lời mời để tiếp tục sự nghiệp:</p>
            <OfferList sacked />
          </>
        ) : (
          <p className="hint">Sự nghiệp kéo dài {S.seasonLog.length} mùa giải.</p>
        )}
        <Button variant="ghost" onClick={() => void reset()}>
          Bắt đầu sự nghiệp mới
        </Button>
      </Card>
    );
  }
  const acts = S.negos.filter(needsAct);
  return (
    <div className="grid2">
      <div className="col">
        <TodayCard />
        <JobOffersCard />
        {acts.length > 0 && (
          <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
            <h3>Cần bạn xử lý ({acts.length})</h3>
            {acts.map((n) => (
              <button key={n.id} className="need" onClick={() => openNego(n.id)}>
                <span>
                  <b>{P(n.pid)?.n ?? "?"}</b>
                  <br />
                  <span className="hint">{stageTxt(n)}</span>
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
