// Dòng thời gian: tua ngày/giờ, phát triển hằng tháng, Deadline Day, tổng kết & sang mùa mới.
import { myWages, objectiveStatus, sack, setBoard } from "./board";
import { jobOffersTick, myReputation, reputationAfterSeason, switchClub } from "./career";
import {
  DEADLINE_HOURS,
  FIRST_MATCH_DAY,
  POSITION_NAMES,
  PROFILES,
  REVIEW_DAY,
  SEASON_LEN,
  SUMMER_WINDOW,
  WINTER_WINDOW,
} from "./constants";
import { formatMoney, formatWage } from "./format";
import { makePlayer, ovrRange, valueOf, wageBase, yearsLeft } from "./players";
import { playRound } from "./match";
import { moodTick } from "./mood";
import { bestLineup, clubPlayers, clubStrength, myLeaguePosition } from "./squad";
import {
  getClub,
  dateOf,
  inbox,
  isDeadline,
  getLeague,
  myClub,
  myLeagueId,
  news,
  getPlayer,
  roundOn,
  gameState,
  simLeagues,
} from "./state";
import { aiBidsTick, aiTransfersTick, movePlayer, processNegos, scoutRange } from "./transfers";
import type { Line } from "./types";
import { clamp, pickRandom, roundToTen, randomInt, randomBetween } from "./util";
import { makeFixtures } from "./world";

function monthTick(): void {
  Object.values(gameState.players).forEach((player) => {
    const profile = PROFILES[player.profile],
      [peakStart, peakEnd] = profile.peak;
    const share = Math.min(
      1,
      player.recentStarts.length
        ? player.recentStarts.filter(Boolean).length / player.recentStarts.length
        : 0.3,
    );
    if (player.age < peakStart && player.ovr < player.pot)
      player.ovr +=
        ((profile.rate * (player.pot - player.ovr)) / 10) *
        (0.5 + share) *
        (0.8 + player.form / 250);
    else if (player.age <= peakEnd && player.ovr < player.pot) player.ovr += 0.08 * (0.5 + share);
    else if (player.age > peakEnd) player.ovr -= profile.decl * (player.age - peakEnd + 1) * 0.12;
    if (player.age <= 24 && player.form > 72) player.pot = Math.min(93, player.pot + 0.25);
    if (player.form < 28) player.pot = Math.max(player.ovr, player.pot - 0.15);
    player.ovr = clamp(player.ovr, 35, 93);
    player.pot = Math.max(player.pot, player.ovr);
    player.marketValue = valueOf(player);
    if (player.club !== gameState.myClubId)
      player.morale = clamp(player.morale + randomBetween(-4, 4), 25, 90);
  });
  // ban lãnh đạo xem xét
  if (gameState.day > FIRST_MATCH_DAY) {
    const pos = myLeaguePosition(),
      target = gameState.board.target;
    gameState.boardConfidence += pos <= target ? 2 : -(pos - target) * 1.5;
    if (myWages() > gameState.wageCap) gameState.boardConfidence -= 4;
    gameState.boardConfidence = clamp(gameState.boardConfidence, 0, 100);
    if (gameState.boardConfidence < 12)
      sack(
        `Ban lãnh đạo mất kiên nhẫn sau chuỗi kết quả không như kỳ vọng (đang xếp thứ ${pos}, mục tiêu top ${target}).`,
      );
  }
}

function hourTick(hour: number): void {
  gameState.hour += hour;
  processNegos();
  aiBidsTick(hour);
  aiTransfersTick(hour);
}

