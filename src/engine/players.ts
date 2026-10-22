import { COMMON_PROFILES } from "./constants";
import { mockData } from "./mockData";
import { getClub, getLeague, gameState } from "./state";
import type { Line, Player } from "./types";
import { pickRandom, roundToTen, randomInt, randomBetween } from "./util";

// Cầu thủ do game tạo thêm (học viện, bù đội hình) lấy tên ghép từ cầu thủ thật cùng quốc tịch trong dữ liệu.
let namePool: { state: unknown; byNationality: Record<string, Player[]>; all: Player[] } | null =
  null;
function realNamePool() {
  if (!namePool || namePool.state !== gameState) {
    const all = Object.values(gameState.players).filter((player) => !player.isGenerated);
    const byNationality: Record<string, Player[]> = {};
    all.forEach((player) => (byNationality[player.nationality] ??= []).push(player));
    namePool = { state: gameState, byNationality, all };
  }
  return namePool;
}
function genName(nationality: string): string {
  const { byNationality, all } = realNamePool();
  const pool = byNationality[nationality]?.length ? byNationality[nationality] : all;
  if (!pool.length) return "Cầu thủ trẻ";
  const fullName = (player: Player) => (player.longName || player.name).split(" ");
  const firstName = fullName(pickRandom(pool))[0];
  const lastName = fullName(pickRandom(pool)).slice(-1)[0];
  return `${firstName} ${lastName}`;
}
export const natName = (player: Player): string =>
  player.nationalityName ||
  mockData().nationalities.shortNameByCode[player.nationality] ||
  player.nationality;
export const ovrRange = (player: Player): number => Math.round(player.ovr);

function moraleAdj(morale: number): number {
  return morale >= 80 ? 2 : morale >= 60 ? 1 : morale >= 40 ? 0 : morale >= 20 ? -2 : -4;
}
/** Chỉ số động: chỉ số gốc ± phong độ, tinh thần, thể lực */
export function dynamicRating(player: Player): number {
  return Math.round(
    player.ovr +
      (player.form - 50) / 12 +
      moraleAdj(player.morale) -
      (player.fitness < 75 ? (75 - player.fitness) / 8 : 0),
  );
}
export function moraleLabel(morale: number): string {
  return morale >= 80
    ? "Rất vui"
    : morale >= 60
      ? "Vui vẻ"
      : morale >= 40
        ? "Bình thường"
        : morale >= 20
          ? "Không vui"
          : "Bất mãn";
}
export const yearsLeft = (player: Player): number =>
  player.contract ? player.contract.expiryYear - gameState.year : 0;

/** Giá trị chuyển nhượng (nghìn €) */
export function valueOf(player: Player): number {
  const overall = player.ovr;
  let value = 3000 * Math.exp((overall - 70) / 6);
  value *=
    player.age < 21
      ? 1.5
      : player.age < 24
        ? 1.3
        : player.age < 28
          ? 1.1
          : player.age < 31
            ? 0.85
            : player.age < 33
              ? 0.55
              : 0.3;
  value *= 1 + Math.max(0, player.pot - overall) / 30;
  const remainingYears = player.contract ? player.contract.expiryYear - gameState.year : 2;
  value *= remainingYears <= 0 ? 0.35 : remainingYears === 1 ? 0.75 : 1;
  value *= 0.85 + (0.3 * player.form) / 100;
  const club = player.club != null ? getClub(player.club) : null;
  if (club) value *= 0.8 + 0.1 * getLeague(club.leagueId).level;
  if (player.valueAnchor !== undefined) value *= player.valueAnchor;
  return roundToTen(value);
}
/** Mức lương cơ bản (nghìn € / tuần) */
export function wageBase(player: Player): number {
  return Math.max(3, Math.round(3 + valueOf(player) / 600));
}

/** Tạo cầu thủ do game sinh (học viện, bù đội hình, cầu thủ tự do) */
export function makePlayer(
  nationality: string,
  pos: Line,
  ovr: number,
  age: number,
  club: string | null,
): Player {
  const id = "p" + gameState.nextPlayerNumber++;
  const prof = age <= 21 && Math.random() < 0.15 ? "prodigy" : pickRandom(COMMON_PROFILES);
  const room =
    age <= 20 ? randomInt(6, 18) : age <= 23 ? randomInt(3, 11) : age <= 26 ? randomInt(0, 5) : 0;
  const player: Player = {
    id,
    name: genName(nationality),
    nationality,
    pos,
    secondaryPositions: [],
    age,
    ovr,
    pot: Math.min(92, ovr + room),
    profile: prof,
    form: randomInt(40, 60),
    morale: randomInt(55, 75),
    fitness: 100,
    injuryDays: 0,
    club,
    contract: null,
    apps: 0,
    goals: 0,
    recentStarts: [],
    careerTotals: { apps: 0, goals: 0 },
    joined: -999,
    potentialBias: randomBetween(-1, 1),
    transferHistory: [],
    marketValue: 0,
  };
  if (pos === "MF" && Math.random() < 0.35)
    player.secondaryPositions.push(pickRandom<Line>(["FW", "DF"]));
  if (pos === "DF" && Math.random() < 0.2) player.secondaryPositions.push("MF");
  if (pos === "FW" && Math.random() < 0.25) player.secondaryPositions.push("MF");
  player.marketValue = valueOf(player);
  player.contract = {
    wage: Math.round(wageBase(player) * randomBetween(0.85, 1.1)),
    expiryYear: gameState.year + randomInt(1, 4),
    releaseClause:
      Math.random() < 0.25 ? roundToTen(player.marketValue * randomBetween(1.8, 3)) : 0,
    role: "Xoay tua",
  };
  gameState.players[id] = player;
  return player;
}
