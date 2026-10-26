// Trạng thái giao diện (không lưu vào file game).
import { toast as sonner } from "sonner";
import { create } from "zustand";
import type { LiveSim, MatchSim } from "@/engine/types";

type SheetState =
  { type: "player"; id: string } | { type: "nego"; id: string } | { type: "match" } | null;
export type TabKey = "home" | "squad" | "market" | "calendar" | "league" | "club";
export type MarketSub = "search" | "short" | "nego" | "mine" | "news";
export interface Filters {
  pos: string;
  leagueId: string;
  age: number;
  max: number;
  expiringOnly: boolean;
  sort: "ovr" | "val" | "age" | "pot";
}
export interface LiveMatch {
  liveSim: LiveSim;
  stage: "pre" | "play" | "pause" | "done";
  tick: number; // tick đang hiển thị
  speed: 1 | 2 | 4;
  outgoingId: string | null; // cầu thủ đang chọn để rút ra sân
  matchSim?: MatchSim; // có khi trận đã chốt
}
type FormVal = number | string;

interface UiState {
  currentTab: TabKey;
  tabStack: TabKey[];
  sheet: SheetState;
  ptab: "info" | "scout" | null;
  error: string | null;
  swapIn: string | null;
  form: Record<string, FormVal>;
  marketSub: MarketSub;
  filters: Filters;
  lgView: string | null;
  match: LiveMatch | null;
  openPlayer: (id: string) => void;
  openNego: (id: string) => void;
  closeSheet: () => void;
  setTab: (currentTab: TabKey) => void;
  goBack: () => boolean;
  setPtab: (currentTab: "info" | "scout") => void;
  setErr: (message: string | null) => void;
  setSwapIn: (id: string | null) => void;
  setForm: (key: string, value: FormVal) => void;
  setMarketSub: (subTab: MarketSub) => void;
  setFlt: (changes: Partial<Filters>) => void;
  setLgView: (leagueId: string) => void;
  setMatch: (liveMatch: LiveMatch | null) => void;
}

const TAB_STACK_MAX = 10;

export const useUi = create<UiState>((set, get) => ({
  currentTab: "home",
  tabStack: [],
  sheet: null,
  ptab: null,
  error: null,
  swapIn: null,
  form: {},
  marketSub: "search",
  filters: { pos: "", leagueId: "", age: 40, max: 0, expiringOnly: false, sort: "ovr" },
  lgView: null,
  match: null,
  openPlayer: (id) => set({ sheet: { type: "player", id }, ptab: null, error: null }),
  openNego: (id) => set({ sheet: { type: "nego", id }, error: null }),
  closeSheet: () => set({ sheet: null, ptab: null, error: null }),
  setTab: (currentTab) =>
    set((ui) =>
      currentTab === ui.currentTab
        ? ui
        : { currentTab, tabStack: [...ui.tabStack, ui.currentTab].slice(-TAB_STACK_MAX) },
    ),
  // Nút Back: đóng lớp trên cùng trước, rồi lùi tab. Trả false khi không còn gì để lùi (thoát app).
  goBack: () => {
    const ui = get();
    if (ui.sheet?.type === "match") return true; // đang xem trận: chặn Back
    if (ui.sheet) set({ sheet: null, ptab: null, error: null });
    else if (ui.swapIn) set({ swapIn: null });
    else if (ui.tabStack.length)
      set({ currentTab: ui.tabStack[ui.tabStack.length - 1], tabStack: ui.tabStack.slice(0, -1) });
    else return false;
    return true;
  },
  setPtab: (ptab) => set({ ptab }),
  setErr: (error) => set({ error }),
  setSwapIn: (swapIn) => set({ swapIn }),
  setForm: (key, value) => set((ui) => ({ form: { ...ui.form, [key]: value } })),
  setMarketSub: (marketSub) => set({ marketSub }),
  setFlt: (changes) => set((ui) => ({ filters: { ...ui.filters, ...changes } })),
  setLgView: (lgView) => set({ lgView }),
  setMatch: (match) => set({ match, sheet: match ? { type: "match" } : null }),
}));

export const toast = (message: string): void => void sonner(message);
