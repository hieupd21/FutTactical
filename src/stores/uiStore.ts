// Trạng thái giao diện (không lưu vào file game).
import { create } from "zustand";
import type { MatchSim } from "@/engine/types";

export type SheetState = { type: "player"; id: string } | { type: "nego"; id: string } | { type: "match" } | null;
export type MarketSub = "search" | "short" | "nego" | "mine" | "news";
export interface Filters { pos: string; lg: string; age: number; max: number; exp: boolean; sort: "ovr" | "val" | "age" | "pot" }
export interface LiveMatch { m: MatchSim; min: number; done: boolean; lines: Record<number, string> }
type FormVal = number | string;

interface UiState {
  sheet: SheetState;
  ptab: "info" | "scout" | null;
  err: string | null;
  toast: string | null;
  swapIn: string | null;
  form: Record<string, FormVal>;
  marketSub: MarketSub;
  flt: Filters;
  lgView: string | null;
  match: LiveMatch | null;
  openPlayer: (id: string) => void;
  openNego: (id: string) => void;
  closeSheet: () => void;
  setPtab: (t: "info" | "scout") => void;
  setErr: (e: string | null) => void;
  showToast: (m: string) => void;
  setSwapIn: (id: string | null) => void;
  setForm: (k: string, v: FormVal) => void;
  setMarketSub: (s: MarketSub) => void;
  setFlt: (p: Partial<Filters>) => void;
  setLgView: (l: string) => void;
  setMatch: (m: LiveMatch | null) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>((set) => ({
  sheet: null,
  ptab: null,
  err: null,
  toast: null,
  swapIn: null,
  form: {},
  marketSub: "search",
  flt: { pos: "", lg: "", age: 40, max: 0, exp: false, sort: "ovr" },
  lgView: null,
  match: null,
  openPlayer: (id) => set({ sheet: { type: "player", id }, ptab: null, err: null }),
  openNego: (id) => set({ sheet: { type: "nego", id }, err: null }),
  closeSheet: () => set({ sheet: null, ptab: null, err: null }),
  setPtab: (ptab) => set({ ptab }),
  setErr: (err) => set({ err }),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: null }), 2800);
  },
  setSwapIn: (swapIn) => set({ swapIn }),
  setForm: (k, v) => set((s) => ({ form: { ...s.form, [k]: v } })),
  setMarketSub: (marketSub) => set({ marketSub }),
  setFlt: (p) => set((s) => ({ flt: { ...s.flt, ...p } })),
  setLgView: (lgView) => set({ lgView }),
  setMatch: (match) => set({ match, sheet: match ? { type: "match" } : null }),
}));

export const toast = (m: string): void => useUi.getState().showToast(m);
