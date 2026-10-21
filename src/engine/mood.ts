// Tâm lý cầu thủ: đòi ra sân, đòi ra đi, cam kết của người chơi, và cầu thủ CLB khác "thả thính" CLB của bạn.
import { ROLE_START } from "./constants";
import { moraleLabel } from "./players";
import { clubPlayers, slotPositions, squadRank } from "./squad";
import { getClub, inbox, myClub, news, getPlayer, gameState } from "./state";
import { activeNegoFor, willingness } from "./transfers";
import type { MoodCause, Player, Role } from "./types";
import { clamp, pickRandom } from "./util";

/** Số trận cam kết cho đá chính; càng dài càng xoa dịu nhiều nhưng càng khó giữ lời */
export const PROMISE_OPTS = [3, 5, 8] as const;
const promiseMor = (starts: number): number => (starts === 3 ? 8 : starts === 5 ? 11 : 14);
const promiseAllow = (starts: number): number => (starts >= 5 ? 1 : 0);

const startCount = (player: Player): number =>
  player.recentStarts.reduce((sum, value) => sum + value, 0);

/** Lý do không hài lòng của cầu thủ đang ở CLB bạn, hoặc null nếu ổn */
function myGrievance(player: Player): MoodCause | null {
  const expectedShare = ROLE_START[player.contract!.role] ?? 0.3;
  const playtime =
    player.recentStarts.length >= 4 &&
    startCount(player) / player.recentStarts.length < expectedShare - 0.15;
  if (playtime) return squadRank(player, gameState.myClubId).slots <= 1 ? "tactics" : "playtime";
  return player.morale < 20 ? "morale" : null;
}

const START_QUOTES: Record<MoodCause, ((player: Player) => string)[]> = {
  playtime: [
    (player) =>
      `${player.name} gõ cửa phòng làm việc của bạn: "Tôi cần được thi đấu. Ngồi dự bị mãi thế này, tôi không thể phát triển."`,
    (player) =>
      `${player.name} đứng ở cửa sau buổi tập, giọng trầm xuống: "HLV, tôi muốn biết mình còn chỗ trong kế hoạch của thầy không?"`,
  ],
  tactics: [
    (player) =>
      `${player.name} tìm gặp bạn: "Hệ thống này gần như không có chỗ cho vị trí của tôi. Tôi muốn biết thầy định dùng tôi thế nào."`,
    (player) =>
      `${player.name} thở dài sau buổi họp chiến thuật: "Tôi không thấy mình đâu trong sơ đồ này, thưa thầy."`,
  ],
  morale: [
    (player) =>
      `${player.name} lặng lẽ để lại một lá thư trên bàn bạn: "Tôi cần nói chuyện về tương lai của mình."`,
  ],
};
const LEAVE_QUOTES: Record<MoodCause, ((player: Player) => string)[]> = {
  playtime: [
    (player) =>
      `${player.name} gửi người đại diện đến gặp bạn: "Cậu ấy không thể tiếp tục thế này. Chúng tôi muốn cậu ấy được ra đi để tìm cơ hội thi đấu."`,
  ],
  tactics: [
    (player) =>
      `Người đại diện của ${player.name} đặt thẳng vấn đề: "Lối chơi này không dành cho cậu ấy. Hãy cho cậu ấy một lối thoát."`,
  ],
  morale: [
    (player) =>
      `${player.name} không còn muốn ở lại. Người đại diện báo cho bạn rằng cậu ấy xin được rao bán.`,
  ],
};

function demandStart(player: Player, cause: MoodCause): void {
  player.demand = { kind: "start", day: gameState.day, cause };
  news(
    `${player.name} đang bất mãn tại ${myClub().name}: cậu ấy đòi được ra sân nhiều hơn.`,
    "rebel",
  );
  inbox({
    kind: "demand",
    title: `${player.name} đòi được ra sân`,
    body:
      pickRandom(START_QUOTES[cause])(player) +
      ` Tinh thần: ${moraleLabel(player.morale).toLowerCase()}.`,
    playerId: player.id,
  });
}
function demandLeave(player: Player, cause: MoodCause): void {
  player.demand = { kind: "leave", day: gameState.day, cause };
  player.wantOut = true;
  news(
    `${player.name} chính thức đòi rời ${myClub().name}. Người đại diện đã bắt đầu tìm bến đỗ mới.`,
    "rebel",
  );
  inbox({
    kind: "demand",
    title: `${player.name} đòi ra đi`,
    body: pickRandom(LEAVE_QUOTES[cause])(player) + " Bạn có thể xoa dịu, rao bán hoặc cho mượn.",
    playerId: player.id,
  });
}

