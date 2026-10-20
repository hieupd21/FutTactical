// Trạng thái giao diện (không lưu vào file game).
import { toast as sonner } from "sonner";
import { create } from "zustand";
import type { MatchSim } from "@/engine/types";

export type SheetState = { type: "player"; id: string } | { type: "nego"; id: string } | { type: "match" } | null;
export type TabKey = "home" | "squad" | "market" | "league" | "club";
export type MarketSub = "search" | "short" | "nego" | "mine" | "news";
export interface Filters {
  pos: string;
  lg: string;
  age: number;
  max: number;
  exp: boolean;
  sort: "ovr" | "val" | "age" | "pot";
}
export interface LiveMatch {
  m: MatchSim;
  min: number;
  done: boolean;
  lines: Record<number, string>;
}
type FormVal = number | string;

interface UiState {
  tab: TabKey;
  tabStack: TabKey[];
  sheet: SheetState;
  ptab: "info" | "scout" | null;
  err: string | null;
  swapIn: string | null;
  form: Record<string, FormVal>;
  marketSub: MarketSub;
  flt: Filters;
  lgView: string | null;
  match: LiveMatch | null;
  openPlayer: (id: string) => void;
  openNego: (id: string) => void;
  closeSheet: () => void;
  setTab: (t: TabKey) => void;
  goBack: () => boolean;
  setPtab: (t: "info" | "scout") => void;
  setErr: (e: string | null) => void;
  setSwapIn: (id: string | null) => void;
  setForm: (k: string, v: FormVal) => void;
  setMarketSub: (s: MarketSub) => void;
  setFlt: (p: Partial<Filters>) => void;
  setLgView: (l: string) => void;
  setMatch: (m: LiveMatch | null) => void;
}

const TAB_STACK_MAX = 10;

export const useUi = create<UiState>((set, get) => ({
  tab: "home",
  tabStack: [],
  sheet: null,
  ptab: null,
  err: null,
  swapIn: null,
  form: {},
  marketSub: "search",
  flt: { pos: "", lg: "", age: 40, max: 0, exp: false, sort: "ovr" },
  lgView: null,
  match: null,
  openPlayer: (id) => set({ sheet: { type: "player", id }, ptab: null, err: null }),
  openNego: (id) => set({ sheet: { type: "nego", id }, err: null }),
  closeSheet: () => set({ sheet: null, ptab: null, err: null }),
  setTab: (tab) => set((s) => (tab === s.tab ? s : { tab, tabStack: [...s.tabStack, s.tab].slice(-TAB_STACK_MAX) })),
  // Nút Back: đóng lớp trên cùng trước, rồi lùi tab. Trả false khi không còn gì để lùi (thoát app).
  goBack: () => {
    const s = get();
    if (s.sheet?.type === "match") return true; // đang xem trận: chặn Back
    if (s.sheet) set({ sheet: null, ptab: null, err: null });
    else if (s.swapIn) set({ swapIn: null });
    else if (s.tabStack.length) set({ tab: s.tabStack[s.tabStack.length - 1], tabStack: s.tabStack.slice(0, -1) });
    else return false;
    return true;
  },
  setPtab: (ptab) => set({ ptab }),
  setErr: (err) => set({ err }),
  setSwapIn: (swapIn) => set({ swapIn }),
  setForm: (k, v) => set((s) => ({ form: { ...s.form, [k]: v } })),
  setMarketSub: (marketSub) => set({ marketSub }),
  setFlt: (p) => set((s) => ({ flt: { ...s.flt, ...p } })),
  setLgView: (lgView) => set({ lgView }),
  setMatch: (match) => set({ match, sheet: match ? { type: "match" } : null }),
}));

export const toast = (m: string): void => void sonner(m);
