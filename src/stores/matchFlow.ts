// Luồng trận đấu của bạn: engine đá xong ngay, giao diện "phát lại" theo từng phút.
import { playMyMatch } from "@/engine/match";
import { commit } from "./gameStore";
import { useUi } from "./uiStore";

const TICK_MS = 55;
let timer: ReturnType<typeof setTimeout> | undefined;

export function startMatch(live: boolean): void {
  const r = commit(() => playMyMatch());
  if (!r) return;
  clearTimeout(timer);
  useUi.getState().setMatch({ m: r.m, min: live ? 0 : 90, done: !live, lines: {} });
  if (!live) return;
  const step = () => {
    const M = useUi.getState().match;
    if (!M || M.done) return;
    const min = Math.min(90, M.min + 1);
    useUi.setState({ match: { ...M, min, done: min >= 90 } });
    if (min < 90) timer = setTimeout(step, TICK_MS);
  };
  timer = setTimeout(step, 300);
}

export function skipMatch(): void {
  clearTimeout(timer);
  const M = useUi.getState().match;
  if (M) useUi.setState({ match: { ...M, min: 90, done: true } });
}

export function closeMatch(): void {
  clearTimeout(timer);
  useUi.getState().setMatch(null);
  commit();
}
