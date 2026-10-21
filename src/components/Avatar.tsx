import { gameState } from "@/engine/state";
import type { Player } from "@/engine/types";
import { clubColors } from "@/lib/clubVisual";
import { playerImgKey, useImg } from "@/lib/images";

/** Ảnh cầu thủ: ảnh người dùng thêm, hoặc hình người cách điệu mặc áo CLB */
export function Avatar({ player, size = 36 }: { player: Player; size?: number }) {
  const custom = useImg(playerImgKey(player));
  if (custom) return <img className="av" src={custom} width={size} height={size} alt="" />;
  const club =
    player.club != null && gameState.clubs[player.club] ? gameState.clubs[player.club].name : "";
  let [primaryColor, secondaryColor] = clubColors(club || "x");
  if (player.pos === "GK") {
    primaryColor = "#2e8b57";
    secondaryColor = "#d7f5c4";
  }
  return (
    <svg className="av" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="20" fill="var(--soft)" />
      <circle cx="20" cy="15" r="7.2" fill="var(--muted)" opacity=".55" />
      <path
        d="M5 40 C6 29 12 25 20 25 C28 25 34 29 35 40 Z"
        fill={primaryColor}
        stroke="rgba(0,0,0,.18)"
        strokeWidth=".8"
      />
      <path d="M16 25.4 L20 30 L24 25.4" fill="none" stroke={secondaryColor} strokeWidth="2" />
    </svg>
  );
}