function dayTick(): void {
  gameState.day++;
  gameState.hour = 9;
  if (gameState.day >= SEASON_LEN) {
    newSeason();
    return;
  }
  const date = dateOf(gameState.day);
  Object.values(gameState.players).forEach((player) => {
    if (player.injuryDays > 0) player.injuryDays--;
    player.fitness = clamp(player.fitness + (player.injuryDays > 0 ? 2 : 7), 0, 100);
  });
  if (gameState.day === WINTER_WINDOW[0]) {
    applyPending(true);
    inbox({
      kind: "window",
      title: "Kỳ chuyển nhượng mùa đông mở cửa",
      body: "Mở đến hết 31/1. Từ hôm nay bạn có thể ký trước với cầu thủ còn dưới 6 tháng hợp đồng.",
    });
  }
  if (gameState.day === SUMMER_WINDOW[1] || gameState.day === WINTER_WINDOW[1])
    inbox({
      kind: "window",
      title: "Deadline Day!",
      body: `Ngày chốt sổ kéo dài ${DEADLINE_HOURS} giờ. Các CLB hành động nhanh hơn, phản hồi chỉ sau 1 giờ. Bạn có thể tua 1 hoặc 2 giờ.`,
    });
  if (gameState.day === SUMMER_WINDOW[1] + 1 || gameState.day === WINTER_WINDOW[1] + 1)
    inbox({
      kind: "window",
      title: "Kỳ chuyển nhượng đóng cửa",
      body: "Các thương vụ đã thỏa thuận cho kỳ sau sẽ hoàn tất khi kỳ tới mở.",
    });
  processNegos();
  aiBidsTick(24);
  aiTransfersTick(24);
  // điều khoản thưởng theo số trận
  clubPlayers(gameState.myClubId).forEach((player) => {
    if (
      player.addon &&
      !player.addon.paid &&
      player.careerTotals.apps - (player.addonBase || 0) >= player.addon.apps
    ) {
      player.addon.paid = true;
      myClub().budget -= player.addon.amount;
      getClub(player.addon.club).budget += player.addon.amount;
      inbox({
        kind: "finance",
        title: "Điều khoản thưởng kích hoạt",
        body: `${player.name} đã đá đủ ${player.addon.apps} trận. Bạn trả ${getClub(player.addon.club).name} ${formatMoney(player.addon.amount)}.`,
      });
    }
  });
  if (date.getDate() === 1) monthTick();
  if (gameState.day % 7 === 3) moodTick();
  const round = roundOn(gameState.day, myLeagueId());
  if (round >= 0) {
    const fixture = gameState.fixtures[myLeagueId()][round].find((fixtureClubIds) =>
      fixtureClubIds.includes(gameState.myClubId),
    )!;
    gameState.matchToday = { homeId: fixture[0], awayId: fixture[1], round };
    gameState.stopFlag = true;
  } else playRound(gameState.day);
  if (gameState.day === REVIEW_DAY) seasonReview();
  if (gameState.day === 150) contractWarning();
}

const FREE_PER_TIER = 120;
/** Tầng của cầu thủ tự do theo chỉ số: cao cấp (70+), trung bình (60–69), hạ cấp (dưới 60) */
export const freeTier = (ovr: number): number => (ovr >= 70 ? 2 : ovr >= 60 ? 1 : 0);

/** Giữ tối đa FREE_PER_TIER cầu thủ tự do mỗi tầng (người cao nhất ở lại) để hạng dưới không bị mất nguồn bổ sung rẻ */
export function trimFree(): void {
  const keep = new Set<string>();
  [0, 1, 2].forEach((tier) =>
    gameState.free
      .filter((id) => freeTier(getPlayer(id).ovr) === tier)
      .sort((playerIdA, playerIdB) => getPlayer(playerIdB).ovr - getPlayer(playerIdA).ovr)
      .slice(0, FREE_PER_TIER)
      .forEach((id) => keep.add(id)),
  );
  gameState.free.filter((id) => !keep.has(id)).forEach((id) => delete gameState.players[id]);
  gameState.free = gameState.free.filter((id) => keep.has(id));
}

