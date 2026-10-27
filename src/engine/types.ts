// Kiểu dữ liệu cốt lõi của game. Engine chỉ làm việc với các kiểu này, không biết gì về React.

export type Line = "GK" | "DF" | "MF" | "FW";
export type Formation =
  | "3-1-4-2"
  | "3-4-1-2"
  | "3-4-2-1"
  | "3-4-3"
  | "3-5-1-1"
  | "3-5-2"
  | "4-1-2-1-2"
  | "4-1-3-2"
  | "4-1-4-1"
  | "4-2-2-2"
  | "4-2-3-1"
  | "4-2-4"
  | "4-3-1-2"
  | "4-3-2-1"
  | "4-3-3"
  | "4-4-1-1"
  | "4-4-2"
  | "4-5-1"
  | "5-2-1-2"
  | "5-2-3"
  | "5-3-2"
  | "5-4-1";
export type Role = "Ngôi sao" | "Đá chính" | "Xoay tua" | "Dự bị" | "Triển vọng";
export type ProfileKey = "early" | "late" | "steady" | "durable" | "fragile" | "prodigy";
export type Philosophy = "young" | "win" | "bargain" | "bal";
export type TransferWindow = "summer" | "winter" | null;

interface Contract {
  wage: number; // nghìn € / tuần
  expiryYear: number; // năm hết hạn (30/6 của năm đó)
  releaseClause: number; // điều khoản giải phóng, nghìn €; 0 = không có
  role: Role;
}

interface TransferRecord {
  year: number;
  fromClub: string;
  toClub: string;
  fee: number | null;
}

/** Lý do cầu thủ không hài lòng */
export type MoodCause = "playtime" | "tactics" | "morale";

export interface Player {
  id: string;
  sourceId?: number;
  nationId?: number;
  name: string; // tên hiển thị
  longName?: string; // tên đầy đủ
  nationality: string; // mã quốc tịch nội bộ (EN, ES…) hoặc "XX"
  nationalityName?: string; // tên quốc tịch theo nhãn FIFACM
  pos: Line;
  secondaryPositions: Line[];
  positionDetail?: string; // vị trí chi tiết, ví dụ "CM, CDM"
  age: number;
  ovr: number;
  pot: number;
  profile: ProfileKey;
  form: number;
  morale: number;
  fitness: number;
  injuryDays: number;
  club: string | null;
  contract: Contract | null;
  apps: number;
  goals: number;
  recentStarts: number[]; // 6 trận gần nhất: 1 = đá chính
  careerTotals: { apps: number; goals: number };
  joined: number;
  joinedAbs?: number;
  potentialBias: number;
  transferHistory: TransferRecord[];
  marketValue: number; // giá trị, nghìn €
  valueAnchor?: number; // hệ số neo giá trị theo dữ liệu thật
  isGenerated?: boolean; // cầu thủ do game tạo thêm
  lastRating?: number;
  // trạng thái chuyển nhượng
  loan?: { fromClub: string; percent: number } | null;
  homeClub?: string | null;
  loanOut?: { toClub: string; fromClub: string; percent: number } | null;
  away?: { club: string; until: string } | null;
  listed?: boolean;
  loanList?: boolean;
  wantOut?: boolean;
  // tâm lý và yêu cầu của cầu thủ
  demand?: { kind: "start" | "leave"; day: number; cause: MoodCause } | null; // yêu cầu đang chờ người chơi trả lời
  promise?: { kind: "start"; left: number; missed: number; allowedMisses: number } | null; // cam kết cho đá chính
  demandCooldown?: number; // ngày (S.d) trước đó không đòi nữa
  interest?: { day: number; cause: MoodCause | "free"; agent?: boolean } | null; // cầu thủ CLB khác đã "thả thính" CLB của bạn
  ovrAtSign?: number;
  cooldown?: number;
  reserved?: boolean;
  sellOn?: { club: string; percent: number } | null;
  addon?: { club: string; amount: number; apps: number; paid: boolean } | null;
  addonBase?: number;
  joinedFee?: number;
}

export interface Club {
  id: string;
  sourceId?: number;
  worthEur?: number;
  squadValueEur?: number;
  weeklyWageEur?: number;
  name: string;
  leagueId: string;
  strength: number;
  prestige: number; // uy tín 1–5
  philosophy: Philosophy;
  form: Formation;
  playerIds: string[];
  budget: number; // nghìn €
  rival: string | null;
}

export interface League {
  id: string;
  name: string;
  nationality: string;
  level: number;
  isSimulated?: boolean; // false = giải chỉ là nguồn thị trường, không thi đấu
  foreignRatio: number;
  importNationalities: string[];
  clubs: [string, number][];
}

export type Mentality = "att" | "bal" | "def";
export type Press = "low" | "mid" | "high";
export interface Tactic {
  ment: Mentality;
  press: Press;
}

