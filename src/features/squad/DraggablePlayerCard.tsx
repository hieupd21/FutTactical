import { useDraggable } from "@dnd-kit/core";
import type { ComponentProps } from "react";
import { PlayerCard } from "./PlayerCard";

/** Thẻ cầu thủ kéo được bằng @dnd-kit: id kéo là id cầu thủ */
export function DraggablePlayerCard(props: ComponentProps<typeof PlayerCard>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.player.id });
  return (
    <PlayerCard
      {...props}
      buttonRef={setNodeRef}
      dragProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
    />
  );
}
