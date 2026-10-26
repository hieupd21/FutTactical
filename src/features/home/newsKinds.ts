import type { NewsItem } from "@/engine/types";

/** Nhãn hiển thị cho từng loại tin */
export const NEWS_KIND_LABEL: Record<NewsItem["kind"], string> = {
  gen: "Chung",
  club: "CLB",
  transfer: "Chuyển nhượng",
  deal: "Đàm phán",
  flirt: "Thả thính",
  rebel: "Nổi loạn",
  match: "Trận đấu",
};
