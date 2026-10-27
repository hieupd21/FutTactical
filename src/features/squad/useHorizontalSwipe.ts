import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";

/** Quãng kéo ngang (px) để chốt là vuốt: đủ ngắn để một cú vuốt nhẹ cũng ăn */
const SWIPE_DISTANCE = 32;
/** Quãng tối thiểu (px) để biết hướng vuốt là ngang hay dọc */
const DIRECTION_LOCK_DISTANCE = 8;
/** Cú hất nhanh (px/ms) đổi trang dù quãng kéo ngắn hơn SWIPE_DISTANCE */
const FLICK_SPEED = 0.35;
const FLICK_MIN_DISTANCE = 14;

/** Vuốt ngang để đổi trang: đổi ngay khi kéo đủ xa (không đợi nhả tay), hất nhanh cũng ăn, nhả tay ngoài vùng vẫn tính. `onSwipe(1)` là vuốt sang trái (trang sau), `-1` là vuốt sang phải (trang trước) */
export function useHorizontalSwipe(onSwipe: (direction: 1 | -1) => void) {
  const onSwipeRef = useRef(onSwipe);
  useEffect(() => {
    onSwipeRef.current = onSwipe;
  });
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  return (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    cleanupRef.current?.();
    const start = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    let isHorizontal: boolean | null = null;
    let hasSwiped = false;

    const swipe = (distanceX: number) => {
      hasSwiped = true;
      onSwipeRef.current(distanceX < 0 ? 1 : -1);
      // Chặn cú click sinh ra sau khi nhả tay để không bấm nhầm vào phần tử bên dưới
      window.addEventListener("click", (clickEvent) => clickEvent.stopPropagation(), {
        capture: true,
        once: true,
      });
    };
    const onMove = (moveEvent: PointerEvent) => {
      if (hasSwiped) return;
      const distanceX = moveEvent.clientX - start.x;
      const distanceY = moveEvent.clientY - start.y;
      if (isHorizontal === null) {
        if (Math.max(Math.abs(distanceX), Math.abs(distanceY)) < DIRECTION_LOCK_DISTANCE) return;
        isHorizontal = Math.abs(distanceX) > Math.abs(distanceY);
      }
      if (isHorizontal && Math.abs(distanceX) >= SWIPE_DISTANCE) swipe(distanceX);
    };
    const finish = (upEvent: PointerEvent | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (hasSwiped || !upEvent || isHorizontal === false) return;
      const distanceX = upEvent.clientX - start.x;
      const speed = Math.abs(distanceX) / Math.max(1, upEvent.timeStamp - start.time);
      if (Math.abs(distanceX) >= FLICK_MIN_DISTANCE && speed >= FLICK_SPEED) swipe(distanceX);
    };
    const onUp = (upEvent: PointerEvent) => finish(upEvent);
    const onCancel = () => finish(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  };
}
