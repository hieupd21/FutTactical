import {
  ArrowLeftRight,
  Pause,
  Cross,
  Goal,
  Hand,
  RectangleVertical,
  ClipboardList,
  Star,
  Target,
  Tv,
} from "lucide-react";
import type { ReactNode } from "react";
import { clockLabel, eventTick } from "@/engine/liveMatch";
import { getClub, getPlayer } from "@/engine/state";
import type { LiveSim, MatchSim } from "@/engine/types";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { ClubBadge } from "@/components/ClubBadge";
import { Sheet } from "@/components/Sheet";
import { cancelMatch, closeMatch, pauseMatch, setSpeed, skipMatch } from "@/stores/matchFlow";
import { useUi } from "@/stores/uiStore";
import { classNames } from "@/utils/display";
import { clockOf, describe, type EvKind, kindOf, scorers } from "./commentary";
import { MatchControls } from "./MatchControls";
import { MatchStats } from "./MatchStats";

const ICON: Record<EvKind, ReactNode> = {
  goal: <Goal size={14} />,
  pen: <Goal size={14} />,
  save: <Hand size={14} />,
  post: <Target size={14} />,
  block: <Target size={14} />,
  off: <Target size={14} />,
  yellow: (
    <RectangleVertical
      size={14}
      style={{ color: "var(--gold-on-ink, #d9a400)" }}
      fill="currentColor"
    />
  ),
  red: <RectangleVertical size={14} style={{ color: "var(--loss)" }} fill="currentColor" />,
  inj: <Cross size={14} />,
  var: <Tv size={14} />,
  sub: <ArrowLeftRight size={14} />,
  tac: <ClipboardList size={14} />,
};
const KEY_EVENT_KINDS: EvKind[] = ["goal", "pen", "red", "var"];

function Feed({ liveSim, tick }: { liveSim: LiveSim; tick: number }) {
  const shown = liveSim.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => eventTick(liveSim, event) <= tick);
  if (!shown.length)
    return (
      <p className="hint">
        {tick ? "Chưa có diễn biến đáng chú ý…" : "Trọng tài chuẩn bị nổi còi khai cuộc…"}
      </p>
    );
  return (
    <div className="feed" aria-live="polite">
      {shown
        .slice()
        .reverse()
        .map(({ event, index }) => {
          const kind = kindOf(event);
          return (
            <div key={index} className={classNames("ev", KEY_EVENT_KINDS.includes(kind) && "goal")}>
              <span className="m">{clockOf(event)}</span>
              <span className="flex items-start gap-1.5">
                <span aria-hidden className="mt-0.5 shrink-0">
                  {ICON[kind]}
                </span>
                <span>{describe(liveSim, event, index)}</span>
              </span>
            </div>
          );
        })}
    </div>
  );
}

/** Bảng điểm cầu thủ của bạn sau trận */
function Ratings({ liveSim, matchSim }: { liveSim: LiveSim; matchSim?: MatchSim }) {
  if (!matchSim?.ratings || !matchSim.usedPlayers) return null;
  const playerIds = matchSim.usedPlayers[liveSim.mySide]
    .slice()
    .sort(
      (playerIdA, playerIdB) =>
        (matchSim.minutes![playerIdB] ?? 0) - (matchSim.minutes![playerIdA] ?? 0) ||
        matchSim.ratings![playerIdB] - matchSim.ratings![playerIdA],
    );
  return (
    <>
      {matchSim.manOfTheMatch && (
        <p className="row" style={{ gap: 6 }}>
          <Star size={16} fill="currentColor" aria-hidden />
          <b>Cầu thủ xuất sắc nhất:</b> {getPlayer(matchSim.manOfTheMatch).name}{" "}
          <span className="mono">({matchSim.ratings[matchSim.manOfTheMatch].toFixed(1)})</span>
        </p>
      )}
      <h3>Điểm số cầu thủ</h3>
      <div className="plist">
        {playerIds.map((id) => {
          const player = getPlayer(id);
          return (
            <div
              key={id}
              className="row between"
              style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}
            >
              <span>
                <Badge variant="pos" className={`pos ${player.pos}`}>
                  {player.pos}
                </Badge>{" "}
                {player.name}{" "}
                {id === matchSim.manOfTheMatch && (
                  <Star size={12} fill="currentColor" aria-label="Xuất sắc nhất" />
                )}
              </span>
              <span className="row" style={{ gap: 8 }}>
                <span className="hint mono">{matchSim.minutes![id]}'</span>
                <b className="mono">{matchSim.ratings![id].toFixed(1)}</b>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Trận đấu: trước trận → diễn biến theo phút, dừng ở các mốc để đổi chiến thuật / thay người → tổng kết */
export function MatchSheet() {
  const liveMatch = useUi((ui) => ui.match);
  if (!liveMatch) return null;
  const { liveSim, tick, stage } = liveMatch;
  const shown = liveSim.events.filter((event) => event.goal && eventTick(liveSim, event) <= tick);
  const homeGoals = shown.filter((event) => event.side === 0).length,
    awayGoals = shown.filter((event) => event.side === 1).length;
  const club = getClub(liveSim.sides[0].club),
    awayClub = getClub(liveSim.sides[1].club);
  const label =
    stage === "pre" ? "TRƯỚC TRẬN" : stage === "done" ? "KẾT THÚC" : clockLabel(liveSim, tick);
  return (
    <Sheet onClose={stage === "done" ? closeMatch : stage === "pre" ? cancelMatch : undefined}>
      <div className="grab" />
      <div className="board">
        <div className="tm r">
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <ClubBadge name={club.name} size={36} />
          </div>
          {club.name}
        </div>
        <div>
          <div className="sc">
            {homeGoals}–{awayGoals}
          </div>
          <div className="min">{label}</div>
        </div>
        <div className="tm">
          <div>
            <ClubBadge name={awayClub.name} size={36} />
          </div>
          {awayClub.name}
        </div>
      </div>
      {tick > 0 && (
        <div className="grid grid-cols-2 gap-3 text-[12px] text-muted-foreground">
          <span className="text-right">{scorers(liveSim, 0, tick)}</span>
          <span>{scorers(liveSim, 1, tick)}</span>
        </div>
      )}
      {stage === "play" && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Button variant="hot" size="sm" onClick={pauseMatch}>
            <Pause size={14} aria-hidden /> Tạm dừng / thay người
          </Button>
          <div role="group" aria-label="Tốc độ trận đấu" className="row" style={{ gap: 4 }}>
            {([1, 2, 4] as const).map((speed) => (
              <Button
                key={speed}
                variant={liveMatch.speed === speed ? "default" : "ghost"}
                size="sm"
                aria-pressed={liveMatch.speed === speed}
                onClick={() => setSpeed(speed)}
              >
                {speed}x
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={skipMatch}>
            Xem kết quả ngay
          </Button>
        </div>
      )}
      {(stage === "pre" || stage === "pause") && <MatchControls liveMatch={liveMatch} />}
      {stage !== "pre" && (
        <>
          <MatchStats liveSim={liveSim} tick={tick} />
          <Feed liveSim={liveSim} tick={tick} />
        </>
      )}
      {stage === "done" && (
        <>
          <Ratings liveSim={liveSim} matchSim={liveMatch.matchSim} />
          <Button variant="hot" className="w-full" onClick={closeMatch}>
            Tiếp tục
          </Button>
        </>
      )}
    </Sheet>
  );
}
