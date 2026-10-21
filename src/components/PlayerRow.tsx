import { Angry, Frown, Laugh, Meh, Smile } from "lucide-react";
import type { ReactNode } from "react";
import { formatMoney } from "@/engine/format";
import { dynamicRating, moraleLabel, ovrRange, yearsLeft } from "@/engine/players";
import { getClub, gameState } from "@/engine/state";
import type { Player } from "@/engine/types";
import { classNames, moraleColor } from "@/utils/display";
import { Avatar } from "./Avatar";
import { ClubBadge } from "./ClubBadge";
import { Badge } from "@/components/shadcn/badge";

const MOODS = [Angry, Frown, Meh, Smile, Laugh];
/** Tinh thần: biểu tượng mặt (không chỉ dựa vào màu) kèm nhãn chữ cho trình đọc màn hình */
function Mood({ morale }: { morale: number }) {
  const Icon = MOODS[morale >= 80 ? 4 : morale >= 60 ? 3 : morale >= 40 ? 2 : morale >= 20 ? 1 : 0];
  return (
    <Icon
      size={14}
      strokeWidth={2.25}
      style={{ color: moraleColor(morale) }}
      role="img"
      aria-label={"Tinh thần: " + moraleLabel(morale)}
    />
  );
}

export function FitBar({ fitness }: { fitness: number }) {
  return (
    <span className="fit" role="img" aria-label={"Thể lực " + Math.round(fitness) + "/100"}>
      <i className={fitness < 70 ? "low" : ""} style={{ width: `${fitness}%` }} />
    </span>
  );
}

/** Một dòng cầu thủ trong danh sách */
export function PlayerRow({
  player,
  right,
  className,
  onClick,
}: {
  player: Player;
  right?: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  const rating = dynamicRating(player),
    diff = rating - ovrRange(player);
  const mine = player.club === gameState.myClubId;
  const ratingLabel =
    right ??
    (mine ? (
      <>
        <FitBar fitness={player.fitness} />
        <span>{moraleLabel(player.morale)}</span>
      </>
    ) : (
      <>
        <b>{formatMoney(player.marketValue)}</b>
        <span className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
          {player.club != null ? (
            <>
              <ClubBadge name={getClub(player.club).name} size={16} />
              {getClub(player.club).name}
            </>
          ) : (
            "Tự do"
          )}
        </span>
      </>
    ));
  return (
    <button className={classNames("prow", className)} onClick={onClick}>
      <span className="ovr">
        {rating}
        <small>{diff ? (diff > 0 ? "+" : "") + diff : "·"}</small>
      </span>
      <Avatar player={player} size={36} />
      <span>
        <span className="nm">{player.name}</span>
        <span className="sub">
          <Badge variant="pos" className={`pos ${player.pos}`}>
            {player.pos}
          </Badge>
          {player.secondaryPositions.map((line) => (
            <Badge key={line} variant="pos" className={`pos alt text-foreground ${line}`}>
              {line}
            </Badge>
          ))}
          <span>{player.age} tuổi</span>
          <Mood morale={player.morale} />
          {player.injuryDays > 0 && (
            <Badge variant="tag" className="tag inj">
              Chấn thương {player.injuryDays}n
            </Badge>
          )}
          {player.away && (
            <Badge variant="tag" className="tag away">
              Đang ở {getClub(player.away.club).name}
            </Badge>
          )}
          {player.loan && (
            <Badge variant="tag" className="tag loan">
              Mượn
            </Badge>
          )}
          {player.listed && (
            <Badge variant="tag" className="tag sale">
              Rao bán
            </Badge>
          )}
          {mine && yearsLeft(player) <= 1 && !player.loan && (
            <Badge variant="tag" className="tag exp">
              HĐ hết 30/6
            </Badge>
          )}
        </span>
      </span>
      <span className="rt">{ratingLabel}</span>
    </button>
  );
}
