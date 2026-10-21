// Sự nghiệp HLV: uy tín, lời mời từ CLB lớn hơn, chuyển CLB.
import { formatWage } from "./format";
import { clubPlayers } from "./squad";
import { getClub, inbox, leagueName, myClub, news, gameState, simLeagues } from "./state";
import type { Club } from "./types";
import { clamp } from "./util";

/** Uy tín HLV của người mới: đủ để nhận các đội cuối bảng hạng dưới cùng */
export const NEWBIE_REPUTATION = 30;
const MAX_OFFERS = 3;

/** Uy tín tối thiểu để một CLB chịu giao ghế HLV trưởng, suy từ sức mạnh đội hình */
export const strengthRequirement = (strength: number): number =>
  clamp(Math.round((strength - 50) * 2.4), 0, 95);
export const clubRequirement = (club: Club): number => strengthRequirement(club.strength);

/** Uy tín HLV hiện tại. Bản lưu cũ chưa có thì lấy theo CLB đang dẫn dắt */
export const myReputation = (): number =>
  gameState.managerReputation ?? clamp(clubRequirement(myClub()) + 5, 0, 100);

export const repLabel = (reputation: number): string =>
  reputation < 15
    ? "Vô danh"
    : reputation < 30
      ? "Mới nổi"
      : reputation < 50
        ? "Có tiếng"
        : reputation < 70
          ? "Được kính trọng"
          : reputation < 88
            ? "Danh tiếng"
            : "Huyền thoại";

const simClubs = (): Club[] => {
  const simulatedLeagueIds = new Set(simLeagues().map((league) => league.id));
  return Object.values(gameState.clubs).filter(
    (club) => simulatedLeagueIds.has(club.leagueId) && club.id !== gameState.myClubId,
  );
};

/** Cập nhật uy tín cuối mùa theo thứ hạng so với mục tiêu. Trả về mức thay đổi */
export function reputationAfterSeason(pos: number, target: number, size: number): number {
  let delta = pos <= target ? 4 + (target - pos) * 1.2 : -(pos - target) * 0.7;
  if (pos === 1) delta += 5;
  if (pos >= size - 2) delta -= 3;
  delta = Math.round(delta);
  gameState.managerReputation = clamp(myReputation() + delta, 0, 100);
  return delta;
}

/** Chọn tối đa MAX_OFFERS CLB trong nhóm ứng viên, ưu tiên nhóm gần ngưỡng uy tín nhất */
function pickOffers(pool: Club[]): Club[] {
  const clubs = pool
    .sort((clubA, clubB) => clubRequirement(clubB) - clubRequirement(clubA))
    .slice(0, 8);
  const candidates: Club[] = [];
  while (candidates.length < MAX_OFFERS && clubs.length)
    candidates.push(clubs.splice(Math.floor(Math.random() * clubs.length), 1)[0]);
  return candidates;
}

function sendOffer(club: Club, text: string): void {
  inbox({
    kind: "job",
    title: `${club.name} muốn bạn làm HLV trưởng`,
    body: `${text} (${leagueName(club.leagueId)}, sức mạnh ${club.strength}). Bạn có thể nhận lời trước khi mùa giải kết thúc; mùa tới bạn sẽ dẫn dắt đội này.`,
    clubId: club.id,
  });
}

/** Sau khi tổng kết mùa: CLB mạnh hơn gửi lời mời nếu uy tín đủ và mùa giải không tệ */
export function jobOffersTick(pos: number, target: number): void {
  gameState.offers = [];
  if (pos > target + 2) return;
  const current = clubRequirement(myClub()),
    reputation = myReputation();
  const pool = simClubs().filter(
    (club) => clubRequirement(club) > current && clubRequirement(club) <= reputation,
  );
  pickOffers(pool).forEach((club) => {
    gameState.offers!.push({ clubId: club.id, year: gameState.year });
    sendOffer(
      club,
      `Ban lãnh đạo theo dõi thành tích của bạn và muốn trao cho bạn cơ hội dẫn dắt đội bóng`,
    );
  });
}

/** Bị sa thải: uy tín tụt, các đội phù hợp với uy tín mới ngỏ lời */
export function sackedOffers(): void {
  gameState.managerReputation = clamp(myReputation() - 10, 0, 100);
  const reputation = gameState.managerReputation,
    clubs = simClubs();
  // luôn còn việc: nếu không đội nào đủ điều kiện thì lấy các đội yếu nhất
  let pool = clubs.filter((club) => clubRequirement(club) <= reputation);
  if (pool.length < MAX_OFFERS)
    pool = clubs
      .sort((clubA, clubB) => clubRequirement(clubA) - clubRequirement(clubB))
      .slice(0, 6);
  gameState.offers = pickOffers(pool).map((club) => ({ clubId: club.id, year: gameState.year }));
}

export const offerClubs = (): Club[] =>
  (gameState.offers ?? []).map((jobOffer) => gameState.clubs[jobOffer.clubId]).filter(Boolean);

export function declineOffer(clubId: string): void {
  gameState.offers = (gameState.offers ?? []).filter((jobOffer) => jobOffer.clubId !== clubId);
  if (gameState.job === clubId) gameState.job = null;
}

/** Nhận lời một đề nghị. Việc chuyển sang chỉ diễn ra khi mùa mới bắt đầu */
export function acceptOffer(clubId: string): string {
  if (!(gameState.offers ?? []).some((jobOffer) => jobOffer.clubId === clubId))
    return "Lời mời này không còn hiệu lực.";
  gameState.job = clubId;
  const club = getClub(clubId);
  inbox({
    kind: "info",
    title: `Bạn nhận lời dẫn dắt ${club.name}`,
    body: `Bạn sẽ bàn giao ${myClub().name} khi mùa giải kết thúc và nhận ghế HLV trưởng ${club.name} từ mùa tới. Đổi ý thì mở lại lời mời để từ chối.`,
  });
  return `Đã nhận lời ${club.name}`;
}

/** Chuyển sang CLB mới ngay lập tức: hủy đàm phán đang mở, nợ trả góp của CLB cũ, đặt lại niềm tin và quỹ lương */
export function switchClub(clubId: string): void {
  const from = myClub().name;
  gameState.myClubId = clubId;
  gameState.negos = [];
  gameState.pending = [];
  gameState.liabilities = [];
  gameState.shortlist = gameState.shortlist.filter(
    (id) => gameState.players[id] && gameState.players[id].club !== clubId,
  );
  gameState.offers = [];
  gameState.job = null;
  gameState.boardConfidence = 60;
  gameState.sacked = false;
  gameState.wageCap = Math.round(
    clubPlayers(clubId).reduce((total, player) => total + player.contract!.wage, 0) * 1.08,
  );
  news(`Bạn rời ${from} và chính thức nhận ghế HLV trưởng ${getClub(clubId).name}.`, "club");
  inbox({
    kind: "welcome",
    title: `Chào mừng đến ${getClub(clubId).name}`,
    body: `Uy tín của bạn: ${Math.round(myReputation())} (${repLabel(myReputation())}). Quỹ lương ${formatWage(gameState.wageCap)}. Mục tiêu của ban lãnh đạo nằm ở tab CLB.`,
  });
}
