import { FORMS } from "./constants";
import formations from "../../data/fifacm/formations.json";
import pitchPositions from "../../data/fifacm/pitch-positions.json";
import { fifacmPositionLine } from "./fifacm";
import { slotPositions } from "./squad";
import { gameState } from "./state";
import type { Formation, Line } from "./types";

const LINE_ORDER: Line[] = ["GK", "DF", "MF", "FW"];

/** Tâm thẻ nằm trong khoảng này của chiều cao sân (%), để thẻ ngoài cùng không tràn khỏi sân */
const CENTER_TOP_PERCENT = 11;
const CENTER_BOTTOM_PERCENT = 89;

export interface PitchSlot {
  /** Vị trí gốc của FIFACM, ví dụ LCB, CAM, RWB */
  position: string;
  line: Line;
  /** Tâm thẻ trên sân của bạn, tính bằng % chiều rộng/cao */
  centerXPercent: number;
  centerYPercent: number;
}

export interface FormationVariant {
  code: string;
  label: string;
  positions: string[];
}

/** Mỗi hệ tọa độ FIFACM có điểm gốc riêng nên được quy đổi riêng về khung sân của mình */
function normalizeVertical(value: number, min: number, max: number, isFlipped: boolean): number {
  const ratio = (value - min) / (max - min);
  const fromTop = isFlipped ? 1 - ratio : ratio;
  return CENTER_TOP_PERCENT + fromTop * (CENTER_BOTTOM_PERCENT - CENTER_TOP_PERCENT);
}

function variantsOf(formation: Formation) {
  const definition = formations.find((candidate) => candidate.id === formation);
  if (!definition) throw new Error(`Unknown formation ${formation}`);
  return definition.variants;
}

export function formationVariants(formation: Formation): FormationVariant[] {
  return variantsOf(formation).map(({ code, label, positions }) => ({ code, label, positions }));
}

/** Biến thể có nhiều vị trí trùng nhất với 11 vị trí này (dự phòng khi startingXI không khớp tuyến của sơ đồ) */
export function findClosestVariantCode(formation: Formation, positions: string[]): string {
  const overlap = (variantPositions: string[]) =>
    variantPositions.filter((position) => positions.includes(position)).length;
  return variantsOf(formation).reduce((best, variant) =>
    overlap(variant.positions) > overlap(best.positions) ? variant : best,
  ).code;
}

/**
 * Gán tuyến theo số ô mỗi tuyến của `FORMS` rồi xếp theo thứ tự ô của engine (GK, hàng thủ, tiền vệ, tiền đạo;
 * trong mỗi tuyến từ trái sang phải). Tuyến công là các ô tiền đạo cao nhất sân, nên CF/LF/RF đứng sau
 * tiền đạo cắm được tính là tiền vệ.
 */
function arrangeSlots(formation: Formation, slots: PitchSlot[]): PitchSlot[] {
  const [, , attackerCount] = FORMS[formation];
  slots
    .filter((slot) => slot.line === "FW")
    .sort((first, second) => first.centerYPercent - second.centerYPercent)
    .slice(attackerCount)
    .forEach((slot) => (slot.line = "MF"));
  return slots.sort(
    (first, second) =>
      LINE_ORDER.indexOf(first.line) - LINE_ORDER.indexOf(second.line) ||
      first.centerXPercent - second.centerXPercent ||
      first.centerYPercent - second.centerYPercent,
  );
}

const BUILDER_TOP_RANGE = formations
  .flatMap((definition) => definition.variants)
  .flatMap((variant) => variant.slotCoordinates)
  .reduce(
    (range, slot) => ({
      min: Math.min(range.min, slot.topPercent),
      max: Math.max(range.max, slot.topPercent),
    }),
    { min: Infinity, max: -Infinity },
  );
/** Ô GK của Squad Builder ở leftPercent 47.5 là chính giữa sân, nên tâm thẻ = left + 2.5 */
const BUILDER_CENTER_OFFSET_PERCENT = 2.5;

/** Các ô của một biến thể Squad Builder, đúng tọa độ FIFACM */
export function formationLayout(formation: Formation, variantCode?: string): PitchSlot[] {
  const variants = variantsOf(formation);
  const variant = variants.find((candidate) => candidate.code === variantCode) ?? variants[0];
  return arrangeSlots(
    formation,
    variant.positions.map((position, index) => ({
      position,
      line: fifacmPositionLine(position),
      centerXPercent: variant.slotCoordinates[index].leftPercent + BUILDER_CENTER_OFFSET_PERCENT,
      centerYPercent: normalizeVertical(
        variant.slotCoordinates[index].topPercent,
        BUILDER_TOP_RANGE.min,
        BUILDER_TOP_RANGE.max,
        false,
      ),
    })),
  );
}

