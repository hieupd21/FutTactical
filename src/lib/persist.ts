// Lưu sự nghiệp vào IndexedDB (dữ liệu thật ~2 MB). Dự phòng localStorage khi IndexedDB bị chặn.
import { createStore, del, get, set } from "idb-keyval";
import type { GameState } from "@/engine/types";

const store = createStore("sanco-career", "s");
const LS_KEY = "sanco-career-v2";

export async function loadGame(): Promise<GameState | null> {
  try {
    return ((await get("career", store)) as GameState | undefined) ?? null;
  } catch {
    try {
      const s = localStorage.getItem(LS_KEY);
      return s ? (JSON.parse(s) as GameState) : null;
    } catch {
      return null;
    }
  }
}

export async function saveGame(s: GameState): Promise<void> {
  try {
    await set("career", s, store);
    await set("at", Date.now(), store);
  } catch {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* hết chỗ lưu */ }
  }
}

export async function clearGame(): Promise<void> {
  try { await del("career", store); } catch { /* bỏ qua */ }
  try { localStorage.removeItem(LS_KEY); } catch { /* bỏ qua */ }
}
