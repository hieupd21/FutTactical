/** Chỉ số tổng hợp hiển thị trên thẻ (Tốc độ, Dứt điểm...): trung bình có trọng số của các chỉ số chi tiết FIFACM */
export interface FaceStat {
  label: string;
  value: number;
}

const OUTFIELD_FACE_STATS: { label: string; weights: Record<string, number> }[] = [
  { label: "Tốc độ", weights: { acceleration: 0.45, sprintSpeed: 0.55 } },
  {
    label: "Dứt điểm",
    weights: {
      finishing: 0.45,
      shotPower: 0.2,
      longShots: 0.2,
      volleys: 0.05,
      penalties: 0.05,
      attackingPosition: 0.05,
    },
  },
  {
    label: "Chuyền",
    weights: {
      vision: 0.2,
      crossing: 0.2,
      freeKickAccuracy: 0.05,
      shortPassing: 0.35,
      longPassing: 0.15,
      curve: 0.05,
    },
  },
  {
    label: "Rê bóng",
    weights: { agility: 0.1, balance: 0.05, reactions: 0.05, ballControl: 0.5, dribbling: 0.3 },
  },
  {
    label: "Phòng ngự",
    weights: {
      interceptions: 0.2,
      headingAccuracy: 0.1,
      defensiveAwareness: 0.3,
      standingTackle: 0.3,
      slidingTackle: 0.1,
    },
  },
  {
    label: "Thể chất",
    weights: { jumping: 0.05, stamina: 0.25, strength: 0.5, aggression: 0.2 },
  },
];

const GOALKEEPER_FACE_STATS: { label: string; attribute: string }[] = [
  { label: "Bay người", attribute: "goalkeeperDiving" },
  { label: "Bắt bóng", attribute: "goalkeeperHandling" },
  { label: "Phát bóng", attribute: "goalkeeperKicking" },
  { label: "Phản xạ", attribute: "goalkeeperReflexes" },
  { label: "Chọn vị trí", attribute: "goalkeeperPositioning" },
];

export function faceStats(attributes: Record<string, number>, isGoalkeeper: boolean): FaceStat[] {
  if (isGoalkeeper) {
    return GOALKEEPER_FACE_STATS.map(({ label, attribute }) => ({
      label,
      value: attributes[attribute],
    }));
  }
  return OUTFIELD_FACE_STATS.map(({ label, weights }) => ({
    label,
    value: Math.round(
      Object.entries(weights).reduce(
        (total, [attribute, weight]) => total + attributes[attribute] * weight,
        0,
      ),
    ),
  }));
}

export interface AttributeGroup {
  label: string;
  attributes: { key: string; label: string }[];
}

const OUTFIELD_ATTRIBUTE_GROUPS: AttributeGroup[] = [
  {
    label: "Tốc độ",
    attributes: [
      { key: "acceleration", label: "Tăng tốc" },
      { key: "sprintSpeed", label: "Chạy nước rút" },
    ],
  },
  {
    label: "Dứt điểm",
    attributes: [
      { key: "finishing", label: "Dứt điểm" },
      { key: "shotPower", label: "Lực sút" },
      { key: "longShots", label: "Sút xa" },
      { key: "volleys", label: "Vô lê" },
      { key: "penalties", label: "Phạt đền" },
      { key: "attackingPosition", label: "Chọn vị trí" },
    ],
  },
  {
    label: "Chuyền bóng",
    attributes: [
      { key: "vision", label: "Tầm nhìn" },
      { key: "crossing", label: "Tạt bóng" },
      { key: "freeKickAccuracy", label: "Đá phạt" },
      { key: "shortPassing", label: "Chuyền ngắn" },
      { key: "longPassing", label: "Chuyền dài" },
      { key: "curve", label: "Cắt xoáy" },
    ],
  },
  {
    label: "Rê bóng",
    attributes: [
      { key: "agility", label: "Nhanh nhẹn" },
      { key: "balance", label: "Thăng bằng" },
      { key: "reactions", label: "Phản ứng" },
      { key: "ballControl", label: "Kiểm soát bóng" },
      { key: "dribbling", label: "Rê dắt" },
      { key: "composure", label: "Bình tĩnh" },
    ],
  },
  {
    label: "Phòng ngự",
    attributes: [
      { key: "interceptions", label: "Cắt bóng" },
      { key: "headingAccuracy", label: "Đánh đầu" },
      { key: "defensiveAwareness", label: "Ý thức phòng ngự" },
      { key: "standingTackle", label: "Tắc bóng" },
      { key: "slidingTackle", label: "Xoạc bóng" },
    ],
  },
  {
    label: "Thể chất",
    attributes: [
      { key: "jumping", label: "Bật nhảy" },
      { key: "stamina", label: "Sức bền" },
      { key: "strength", label: "Sức mạnh" },
      { key: "aggression", label: "Quyết liệt" },
    ],
  },
];

const GOALKEEPER_ATTRIBUTE_GROUPS: AttributeGroup[] = [
  {
    label: "Thủ môn",
    attributes: GOALKEEPER_FACE_STATS.map(({ label, attribute }) => ({ key: attribute, label })),
  },
  ...OUTFIELD_ATTRIBUTE_GROUPS.filter((group) =>
    ["Tốc độ", "Chuyền bóng", "Thể chất"].includes(group.label),
  ),
];

/** Tên các nhóm chỉ số chi tiết xếp trên mỗi trang (trang 2 và 3 của bảng thông số) */
const OUTFIELD_DETAIL_PAGES = [
  ["Tốc độ", "Dứt điểm", "Rê bóng"],
  ["Chuyền bóng", "Phòng ngự", "Thể chất"],
];
const GOALKEEPER_DETAIL_PAGES = [
  ["Thủ môn", "Tốc độ"],
  ["Chuyền bóng", "Thể chất"],
];

/** Chỉ số chi tiết chia theo trang: mỗi trang là danh sách phẳng các chỉ số của những nhóm đã chọn */
export function detailedAttributePages(isGoalkeeper: boolean): AttributeGroup["attributes"][] {
  const groups = isGoalkeeper ? GOALKEEPER_ATTRIBUTE_GROUPS : OUTFIELD_ATTRIBUTE_GROUPS;
  return (isGoalkeeper ? GOALKEEPER_DETAIL_PAGES : OUTFIELD_DETAIL_PAGES).map((groupLabels) =>
    groupLabels.flatMap(
      (groupLabel) => groups.find((group) => group.label === groupLabel)?.attributes ?? [],
    ),
  );
}