export interface MatchEvent {
  minute: number; // phút cơ bản (1–90)
  stoppageMinute?: number; // phút bù giờ của hiệp (45+x / 90+x)
  side: 0 | 1;
  goal?: string;
  assist?: string;
  isPenalty?: boolean;
  miss?: string;
  missKind?: "save" | "off" | "block" | "post";
  goalkeeper?: string; // thủ môn cản phá
  expectedGoals?: number;
  card?: string;
  isRedCard?: boolean;
  isSecondYellow?: boolean; // thẻ đỏ do vàng thứ hai
  injured?: string;
  days?: number;
  varDisallowed?: string; // bàn thắng bị VAR hủy (cầu thủ ghi)
  subbedIn?: string; // cầu thủ vào sân
  subbedOut?: string; // cầu thủ rời sân
  tacticChange?: string; // đổi chiến thuật (mô tả)
}

export interface MatchSim {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  homeLineup: (string | null)[];
  awayLineup: (string | null)[];
  shots: [number, number];
  power: [number, number];
  // chỉ có ở trận mô phỏng chi tiết (trận của bạn)
  shotsOnTarget?: [number, number];
  expectedGoals?: [number, number];
  possession?: number; // % kiểm soát bóng của đội nhà
  minutes?: Record<string, number>;
  usedPlayers?: [string[], string[]];
  ratings?: Record<string, number>;
  manOfTheMatch?: string;
}

/** Một đội trong trận đang diễn ra */
export interface LiveSide {
  club: string;
  form: Formation;
  startingLineup: (string | null)[];
  lineup: (string | null)[]; // đội hình trên sân theo ô; người đã rời sân (đỏ/chấn thương) vẫn nằm ở đây đến khi có người thay
  /** Tên vị trí từng ô (LB, CDM...) nếu biết, để phạt cầu thủ trái vị trí; đội AI không có */
  slotNames?: string[];
  bench: string[];
  subsLeft: number;
  tactic: Tactic;
  startFitness: Record<string, number>;
  fatigue: Record<string, number>; // thể lực đã tiêu hao trong trận
  removed: string[];
  yellowCarded: string[];
  minutesSpan: Record<string, [number, number | null]>; // phút vào / ra sân
  isAuto: boolean; // HLV máy điều hành (đội AI, hoặc bạn bấm xem kết quả ngay)
}

export interface LiveSim {
  sides: [LiveSide, LiveSide];
  ticks: [number, number][]; // (phút, phút bù giờ)
  pauses: number[]; // chỉ số tick có điểm dừng
  tickIndex: number; // tick kế tiếp cần mô phỏng
  events: MatchEvent[];
  homeGoals: number;
  awayGoals: number;
  shots: [number, number];
  shotsOnTarget: [number, number];
  expectedGoals: [number, number];
  possessionHistory: number[]; // % kiểm soát bóng lũy kế của đội nhà sau mỗi tick
  injuryAlert: { side: 0 | 1; playerId: string } | null; // cầu thủ của bạn chấn thương, cần thay
  mySide: 0 | 1;
}

export interface MatchResult {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  scorers: string[];
}

export interface TableRow {
  id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: ("W" | "D" | "L")[];
}

export interface ClubOffer {
  fee: number;
  installments: number;
  addon?: number;
  sellOnPercent?: number;
  loanback?: boolean;
  swapPlayerId?: string | null;
  timing?: "now" | "next";
  percent?: number; // dùng cho hợp đồng mượn
}

export interface ContractOffer {
  wage: number;
  years: number;
  signingBonus: number;
  role: Role;
  releaseClause: number;
}

type NegoStage = "enquiry" | "dof" | "club" | "contract" | "final" | "offer" | "done" | "failed";
export type NegoType = "transfer" | "loan" | "free" | "pre" | "renew" | "loanout";

/** Giọng điệu người chơi chọn khi gửi đề nghị: điềm đạm (trung tính), chân thành (an toàn), cứng rắn (đánh cược) */
export type Tone = "calm" | "warm" | "bluff";

export interface Negotiation {
  id: string;
  playerId: string;
  type: NegoType;
  stage: NegoStage;
  isBuyOffer?: boolean;
  isSellOffer?: boolean;
  seller?: string | null;
  buyer?: string;
  tension: number;
  round: number;
  log: { author: "me" | "them"; text: string; tickAt: number }[];
  created: number;
  message: string;
  readyAt?: number | null;
  waiting?: boolean;
  askingFee?: number | null;
  counter?: number;
  minPercent?: number;
  offer?: ClubOffer;
  contractAsk?: ContractOffer;
  contractOffer?: ContractOffer;
  releaseClauseUsed?: boolean;
  tone?: Tone;
  pushed?: boolean;
  willChecked?: boolean;
  twist?: { club: string } | null;
  sportingDirector?: { maxFee: number };
  // đề nghị AI mua cầu thủ của bạn
  fee?: number;
  installments?: number;
  maxFee?: number;
  percent?: number;
  myCounter?: number; // giá bạn phản lại, đang chờ CLB mua trả lời
}