/** Chạy mỗi tuần: cầu thủ của bạn đòi hỏi, và cầu thủ CLB khác thả thính */
export function moodTick(): void {
  clubPlayers(gameState.myClubId).forEach((player) => {
    if (player.loan || player.away || !player.contract || player.promise) return;
    if (player.demand) {
      if (gameState.day - player.demand.day >= 14 && player.demand.kind === "start")
        demandLeave(player, player.demand.cause);
      return;
    }
    if (player.demandCooldown && gameState.day < player.demandCooldown) return;
    const grievance = myGrievance(player);
    if (!grievance) return;
    if (player.morale < 20) demandLeave(player, grievance);
    else if (player.morale < 55) demandStart(player, grievance);
  });
  interestTick();
  worldDramaTick();
}

// ---------- cầu thủ CLB khác thả thính ----------
const FLIRT: Record<
  MoodCause | "free",
  ((player: Player, club: string, toClubName: string) => string)[]
> = {
  playtime: [
    (player, clubName, toClubName) =>
      `${player.name} (${clubName}) nói trên báo: "Tôi muốn được đá nhiều hơn. Nghe nói ${toClubName} đang chơi thứ bóng đá rất hấp dẫn."`,
    (player, clubName, toClubName) =>
      `Sau trận thua, ${player.name} (${clubName}) bình thản: "Ngồi dự bị không phải điều tôi muốn. Nếu ${toClubName} gọi, tôi sẽ lắng nghe."`,
  ],
  tactics: [
    (player, clubName, toClubName) =>
      `${player.name} (${clubName}) tâm sự: "Sơ đồ ở đây chưa phù hợp với tôi. Tôi thích cách ${toClubName} sử dụng vị trí của mình."`,
  ],
  morale: [
    (player, clubName, toClubName) =>
      `Một nguồn tin thân cận cho biết ${player.name} (${clubName}) không còn hạnh phúc, và ${toClubName} nằm trong danh sách mơ ước của cậu ấy.`,
  ],
  free: [
    (player, _c, toClubName) =>
      `${player.name} đang tìm bến đỗ mới. Người đại diện nói cậu ấy "rất ấn tượng với dự án của ${toClubName}".`,
  ],
};

function interestCause(player: Player): MoodCause | "free" | null {
  if (player.club == null) return "free";
  const squadStanding = squadRank(player, player.club);
  const mySlots = slotPositions(gameState.form).filter((line) => line === player.pos).length;
  if (player.ovr >= 65 && (squadStanding.role === "Dự bị" || squadStanding.role === "Xoay tua"))
    return "playtime";
  if (squadStanding.slots < mySlots && squadStanding.rank > squadStanding.slots) return "tactics";
  if (player.morale < 35) return "morale";
  return null;
}

function interestTick(): void {
  if (Math.random() > 0.4) return;
  const pool = Object.values(gameState.players).filter(
    (player) =>
      player.club !== gameState.myClubId &&
      player.contract &&
      !player.interest &&
      !player.loan &&
      !player.away &&
      player.ovr >= myClub().strength - 4 &&
      !activeNegoFor(player.id) &&
      willingness(player) >= 55 &&
      interestCause(player),
  );
  const free = Object.values(gameState.players).filter(
    (player) =>
      player.club == null &&
      !player.interest &&
      player.ovr >= myClub().strength - 6 &&
      !activeNegoFor(player.id) &&
      willingness(player) >= 55,
  );
  const cand = [...pool, ...free];
  if (!cand.length) return;
  const player = pickRandom(cand);
  const cause = interestCause(player)!;
  player.interest = { day: gameState.day, cause };
  const club = player.club != null ? getClub(player.club).name : "tự do";
  news(pickRandom(FLIRT[cause])(player, club, myClub().name), "flirt");
  if (cause === "free" || Math.random() < 0.6) {
    player.interest.agent = true; // có thư từ người đại diện: hiện ở tab Mua bán cho đến khi hết hạn
    const bind =
      player.club != null && player.contract!.expiryYear - gameState.year > 1
        ? " Lưu ý: cậu ấy còn hợp đồng dài hạn, bạn cần thương lượng với CLB chủ quản."
        : "";
    inbox({
      kind: "agent",
      title: `Người đại diện của ${player.name} liên hệ`,
      body: `Người đại diện của ${player.name} (${club}) gửi thư thăm dò ý định của ${myClub().name}: cậu ấy sẵn sàng ngồi xuống nói chuyện.${bind}`,
      playerId: player.id,
    });
  }
}

