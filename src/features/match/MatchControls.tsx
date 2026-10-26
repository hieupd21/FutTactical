import { effectiveRating, MAX_SUBS, MENTALITY_LABEL, PRESS_LABEL } from "@/engine/liveMatch";
import { slotPositions } from "@/engine/squad";
import { getPlayer } from "@/engine/state";
import type { Mentality, Press } from "@/engine/types";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { FitBar } from "@/components/PlayerRow";
import { SegmentedControl } from "@/components/ui";
import {
  changeTactic,
  dismissAlert,
  makeSub,
  pickOut,
  resumeMatch,
  cancelMatch,
} from "@/stores/matchFlow";
import { type LiveMatch, toast } from "@/stores/uiStore";
import { classNames } from "@/utils/display";

const MENTALITY_HINT: Record<Mentality, string> = {
  att: "Nhiều cơ hội hơn nhưng hở sườn: đối thủ cũng dứt điểm nhiều hơn.",
  bal: "Không thiên lệch bên nào.",
  def: "Ít cơ hội hơn cho cả hai bên, phù hợp khi đang dẫn hoặc kém thế.",
};
const PRESS_HINT: Record<Press, string> = {
  low: "Tiết kiệm sức, đội ít mệt hơn nhưng ít gây sức ép.",
  mid: "Mức mặc định.",
  high: "Mạnh ở đầu trận nhưng hao thể lực rất nhanh, hiệu quả giảm khi đội mệt.",
};

function Tactics({ liveMatch }: { liveMatch: LiveMatch }) {
  const tactic = liveMatch.liveSim.sides[liveMatch.liveSim.mySide].tactic;
  return (
    <div className="flex flex-col gap-2">
      <h3>Chiến thuật</h3>
      <SegmentedControl<Mentality>
        items={(Object.keys(MENTALITY_LABEL) as Mentality[]).map((mentality) => [
          mentality,
          MENTALITY_LABEL[mentality],
        ])}
        value={tactic.ment}
        onChange={(ment) => changeTactic({ ...tactic, ment })}
      />
      <p className="hint">{MENTALITY_HINT[tactic.ment]}</p>
      <SegmentedControl<Press>
        items={(Object.keys(PRESS_LABEL) as Press[]).map((press) => [press, PRESS_LABEL[press]])}
        value={tactic.press}
        onChange={(press) => changeTactic({ ...tactic, press })}
      />
      <p className="hint">{PRESS_HINT[tactic.press]}</p>
    </div>
  );
}

function Subs({ liveMatch }: { liveMatch: LiveMatch }) {
  const liveSim = liveMatch.liveSim,
    side = liveSim.sides[liveSim.mySide];
  const lines = slotPositions(side.form);
  const left = (id: string) =>
    Math.max(0, Math.round(side.startFitness[id] - (side.fatigue[id] ?? 0)));
  const substitutePlayer = (id: string) => {
    const error = makeSub(id);
    if (error) toast(error);
  };
  return (
    <div className="flex flex-col gap-2">
      <h3>
        Thay người{" "}
        <span className="hint">
          · còn {side.subsLeft}/{MAX_SUBS} lượt
        </span>
      </h3>
      {liveSim.injuryAlert && (
        <div
          className="flex flex-col items-start gap-2 rounded-lg border border-destructive p-2.5 text-[13px]"
          role="alert"
        >
          <b>{getPlayer(liveSim.injuryAlert.playerId).name} chấn thương.</b>{" "}
          {side.subsLeft > 0
            ? "Chọn cậu ấy rồi chọn người vào sân thay thế."
            : "Hết lượt thay người, đội phải đá thiếu người."}
          <Button variant="ghost" size="sm" onClick={dismissAlert}>
            Đá thiếu người
          </Button>
        </div>
      )}
      <div className="plist">
        {side.lineup.map((id, i) => {
          if (!id) return null;
          const gone = side.removed.includes(id);
          const player = getPlayer(id);
          return (
            <button
              key={id}
              type="button"
              disabled={side.subsLeft <= 0}
              aria-pressed={liveMatch.outgoingId === id}
              className={classNames(
                "flex min-h-11 w-full items-center justify-between gap-2 border-b border-border py-1.5 text-left disabled:opacity-50 aria-pressed:bg-secondary",
                gone && "line-through opacity-60",
              )}
              onClick={() => pickOut(liveMatch.outgoingId === id ? null : id)}
            >
              <span>
                <Badge variant="pos" className={`pos ${lines[i]}`}>
                  {lines[i]}
                </Badge>{" "}
                {player.name}
                {gone && <em className="hint"> · rời sân</em>}
              </span>
              <span className="flex items-center gap-2">
                <FitBar fitness={left(id)} />
                <b className="mono">
                  {gone ? "-" : Math.round(effectiveRating(side, id, lines[i]))}
                </b>
              </span>
            </button>
          );
        })}
      </div>
      <h3>Băng ghế dự bị</h3>
      <div className="plist">
        {side.bench.map((id) => {
          const player = getPlayer(id);
          return (
            <button
              key={id}
              type="button"
              disabled={!liveMatch.outgoingId}
              className="flex min-h-11 w-full items-center justify-between gap-2 border-b border-border py-1.5 text-left disabled:opacity-50 enabled:hover:bg-secondary"
              onClick={() => substitutePlayer(id)}
            >
              <span>
                <Badge variant="pos" className={`pos ${player.pos}`}>
                  {player.pos}
                </Badge>{" "}
                {player.name}
              </span>
              <b className="mono">{Math.round(effectiveRating(side, id, player.pos))}</b>
            </button>
          );
        })}
        {!side.bench.length && <p className="hint">Không còn cầu thủ dự bị.</p>}
      </div>
      <p className="hint">
        Số hiển thị là chỉ số thực tế trên sân, đã trừ mệt mỏi. Chọn cầu thủ ra sân trước, rồi chọn
        người vào.
      </p>
    </div>
  );
}

/** Bảng trước trận (đặt chiến thuật) hoặc tại điểm dừng (chiến thuật + thay người) */
export function MatchControls({ liveMatch }: { liveMatch: LiveMatch }) {
  const liveSim = liveMatch.liveSim;
  if (liveMatch.stage === "pre")
    return (
      <>
        <Tactics liveMatch={liveMatch} />
        <p className="hint">
          Trong trận bạn có thể bấm Tạm dừng bất cứ lúc nào để đổi chiến thuật và thay người. Đội
          mệt đá kém đi rõ rệt, nên pressing cao cần thay người sớm.
        </p>
        <div className="row">
          <Button variant="hot" style={{ flex: 1 }} onClick={resumeMatch}>
            Bắt đầu trận
          </Button>
          <Button variant="ghost" onClick={cancelMatch}>
            Hủy
          </Button>
        </div>
      </>
    );
  const pauseIndex = liveSim.pauses.indexOf(liveSim.tickIndex);
  return (
    <>
      <h3>
        {liveSim.injuryAlert ? "Cầu thủ chấn thương" : pauseIndex >= 0 ? "Hết hiệp 1" : "Tạm dừng"}
      </h3>
      <Tactics liveMatch={liveMatch} />
      <Subs liveMatch={liveMatch} />
      <Button variant="hot" className="w-full" onClick={resumeMatch}>
        Đá tiếp
      </Button>
    </>
  );
}
