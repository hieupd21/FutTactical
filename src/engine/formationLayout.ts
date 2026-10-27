import { FORMS } from "./constants";
import formations from "../../data/fifacm/formations.json";
import { fifacmPositionLine } from "./fifacm";
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

/** Quy đổi toạ độ dọc của Squad Builder (0 = đỉnh sân) về khoảng an toàn của sân */
function normalizeVertical(value: number, min: number, max: number): number {
  const ratio = (value - min) / (max - min);
  return CENTER_TOP_PERCENT + ratio * (CENTER_BOTTOM_PERCENT - CENTER_TOP_PERCENT);
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
      ),
    })),
  );
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

/** Hai ô cách nhau theo chiều dọc ít hơn mức này (% chiều cao sân) thì coi là cùng một hàng ngang */
const SAME_ROW_TOLERANCE_PERCENT = 7;
/** Hàng có từ chừng này ô trở lên mới cần dàn đều (hai ô đã tự đối xứng) */
const MIN_SLOTS_TO_DISTRIBUTE = 3;

/**
 * Dàn đều khoảng cách ngang trong mỗi hàng ngang: hai ô ngoài cùng giữ nguyên, các ô giữa chia đều
 * giữa chúng theo thứ tự trái sang phải. Độ cao từng ô không đổi nên dáng lệch hàng của sơ đồ vẫn còn.
 */
function distributeRows(slots: PitchSlot[]): PitchSlot[] {
  const distributed = slots.map((slot) => ({ ...slot }));
  const rows: PitchSlot[][] = [];
  [...distributed]
    .sort((first, second) => first.centerYPercent - second.centerYPercent)
    .forEach((slot) => {
      const lastRow = rows[rows.length - 1];
      const lastSlot = lastRow?.[lastRow.length - 1];
      if (lastRow && slot.centerYPercent - lastSlot.centerYPercent <= SAME_ROW_TOLERANCE_PERCENT)
        lastRow.push(slot);
      else rows.push([slot]);
    });
  rows
    .filter((row) => row.length >= MIN_SLOTS_TO_DISTRIBUTE)
    .forEach((row) => {
      const byX = [...row].sort((first, second) => first.centerXPercent - second.centerXPercent);
      const leftmost = byX[0].centerXPercent;
      const step = (byX[byX.length - 1].centerXPercent - leftmost) / (byX.length - 1);
      byX.forEach((slot, position) => (slot.centerXPercent = leftmost + step * position));
    });
  return distributed;
}

/** Các ô đội hình của bạn: đúng biến thể Squad Builder đang chọn của sơ đồ, đặt đối xứng qua trục giữa sân */
export function myPitchLayout(): PitchSlot[] {
  return distributeRows(balanceSlots(formationLayout(gameState.form, gameState.formVariant)));
}