// ---------- cam kết ----------
/** Gọi sau mỗi trận của CLB bạn: cầu thủ có cam kết được đá chính thì tính, khỏe mà không đá thì tính là lỡ hẹn */
export function trackPromise(player: Player, started: boolean): void {
  const profile = player.promise;
  if (!profile) return;
  if (started) profile.left--;
  else if (player.injuryDays <= 0) profile.missed++;
  if (profile.missed > profile.allowedMisses) {
    player.promise = null;
    player.morale = clamp(player.morale - 15, 0, 100);
    player.demandCooldown = 0;
    demandLeave(player, "playtime");
  } else if (profile.left <= 0) {
    player.promise = null;
    player.morale = clamp(player.morale + 10, 0, 100);
    news(`${player.name} hài lòng vì bạn đã giữ lời: cậu ấy được ra sân đúng như cam kết.`, "club");
  }
}

// ---------- người chơi trả lời ----------
export type DemandChoice =
  | { action: "promise"; starts: (typeof PROMISE_OPTS)[number] }
  | { action: "promote" }
  | { action: "persuade" }
  | { action: "refuse" }
  | { action: "sell" }
  | { action: "loan" }
  | { action: "hold" };

const LADDER: Role[] = ["Dự bị", "Xoay tua", "Đá chính", "Ngôi sao"];
/** Vai trò cao hơn một bậc, hoặc null nếu đã ở đỉnh */
export function nextRole(role: Role): Role | null {
  if (role === "Triển vọng") return "Xoay tua";
  const i = LADDER.indexOf(role);
  return i >= 0 && i < LADDER.length - 1 ? LADDER[i + 1] : null;
}
/** Xác suất xoa dịu thành công một yêu cầu ra đi bằng cam kết */
export const appeaseChance = (player: Player, starts: number): number =>
  clamp(0.4 + starts * 0.04 + player.morale / 200, 0, 0.9);

/** Người chơi phản hồi yêu cầu của cầu thủ. Trả về câu mô tả kết quả. */
export function respondDemand(playerId: string, choice: DemandChoice): { message: string } {
  const player = getPlayer(playerId);
  const demand = player.demand;
  if (!demand) return { message: "Không còn yêu cầu nào." };
  const clear = (cool: number) => {
    player.demand = null;
    player.demandCooldown = gameState.day + cool;
  };
  const promise = (starts: number) => {
    player.promise = {
      kind: "start",
      left: starts,
      missed: 0,
      allowedMisses: promiseAllow(starts),
    };
    player.recentStarts = [];
  };
  if (choice.action === "promise") {
    if (demand.kind === "start") {
      promise(choice.starts);
      player.morale = clamp(player.morale + promiseMor(choice.starts), 0, 100);
      clear(30);
      return {
        message: `${player.name} gật đầu: "Tôi sẽ chờ xem thầy giữ lời." Hãy cho cậu ấy đá chính ${choice.starts} trận tới.`,
      };
    }
    if (Math.random() < appeaseChance(player, choice.starts)) {
      promise(choice.starts);
      player.wantOut = false;
      player.morale = clamp(player.morale + promiseMor(choice.starts) + 2, 0, 100);
      clear(30);
      return {
        message: `${player.name} cân nhắc rồi đồng ý ở lại: "Tôi tin thầy lần này." Cậu ấy sẽ đá chính ${choice.starts} trận tới.`,
      };
    }
    player.morale = clamp(player.morale - 2, 0, 100);
    player.demand = { ...demand, day: gameState.day };
    return {
      message: `${player.name} lắc đầu: "Lời hứa suông thôi chưa đủ." Cậu ấy vẫn muốn ra đi.`,
    };
  }
  if (choice.action === "promote") {
    const role = nextRole(player.contract!.role);
    if (!role) return { message: "Cậu ấy đã ở vai trò cao nhất." };
    player.contract!.role = role;
    player.morale = clamp(player.morale + 10, 0, 100);
    clear(30);
    return {
      message: `${player.name} được nâng lên vai trò "${role}". Cậu ấy mỉm cười, nhưng sẽ chờ xem thầy có xếp mình đá đủ không.`,
    };
  }
  if (choice.action === "persuade") {
    player.morale = clamp(player.morale + 3, 0, 100);
    if (Math.random() < 0.4) {
      clear(14);
      return {
        message: `${player.name} im lặng một lúc rồi chấp nhận: "Tôi sẽ cố gắng chờ cơ hội."`,
      };
    }
    player.demand = null;
    demandLeave(player, demand.cause);
    return { message: `${player.name} không bị thuyết phục. Cậu ấy quay sang đòi được ra đi.` };
  }
  if (choice.action === "sell") {
    player.listed = true;
    player.loanList = false;
    player.morale = clamp(player.morale + 5, 0, 100);
    clear(60);
    return { message: `Bạn đồng ý rao bán ${player.name}. Các CLB sẽ sớm liên hệ.` };
  }
  if (choice.action === "loan") {
    player.loanList = true;
    player.listed = false;
    player.morale = clamp(player.morale + 5, 0, 100);
    clear(60);
    return { message: `Bạn đồng ý cho ${player.name} đi mượn. Các CLB sẽ sớm liên hệ.` };
  }
  // refuse (đòi ra sân) hoặc hold (đòi ra đi): giữ nguyên quyết định
  player.morale = clamp(player.morale - (choice.action === "hold" ? 12 : 10), 0, 100);
  if (choice.action === "hold") player.wantOut = true;
  clear(choice.action === "hold" ? 60 : 30);
  return {
    message: `${player.name} cúi đầu rời phòng, không nói thêm lời nào. Tinh thần của cậu ấy sa sút.`,
  };
}

