// Cầu nối giữa engine (trạng thái S mutable) và React.
// Mọi thay đổi đi qua commit(): chạy hàm của engine → tăng phiên bản để các component vẽ lại → lưu (debounce).
import { create } from "zustand";
import { S, setState } from "@/engine/state";
import type { DataRow } from "@/engine/types";
import { newGame, newGameReal } from "@/engine/world";
import { clearGame, loadGame, saveGame } from "@/lib/persist";

type Status = "loading" | "none" | "ready";
interface GameStore {
  status: Status;
  v: number;
  boot: () => Promise<void>;
  commit: <T>(fn?: () => T) => T | undefined;
  startReal: (rows: DataRow[], lgId: string, club: string, src: string) => void;
  startFict: (lgId: string, clubIdx: number) => void;
  reset: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (S) void saveGame(S); }, 250);
}

export const useGame = create<GameStore>((set, get) => ({
  status: "loading",
  v: 0,
  boot: async () => {
    const s = await loadGame();
    if (s && !s.lgN) s.lgN = {};
    setState(s);
    set({ status: s ? "ready" : "none", v: get().v + 1 });
  },
  commit: (fn) => {
    const r = fn ? fn() : undefined;
    set({ v: get().v + 1 });
    scheduleSave();
    return r;
  },
  startReal: (rows, lgId, club, src) => {
    newGameReal(rows, lgId, club, src);
    set({ status: "ready", v: get().v + 1 });
    scheduleSave();
  },
  startFict: (lgId, clubIdx) => {
    newGame(lgId, clubIdx);
    set({ status: "ready", v: get().v + 1 });
    scheduleSave();
  },
  reset: async () => {
    clearTimeout(saveTimer);
    await clearGame();
    setState(null);
    set({ status: "none", v: get().v + 1 });
  },
}));

/** Đăng ký vẽ lại khi trạng thái game thay đổi. Trả về phiên bản hiện tại. */
export const useGameVersion = (): number => useGame((s) => s.v);
export const commit = <T,>(fn?: () => T): T | undefined => useGame.getState().commit(fn);
