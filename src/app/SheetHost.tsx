// Bảng trượt đang mở (một lúc chỉ một). Ghép các feature ở tầng app để feature không import lẫn nhau.
import { MatchSheet } from "@/features/match/MatchSheet";
import { NegoSheet } from "@/features/negotiation/NegoSheet";
import { PlayerSheet } from "@/features/player/PlayerSheet";
import { useUi } from "@/stores/uiStore";

export function SheetHost() {
  const sheet = useUi((s) => s.sheet);
  if (!sheet) return null;
  if (sheet.type === "player") return <PlayerSheet key={sheet.id} id={sheet.id} />;
  if (sheet.type === "nego") return <NegoSheet key={sheet.id} id={sheet.id} />;
  return <MatchSheet />;
}
