// Lưu sự nghiệp vào IndexedDB (dữ liệu thật ~2 MB). Dự phòng localStorage khi IndexedDB bị chặn.
import { createStore, del, get, set } from "idb-keyval";
import type { GameState } from "@/engine/types";

const store = createStore("sanco-career", "s");
const LS_KEY = "sanco-career-v2";

// Bản lưu cũ (trước khi đổi tên field cho rõ nghĩa) không có saveVersion: bỏ qua, bắt đầu sự nghiệp mới.
const isCurrentSave = (save: GameState | null | undefined): save is GameState =>
  typeof save?.saveVersion === "number";

export async function loadGame(): Promise<GameState | null> {
  try {
    const save = (await get("career", store)) as GameState | undefined;
    return isCurrentSave(save) ? save : null;
  } catch {
    try {
      const rawSave = localStorage.getItem(LS_KEY);
      const save = rawSave ? (JSON.parse(rawSave) as GameState) : null;
      return isCurrentSave(save) ? save : null;
    } catch {
      return null;
    }
  }
}

export async function saveGame(state: GameState): Promise<void> {
  try {
    await set("career", state, store);
    await set("at", Date.now(), store);
  } catch {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* hết chỗ lưu */
    }
  }
}

export async function clearGame(): Promise<void> {
  try {
    await del("career", store);
  } catch {
    /* bỏ qua */
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* bỏ qua */
  }
}
