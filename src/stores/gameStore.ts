// Cầu nối giữa engine (trạng thái S mutable) và React.
// Mọi thay đổi đi qua commit(): chạy hàm của engine → tăng phiên bản để các component vẽ lại → lưu (debounce).
import { create } from "zustand";
import { gameState, setState } from "@/engine/state";
import type { DataRow } from "@/engine/types";
import { newGameReal, registerSavedCustomLogos, type RealStart } from "@/engine/world";
import { loadPack } from "@/lib/data";
import { clearGame, loadGame, saveGame } from "@/lib/persist";

type Status = "loading" | "none" | "ready";
interface GameStore {
  status: Status;
  version: number;
  boot: () => Promise<void>;
  commit: <T>(action?: () => T) => T | undefined;
  startReal: (
    rows: DataRow[],
    lgId: string,
    club: string,
    dataSource: string,
    opts?: RealStart,
  ) => void;
  reset: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (gameState) void saveGame(gameState);
  }, 250);
}

export const useGame = create<GameStore>((set, get) => ({
  status: "loading",
  version: 0,
  boot: async () => {
    await loadPack("fifacm");
    const state = await loadGame();
    if (state && !state.leagueNames) state.leagueNames = {};
    setState(state);
    if (state) registerSavedCustomLogos();
    set({ status: state ? "ready" : "none", version: get().version + 1 });
  },
  commit: (action) => {
    const result = action ? action() : undefined;
    set({ version: get().version + 1 });
    scheduleSave();
    return result;
  },
  startReal: (rows, lgId, club, dataSource, opts) => {
    newGameReal(rows, lgId, club, dataSource, opts);
    set({ status: "ready", version: get().version + 1 });
    scheduleSave();
  },
  reset: async () => {
    clearTimeout(saveTimer);
    await clearGame();
    setState(null);
    set({ status: "none", version: get().version + 1 });
  },
}));

/** Đăng ký vẽ lại khi trạng thái game thay đổi. Trả về phiên bản hiện tại. */
export const useGameVersion = (): number => useGame((store) => store.version);
export const commit = <T>(action?: () => T): T | undefined => useGame.getState().commit(action);
