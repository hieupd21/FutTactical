export interface SlotCenter {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Số vòng giải va chạm tối đa; đủ để 11 thẻ ổn định trong mọi sơ đồ */
const MAX_ITERATIONS = 80;

/**
 * Nới tâm các thẻ ra để không thẻ nào đè lên thẻ khác mà vẫn giữ dáng đội hình, kể cả khi các thẻ cùng tuyến
 * lệch độ cao (ví dụ hai hậu vệ biên cao hơn hai trung vệ): chỉ cặp thẻ thực sự chồng nhau mới bị đẩy ra,
 * theo trục chồng ít hơn (ưu tiên đẩy ngang để giữ hàng), mỗi thẻ chịu một nửa. Hai hàng liền kề được phép
 * lồng vào nhau theo chiều dọc nếu các thẻ lệch nhau theo chiều ngang. Tâm luôn nằm trong sân.
 */
export function spreadSlots(
  centers: SlotCenter[],
  area: { width: number; height: number },
  card: { width: number; height: number },
  gap: number,
): SlotCenter[] {
  const spread = centers.map((center) => ({ ...center }));
  const minimumGapX = card.width + gap;
  const minimumGapY = card.height + gap;
  const clampIntoArea = (center: SlotCenter) => {
    center.x = clamp(center.x, card.width / 2, area.width - card.width / 2);
    center.y = clamp(center.y, card.height / 2, area.height - card.height / 2);
  };
  spread.forEach(clampIntoArea);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let hasOverlap = false;
    for (let i = 0; i < spread.length; i++) {
      for (let j = i + 1; j < spread.length; j++) {
        const deltaX = spread[j].x - spread[i].x;
        const deltaY = spread[j].y - spread[i].y;
        const overlapX = minimumGapX - Math.abs(deltaX);
        const overlapY = minimumGapY - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) continue;
        hasOverlap = true;
        if (overlapX <= overlapY) {
          const push = (deltaX >= 0 ? overlapX : -overlapX) / 2;
          spread[i].x -= push;
          spread[j].x += push;
        } else {
          const push = (deltaY >= 0 ? overlapY : -overlapY) / 2;
          spread[i].y -= push;
          spread[j].y += push;
        }
        clampIntoArea(spread[i]);
        clampIntoArea(spread[j]);
      }
    }
    if (!hasOverlap) break;
  }
  return spread;
}