/** Loại thông báo: mỗi loại có hành vi riêng khi bấm vào (xem features/club/inboxKinds.ts) */
export type InboxKind =
  | "offer" // CLB khác muốn mua / mượn cầu thủ của bạn
  | "reply" // phản hồi trong một cuộc đàm phán
  | "dealFail" // thương vụ đổ vỡ
  | "agent" // người đại diện cầu thủ gửi thư thăm dò
  | "demand" // cầu thủ của bạn đòi ra sân / ra đi
  | "injury"
  | "contract" // hợp đồng sắp hết hạn
  | "window" // kỳ chuyển nhượng mở / đóng / Deadline Day
  | "finance" // thưởng, ngân sách, trả góp
  | "job" // lời mời làm HLV
  | "season" // tổng kết mùa
  | "youth" // học viện đôn lên
  | "dof" // Giám đốc thể thao chốt thương vụ
  | "welcome"
  | "info";

export interface InboxMessage {
  id: string;
  title: string;
  body: string;
  day: number;
  hour: number;
  year: number;
  read: boolean;
  negotiationId?: string;
  playerId?: string;
  clubId?: string;
  kind?: InboxKind; // thiếu ở bản lưu cũ: coi như suy ra từ nid / pid
}

/** Lời mời dẫn dắt CLB khác, gửi sau khi tổng kết mùa */
interface JobOffer {
  clubId: string;
  year: number;
}

/** Loại tin: chung, CLB, chuyển nhượng xong, đàm phán, thả thính, nổi loạn, trận đấu */
type NewsKind = "gen" | "club" | "transfer" | "deal" | "flirt" | "rebel" | "match";

export interface NewsItem {
  text: string;
  kind: NewsKind;
  day: number;
  year: number;
}

export interface BoardObjective {
  kind: "pos" | "wage" | "youth" | "sell";
  label: string;
  importance: string;
  target?: number;
  start?: number;
}

interface PendingTransfer {
  playerId: string;
  from: string | null;
  contract: Contract;
  offer: ClubOffer;
  type: NegoType;
}

interface Liability {
  year: number;
  amount: number; // dương = phải trả, âm = được nhận
  toClub: string;
  playerId: string;
}

interface SeasonReview {
  position: number;
  confidenceDelta: number;
  prize: number;
  lines: string[];
}

export interface GameState {
  saveVersion: number;
  nextPlayerNumber: number;
  year: number;
  day: number; // ngày trong mùa, 0 = 1/7
  hour: number; // giờ (dùng trong Deadline Day)
  players: Record<string, Player>;
  clubs: Record<string, Club>;
  myClubId: string;
  fixtures: Record<string, [string, string][][]>;
  results: Record<string, MatchResult[][]>;
  news: NewsItem[];
  inbox: InboxMessage[];
  negos: Negotiation[];
  nextRecordNumber: number;
  liabilities: Liability[];
  pending: PendingTransfer[];
  leagueNames: Record<string, string>;
  leagueMeta?: League[];
  dataSource?: string;
  dataProvider?: "fifacm";
  form: Formation;
  /** Mã biến thể Squad Builder của sơ đồ (vị trí và tọa độ từng ô); thiếu thì dùng biến thể đầu tiên */
  formVariant?: string;
  tactic?: Tactic;
  lineup: (string | null)[];
  scout: number;
  shortlist: string[];
  board: { target: number; objectives: BoardObjective[] };
  boardConfidence: number;
  sacked: string | false;
  matchToday: { homeId: string; awayId: string; round: number } | null;
  lastMatch: { matchSim: MatchSim; result: MatchResult } | null;
  free: string[];
  aiDone: number;
  seasonLog: { year: number; position: number | null }[];
  wageCap: number;
  managerReputation?: number; // uy tín HLV 0–100; thiếu = lưu cũ, coi như 100
  offers?: JobOffer[];
  job?: string | null; // CLB đã nhận lời, chuyển sang khi mùa mới bắt đầu
  stopFlag?: boolean;
  review?: SeasonReview | null;
}

/** Một dòng dữ liệu cầu thủ thật (định dạng cột kiểu sofifa, đã rút gọn) */
export type DataRow = [
  leagueId: number,
  club: string,
  shortName: string,
  longName: string,
  positions: string,
  overall: number,
  potential: number,
  valueEur: number,
  wageEur: number,
  age: number,
  contractYear: number,
  releaseClauseEur: number,
  nationality: string,
  fifaVersion: number,
  prevClub?: string,
];
