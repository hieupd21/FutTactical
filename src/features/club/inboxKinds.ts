// Mỗi loại thông báo có biểu tượng, nhãn và hành vi riêng khi bấm vào.
import {
  Briefcase,
  CalendarClock,
  CircleX,
  ClipboardList,
  Cross,
  FileClock,
  HandCoins,
  Info,
  Mail,
  Megaphone,
  MessageCircle,
  PartyPopper,
  Sprout,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getNegotiation, getPlayer } from "@/engine/state";
import type { InboxKind, InboxMessage } from "@/engine/types";
import { toast, type useUi } from "@/stores/uiStore";

type Ui = ReturnType<typeof useUi.getState>;
interface KindDef {
  label: string; // loại thông báo
  actionLabel: string; // hành động khi bấm
  icon: LucideIcon;
  perform: (message: InboxMessage, ui: Ui) => void;
}

const goMarket = (ui: Ui, marketTab: "search" | "nego"): void => {
  ui.setTab("market");
  ui.setMarketSub(marketTab);
};
/** Mở đàm phán; nếu thương vụ đã bị dọn khỏi danh sách thì dẫn tới tab Đàm phán */
const openDeal = (message: InboxMessage, ui: Ui): void => {
  if (message.negotiationId && getNegotiation(message.negotiationId))
    ui.openNego(message.negotiationId);
  else goMarket(ui, "nego");
};
const openPlayerOr = (message: InboxMessage, ui: Ui, fallback: () => void): void => {
  if (message.playerId && getPlayer(message.playerId)) ui.openPlayer(message.playerId);
  else fallback();
};
const show = (message: InboxMessage): void => toast(message.body);

export const INBOX_KINDS: Record<InboxKind, KindDef> = {
  offer: { label: "Đề nghị mua", actionLabel: "Xem đề nghị", icon: HandCoins, perform: openDeal },
  reply: {
    label: "Phản hồi đàm phán",
    actionLabel: "Xem phản hồi",
    icon: MessageCircle,
    perform: openDeal,
  },
  dealFail: { label: "Đổ vỡ", actionLabel: "Xem lý do", icon: CircleX, perform: openDeal },
  agent: {
    label: "Người đại diện",
    actionLabel: "Xem thư",
    icon: Mail,
    perform: (_m, ui) => goMarket(ui, "nego"),
  },
  demand: {
    label: "Cầu thủ đòi hỏi",
    actionLabel: "Nói chuyện",
    icon: Megaphone,
    perform: (message, ui) => openPlayerOr(message, ui, () => ui.setTab("squad")),
  },
  injury: {
    label: "Chấn thương",
    actionLabel: "Xem cầu thủ",
    icon: Cross,
    perform: (message, ui) => {
      ui.setTab("squad");
      openPlayerOr(message, ui, () => undefined);
    },
  },
  contract: {
    label: "Hợp đồng",
    actionLabel: "Xem đội hình",
    icon: FileClock,
    perform: (_m, ui) => ui.setTab("squad"),
  },
  window: {
    label: "Kỳ chuyển nhượng",
    actionLabel: "Đến thị trường",
    icon: CalendarClock,
    perform: (_m, ui) => goMarket(ui, "search"),
  },
  finance: {
    label: "Tài chính",
    actionLabel: "Xem CLB",
    icon: Wallet,
    perform: (_m, ui) => ui.setTab("club"),
  },
  job: {
    label: "Lời mời HLV",
    actionLabel: "Xem lời mời",
    icon: Briefcase,
    perform: (_m, ui) => {
      ui.setTab("central");
      requestAnimationFrame(() =>
        document
          .getElementById("job-offers")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
    },
  },
  season: {
    label: "Tổng kết mùa",
    actionLabel: "Xem bảng xếp hạng",
    icon: Trophy,
    perform: (_m, ui) => {
      ui.setTab("club");
      ui.setClubView("standings");
    },
  },
  youth: {
    label: "Học viện",
    actionLabel: "Xem hồ sơ",
    icon: Sprout,
    perform: (message, ui) => openPlayerOr(message, ui, () => ui.setTab("squad")),
  },
  dof: {
    label: "Giám đốc thể thao",
    actionLabel: "Xem cầu thủ",
    icon: ClipboardList,
    perform: (message, ui) => openPlayerOr(message, ui, () => goMarket(ui, "nego")),
  },
  welcome: { label: "Chào mừng", actionLabel: "Đọc", icon: PartyPopper, perform: show },
  info: { label: "Thông tin", actionLabel: "Đọc", icon: Info, perform: show },
};

/** Bản lưu cũ chưa có kind: suy ra từ nid / pid */
export const kindOfMsg = (message: InboxMessage): InboxKind =>
  message.kind ?? (message.negotiationId ? "reply" : "info");
