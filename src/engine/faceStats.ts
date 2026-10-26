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
