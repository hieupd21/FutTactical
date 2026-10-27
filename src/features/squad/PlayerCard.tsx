import { Avatar } from "@/components/Avatar";
import { dynamicRating, ovrRange } from "@/engine/players";
import { ratingAtSlot } from "@/engine/squad";
import type { Player } from "@/engine/types";
import { classNames, lastName } from "@/utils/display";

/** Hình thoi chỉ số viền trắng: ô vuông xoay 45°, số xoay ngược lại cho thẳng; quầng xanh ở đỉnh trên khi cao hơn OVR gốc, quầng đỏ ở đỉnh dưới khi thấp hơn */
export function RatingDiamond({
  rating,
  baseRating,
  isLarge = false,
}: {
  rating: number;
  /** OVR gốc của cầu thủ để so: cao hơn thì quầng xanh, thấp hơn thì quầng đỏ */
  baseRating: number;
  isLarge?: boolean;
}) {
  return (
    <span
      className={classNames("absolute top-0", isLarge ? "-right-10 size-10" : "-right-4 size-5.5")}
    >
      <span
        className={classNames(
          "absolute inset-0 grid rotate-45 place-items-center overflow-hidden rounded-sm border border-white/30 bg-muted",
          // Quầng sáng giống quầng tím của thẻ: xanh ở đỉnh trên (góc trên trái của ô đã xoay) khi cao hơn OVR gốc, đỏ ở đỉnh dưới (góc dưới phải) khi thấp hơn
          "after:pointer-events-none after:absolute after:inset-0 after:content-['']",
          rating > baseRating &&
            "after:bg-[radial-gradient(circle_at_0_0,var(--win),transparent_75%)]",
          rating < baseRating &&
            "after:bg-[radial-gradient(circle_at_100%_100%,var(--loss),transparent_75%)]",
          isLarge && "border-2",
        )}
      >
        <b
          className={classNames(
            "relative z-1 -rotate-45 leading-none font-bold text-white tabular-nums",
            isLarge ? "text-xl" : "text-xs",
          )}
        >
          {rating}
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
export const CARD_WIDTH = 70;
export const CARD_HEIGHT = 80;

/** Cỡ thẻ hiện hành (px); sân, băng ghế và lưới dự bị đọc chung từ đây để luôn bằng nhau */
export function useCardSize(): { width: number; height: number } {
  return { width: CARD_WIDTH, height: CARD_HEIGHT };
}

/** Thẻ cầu thủ dùng chung cho sân và băng ghế: ảnh, chỉ số động, thanh thể lực, tên */
export function PlayerCard({
  player,
  positionLabel,
  slotPosition,
  isSelected,
  isTarget,
  isDropTarget = false,
  onClick,
  buttonRef,
  dragProps,
  isDragging = false,
}: {
  player: Player;
  /** nhãn vị trí nhỏ cạnh ảnh */
  positionLabel: string;
  /** ô đội hình đang đứng (LB, CDM...) để tính chỉ số theo vị trí; bỏ trống ở băng ghế */
  slotPosition?: string;
  isSelected: boolean;
  /** đang chọn chỗ để thay người: thẻ này là chỗ có thể đặt vào */
  isTarget: boolean;
  /** đang có thẻ được kéo tới đúng ô này: hiện viền chạy như khi chọn */
  isDropTarget?: boolean;
  onClick: () => void;
  /** ref và thuộc tính kéo thả do DraggablePlayerCard truyền vào */
  buttonRef?: React.Ref<HTMLButtonElement>;
  dragProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
}) {
  const rating = slotPosition ? ratingAtSlot(player, slotPosition) : dynamicRating(player);
  return (
    <button
      type="button"
      ref={buttonRef}
      {...dragProps}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`${player.name}, chỉ số ${rating}${isTarget ? ", chọn để thay người" : ""}`}
      title={player.name}
      data-target={isTarget || isDropTarget || undefined}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      className={classNames(
        "squad-pitch-card group relative flex shrink-0 cursor-pointer flex-col items-center rounded-lg border-0 px-1 pt-1.5 pb-1 text-inherit transition-colors",
        player.injuryDays > 0 && "opacity-60",
        dragProps && "select-none",
        isDragging && "opacity-40",
      )}
    >
      <span className="relative">
        <Avatar player={player} size={46} />
        <RatingDiamond rating={rating} baseRating={ovrRange(player)} />
        <span className="absolute -right-3.5 bottom-0.5 text-[9px] font-medium">
          {positionLabel}
        </span>
      </span>
      <FitnessLine fitness={player.fitness} />
      <span className="-mx-1 mt-1 w-[calc(100%+0.5rem)] flex justify-center text-[9px] leading-tight tracking-tight font-extrabold uppercase">
        {lastName(player.name)}
      </span>
    </button>
  );
}

/** Ô trống của đội hình ra sân (cầu thủ rời đội / chấn thương chưa được lấp) */
export function EmptySlot({
  positionLabel,
  isTarget,
  isDropTarget = false,
  onClick,
}: {
  positionLabel?: string;
  isTarget: boolean;
  isDropTarget?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Vị trí trống"
      data-target={isDropTarget || undefined}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      className={classNames(
        "grid h-20 w-full cursor-pointer place-items-center rounded-xl border border-dashed border-foreground/30 bg-transparent text-xs text-muted-foreground",
        isTarget && "bg-(--accent)/20",
        isDropTarget && "border-solid border-(--accent) bg-(--accent)/20",
      )}
    >
      {positionLabel ?? "Trống"}
    </button>
  );
}