function contractWarning(): void {
  const players = clubPlayers(gameState.myClubId).filter(
    (player) => yearsLeft(player) <= 1 && !player.loan,
  );
  if (players.length)
    inbox({
      kind: "contract",
      title: "Hợp đồng sắp hết hạn",
      body: `${players.length} cầu thủ hết hạn hợp đồng vào 30/6: ${players.map((player) => player.name).join(", ")}. Từ 1/1, CLB khác có thể ký trước với họ.`,
    });
}

export type AdvanceMode = "next" | "day" | "h1" | "h2" | "skipDL";
/** Tua thời gian. "next" = đến sự kiện tiếp theo, "day" = 1 ngày, "h1"/"h2" = giờ trong Deadline Day */
export function advance(mode: AdvanceMode): void {
  if (gameState.sacked || gameState.matchToday) return;
  gameState.stopFlag = false;
  if (isDeadline() && gameState.hour < 9 + DEADLINE_HOURS && mode !== "skipDL") {
    hourTick(mode === "h2" ? 2 : 1);
    if (gameState.hour >= 9 + DEADLINE_HOURS) {
      inbox({ kind: "window", title: "Hết giờ!", body: "Kỳ chuyển nhượng đã đóng." });
      dayTick();
    }
    return;
  }
  let guard = 0;
  do {
    dayTick();
    guard++;
    if (mode === "day") break;
  } while (
    !gameState.stopFlag &&
    !gameState.matchToday &&
    !isDeadline() &&
    guard < 60 &&
    !gameState.sacked
  );
}

/** Hoàn tất các thương vụ đã thỏa thuận cho kỳ sau. Mùa đông: giữ lại các hợp đồng ký trước (gia nhập 1/7) */
export function applyPending(winter = false): void {
  const keep = gameState.pending.filter(
    (pendingTransfer) => winter && pendingTransfer.type === "pre",
  );
  gameState.pending.forEach((pendingTransfer) => {
    const player = getPlayer(pendingTransfer.playerId);
    if (!player || (winter && pendingTransfer.type === "pre")) return;
    const from = player.club;
    player.reserved = false;
    movePlayer(player, gameState.myClubId);
    player.contract = pendingTransfer.contract;
    player.joinedFee = pendingTransfer.offer.fee;
    if (pendingTransfer.offer.sellOnPercent && from != null)
      player.sellOn = { club: from, percent: pendingTransfer.offer.sellOnPercent };
    if (pendingTransfer.offer.addon && from != null)
      player.addon = { club: from, amount: pendingTransfer.offer.addon, apps: 20, paid: false };
    player.addonBase = player.careerTotals.apps;
    news(`${player.name} chính thức ra mắt ${myClub().name}.`, "transfer");
  });
  gameState.pending = keep;
}

const leagueSize = (): number => gameState.fixtures[myLeagueId()].length / 2 + 1;

function seasonReview(): void {
  const pos = myLeaguePosition(),
    target = gameState.board.target;
  let confidenceDelta = 0;
  const lines: string[] = [];
  const OBJECTIVE_WEIGHTS = { pos: 18, wage: 8, youth: 6, sell: 6 };
  gameState.board.objectives.forEach((objective) => {
    const status = objectiveStatus(objective);
    const weight = OBJECTIVE_WEIGHTS[objective.kind];
    confidenceDelta += status.ok
      ? weight
      : -weight * (objective.kind === "pos" ? Math.max(1, pos - target) : 1);
    lines.push(`${status.ok ? "✓" : "✗"} ${objective.label}: ${status.text}`);
  });
  gameState.boardConfidence = clamp(gameState.boardConfidence + confidenceDelta, 0, 100);
  const teamCount = leagueSize();
  const prize = roundToTen((teamCount + 1 - pos) * 900 + myClub().prestige * 3000);
  gameState.review = { position: pos, confidenceDelta, prize, lines };
  const reputationDelta = reputationAfterSeason(pos, target, teamCount);
  inbox({
    kind: "season",
    title: `Tổng kết mùa ${gameState.year}/${gameState.year + 1}`,
    body: `Xếp hạng ${pos}/${teamCount}. ${lines.join(" · ")}. Niềm tin ban lãnh đạo ${confidenceDelta >= 0 ? "+" : ""}${Math.round(confidenceDelta)} → ${Math.round(gameState.boardConfidence)}. Uy tín HLV ${reputationDelta >= 0 ? "+" : ""}${reputationDelta} → ${Math.round(myReputation())}. Tiền thưởng xếp hạng ${formatMoney(prize)} sẽ cộng vào ngân sách mùa tới.`,
  });
  if (gameState.boardConfidence < 15)
    sack(`Không đạt mục tiêu mùa giải (xếp thứ ${pos}, mục tiêu top ${target}).`);
  else jobOffersTick(pos, target);
}

