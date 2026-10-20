// Bảng trượt đang mở (một lúc chỉ một). Ghép các feature ở tầng app để feature không import lẫn nhau.
import { Suspense } from "react";
import { PlayerSheet } from "@/features/player/PlayerSheet";
import { useUi } from "@/stores/uiStore";
import { MatchSheet, NegoSheet } from "./lazyPages";

export function SheetHost() {
  const sheet = useUi((s) => s.sheet);
  if (!sheet) return null;
  if (sheet.type === "player") return <PlayerSheet key={sheet.id} id={sheet.id} />;
  return <Suspense fallback={null}>{sheet.type === "nego" ? <NegoSheet key={sheet.id} id={sheet.id} /> : <MatchSheet />}</Suspense>;
}
