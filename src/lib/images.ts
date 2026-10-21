// Ảnh người dùng tự thêm (mặt cầu thủ, huy hiệu CLB). Lưu riêng trong IndexedDB, không nằm trong file lưu game.
import { clear, createStore, del, entries, set } from "idb-keyval";
import { create } from "zustand";
import type { Player } from "@/engine/types";

const store = createStore("sanco-career-img", "i");

export const playerImgKey = (player: Pick<Player, "name" | "longName">): string =>
  "p:" + (player.longName || player.name);
export const clubImgKey = (name: string): string => "c:" + name;

interface ImgState {
  map: Record<string, string>;
  load: () => Promise<void>;
  saveImage: (key: string, url: string | null) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useImages = create<ImgState>((setS, getS) => ({
  map: {},
  load: async () => {
    try {
      const storedEntries = await entries<string, string>(store);
      setS({ map: Object.fromEntries(storedEntries) });
    } catch {
      /* trình duyệt chặn IndexedDB */
    }
  },
  saveImage: async (key, url) => {
    const map = { ...getS().map };
    if (url) map[key] = url;
    else delete map[key];
    setS({ map });
    try {
      if (url) await set(key, url, store);
      else await del(key, store);
    } catch {
      /* bỏ qua */
    }
  },
  clearAll: async () => {
    setS({ map: {} });
    try {
      await clear(store);
    } catch {
      /* bỏ qua */
    }
  },
}));

export const useImg = (key: string): string | undefined =>
  useImages((imageState) => imageState.map[key]);

/** Thu ảnh về khung vuông 192px (webp nếu trình duyệt hỗ trợ) */
export function shrinkImage(file: File, max = 192): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale),
          height = Math.round(image.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = max;
        canvas.height = max;
        canvas
          .getContext("2d")!
          .drawImage(image, (max - width) / 2, (max - height) / 2, width, height);
        let dataUrl = canvas.toDataURL("image/webp", 0.85);
        if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      };
      image.onerror = () => reject(new Error("Không đọc được ảnh " + file.name));
      image.src = reader.result as string;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const normalizeKey = (text: string | undefined): string =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Nhập nhiều ảnh: tên file trùng tên cầu thủ (ngắn hoặc đầy đủ) hoặc tên CLB */
export async function bulkImages(
  files: File[],
  players: Player[],
  clubNames: string[],
): Promise<{ pngCount: number; clubCount: number; miss: string[] }> {
  const pmap = new Map<string, Player>(),
    cmap = new Map<string, string>();
  players.forEach((player) => {
    if (player.club == null) return;
    [player.name, player.longName].forEach((playerName) => {
      const key = normalizeKey(playerName);
      if (key && !pmap.has(key)) pmap.set(key, player);
    });
  });
  clubNames.forEach((clubName) => cmap.set(normalizeKey(clubName), clubName));
  let pngCount = 0,
    clubCount = 0;
  const miss: string[] = [];
  const { saveImage } = useImages.getState();
  for (const file of files) {
    const base = normalizeKey(file.name.replace(/\.[^.]+$/, ""));
    const clubName = cmap.get(base),
      player = pmap.get(base);
    if (!clubName && !player) {
      miss.push(file.name);
      continue;
    }
    try {
      const dataUrl = await shrinkImage(file);
      if (clubName) {
        await saveImage(clubImgKey(clubName), dataUrl);
        clubCount++;
      } else {
        await saveImage(playerImgKey(player!), dataUrl);
        pngCount++;
      }
    } catch {
      miss.push(file.name);
    }
  }
  return { pngCount, clubCount, miss };
}