const SOURCE_BOTTOM_RANGE = pitchPositions.reduce(
  (range, slot) => ({
    min: Math.min(range.min, slot.bottomPercent),
    max: Math.max(range.max, slot.bottomPercent),
  }),
  { min: Infinity, max: -Infinity },
);
/** Ô GK trên sân trang CLB ở leftPercent 46 là chính giữa sân (thẻ rộng 8%), nên tâm thẻ = left + 4 */
const SOURCE_CENTER_OFFSET_PERCENT = 4;

/** Các ô theo đúng 11 vị trí trong startingXI của CLB, đặt ở tọa độ của chúng trên sân ở trang CLB của FIFACM */
export function sourceLayout(formation: Formation, positions: string[]): PitchSlot[] | undefined {
  const slots: PitchSlot[] = [];
  for (const position of positions) {
    const coordinates = pitchPositions.find((candidate) => candidate.position === position);
    if (!coordinates) return undefined;
    slots.push({
      position,
      line: fifacmPositionLine(position),
      centerXPercent: coordinates.leftPercent + SOURCE_CENTER_OFFSET_PERCENT,
      centerYPercent: normalizeVertical(
        coordinates.bottomPercent,
        SOURCE_BOTTOM_RANGE.min,
        SOURCE_BOTTOM_RANGE.max,
        true,
      ),
    });
  }
  const arranged = arrangeSlots(formation, slots);
  return arranged.map((slot) => slot.line).join() === slotPositions(formation).join()
    ? arranged
    : undefined;
}

const MIRROR_PREFIX: Record<string, string> = { L: "R", R: "L" };
const CENTER_X_PERCENT = 50;

/** Vị trí đối xứng qua trục giữa sân (LCB ↔ RCB, LWB ↔ RWB); không có thì là vị trí trung tâm hoặc không ghép được */
function mirrorPosition(position: string): string | undefined {
  const mirroredPrefix = MIRROR_PREFIX[position[0]];
  return mirroredPrefix && position.length > 1 ? mirroredPrefix + position.slice(1) : undefined;
}

/**
 * Tọa độ nguồn của FIFACM lệch nhẹ giữa hai bên nên đội hình nhìn không cân: mỗi cặp trái/phải được đặt đối xứng
 * qua trục giữa sân (khoảng cách tới trục và độ cao lấy trung bình), vị trí trung tâm duy nhất của tuyến nằm đúng giữa.
 */
function balanceSlots(slots: PitchSlot[]): PitchSlot[] {
  const countByPosition = new Map<string, number>();
  slots.forEach((slot) =>
    countByPosition.set(slot.position, (countByPosition.get(slot.position) ?? 0) + 1),
  );
  const isUnique = (position: string) => countByPosition.get(position) === 1;
  return slots.map((slot) => {
    const mirror = mirrorPosition(slot.position);
    const counterpart =
      mirror && isUnique(slot.position) && isUnique(mirror)
        ? slots.find((candidate) => candidate.position === mirror)
        : undefined;
    if (counterpart) {
      const distance =
        (Math.abs(slot.centerXPercent - CENTER_X_PERCENT) +
          Math.abs(counterpart.centerXPercent - CENTER_X_PERCENT)) /
        2;
      const isLeft = slot.position[0] === "L";
      return {
        ...slot,
        centerXPercent: CENTER_X_PERCENT + (isLeft ? -distance : distance),
        centerYPercent: (slot.centerYPercent + counterpart.centerYPercent) / 2,
      };
    }
    if (!mirror && isUnique(slot.position)) return { ...slot, centerXPercent: CENTER_X_PERCENT };
    return slot;
  });
}

/** Các ô đội hình của bạn: đúng vị trí gốc của startingXI nếu chưa đổi sơ đồ/biến thể, ngược lại theo biến thể Squad Builder */
export function myPitchLayout(): PitchSlot[] {
  const sourcePositions =
    gameState.formVariant === undefined ? gameState.sourceSlotPositions : undefined;
  return balanceSlots(
    (sourcePositions && sourceLayout(gameState.form, sourcePositions)) ||
      formationLayout(gameState.form, gameState.formVariant),
  );
}
