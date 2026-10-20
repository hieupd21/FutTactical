// Sự nghiệp HLV: uy tín, lời mời từ CLB lớn hơn, chuyển CLB.
import { fmtW } from "./format";
import { clubPlayers } from "./squad";
import { C, inbox, lgName, me, news, S, simLeagues } from "./state";
import type { Club } from "./types";
import { clamp } from "./util";

/** Uy tín HLV của người mới: đủ để nhận các đội cuối bảng hạng dưới cùng */
export const REP_NEWBIE = 15;
const MAX_OFFERS = 3;

/** Uy tín tối thiểu để một CLB chịu giao ghế HLV trưởng, suy từ sức mạnh đội hình */
export const strReq = (str: number): number => clamp(Math.round((str - 50) * 2.4), 0, 95);
export const clubReq = (c: Club): number => strReq(c.str);

/** Uy tín HLV hiện tại. Bản lưu cũ chưa có thì lấy theo CLB đang dẫn dắt */
export const myRep = (): number => S.rep ?? clamp(clubReq(me()) + 5, 0, 100);

export const repLabel = (r: number): string =>
  r < 15 ? "Vô danh" : r < 30 ? "Mới nổi" : r < 50 ? "Có tiếng" : r < 70 ? "Được kính trọng" : r < 88 ? "Danh tiếng" : "Huyền thoại";

const simClubs = (): Club[] => {
  const ids = new Set(simLeagues().map((l) => l.id));
  return Object.values(S.clubs).filter((c) => ids.has(c.lg) && c.id !== S.me);
};

/** Cập nhật uy tín cuối mùa theo thứ hạng so với mục tiêu. Trả về mức thay đổi */
export function repAfterSeason(pos: number, target: number, size: number): number {
  let d = pos <= target ? 4 + (target - pos) * 1.2 : -(pos - target) * 0.7;
  if (pos === 1) d += 5;
  if (pos >= size - 2) d -= 3;
  d = Math.round(d);
  S.rep = clamp(myRep() + d, 0, 100);
  return d;
}

/** Chọn tối đa MAX_OFFERS CLB trong nhóm ứng viên, ưu tiên nhóm gần ngưỡng uy tín nhất */
function pickOffers(pool: Club[]): Club[] {
  const top = pool.sort((a, b) => clubReq(b) - clubReq(a)).slice(0, 8);
  const out: Club[] = [];
  while (out.length < MAX_OFFERS && top.length) out.push(top.splice(Math.floor(Math.random() * top.length), 1)[0]);
  return out;
}

function sendOffer(c: Club, text: string): void {
  inbox({
    t: `${c.n} muốn bạn làm HLV trưởng`,
    b: `${text} (${lgName(c.lg)}, sức mạnh ${c.str}). Bạn có thể nhận lời trước khi mùa giải kết thúc; mùa tới bạn sẽ dẫn dắt đội này.`,
    cid: c.id,
    act: "job",
  });
}

/** Sau khi tổng kết mùa: CLB mạnh hơn gửi lời mời nếu uy tín đủ và mùa giải không tệ */
export function jobOffersTick(pos: number, target: number): void {
  S.offers = [];
  if (pos > target + 2) return;
  const cur = clubReq(me()),
    rep = myRep();
  const pool = simClubs().filter((c) => clubReq(c) > cur && clubReq(c) <= rep);
  pickOffers(pool).forEach((c) => {
    S.offers!.push({ cid: c.id, y: S.year });
    sendOffer(c, `Ban lãnh đạo theo dõi thành tích của bạn và muốn trao cho bạn cơ hội dẫn dắt đội bóng`);
  });
}

/** Bị sa thải: uy tín tụt, các đội phù hợp với uy tín mới ngỏ lời */
export function sackedOffers(): void {
  S.rep = clamp(myRep() - 10, 0, 100);
  const rep = S.rep,
    clubs = simClubs();
  // luôn còn việc: nếu không đội nào đủ điều kiện thì lấy các đội yếu nhất
  let pool = clubs.filter((c) => clubReq(c) <= rep);
  if (pool.length < MAX_OFFERS) pool = clubs.sort((a, b) => clubReq(a) - clubReq(b)).slice(0, 6);
  S.offers = pickOffers(pool).map((c) => ({ cid: c.id, y: S.year }));
}

export const offerClubs = (): Club[] => (S.offers ?? []).map((o) => S.clubs[o.cid]).filter(Boolean);

export function declineOffer(cid: string): void {
  S.offers = (S.offers ?? []).filter((o) => o.cid !== cid);
  if (S.job === cid) S.job = null;
}

/** Nhận lời một đề nghị. Việc chuyển sang chỉ diễn ra khi mùa mới bắt đầu */
export function acceptOffer(cid: string): string {
  if (!(S.offers ?? []).some((o) => o.cid === cid)) return "Lời mời này không còn hiệu lực.";
  S.job = cid;
  const c = C(cid);
  inbox({
    t: `Bạn nhận lời dẫn dắt ${c.n}`,
    b: `Bạn sẽ bàn giao ${me().n} khi mùa giải kết thúc và nhận ghế HLV trưởng ${c.n} từ mùa tới. Đổi ý thì mở lại lời mời để từ chối.`,
  });
  return `Đã nhận lời ${c.n}`;
}

/** Chuyển sang CLB mới ngay lập tức: hủy đàm phán đang mở, nợ trả góp của CLB cũ, đặt lại niềm tin và quỹ lương */
export function switchClub(cid: string): void {
  const from = me().n;
  S.me = cid;
  S.negos = [];
  S.pending = [];
  S.liab = [];
  S.shortlist = S.shortlist.filter((id) => S.P[id] && S.P[id].club !== cid);
  S.offers = [];
  S.job = null;
  S.conf = 60;
  S.sacked = false;
  S.wageCap = Math.round(clubPlayers(cid).reduce((s, p) => s + p.c!.wage, 0) * 1.08);
  news(`Bạn rời ${from} và chính thức nhận ghế HLV trưởng ${C(cid).n}.`, "club");
  inbox({
    t: `Chào mừng đến ${C(cid).n}`,
    b: `Uy tín của bạn: ${Math.round(myRep())} (${repLabel(myRep())}). Quỹ lương ${fmtW(S.wageCap)}. Mục tiêu của ban lãnh đạo nằm ở tab CLB.`,
  });
}
