// Luồng trận đấu của bạn: đồng hồ chạy từng phút, engine mô phỏng đúng phút đó nên bạn tạm dừng và đổi đội hình / chiến thuật lúc nào cũng được.
import { setMyTactic } from "@/engine/actions";
import { autoRest, isOver, setTactic, stepLive, substitute } from "@/engine/liveMatch";
import { beginMyMatch, finishMyMatch } from "@/engine/match";
import type { Tactic } from "@/engine/types";
import { commit } from "./gameStore";
import { type LiveMatch, useUi } from "./uiStore";

const TICK_MS: Record<1 | 2 | 4, number> = { 1: 450, 2: 220, 4: 90 };
let timer: ReturnType<typeof setTimeout> | undefined;

const current = (): LiveMatch | null => useUi.getState().match;
function patch(changes: Partial<LiveMatch>): void {
  const currentMatch = current();
  if (currentMatch) useUi.setState({ match: { ...currentMatch, ...changes } });
}

/** live = true: vào sân, có điểm dừng; false: máy đá nốt, chỉ xem kết quả */
export function startMatch(live: boolean): void {
  const liveSim = beginMyMatch();
  if (!liveSim) return;
  clearTimeout(timer);
  useUi.getState().setMatch({ liveSim, stage: "pre", tick: 0, speed: 1, outgoingId: null });
  if (!live) skipMatch();
}

function finish(): void {
  const currentMatch = current();
  if (!currentMatch) return;
  const result = commit(() => finishMyMatch(currentMatch.liveSim));
  patch({
    stage: "done",
    tick: currentMatch.liveSim.ticks.length,
    matchSim: result?.matchSim,
    outgoingId: null,
  });
}

function animate(delay: number): void {
  clearTimeout(timer);
  const step = () => {
    const currentMatch = current();
    if (!currentMatch || currentMatch.stage !== "play") return;
    if (isOver(currentMatch.liveSim)) return finish();
    stepLive(currentMatch.liveSim, currentMatch.liveSim.tickIndex + 1);
    patch({ tick: currentMatch.liveSim.tickIndex });
    if (isOver(currentMatch.liveSim)) timer = setTimeout(finish, 700);
    else if (
      currentMatch.liveSim.injuryAlert ||
      currentMatch.liveSim.pauses.includes(currentMatch.liveSim.tickIndex)
    )
      patch({ stage: "pause" }); // chấn thương hoặc nghỉ giữa hiệp
    else timer = setTimeout(step, TICK_MS[currentMatch.speed]);
  };
  timer = setTimeout(step, delay);
}

/** Bắt đầu / đá tiếp */
export function resumeMatch(): void {
  const currentMatch = current();
  if (!currentMatch || currentMatch.stage === "play" || currentMatch.stage === "done") return;
  patch({ stage: "play", outgoingId: null });
  animate(300);
}

/** Tạm dừng để đổi chiến thuật / thay người */
export function pauseMatch(): void {
  const currentMatch = current();
  if (currentMatch?.stage !== "play") return;
  clearTimeout(timer);
  patch({ stage: "pause" });
}

export function setSpeed(speed: 1 | 2 | 4): void {
  patch({ speed });
}

/** Bỏ qua phần còn lại: máy điều hành nốt, hiện kết quả ngay */
export function skipMatch(): void {
  clearTimeout(timer);
  const currentMatch = current();
  if (!currentMatch || currentMatch.stage === "done") return;
  autoRest(currentMatch.liveSim);
  finish();
}

export function pickOut(id: string | null): void {
  patch({ outgoingId: id });
}

/** Thay người; trả về thông báo lỗi nếu không hợp lệ */
export function makeSub(inId: string): string | null {
  const currentMatch = current();
  if (!currentMatch?.outgoingId) return "Hãy chọn cầu thủ ra sân trước.";
  const error = substitute(
    currentMatch.liveSim,
    currentMatch.liveSim.mySide,
    currentMatch.outgoingId,
    inId,
  );
  patch({ outgoingId: null });
  return error;
}

export function changeTactic(tactic: Tactic): void {
  const currentMatch = current();
  if (!currentMatch) return;
  setTactic(currentMatch.liveSim, currentMatch.liveSim.mySide, tactic);
  if (currentMatch.stage === "pre") commit(() => setMyTactic(tactic));
  patch({});
}

/** Bỏ qua cảnh báo chấn thương: đá tiếp thiếu người */
export function dismissAlert(): void {
  const currentMatch = current();
  if (!currentMatch) return;
  currentMatch.liveSim.injuryAlert = null;
  patch({});
}

export function cancelMatch(): void {
  clearTimeout(timer);
  useUi.getState().setMatch(null);
}

export function closeMatch(): void {
  clearTimeout(timer);
  useUi.getState().setMatch(null);
  commit();
}
