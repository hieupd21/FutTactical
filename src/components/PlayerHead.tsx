import type { ReactNode } from "react";
import { POSITION_NAMES } from "@/engine/constants";
import { dynamicRating, natName, ovrRange } from "@/engine/players";
import { getClub } from "@/engine/state";
import type { Player } from "@/engine/types";
import { Avatar } from "./Avatar";
import { ClubBadge } from "./ClubBadge";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";

/** Phần đầu bảng trượt: ảnh, chỉ số, tên, CLB. Dùng cho hồ sơ cầu thủ và đàm phán. */
export function PlayerHead({
  player,
  extra,
  onClose,
}: {
  player: Player;
  extra?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="grab" />
      <div className="sh-head">
        <div className="pav">
          <Avatar player={player} size={72} />
          <span className="pr">{dynamicRating(player)}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="sh-name">{player.name}</div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <Badge variant="pos" className={`pos ${player.pos}`}>
              {POSITION_NAMES[player.pos]}
            </Badge>
            {player.secondaryPositions.map((line) => (
              <Badge key={line} variant="pos" className={`pos alt text-foreground ${line}`}>
                {line}
              </Badge>
            ))}
            <span className="hint">
              {player.age} tuổi · {natName(player)} · gốc {ovrRange(player)}
            </span>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {player.club != null ? (
              <>
                <ClubBadge name={getClub(player.club).name} size={20} />
                <span className="hint" style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {getClub(player.club).name}
                </span>
              </>
            ) : (
              <span className="hint">Cầu thủ tự do</span>
            )}
          </div>
          {player.longName && player.longName !== player.name ? (
            <div className="hint">
              {player.longName}
              {player.positionDetail ? " · " + player.positionDetail : ""}
            </div>
          ) : player.positionDetail ? (
            <div className="hint">{player.positionDetail}</div>
          ) : null}
          {extra}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="x size-11 rounded-full border border-border text-xl"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </Button>
        )}
      </div>
    </>
  );
}
