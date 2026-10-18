// Ảnh người dùng tự thêm (mặt cầu thủ, huy hiệu CLB). Lưu riêng trong IndexedDB, không nằm trong file lưu game.
import { clear, createStore, del, entries, set } from "idb-keyval";
import { create } from "zustand";
import type { Player } from "@/engine/types";

const store = createStore("sanco-career-img", "i");

export const playerImgKey = (p: Pick<Player, "n" | "ln">): string => "p:" + (p.ln || p.n);
export const clubImgKey = (name: string): string => "c:" + name;

interface ImgState {
  map: Record<string, string>;
  load: () => Promise<void>;
  put: (key: string, url: string | null) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useImages = create<ImgState>((setS, getS) => ({
  map: {},
  load: async () => {
    try {
      const all = await entries<string, string>(store);
      setS({ map: Object.fromEntries(all) });
    } catch { /* trình duyệt chặn IndexedDB */ }
  },
  put: async (key, url) => {
    const map = { ...getS().map };
    if (url) map[key] = url; else delete map[key];
    setS({ map });
    try { if (url) await set(key, url, store); else await del(key, store); } catch { /* bỏ qua */ }
  },
  clearAll: async () => {
    setS({ map: {} });
    try { await clear(store); } catch { /* bỏ qua */ }
  },
}));

export const useImg = (key: string): string | undefined => useImages((s) => s.map[key]);

/** Thu ảnh về khung vuông 192px (webp nếu trình duyệt hỗ trợ) */
export function shrinkImage(file: File, max = 192): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const sc = Math.min(1, max / Math.max(im.width, im.height));
        const w = Math.round(im.width * sc), h = Math.round(im.height * sc);
        const cv = document.createElement("canvas");
        cv.width = max; cv.height = max;
        cv.getContext("2d")!.drawImage(im, (max - w) / 2, (max - h) / 2, w, h);
        let u = cv.toDataURL("image/webp", 0.85);
        if (!u.startsWith("data:image/webp")) u = cv.toDataURL("image/png");
        res(u);
      };
      im.onerror = () => rej(new Error("Không đọc được ảnh " + file.name));
      im.src = fr.result as string;
    };
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}

export const normKey = (s: string | undefined): string =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Nhập nhiều ảnh: tên file trùng tên cầu thủ (ngắn hoặc đầy đủ) hoặc tên CLB */
export async function bulkImages(files: File[], players: Player[], clubNames: string[]): Promise<{ pc: number; cc: number; miss: string[] }> {
  const pmap = new Map<string, Player>(), cmap = new Map<string, string>();
  players.forEach((p) => { if (p.club == null) return; [p.n, p.ln].forEach((n) => { const k = normKey(n); if (k && !pmap.has(k)) pmap.set(k, p); }); });
  clubNames.forEach((c) => cmap.set(normKey(c), c));
  let pc = 0, cc = 0;
  const miss: string[] = [];
  const { put } = useImages.getState();
  for (const f of files) {
    const base = normKey(f.name.replace(/\.[^.]+$/, ""));
    const c = cmap.get(base), p = pmap.get(base);
    if (!c && !p) { miss.push(f.name); continue; }
    try {
      const u = await shrinkImage(f);
      if (c) { await put(clubImgKey(c), u); cc++; } else { await put(playerImgKey(p!), u); pc++; }
    } catch { miss.push(f.name); }
  }
  return { pc, cc, miss };
}
