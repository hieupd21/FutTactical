import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { myPitchLayout } from "@/engine/formationLayout";
import { getPlayer } from "@/engine/state";
import type { Player } from "@/engine/types";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { canSwapInto } from "@/engine/squad";
import { DraggablePlayerCard } from "./DraggablePlayerCard";
import { EmptySlot, useCardSize } from "./PlayerCard";
import { spreadSlots } from "./spreadSlots";
import { classNames } from "@/utils/display";
import "./pitch.css";

/** Khoảng cách tối thiểu (px) giữa hai thẻ trên sân */
const CARD_GAP = 6;
/** Thời gian (ms) thẻ trượt sang vị trí mới khi đổi sơ đồ */
const FORMATION_TRANSITION_MS = 100;

/** Ô đội hình nhận thẻ thả vào; chỉ sáng viền khi cầu thủ đang kéo được phép vào ô này */
function PitchSlot({
  slotIndex,
  style,
  children,
}: {
  slotIndex: number;
  style: React.CSSProperties;
  children: (isDropTarget: boolean) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotIndex}`, data: { slotIndex } });
  const { active } = useDndContext();
  const isValidDrop = isOver && !!active && canSwapInto(String(active.id), slotIndex);
  return (
    <div
      ref={setNodeRef}
      className={classNames("absolute motion-reduce:transition-none")}
      style={style}
    >
      {children(isValidDrop)}
    </div>
  );
}

function useElementSize<ElementType extends HTMLElement>() {
  const elementRef = useRef<ElementType>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [elementRef, size] as const;
}

/** Thẻ trên sân luôn đúng cỡ thẻ dự bị (cùng thu nhỏ theo màn hình). Đội hình ra sân đặt lên sân đúng vị trí và tọa độ của từng ô theo Squad Builder của FIFACM */
export function PitchView({
  className,
  lineup,
  selectedPlayerId,
  isChoosingSlot,
  onSelectSlot,
}: {
  className: string;
  lineup: (string | null)[];
  selectedPlayerId: string | null;
  isChoosingSlot: boolean;
  onSelectSlot: (slotIndex: number, player: Player | null) => void;
}) {
  const [pitchRef, pitchSize] = useElementSize<HTMLDivElement>();
  const cardSize = useCardSize();
  const slots = myPitchLayout();
  // Chỉ bật chuyển động sau khi sân đã đo xong và vẽ lần đầu, để thẻ không trượt từ góc sân lúc mới mở
  const [isAnimated, setIsAnimated] = useState(false);
  const isPitchMeasured = pitchSize.width > 0;
  useEffect(() => {
    if (!isPitchMeasured) return;
    const frame = requestAnimationFrame(() => setIsAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, [isPitchMeasured]);
  // Tọa độ FIFACM tính theo %; khi biết cỡ sân thì đổi ra px rồi nới ra để các thẻ không đè lên nhau
  const centers = spreadSlots(
    slots.map((slot) => ({
      x: (slot.centerXPercent * pitchSize.width) / 100,
      y: (slot.centerYPercent * pitchSize.height) / 100,
    })),
    pitchSize,
    { width: cardSize.width, height: cardSize.height },
    CARD_GAP,
  );
  return (
    <div
      ref={pitchRef}
      className={classNames("squad-pitch relative mx-auto w-full max-w-3xl", className)}
    >
      <img
        src={`${import.meta.env.BASE_URL}images/squad-pitch-lines.svg`}
        alt=""
        aria-hidden="true"
        draggable={false}
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 size-full object-fill select-none"
      />
      {slots.map((slot, slotIndex) => {
        const playerId = lineup[slotIndex] ?? null;
        const player = playerId ? getPlayer(playerId) : null;
        return (
          <PitchSlot
            // key theo cầu thủ để cùng một người trượt từ ô cũ sang ô mới khi đổi sơ đồ
            key={playerId ?? `empty-${slotIndex}`}
            slotIndex={slotIndex}
            style={{
              left: centers[slotIndex].x,
              top: centers[slotIndex].y,
              transform: "translate(-50%, -50%)",
              transition: isAnimated
                ? `left ${FORMATION_TRANSITION_MS}ms ease-out, top ${FORMATION_TRANSITION_MS}ms ease-out`
                : undefined,
            }}
          >
            {(isDropTarget) =>
              player ? (
                <DraggablePlayerCard
                  player={player}
                  positionLabel={slot.position}
                  slotPosition={slot.position}
                  isSelected={player.id === selectedPlayerId}
                  isTarget={isChoosingSlot}
                  isDropTarget={isDropTarget}
                  onClick={() => onSelectSlot(slotIndex, player)}
                />
              ) : (
                <EmptySlot
                  positionLabel={slot.position}
                  isTarget={isChoosingSlot}
                  isDropTarget={isDropTarget}
                  onClick={() => onSelectSlot(slotIndex, null)}
                />
              )
            }
          </PitchSlot>
        );
      })}
    </div>
  );
}