function newSeason(): void {
  let prize = gameState.review ? gameState.review.prize : 0;
  // đã nhận lời CLB khác: hoàn tất các thương vụ của CLB cũ rồi bàn giao
  const moved = !!gameState.job && !!gameState.clubs[gameState.job];
  if (moved) {
    applyPending();
    switchClub(gameState.job!);
    prize = 0;
  }
  gameState.offers = [];
  gameState.job = null;
  gameState.year++;
  gameState.day = 0;
  gameState.hour = 9;
  // cho mượn trở về
  Object.values(gameState.players).forEach((player) => {
    if (player.loan) {
      const from = player.loan.fromClub;
      player.loan = null;
      movePlayer(player, from);
    }
    if (player.homeClub) {
      const homeClubId = player.homeClub;
      player.homeClub = null;
      player.loanOut = null;
      movePlayer(player, homeClubId);
    }
    if (player.away) player.away = null;
  });
  // hợp đồng hết hạn
  Object.values(gameState.players).forEach((player) => {
    player.age++;
    player.apps = 0;
    player.goals = 0;
    if (
      player.club != null &&
      player.contract &&
      player.contract.expiryYear <= gameState.year &&
      !gameState.pending.some((pendingTransfer) => pendingTransfer.playerId === player.id)
    ) {
      if (player.club === gameState.myClubId) {
        news(`${player.name} rời CLB theo dạng tự do khi hết hợp đồng.`, "club");
        movePlayer(player, null);
        player.contract = null;
      } else if (Math.random() < 0.65) {
        player.contract.expiryYear = gameState.year + randomInt(1, 3);
        player.contract.wage = Math.round(Math.max(player.contract.wage, wageBase(player)));
        if (player.ovr >= 78 || getClub(player.club).leagueId === myLeagueId())
          news(
            `${player.name} gia hạn hợp đồng với ${getClub(player.club).name} đến 30/6/${player.contract.expiryYear}, lương ${formatWage(player.contract.wage)}.`,
            "deal",
          );
      } else {
        movePlayer(player, null);
        player.contract = null;
      }
    }
  });
  // giải nghệ
  Object.values(gameState.players).forEach((player) => {
    if (player.age >= 34 && Math.random() < (player.age - 33) * 0.3) {
      if (player.club === gameState.myClubId)
        news(`${player.name} giải nghệ ở tuổi ${player.age}.`, "club");
      if (player.club != null)
        getClub(player.club).playerIds = getClub(player.club).playerIds.filter(
          (playerId) => playerId !== player.id,
        );
      gameState.free = gameState.free.filter((playerId) => playerId !== player.id);
      gameState.shortlist = gameState.shortlist.filter((playerId) => playerId !== player.id);
      delete gameState.players[player.id];
    }
  });
  // cầu thủ tự do: tối đa 120, gán hợp đồng ảo để thương lượng
  gameState.free = gameState.free.filter((id) => gameState.players[id]);
  gameState.free.forEach((id) => {
    const player = getPlayer(id);
    if (!player.contract)
      player.contract = {
        wage: wageBase(player),
        expiryYear: gameState.year,
        releaseClause: 0,
        role: "Xoay tua",
      };
  });
  trimFree();
  // CLB AI: bổ sung cầu thủ trẻ, ngân sách mới, cập nhật sức mạnh
  Object.values(gameState.clubs).forEach((club) => {
    if (club.id !== gameState.myClubId) {
      while (club.playerIds.length < 23) {
        const player = makePlayer(
          getLeague(club.leagueId).nationality,
          pickRandom<Line>(["GK", "DF", "DF", "MF", "MF", "FW"]),
          Math.round(club.strength - randomInt(8, 14)),
          randomInt(17, 19),
          club.id,
        );
        player.contract!.role = "Triển vọng";
        club.playerIds.push(player.id);
      }
      club.budget = roundToTen(
        club.budget * 0.5 + 4000 * Math.pow(club.prestige, 2.2) * randomBetween(0.8, 1.2),
      );
    }
    club.strength = Math.round(clamp(clubStrength(club.id).power, 45, 85));
  });
  // học viện: 2 cầu thủ trẻ mỗi mùa (thêm nếu đội quá mỏng)
  const need = Math.max(2, 20 - clubPlayers(gameState.myClubId).length);
  for (let i = 0; i < need; i++) {
    const player = makePlayer(
      getLeague(myLeagueId()).nationality,
      pickRandom<Line>(["DF", "MF", "FW"]),
      Math.round(myClub().strength - randomInt(12, 18)),
      17,
      gameState.myClubId,
    );
    player.contract!.role = "Triển vọng";
    player.contract!.wage = 3;
    myClub().playerIds.push(player.id);
    inbox({
      kind: "youth",
      title: "Học viện đôn lên cầu thủ trẻ",
      body: `${player.name} (${POSITION_NAMES[player.pos]}, ${ovrRange(player)}, tiềm năng ước tính ${scoutRange(player).join("–")}) ký hợp đồng chuyên nghiệp đầu tiên.`,
      playerId: player.id,
    });
  }
  applyPending();
  // ngân sách
  const dueAmount = gameState.liabilities
    .filter((liability) => liability.year === gameState.year)
    .reduce((total, liability) => total + liability.amount, 0);
  gameState.liabilities = gameState.liabilities.filter(
    (liability) => liability.year > gameState.year,
  );
  const alloc = roundToTen(
    4000 * Math.pow(myClub().prestige, 2) * (gameState.boardConfidence / 60),
  );
  myClub().budget = roundToTen(myClub().budget + alloc + prize - dueAmount);
  gameState.wageCap = Math.round(Math.max(gameState.wageCap, myWages() * 1.05));
  gameState.seasonLog.unshift({
    year: gameState.year - 1,
    position: gameState.review ? gameState.review.position : null,
  });
  if (gameState.review && !moved) {
    const teamCount = leagueSize();
    if (gameState.review.position <= 2) myClub().prestige = Math.min(5, myClub().prestige + 1);
    if (gameState.review.position >= teamCount - 3)
      myClub().prestige = Math.max(1, myClub().prestige - 1);
  }
  Object.values(gameState.players).forEach((player) => (player.marketValue = valueOf(player)));
  simLeagues().forEach((league) => {
    gameState.fixtures[league.id] = makeFixtures(
      Object.values(gameState.clubs)
        .filter((club) => club.leagueId === league.id)
        .map((club) => club.id),
    );
    gameState.results[league.id] = [];
  });
  gameState.review = null;
  gameState.lineup = bestLineup(gameState.myClubId, gameState.form);
  setBoard();
  inbox({
    kind: "finance",
    title: `Mùa giải ${gameState.year}/${gameState.year + 1} bắt đầu`,
    body: `Ngân sách chuyển nhượng ${formatMoney(myClub().budget)} (gồm phân bổ ${formatMoney(alloc)}, thưởng ${formatMoney(prize)}${dueAmount ? `, trừ trả góp ${formatMoney(dueAmount)}` : ""}). Kỳ chuyển nhượng hè mở đến 31/8.`,
  });
}
