import type { Formation, Line, Philosophy, ProfileKey, Role, Tone } from "./types";
import formations from "../../data/fifacm/formations.json";

export const PHILOSOPHY_LABEL: Record<Philosophy, string> = {
  young: "Ưu tiên trẻ",
  win: "Thắng ngay",
  bargain: "Săn hời",
  bal: "Cân bằng",
};
export const FORMS = Object.fromEntries(
  formations.map(({ id, lines }) => [
    id,
    [
      lines[0],
      lines.slice(1, -1).reduce((total, count) => total + count, 0),
      lines[lines.length - 1],
    ],
  ]),
) as Record<Formation, [number, number, number]>;
/** Số quốc gia có giải hạng 1 mạnh nhất (theo overallRating trung bình của CLB) được mô phỏng mọi hạng đấu; các giải còn lại chỉ là nguồn thị trường */
export const SIMULATED_LEAGUE_COUNT = 5;
/** Số đội lên/xuống hạng mỗi cặp hạng đấu cuối mùa */
export const PROMOTION_SLOTS = 3;
/** Quy đổi overallRating trung bình của giải sang `level`: giải trung bình LEAGUE_RATING_ANCHOR có level LEAGUE_LEVEL_ANCHOR, mỗi điểm rating lệch thêm LEAGUE_LEVEL_PER_RATING */
export const LEAGUE_RATING_ANCHOR = 79;
export const LEAGUE_LEVEL_ANCHOR = 4;
export const LEAGUE_LEVEL_PER_RATING = 0.16;
export const MIN_LEAGUE_LEVEL = 1;
export const POSITION_NAMES: Record<Line, string> = {
  GK: "Thủ môn",
  DF: "Hậu vệ",
  MF: "Tiền vệ",
  FW: "Tiền đạo",
};
export const ROLES: Role[] = ["Ngôi sao", "Đá chính", "Xoay tua", "Dự bị", "Triển vọng"];
export const ROLE_START: Record<Role, number> = {
  "Ngôi sao": 0.8,
  "Đá chính": 0.6,
  "Xoay tua": 0.3,
  "Dự bị": 0.1,
  "Triển vọng": 0.2,
};
export const PROFILES: Record<
  ProfileKey,
  { label: string; peak: [number, number]; rate: number; decl: number }
> = {
  early: { label: "Bùng nổ sớm", peak: [22, 26], rate: 0.9, decl: 0.6 },
  late: { label: "Nở muộn", peak: [27, 31], rate: 0.45, decl: 0.4 },
  steady: { label: "Ổn định", peak: [24, 29], rate: 0.6, decl: 0.45 },
  durable: { label: "Bền bỉ", peak: [25, 31], rate: 0.55, decl: 0.25 },
  fragile: { label: "Mong manh", peak: [23, 27], rate: 0.7, decl: 0.8 },
  prodigy: { label: "Thần đồng", peak: [21, 28], rate: 1.1, decl: 0.5 },
};
export const COMMON_PROFILES: ProfileKey[] = [
  "early",
  "late",
  "steady",
  "steady",
  "durable",
  "fragile",
];
export const AI_FORMS: Formation[] = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2"];

// ---------- lịch mùa giải (ngày tính từ 1/7) ----------
export const FIRST_MATCH_DAY = 45; // vòng 1 ngày 15/8
export const MATCH_GAP = 7; // mỗi tuần một vòng
export const MAX_WEEKLY = 42; // giải nhiều vòng hơn thế dồn lịch (xem roundDay)
export const SUMMER_WINDOW: [number, number] = [0, 61]; // 1/7–31/8
export const WINTER_WINDOW: [number, number] = [184, 214]; // 1/1–31/1
export const REVIEW_DAY = 335;
export const SEASON_LEN = 365;
export const DEADLINE_HOURS = 20;

/** Giọng điệu của các câu trả lời gợi ý: nhãn và mô tả hiệu ứng */
export const TONES: Record<Tone, { label: string; hint: string }> = {
  calm: { label: "Điềm đạm", hint: "Trung tính: không thêm lợi thế hay rủi ro." },
  warm: {
    label: "Chân thành",
    hint: "Lời lẽ mềm mỏng làm dịu bầu không khí: căng thẳng tăng chậm hơn một nửa, nhưng sức ép lên đối phương giảm nhẹ.",
  },
  bluff: {
    label: "Cứng rắn",
    hint: "Đánh cược: 45% họ chùn bước và đề nghị của bạn có sức nặng hơn rõ rệt; 55% họ không tin và căng thẳng tăng thêm.",
  },
};
