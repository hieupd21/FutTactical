import { dynamicRating } from "@/engine/players";
import type { Player } from "@/engine/types";
import { Avatar } from "@/components/Avatar";
import { classNames, lastName } from "@/utils/display";

/** Hình thoi chỉ số viền trắng: ô vuông xoay 45°, số xoay ngược lại cho thẳng */
function RatingDiamond({ player }: { player: Player }) {
  return (
    <span className="absolute top-0 -right-4 size-6">
      <span className="absolute inset-0 grid rotate-45 place-items-center rounded-sm border border-white/50! bg-muted">
        <b className="-rotate-45 text-xs leading-none font-bold tabular-nums">
          {dynamicRating(player)}
        </b>
      </span>
    </span>
  );
}

function FitnessLine({ fitness }: { fitness: number }) {
  return (
    <span
      className="h-0.75 w-full overflow-hidden rounded-full bg-foreground/20"
      role="img"
      aria-label={`Thể lực ${Math.round(fitness)}/100`}
    >
      <i
        className={classNames(
          "block h-full rounded-full",
          fitness < 70 ? "bg-destructive" : "bg-(--win)",
        )}
        style={{ width: `${fitness}%` }}
      />
    </span>
  );
}

/** Kích thước (px) của thẻ cầu thủ, dùng chung cho sân và băng ghế */
export const CARD_WIDTH = 76;
export const CARD_HEIGHT = 86;

/** Cỡ thẻ hiện hành (px); sân, băng ghế và lưới dự bị đọc chung từ đây để luôn bằng nhau */
export function useCardSize(): { width: number; height: number } {
  return { width: CARD_WIDTH, height: CARD_HEIGHT };
}

/** Thẻ cầu thủ dùng chung cho sân và băng ghế: ảnh, chỉ số động, thanh thể lực, tên */
export function PlayerCard({
  player,
  positionLabel,
  isSelected,
  isTarget,
  onClick,
}: {
  player: Player;
  /** nhãn vị trí nhỏ cạnh ảnh */
  positionLabel: string;
  isSelected: boolean;
  /** đang chọn chỗ để thay người: thẻ này là chỗ có thể đặt vào */
  isTarget: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`${player.name}, chỉ số ${dynamicRating(player)}${isTarget ? ", chọn để thay người" : ""}`}
      title={player.name}
      data-target={isTarget || undefined}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      className={classNames(
        "squad-pitch-card group relative flex shrink-0 cursor-pointer flex-col items-center rounded-lg border-0 px-1 pt-1.5 pb-1 text-inherit transition-colors",
        player.injuryDays > 0 && "opacity-60",
      )}
    >
      <span className="relative">
        <Avatar player={player} size={50} />
        <RatingDiamond player={player} />
        <span className="absolute -right-3 -bottom-0.5 text-[10px] font-extrabold text-foreground">
          {positionLabel}
        </span>
      </span>
      <FitnessLine fitness={player.fitness} />
      <span className="-mx-1 mt-1 w-[calc(100%+0.5rem)] flex justify-center text-[9px] leading-tight tracking-tight font-extrabold uppercase text-shadow-amber-600">
        {lastName(player.name)}
      </span>
    </button>
  );
}

/** Ô trống của đội hình ra sân (cầu thủ rời đội / chấn thương chưa được lấp) */
export function EmptySlot({
  positionLabel,
  isTarget,
  onClick,
}: {
  positionLabel?: string;
  isTarget: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Vị trí trống"
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      className={classNames(
        "grid h-20 w-full cursor-pointer place-items-center rounded-xl border border-dashed border-foreground/30 bg-transparent text-xs text-muted-foreground",
        isTarget && "bg-(--accent)/20",
      )}
    >
      {positionLabel ?? "Trống"}
    </button>
  );
}