// ---------- chuyện của các CLB khác ----------
const REBEL: Record<MoodCause, ((player: Player, clubName: string) => string)[]> = {
  playtime: [
    (player, clubName) =>
      `${player.name} nổi giận vì ngồi dự bị: cậu ấy đòi rời ${clubName} ngay trong kỳ chuyển nhượng tới.`,
    (player, clubName) =>
      `Phòng thay đồ ${clubName} dậy sóng: ${player.name} công khai phàn nàn về thời gian thi đấu.`,
  ],
  tactics: [
    (player, clubName) =>
      `${player.name} bất đồng với HLV ${clubName} về chiến thuật và bị loại khỏi buổi tập chung.`,
  ],
  morale: [
    (player, clubName) =>
      `${player.name} (${clubName}) mất hứng thú với bóng đá ở đây và yêu cầu được ra đi.`,
  ],
};

/** Mỗi tuần có thể có một cầu thủ CLB khác thả thính một đội khác, nổi loạn hoặc làm hòa */
function worldDramaTick(): void {
  const players = Object.values(gameState.players).filter(
    (player) =>
      player.club != null &&
      player.club !== gameState.myClubId &&
      player.contract &&
      !player.loan &&
      !player.away &&
      player.ovr >= 70,
  );
  // làm hòa
  const rebels = players.filter((player) => player.wantOut);
  if (rebels.length && Math.random() < 0.4) {
    const player = pickRandom(rebels);
    player.wantOut = false;
    player.morale = clamp(player.morale + 15, 0, 100);
    news(
      `${player.name} làm hòa với ${getClub(player.club!).name} sau cuộc nói chuyện thẳng thắn: cậu ấy sẽ ở lại.`,
      "rebel",
    );
  }
  // nổi loạn
  if (Math.random() < 0.3) {
    const player = pickRandom(
      players.filter(
        (candidate) =>
          !candidate.wantOut && interestCause(candidate) && interestCause(candidate) !== "free",
      ),
    );
    if (player) {
      const cause = interestCause(player) as MoodCause;
      player.wantOut = true;
      player.morale = clamp(player.morale - 10, 0, 100);
      news(pickRandom(REBEL[cause])(player, getClub(player.club!).name), "rebel");
    }
  }
  // thả thính CLB khác
  if (Math.random() < 0.3) {
    const player = pickRandom(
      players.filter(
        (candidate) =>
          interestCause(candidate) === "playtime" || interestCause(candidate) === "morale",
      ),
    );
    if (player) {
      const cause = interestCause(player) as MoodCause;
      const from = getClub(player.club!);
      const club = pickRandom(
        Object.values(gameState.clubs).filter(
          (otherClub) =>
            otherClub.id !== from.id &&
            otherClub.id !== gameState.myClubId &&
            otherClub.prestige >= from.prestige,
        ),
      );
      if (club) news(pickRandom(FLIRT[cause])(player, from.name, club.name), "flirt");
    }
  }
}
