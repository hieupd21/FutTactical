// Kiểu dữ liệu cốt lõi của game. Engine chỉ làm việc với các kiểu này, không biết gì về React.

export type Line = "GK" | "DF" | "MF" | "FW";
export type Formation = "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2" | "5-3-2";
export type Role = "Ngôi sao" | "Đá chính" | "Xoay tua" | "Dự bị" | "Triển vọng";
export type ProfileKey = "early" | "late" | "steady" | "durable" | "fragile" | "prodigy";
export type Philosophy = "young" | "win" | "bargain" | "bal";
export type TransferWindow = "summer" | "winter" | null;

export interface Contract {
  wage: number; // nghìn € / tuần
  exp: number; // năm hết hạn (30/6 của năm đó)
  rc: number; // điều khoản giải phóng, nghìn €; 0 = không có
  role: Role;
}

export interface TransferRecord {
  y: number;
  from: string;
  to: string;
  fee: number | null;
}

export interface Player {
  id: string;
  n: string; // tên hiển thị
  ln?: string; // tên đầy đủ
  nat: string; // mã quốc tịch nội bộ (EN, ES…) hoặc "XX"
  natN?: string; // tên quốc tịch tiếng Việt
  pos: Line;
  pos2: Line[];
  posD?: string; // vị trí chi tiết, ví dụ "CM, CDM"
  age: number;
  ovr: number;
  pot: number;
  prof: ProfileKey;
  form: number;
  mor: number;
  fit: number;
  inj: number;
  club: string | null;
  c: Contract | null;
  apps: number;
  goals: number;
  st: number[]; // 6 trận gần nhất: 1 = đá chính
  tot: { apps: number; goals: number };
  joined: number;
  joinedAbs?: number;
  pbias: number;
  hist: TransferRecord[];
  val: number; // giá trị, nghìn €
  vk?: number; // hệ số neo giá trị theo dữ liệu thật
  gen?: boolean; // cầu thủ do game tạo thêm
  lastR?: number;
  // trạng thái chuyển nhượng
  loan?: { from: string; pct: number } | null;
  homeClub?: string | null;
  loanOut?: { to: string; from: string; pct: number } | null;
  away?: { club: string; until: string } | null;
  listed?: boolean;
  loanList?: boolean;
  wantOut?: boolean;
  ovrAtSign?: number;
  cool?: number;
  reserved?: boolean;
  sellOn?: { club: string; pct: number } | null;
  addon?: { club: string; amt: number; apps: number; paid: boolean } | null;
  addonBase?: number;
  joinedFee?: number;
}

export interface Club {
  id: string;
  n: string;
  lg: string;
  str: number;
  pres: number; // uy tín 1–5
  phil: Philosophy;
  form: Formation;
  ids: string[];
  budget: number; // nghìn €
  rival: string | null;
}

export interface League {
  id: string;
  n: string;
  nat: string;
  lvl: number;
  sim?: boolean; // false = giải nguồn cầu thủ, không thi đấu
  fr: number; // tỷ lệ cầu thủ ngoại (thế giới hư cấu)
  imp: string[];
  clubs: [string, number][];
}

export interface MatchEvent {
  m: number;
  s: 0 | 1;
  goal?: string;
  miss?: string;
  card?: string;
  inj?: string;
  days?: number;
}

export interface MatchSim {
  h: string;
  a: string;
  hg: number;
  ag: number;
  ev: MatchEvent[];
  xh: (string | null)[];
  xa: (string | null)[];
  shots: [number, number];
  pow: [number, number];
}

export interface MatchResult {
  h: string;
  a: string;
  hg: number;
  ag: number;
  sc: string[];
}

export interface TableRow {
  id: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  form: ("W" | "D" | "L")[];
}

export interface ClubOffer {
  fee: number;
  inst: number;
  addon?: number;
  sellon?: number;
  loanback?: boolean;
  swap?: string | null;
  timing?: "now" | "next";
  pct?: number; // dùng cho hợp đồng mượn
}

export interface ContractOffer {
  wage: number;
  years: number;
  signon: number;
  role: Role;
  rc: number;
}

export type NegoStage = "enquiry" | "dof" | "club" | "contract" | "final" | "offer" | "done" | "failed";
export type NegoType = "transfer" | "loan" | "free" | "pre" | "renew" | "loanout";

export interface Negotiation {
  id: string;
  pid: string;
  type: NegoType;
  stage: NegoStage;
  buy?: boolean;
  sell?: boolean;
  seller?: string | null;
  buyer?: string;
  tension: number;
  round: number;
  log: { who: "me" | "them"; t: string; at: number }[];
  created: number;
  msg: string;
  readyAt?: number | null;
  waiting?: boolean;
  fresh?: boolean;
  ask?: number | null;
  counter?: number;
  minPct?: number;
  offer?: ClubOffer;
  cAsk?: ContractOffer;
  cOffer?: ContractOffer;
  rcUsed?: boolean;
  pushed?: boolean;
  willChecked?: boolean;
  twist?: { club: string } | null;
  dof?: { max: number };
  // đề nghị AI mua cầu thủ của bạn
  fee?: number;
  inst?: number;
  max?: number;
  pct?: number;
}

export interface InboxMessage {
  id: string;
  t: string;
  b: string;
  d: number;
  h: number;
  y: number;
  read: boolean;
  nid?: string;
  pid?: string;
  act?: string;
}

export interface NewsItem {
  t: string;
  k: "gen" | "club" | "transfer";
  d: number;
  y: number;
}

export interface BoardObjective {
  k: "pos" | "wage" | "youth" | "sell";
  n: string;
  imp: string;
  target?: number;
  start?: number;
}

export interface PendingTransfer {
  pid: string;
  from: string | null;
  c: Contract;
  o: ClubOffer;
  type: NegoType;
}

export interface Liability {
  y: number;
  amt: number; // dương = phải trả, âm = được nhận
  to: string;
  pid: string;
}

export interface SeasonReview {
  pos: number;
  dc: number;
  prize: number;
  lines: string[];
}

export interface GameState {
  v: number;
  nid: number;
  year: number;
  d: number; // ngày trong mùa, 0 = 1/7
  h: number; // giờ (dùng trong Deadline Day)
  P: Record<string, Player>;
  clubs: Record<string, Club>;
  me: string;
  fx: Record<string, [string, string][][]>;
  res: Record<string, MatchResult[][]>;
  news: NewsItem[];
  inbox: InboxMessage[];
  negos: Negotiation[];
  nnid: number;
  liab: Liability[];
  pending: PendingTransfer[];
  lgN: Record<string, string>;
  leagueMeta?: League[];
  src?: string;
  form: Formation;
  xi: (string | null)[];
  scout: number;
  shortlist: string[];
  board: { target: number; objs: BoardObjective[] };
  conf: number;
  sacked: string | false;
  matchToday: { h: string; a: string; round: number } | null;
  lastMatch: { m: MatchSim; res: MatchResult } | null;
  free: string[];
  aiDone: number;
  seasonLog: { y: number; pos: number | null }[];
  wageCap: number;
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
