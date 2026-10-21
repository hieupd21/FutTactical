import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advance } from "@/engine/season";
import { gameState } from "@/engine/state";
import { startTestGame } from "@/test/helpers";

vi.mock("@/lib/persist", () => ({ saveGame: vi.fn(), loadGame: vi.fn(), clearGame: vi.fn() }));

import {
  changeTactic,
  closeMatch,
  makeSub,
  pauseMatch,
  pickOut,
  resumeMatch,
  setSpeed,
  skipMatch,
  startMatch,
} from "./matchFlow";
import { useUi } from "./uiStore";

const currentMatch = () => useUi.getState().match!;

describe("luồng trận đấu", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startTestGame();
    let goals = 0;
    while (!gameState.matchToday && goals++ < 400) advance("next");
    expect(gameState.matchToday).toBeTruthy();
  });
  afterEach(() => {
    vi.useRealTimers();
    useUi.getState().setMatch(null);
  });

  it("vào trận: trước trận → điểm dừng → thay người → hết trận", () => {
    startMatch(true);
    expect(currentMatch().stage).toBe("pre");
    changeTactic({ ment: "att", press: "high" });
    expect(gameState.tactic).toEqual({ ment: "att", press: "high" });
    resumeMatch();
    expect(currentMatch().stage).toBe("play");
    vi.advanceTimersByTime(3_000);
    expect(currentMatch().stage).toBe("play");
    pauseMatch();
    expect(currentMatch().stage).toBe("pause");
    const startTick = currentMatch().tick;
    expect(startTick).toBeGreaterThan(3);
    vi.advanceTimersByTime(5_000);
    expect(currentMatch().tick).toBe(startTick); // đang tạm dừng thì đồng hồ đứng

    const side = currentMatch().liveSim.sides[currentMatch().liveSim.mySide];
    const outgoingId = side.lineup.find((id, i) => id && i > 0 && !side.removed.includes(id))!;
    pickOut(outgoingId);
    expect(makeSub(side.bench.find((benchId) => benchId !== outgoingId)!)).toBeNull();
    expect(side.subsLeft).toBe(4);

    setSpeed(4);
    // chấn thương của cầu thủ mình cũng làm trận tự dừng nên tiếp tục tới khi chạm nghỉ giữa hiệp
    for (
      let guard = 0;
      guard < 10 && currentMatch().tick < currentMatch().liveSim.pauses[0];
      guard++
    ) {
      resumeMatch();
      vi.advanceTimersByTime(20_000);
    }
    expect(currentMatch().stage).toBe("pause"); // tự dừng ở nghỉ giữa hiệp
    expect(currentMatch().tick).toBe(currentMatch().liveSim.pauses[0]);
    // hiệp hai cũng có thể dừng vì chấn thương, nên tiếp tục tới khi trận kết thúc
    for (let guard = 0; guard < 10 && currentMatch().stage !== "done"; guard++) {
      resumeMatch();
      vi.advanceTimersByTime(20_000);
    }
    expect(currentMatch().stage).toBe("done");
    expect(currentMatch().matchSim?.manOfTheMatch).toBeTruthy();
    expect(gameState.matchToday).toBeNull();
    closeMatch();
    expect(useUi.getState().match).toBeNull();
  });

  it("xem kết quả ngay chốt trận và ghi nhận lượt đá", () => {
    startMatch(true);
    resumeMatch();
    skipMatch();
    expect(currentMatch().stage).toBe("done");
    expect(gameState.lastMatch?.matchSim.homeGoals).toBe(currentMatch().matchSim!.homeGoals);
    expect(gameState.matchToday).toBeNull();
  });

  it("giả lập nhanh chốt trận ngay", () => {
    startMatch(false);
    expect(currentMatch().stage).toBe("done");
    expect(gameState.matchToday).toBeNull();
  });
});
