// Toàn bộ logic chuyển nhượng: mua, mượn, tự do, ký trước, gia hạn, bán, Giám đốc thể thao, AI ↔ AI.
import { WINTER_WINDOW } from "./constants";
import type { Reply } from "./dialogue";
import { myWages } from "./board";
import { formatMoney, formatWage } from "./format";
import { valueOf, wageBase, yearsLeft } from "./players";
import { clubPlayers, myLineup, squadRank } from "./squad";
import {
  getClub,
  inbox,
  isDeadline,
  getLeague,
  myClub,
  myLeagueId,
  news,
  getPlayer,
  gameState,
  tick,
  windowNow,
} from "./state";
import type {
  Club,
  ClubOffer,
  ContractOffer,
  Line,
  NegoType,
  Negotiation,
  Player,
  Role,
  Tone,
} from "./types";
import { clamp, pickRandom, roundToTen, randomInt, randomBetween } from "./util";

export type Res = { error?: string; negotiation?: Negotiation };

/** Kết quả giọng điệu: cộng vào điểm/tỉ lệ, nhân mức tăng căng thẳng, cộng thêm căng thẳng và một câu phản ứng */
function toneEffect(tone: Tone | undefined): {
  bonus: number;
  tenseMul: number;
  tenseAdd: number;
  line: string;
} {
  if (tone === "warm")
    return {
      bonus: -0.02,
      tenseMul: 0.5,
      tenseAdd: 0,
      line: "Thái độ chân thành của bạn làm bầu không khí dịu lại.",
    };
  if (tone === "bluff") {
    if (Math.random() < 0.45)
      return {
        bonus: 0.07,
        tenseMul: 1,
        tenseAdd: 0,
        line: "Lời nói cứng của bạn có tác dụng: họ chùn lại một nhịp.",
      };
    return {
      bonus: -0.02,
      tenseMul: 1,
      tenseAdd: 15,
      line: "Họ không tin vào lời dọa của bạn. Căn phòng như lạnh đi.",
    };
  }
  return { bonus: 0, tenseMul: 1, tenseAdd: 0, line: "" };
}
/** Áp mức tăng căng thẳng của lượt này theo giọng điệu và ghép câu phản ứng vào đầu tin nhắn */
function applyToneTension(
  negotiation: Negotiation,
  tensionBefore: number,
  effect: ReturnType<typeof toneEffect>,
): void {
  negotiation.tension = Math.round(
    tensionBefore + (negotiation.tension - tensionBefore) * effect.tenseMul + effect.tenseAdd,
  );
  if (effect.line) negotiation.message = `${effect.line} ${negotiation.message}`;
}

const leagueLevel = (clubId: string | null): number =>
  clubId == null ? 1.5 : getLeague(getClub(clubId).leagueId).level;
const prestigeOf = (clubId: string | null): number =>
  clubId == null ? 1 : getClub(clubId).prestige;
const absDay = (): number => gameState.year * 400 + gameState.day;

/** Mức sẵn lòng gia nhập CLB của bạn (0–100) */
export function willingness(player: Player): number {
  let willingnessScore =
    55 +
    (myClub().prestige - prestigeOf(player.club)) * 14 +
    (leagueLevel(gameState.myClubId) - leagueLevel(player.club)) * 12;
  if (player.club == null) willingnessScore += 25;
  if (player.morale < 40) willingnessScore += 18;
  if (yearsLeft(player) <= 1) willingnessScore += 10;
  if (
    player.interest &&
    gameState.day - player.interest.day >= 0 &&
    gameState.day - player.interest.day < 60
  )
    willingnessScore += 10;
  if (
    player.nationality === getLeague(myLeagueId()).nationality &&
    player.club != null &&
    getClub(player.club).leagueId !== myLeagueId()
  )
    willingnessScore += 10;
  if (player.club != null && getClub(player.club).rival === gameState.myClubId)
    willingnessScore -= 25;
  return clamp(Math.round(willingnessScore), 0, 100);
}
export const willingnessLabel = (willingnessScore: number): string =>
  willingnessScore >= 75
    ? "Rất muốn đến"
    : willingnessScore >= 55
      ? "Sẵn sàng nghe"
      : willingnessScore >= 35
        ? "Do dự"
        : "Không muốn đến";

export function askFactor(player: Player): number {
  const clubId = player.club;
  if (clubId == null) return 0;
  const club = getClub(clubId),
    squadStanding = squadRank(player, clubId);
  let factor =
    squadStanding.role === "Ngôi sao" ? 1.7 : squadStanding.role === "Đá chính" ? 1.35 : 1.08;
  const remainingYears = yearsLeft(player);
  factor *= remainingYears <= 1 ? 0.72 : remainingYears === 2 ? 0.9 : 1;
  if (club.philosophy === "bargain") factor *= 0.95;
  if (club.philosophy === "young" && player.age <= 23) factor *= 1.25;
  if (club.philosophy === "win" && squadStanding.role !== "Dự bị") factor *= 1.12;
  if (club.leagueId === myClub().leagueId) factor *= 1.08;
  if (club.rival === gameState.myClubId) factor *= 1.35;
  return factor;
}
/** Ước lượng tiềm năng của tuyển trạch viên (sai số giảm theo cấp tuyển trạch) */
export function scoutRange(player: Player): [number, number] {
  const error = 6 - gameState.scout;
  const potentialEstimate = player.pot + player.potentialBias * error * 1.6;
  return [Math.round(potentialEstimate - error * 1.5), Math.round(potentialEstimate + error * 1.5)];
}
export function feeEstimate(player: Player): [number, number] {
  const askingFee = player.marketValue * askFactor(player),
    scoutError = (6 - gameState.scout) * 0.06;
  return [roundToTen(askingFee * (1 - scoutError)), roundToTen(askingFee * (1 + scoutError))];
}
export const expectedRoleAtMe = (player: Player): Role =>
  squadRank(player, gameState.myClubId).role;
export const roleIdx = (role: Role): number =>
  ["Ngôi sao", "Đá chính", "Xoay tua", "Triển vọng", "Dự bị"].indexOf(role);

export function contractAsk(player: Player, type: NegoType): ContractOffer {
  const base = wageBase(player);
  let factor = 1;
  if (type !== "renew") {
    const gap = prestigeOf(player.club) - myClub().prestige;
    factor +=
      Math.max(0, gap) * 0.15 -
      Math.max(0, -gap) * 0.04 +
      (leagueLevel(player.club) - leagueLevel(gameState.myClubId)) * 0.08;
    if (type === "free") factor += 0.15;
  } else
    factor =
      1.05 +
      (player.morale < 40 ? 0.25 : 0) +
      (player.ovr - (player.ovrAtSign || player.ovr)) * 0.03;
  const role = expectedRoleAtMe(player);
  factor *= role === "Ngôi sao" ? 1.3 : role === "Đá chính" ? 1.1 : role === "Dự bị" ? 0.9 : 1;
  const wage = Math.max(base, Math.round(base * factor * randomBetween(0.95, 1.08)));
  return {
    wage,
    years: player.age < 24 ? 5 : player.age < 29 ? 4 : player.age < 32 ? 3 : 2,
    signingBonus: roundToTen(player.marketValue * 0.04 + wage * 4),
    role,
    releaseClause: 0,
  };
}

function newNego(
  draft: Partial<Negotiation> & Pick<Negotiation, "playerId" | "type" | "stage" | "message">,
): Negotiation {
  const negotiation: Negotiation = {
    id: "n" + gameState.nextRecordNumber++,
    tension: 0,
    round: 0,
    log: [],
    created: tick(),
    ...draft,
  };
  gameState.negos.unshift(negotiation);
  return negotiation;
}
const logNegotiation = (negotiation: Negotiation, author: "me" | "them", text: string): void => {
  negotiation.log.push({ author, text, tickAt: tick() });
};
const responseWait = (): number => (isDeadline() ? 1 : 24);
export const activeNegoFor = (playerId: string): Negotiation | undefined =>
  gameState.negos.find(
    (negotiation) =>
      negotiation.playerId === playerId &&
      negotiation.stage !== "done" &&
      negotiation.stage !== "failed",
  );

/** Cầu thủ mà người đại diện đã gửi thư thăm dò CLB bạn (còn hiệu lực 60 ngày, chưa có đàm phán) */
export const AGENT_LETTER_DAYS = 60;
export const agentLetters = (): Player[] =>
  Object.values(gameState.players)
    .filter(
      (player) =>
        player.interest?.agent &&
        player.club !== gameState.myClubId &&
        gameState.day - player.interest.day >= 0 &&
        gameState.day - player.interest.day < AGENT_LETTER_DAYS &&
        !activeNegoFor(player.id),
    )
    .sort((playerA, playerB) => playerB.interest!.day - playerA.interest!.day);

export function failNegotiation(negotiation: Negotiation, reason: string, coolDays = 15): void {
  negotiation.stage = "failed";
  negotiation.message = reason;
  logNegotiation(negotiation, "them", reason);
  const player = getPlayer(negotiation.playerId);
  if (player) player.cooldown = tick() + coolDays * 24;
  if (negotiation.isBuyOffer || negotiation.isSellOffer)
    inbox({
      kind: "dealFail",
      title: "Thương vụ đổ vỡ",
      body: reason,
      negotiationId: negotiation.id,
      playerId: negotiation.playerId,
    });
  if (player && (negotiation.isBuyOffer || negotiation.isSellOffer))
    news(`Đàm phán đổ vỡ: ${player.name} sẽ không đến/rời ${myClub().name} lần này.`, "deal");
}

// ---------- mua: thăm dò ----------
export function enquire(playerId: string, type: NegoType = "transfer"): Res {
  const player = getPlayer(playerId);
  if (activeNegoFor(playerId))
    return { error: "Đã có một thương vụ đang diễn ra với cầu thủ này." };
  if (player.club === gameState.myClubId) return { error: "Cầu thủ đã thuộc CLB của bạn." };
  if (player.cooldown && player.cooldown > tick())
    return { error: "CLB này tạm thời không muốn nói chuyện lại. Hãy thử sau." };
  if (player.club == null)
    return {
      negotiation: newNego({
        playerId,
        type: "free",
        isBuyOffer: true,
        stage: "contract",
        askingFee: null,
        contractAsk: contractAsk(player, "free"),
        message: "Cầu thủ tự do, bạn có thể đàm phán hợp đồng ngay.",
      }),
    };
  if (type === "pre") {
    if (yearsLeft(player) > 1 || gameState.day < WINTER_WINDOW[0])
      return { error: "Chỉ được đàm phán trước với cầu thủ còn dưới 6 tháng hợp đồng (từ 1/1)." };
    return {
      negotiation: newNego({
        playerId,
        type: "pre",
        isBuyOffer: true,
        stage: "contract",
        contractAsk: contractAsk(player, "free"),
        message: "Hợp đồng sắp hết hạn: bạn có thể ký trước, cầu thủ gia nhập miễn phí từ 1/7.",
      }),
    };
  }
  const negotiation = newNego({
    playerId,
    type,
    isBuyOffer: true,
    stage: "enquiry",
    seller: player.club,
    readyAt: tick() + responseWait(),
    message: "Đã gửi thư thăm dò. Chờ phản hồi.",
  });
  logNegotiation(
    negotiation,
    "me",
    type === "loan"
      ? "Bạn nhấc máy, hỏi thăm khả năng mượn cầu thủ."
      : "Một lá thư thăm dò được gửi đi trong im lặng...",
  );
  return { negotiation };
}
function processEnquiry(negotiation: Negotiation): void {
  const player = getPlayer(negotiation.playerId);
  if (!player || player.club !== negotiation.seller || player.club == null) {
    failNegotiation(negotiation, "Cánh cửa đã khép lại: cầu thủ này không còn thuộc CLB đó nữa.");
    return;
  }
  const squadStanding = squadRank(player, player.club),
    club = getClub(player.club);
  if (negotiation.type === "loan") {
    if (
      squadStanding.role === "Ngôi sao" ||
      (squadStanding.role === "Đá chính" && Math.random() < 0.75)
    ) {
      failNegotiation(
        negotiation,
        `${club.name} đáp gọn qua điện thoại: "Cậu ấy nằm trong kế hoạch đội một. Chúng tôi không cho mượn." Đường dây cúp máy.`,
      );
      return;
    }
    negotiation.minPercent = clamp(
      40 + (squadStanding.role === "Đá chính" ? 30 : 0) + randomInt(0, 25),
      30,
      100,
    );
    negotiation.stage = "club";
    negotiation.message = `Sau một hồi cân nhắc, ${club.name} gật đầu: cho mượn đến hết mùa. Điều kiện đi kèm: bạn phải gánh một phần lương của cậu ấy.`;
    logNegotiation(negotiation, "them", negotiation.message);
    return;
  }
  if (absDay() - (player.joinedAbs || -9999) < 120) {
    failNegotiation(
      negotiation,
      `${club.name} lắc đầu: "Cậu ấy vừa mới đến, mực chưa khô trên bản hợp đồng. Chúng tôi không bán."`,
    );
    return;
  }
  if (club.rival === gameState.myClubId && Math.random() < 0.5) {
    failNegotiation(
      negotiation,
      `Chủ tịch ${club.name} nhìn thấy tên CLB bạn trên lá thư và gạt phắt đi: họ không bao giờ làm ăn với kình địch.`,
      30,
    );
    return;
  }
  if (
    squadStanding.role === "Ngôi sao" &&
    club.prestige >= myClub().prestige &&
    Math.random() < 0.55 &&
    !player.contract!.releaseClause
  ) {
    failNegotiation(
      negotiation,
      `${club.name} đáp lạnh lùng: "${player.name} là trụ cột của chúng tôi. Cậu ấy không phải để bán."`,
      20,
    );
    return;
  }
  negotiation.askingFee = roundToTen(
    player.marketValue * askFactor(player) * randomBetween(0.95, 1.08),
  );
  negotiation.stage = "club";
  const hint = feeEstimate(player);
  negotiation.message =
    `Cánh cửa phòng họp hé mở: ${club.name} sẵn sàng lắng nghe. Tuyển trạch viên của bạn thì thầm rằng họ định giá cậu ấy khoảng ${formatMoney(hint[0])}–${formatMoney(hint[1])}.` +
    (player.contract!.releaseClause
      ? ` Nhưng có một lá bài trong tay bạn: điều khoản giải phóng ${formatMoney(player.contract!.releaseClause)} nằm trong hợp đồng của cậu ấy.`
      : "");
  logNegotiation(negotiation, "them", negotiation.message);
}

// ---------- đề nghị với CLB bán ----------
export function offerValue(negotiation: Negotiation, clubOffer: ClubOffer): number {
  const player = getPlayer(negotiation.playerId);
  let total = clubOffer.fee;
  if (clubOffer.installments === 2) total *= 0.96;
  if (clubOffer.installments === 3) total *= 0.92;
  total += (clubOffer.addon || 0) * 0.45;
  total += ((clubOffer.sellOnPercent || 0) / 100) * player.marketValue * 0.6;
  if (clubOffer.swapPlayerId && getPlayer(clubOffer.swapPlayerId))
    total += getPlayer(clubOffer.swapPlayerId).marketValue * 0.8;
  if (clubOffer.loanback) total += (negotiation.askingFee || 0) * 0.06;
  if (clubOffer.timing === "next") total *= 0.98;
  return total;
}
export const canAffordNow = (clubOffer: ClubOffer): boolean =>
  (clubOffer.installments > 1 ? clubOffer.fee / clubOffer.installments : clubOffer.fee) <=
  myClub().budget;

export function submitClubOffer(
  negotiation: Negotiation,
  clubOffer: ClubOffer,
  reply?: Reply,
): Res {
  if (negotiation.type === "loan") {
    negotiation.offer = clubOffer;
    negotiation.waiting = true;
    negotiation.readyAt = tick() + responseWait();
    logNegotiation(negotiation, "me", `Đề nghị trả ${clubOffer.percent}% lương`);
    return {};
  }
  if (!canAffordNow(clubOffer)) return { error: "Vượt ngân sách chuyển nhượng hiện có." };
  negotiation.offer = clubOffer;
  negotiation.tone = reply?.tone;
  if (reply) logNegotiation(negotiation, "me", reply.text);
  negotiation.waiting = true;
  negotiation.readyAt = tick() + responseWait();
  negotiation.round++;
  logNegotiation(
    negotiation,
    "me",
    `Đề nghị ${formatMoney(clubOffer.fee)}${clubOffer.installments > 1 ? ` (trả góp ${clubOffer.installments} mùa)` : ""}${clubOffer.addon ? `, thưởng ${formatMoney(clubOffer.addon)}` : ""}${clubOffer.sellOnPercent ? `, ${clubOffer.sellOnPercent}% bán lại` : ""}${clubOffer.swapPlayerId ? `, + ${getPlayer(clubOffer.swapPlayerId).name}` : ""}${clubOffer.loanback ? ", cho mượn lại" : ""}${clubOffer.timing === "next" ? ", chuyển vào kỳ sau" : ""}`,
  );
  return {};
}
export function triggerReleaseClause(negotiation: Negotiation): Res {
  const player = getPlayer(negotiation.playerId);
  if (!player.contract?.releaseClause) return { error: "Không có điều khoản giải phóng." };
  if (player.contract.releaseClause > myClub().budget)
    return { error: "Không đủ ngân sách để kích hoạt điều khoản." };
  negotiation.offer = { fee: player.contract.releaseClause, installments: 1, timing: "now" };
  negotiation.releaseClauseUsed = true;
  negotiation.stage = "contract";
  negotiation.contractAsk = contractAsk(player, "transfer");
  negotiation.message = `Bạn kích hoạt điều khoản giải phóng ${formatMoney(player.contract.releaseClause)}. ${getClub(player.club!).name} buộc phải chấp nhận.`;
  logNegotiation(negotiation, "me", negotiation.message);
  return {};
}
function processClubOffer(negotiation: Negotiation): void {
  negotiation.waiting = false;
  const player = getPlayer(negotiation.playerId),
    club = getClub(negotiation.seller!),
    clubOffer = negotiation.offer!;
  if (negotiation.type === "loan") {
    if ((clubOffer.percent || 0) >= (negotiation.minPercent || 0)) {
      negotiation.stage = "final";
      negotiation.message = `${club.name} bắt tay đồng ý. ${player.name} đã sẵn sàng khoác áo bạn trong phần còn lại của mùa giải.`;
    } else {
      negotiation.tension += 25 + ((negotiation.minPercent || 0) - (clubOffer.percent || 0));
      negotiation.message = `${club.name} gõ nhẹ xuống bàn: "Ít nhất ${negotiation.minPercent}% lương phải do các anh chi trả. Dưới mức đó, đừng phí lời."`;
      if (negotiation.tension >= 100)
        return failNegotiation(
          negotiation,
          `Ghế của phía ${club.name} đã bị đẩy ra sau. Họ hết kiên nhẫn và rời bàn đàm phán.`,
        );
    }
    logNegotiation(negotiation, "them", negotiation.message);
    return;
  }
  const askingFee = negotiation.askingFee || 1;
  const effect = toneEffect(negotiation.tone),
    tensionBefore = negotiation.tension;
  negotiation.tone = undefined;
  const offered = offerValue(negotiation, clubOffer),
    ratio = offered / askingFee + effect.bonus;
  if (ratio >= 1) {
    negotiation.stage = "contract";
    negotiation.contractAsk = contractAsk(player, "transfer");
    negotiation.message = `${club.name} đồng ý với đề nghị của bạn! Bóng giờ nằm ở phía ${player.name}: đến lúc ngồi xuống với người đại diện của cậu ấy.`;
    negotiation.tension = Math.max(0, negotiation.tension - 20);
  } else if (ratio >= 0.85) {
    negotiation.tension += 12 + (1 - ratio) * 80;
    negotiation.askingFee = Math.max(
      roundToTen(askingFee - (askingFee - offered) * 0.35),
      roundToTen(offered * 1.02),
    );
    negotiation.counter = negotiation.askingFee;
    negotiation.message = `${club.name} nghiêng người về phía trước, đẩy tờ giấy ngược lại: ${formatMoney(negotiation.askingFee)}. Họ đã nhích một bước, bây giờ đến lượt bạn.`;
  } else {
    negotiation.tension += 22 + (1 - ratio) * 90;
    negotiation.counter = askingFee;
    negotiation.message = `${club.name} liếc qua con số rồi đặt tờ giấy xuống: "Còn cách quá xa." Họ vẫn đòi khoảng ${formatMoney(askingFee)}.`;
  }
  applyToneTension(negotiation, tensionBefore, effect);
  if (negotiation.round >= 5 && negotiation.stage === "club") negotiation.tension += 15;
  negotiation.tension = Math.round(Math.min(100, negotiation.tension));
  if (negotiation.tension >= 100)
    return failNegotiation(
      negotiation,
      `Bầu không khí đặc quánh lại. ${club.name} cắt đứt đàm phán và đứng dậy rời phòng.`,
    );
  logNegotiation(negotiation, "them", negotiation.message);
}

// ---------- hợp đồng cá nhân ----------
export function submitContract(
  negotiation: Negotiation,
  contractOffer: ContractOffer,
  reply?: Reply,
): Res {
  const player = getPlayer(negotiation.playerId);
  const swapP = negotiation.offer?.swapPlayerId ? getPlayer(negotiation.offer.swapPlayerId) : null;
  const extraW =
    contractOffer.wage -
    (negotiation.type === "renew" ? player.contract!.wage : 0) -
    (swapP ? swapP.contract!.wage : 0);
  if (myWages() + extraW > gameState.wageCap)
    return {
      error: `Vượt quỹ lương (${formatWage(myWages() + extraW)} / ${formatWage(gameState.wageCap)}). Hãy điều chỉnh ngân sách ở tab CLB.`,
    };
  const feeNow =
    negotiation.offer && negotiation.type !== "loan"
      ? negotiation.offer.installments > 1
        ? negotiation.offer.fee / negotiation.offer.installments
        : negotiation.offer.fee
      : 0;
  if (
    contractOffer.signingBonus * (negotiation.type === "renew" ? 1 : 1.5) + feeNow >
    myClub().budget
  )
    return { error: "Không đủ ngân sách cho phí chuyển nhượng, lót tay và phí người đại diện." };
  negotiation.contractOffer = contractOffer;
  negotiation.tone = reply?.tone;
  if (reply) logNegotiation(negotiation, "me", reply.text);
  negotiation.waiting = true;
  negotiation.readyAt = tick() + responseWait();
  negotiation.round++;
  logNegotiation(
    negotiation,
    "me",
    `Đề nghị lương ${formatWage(contractOffer.wage)}, ${contractOffer.years} năm, lót tay ${formatMoney(contractOffer.signingBonus)}, vai trò ${contractOffer.role}${contractOffer.releaseClause ? `, điều khoản giải phóng ${formatMoney(contractOffer.releaseClause)}` : ""}`,
  );
  return {};
}
function processContract(negotiation: Negotiation): void {
  negotiation.waiting = false;
  const player = getPlayer(negotiation.playerId),
    contractOffer = negotiation.contractAsk!,
    currentOffer = negotiation.contractOffer!;
  if (negotiation.type !== "renew" && !negotiation.willChecked) {
    negotiation.willChecked = true;
    const willingnessScore = willingness(player);
    if (willingnessScore < 20 && currentOffer.wage < contractOffer.wage * 1.5)
      return failNegotiation(
        negotiation,
        `Người đại diện của ${player.name} trả lời thẳng: "Cậu ấy không muốn chuyển đến ${myClub().name} lúc này." Cuộc gặp kết thúc ở đó.`,
      );
    if (willingnessScore < 40) negotiation.tension += 20;
  }
  if (negotiation.type === "renew" && player.morale < 25 && Math.random() < 0.7)
    return failNegotiation(
      negotiation,
      `${player.name} nhìn bản hợp đồng rồi nhẹ nhàng đặt bút xuống. Cậu ấy muốn tìm một thử thách mới.`,
    );
  const effect = toneEffect(negotiation.tone),
    tensionBefore = negotiation.tension;
  negotiation.tone = undefined;
  let score =
    0.62 * Math.min(1.3, currentOffer.wage / contractOffer.wage) +
    0.2 * Math.min(1.3, (currentOffer.signingBonus + 1) / (contractOffer.signingBonus + 1)) +
    0.18 * (Math.abs(currentOffer.years - contractOffer.years) <= 1 ? 1 : 0.75);
  const gap = roleIdx(currentOffer.role) - roleIdx(contractOffer.role);
  if (gap >= 2) score *= 0.82;
  else if (gap === 1) score *= 0.95;
  else if (gap < 0) score *= 1.03;
  if (currentOffer.releaseClause) score += 0.03;
  score += effect.bonus;
  if (score >= 1) {
    negotiation.stage = "final";
    negotiation.message = `Người đại diện gập tập hồ sơ lại và mỉm cười. ${player.name} đồng ý các điều khoản cá nhân!`;
    if (
      negotiation.type !== "renew" &&
      negotiation.type !== "free" &&
      negotiation.type !== "pre" &&
      Math.random() < 0.18
    ) {
      const pool = Object.values(gameState.clubs).filter(
        (club) =>
          club.id !== gameState.myClubId &&
          club.id !== negotiation.seller &&
          club.prestige >= myClub().prestige - 1,
      );
      if (pool.length) {
        const club = pickRandom(pool);
        negotiation.twist = { club: club.id };
        negotiation.message += ` Nhưng ngay khi bút sắp chạm giấy, điện thoại rung lên: ${club.name} cũng vừa nhảy vào cuộc đua!`;
      }
    }
  } else if (currentOffer.wage >= contractOffer.wage && gap <= 0) {
    // Đã đạt lương và vai trò: chỉ còn vướng lót tay, họ có thể nhượng bộ hoặc giữ nguyên, không đòi thêm lương.
    negotiation.tension += 8 + (1 - score) * 40;
    if (Math.random() < 0.5) {
      contractOffer.signingBonus = Math.max(
        roundToTen(contractOffer.signingBonus * 0.9),
        currentOffer.signingBonus,
      );
      negotiation.message = `Người đại diện gật gù: "Lương và vai trò thì ổn rồi." Ông ta nhìn xuống con số lót tay, rồi hạ nó xuống ${formatMoney(contractOffer.signingBonus)}.`;
    } else {
      negotiation.message = `Người đại diện khoanh tay: "Lương và vai trò ổn, nhưng lót tay ${formatMoney(contractOffer.signingBonus)} là mức sàn. Tôi sẽ không xuống thêm."`;
    }
  } else if (score >= 0.85) {
    negotiation.tension += 12 + (1 - score) * 70;
    contractOffer.wage = Math.min(
      contractOffer.wage,
      Math.max(Math.round(contractOffer.wage * 0.97), Math.round(currentOffer.wage * 1.02)),
    );
    negotiation.message = `Người đại diện chầm chậm xoay cây bút: "Chúng tôi cần lương khoảng ${formatWage(contractOffer.wage)} và vai trò ${contractOffer.role}. Gần rồi đấy."`;
  } else {
    negotiation.tension += 22 + (1 - score) * 80;
    negotiation.message = `Người đại diện cười nhạt, đẩy bản đề nghị trở lại. Họ vẫn đòi ${formatWage(contractOffer.wage)}, ${contractOffer.years} năm, lót tay ${formatMoney(contractOffer.signingBonus)}.`;
  }
  applyToneTension(negotiation, tensionBefore, effect);
  negotiation.tension = Math.round(Math.min(100, negotiation.tension));
  if (negotiation.tension >= 100)
    return failNegotiation(
      negotiation,
      `Người đại diện của ${player.name} đóng cặp, đứng dậy và rời bàn đàm phán mà không ngoảnh lại.`,
    );
  logNegotiation(negotiation, "them", negotiation.message);
}

// ---------- bước cuối ----------
export function finalPush(negotiation: Negotiation): void {
  const ratio = Math.random(),
    club = getClub(negotiation.seller!);
  if (ratio < 0.5) {
    negotiation.offer!.fee = roundToTen(negotiation.offer!.fee * 0.92);
    negotiation.pushed = true;
    negotiation.message = `Phòng họp im lặng vài giây. Rồi ${club.name} miễn cưỡng gật đầu: giảm 8%, phí còn ${formatMoney(negotiation.offer!.fee)}.`;
  } else if (ratio < 0.85) {
    negotiation.pushed = true;
    negotiation.message = `${club.name} không nhúc nhích: giá vẫn y nguyên. Bạn không mất gì, nhưng cũng chẳng được gì.`;
  } else
    return failNegotiation(
      negotiation,
      `Cú ép giá phút chót đã đi quá xa. ${club.name} đập tập hồ sơ xuống bàn và rút khỏi thương vụ.`,
    );
  logNegotiation(negotiation, "them", negotiation.message);
}
export function resolveTwist(negotiation: Negotiation, raise: boolean): void {
  const club = getClub(negotiation.twist!.club),
    clubOffer = negotiation.offer!;
  if (raise) {
    if (negotiation.type === "loan")
      clubOffer.percent = Math.min(100, (clubOffer.percent || 0) + 10);
    else clubOffer.fee = roundToTen(clubOffer.fee * 1.1);
    if (negotiation.type !== "loan" && !canAffordNow(clubOffer))
      return failNegotiation(
        negotiation,
        `Ngân sách của bạn không đủ để đáp trả. ${getPlayer(negotiation.playerId).name} quay sang ${club.name}.`,
      );
    negotiation.twist = null;
    negotiation.message = `Bạn nâng giá thêm 10%. ${getClub(negotiation.seller!).name} cân nhắc trong giây lát rồi chọn bạn thay vì ${club.name}.`;
  } else if (Math.random() < 0.5) {
    negotiation.twist = null;
    negotiation.message = `Bạn giữ nguyên đề nghị và nín thở chờ đợi... ${getPlayer(negotiation.playerId).name} vẫn chọn ${myClub().name}. Ván cược đã thắng!`;
  } else {
    const player = getPlayer(negotiation.playerId);
    movePlayer(player, club.id);
    club.budget -= clubOffer.fee;
    getClub(negotiation.seller!).budget += clubOffer.fee;
    player.contract = { ...player.contract!, expiryYear: gameState.year + 3 };
    news(`${player.name} gia nhập ${club.name} sau khi ${myClub().name} chậm chân.`, "transfer");
    return failNegotiation(
      negotiation,
      `Điện thoại không còn đổ chuông. ${player.name} đã chọn ${club.name}.`,
    );
  }
  logNegotiation(negotiation, "them", negotiation.message);
}

export function movePlayer(player: Player, toClubId: string | null): void {
  if (player.club != null) {
    const club = getClub(player.club);
    club.playerIds = club.playerIds.filter((id) => id !== player.id);
  } else gameState.free = gameState.free.filter((id) => id !== player.id);
  player.club = toClubId;
  if (toClubId != null) getClub(toClubId).playerIds.push(player.id);
  else gameState.free.push(player.id);
  player.joined = gameState.day;
  player.joinedAbs = absDay();
  player.recentStarts = [];
  player.listed = false;
  player.loanList = false;
  player.wantOut = false;
  player.demand = null;
  player.promise = null;
  player.interest = null;
  player.ovrAtSign = player.ovr;
  if (gameState.lineup.includes(player.id))
    gameState.lineup = gameState.lineup.map((id) => (id === player.id ? null : id));
  player.marketValue = valueOf(player);
}

export function completeBuy(negotiation: Negotiation): void {
  const player = getPlayer(negotiation.playerId),
    clubOffer: ClubOffer = negotiation.offer || { fee: 0, installments: 1, timing: "now" },
    contractOffer = negotiation.contractOffer;
  const seller = negotiation.seller != null ? getClub(negotiation.seller) : null;
  if (negotiation.type === "loan") {
    movePlayer(player, gameState.myClubId);
    player.loan = { fromClub: negotiation.seller!, percent: clubOffer.percent || 0 };
    player.contract!.role = expectedRoleAtMe(player);
    news(
      `${player.name} đến ${myClub().name} theo dạng cho mượn từ ${seller!.name} (bạn trả ${clubOffer.percent}% lương).`,
      "transfer",
    );
  } else if (contractOffer) {
    const nowFee =
        clubOffer.installments > 1
          ? roundToTen(clubOffer.fee / clubOffer.installments)
          : clubOffer.fee,
      agent = roundToTen(contractOffer.signingBonus * 0.5);
    myClub().budget -= nowFee + contractOffer.signingBonus + agent;
    if (seller) {
      seller.budget += clubOffer.fee;
      for (let installmentIndex = 1; installmentIndex < clubOffer.installments; installmentIndex++)
        gameState.liabilities.push({
          year: gameState.year + installmentIndex,
          amount: roundToTen(clubOffer.fee / clubOffer.installments),
          toClub: seller.name,
          playerId: player.id,
        });
    }
    if (clubOffer.swapPlayerId && getPlayer(clubOffer.swapPlayerId) && seller) {
      const swapPlayer = getPlayer(clubOffer.swapPlayerId);
      movePlayer(swapPlayer, seller.id);
      news(`${swapPlayer.name} chuyển sang ${seller.name} trong thương vụ trao đổi.`, "transfer");
    }
    const from = player.club;
    const nowOK =
      (negotiation.type === "free" || (!!windowNow() && clubOffer.timing !== "next")) &&
      negotiation.type !== "pre";
    if (nowOK) {
      movePlayer(player, gameState.myClubId);
      player.contract = {
        wage: contractOffer.wage,
        expiryYear: gameState.year + contractOffer.years,
        releaseClause: contractOffer.releaseClause || 0,
        role: contractOffer.role,
      };
      player.joinedFee = clubOffer.fee;
      if (clubOffer.sellOnPercent && from)
        player.sellOn = { club: from, percent: clubOffer.sellOnPercent };
      if (clubOffer.addon && from)
        player.addon = { club: from, amount: clubOffer.addon, apps: 20, paid: false };
      player.addonBase = player.careerTotals.apps;
      if (clubOffer.loanback && from) {
        player.away = { club: from, until: "end" };
        player.club = gameState.myClubId;
      }
    } else {
      player.reserved = true;
      gameState.pending.push({
        playerId: player.id,
        from,
        contract: {
          wage: contractOffer.wage,
          expiryYear: gameState.year + contractOffer.years,
          releaseClause: contractOffer.releaseClause || 0,
          role: contractOffer.role,
        },
        offer: clubOffer,
        type: negotiation.type,
      });
    }
    player.transferHistory.push({
      year: gameState.year,
      fromClub: from != null ? getClub(from).name : "Tự do",
      toClub: myClub().name,
      fee: clubOffer.fee,
    });
    news(
      `${myClub().name} ${nowOK ? "chiêu mộ" : "thỏa thuận chiêu mộ"} ${player.name} từ ${from != null ? getClub(from).name : "thị trường tự do"} với giá ${clubOffer.fee ? formatMoney(clubOffer.fee) : "0 đồng"}${nowOK ? "" : " (gia nhập kỳ chuyển nhượng tới)"}${clubOffer.loanback ? ", cho mượn lại đến hết mùa" : ""}.`,
      "transfer",
    );
  }
  negotiation.stage = "done";
  negotiation.message = "Mực đã khô trên bản hợp đồng. Thương vụ hoàn tất!";
  logNegotiation(negotiation, "them", negotiation.message);
  if (gameState.lineup.filter(Boolean).length < 11) myLineup();
}

export function renew(playerId: string): Res {
  const player = getPlayer(playerId);
  if (activeNegoFor(playerId)) return { error: "Đang có đàm phán với cầu thủ này." };
  return {
    negotiation: newNego({
      playerId,
      type: "renew",
      isBuyOffer: false,
      stage: "contract",
      contractAsk: contractAsk(player, "renew"),
      message: `Đàm phán gia hạn với ${player.name}. Hợp đồng hiện tại hết hạn 30/6/${player.contract!.expiryYear}.`,
    }),
  };
}
export function completeRenew(negotiation: Negotiation): void {
  const player = getPlayer(negotiation.playerId),
    contractOffer = negotiation.contractOffer!;
  myClub().budget -= contractOffer.signingBonus;
  player.contract = {
    wage: contractOffer.wage,
    expiryYear: gameState.year + contractOffer.years,
    releaseClause: contractOffer.releaseClause || 0,
    role: contractOffer.role,
  };
  player.ovrAtSign = player.ovr;
  player.morale = clamp(player.morale + 10, 0, 100);
  negotiation.stage = "done";
  negotiation.message = "Chữ ký đã được đặt xuống: hợp đồng mới có hiệu lực.";
  news(
    `${player.name} gia hạn hợp đồng với ${myClub().name} đến 30/6/${player.contract.expiryYear}.`,
    "deal",
  );
}

// ---------- bán: AI hỏi mua cầu thủ của bạn ----------
export function aiBidsTick(hours: number): void {
  if (!windowNow()) return;
  const mult = ((isDeadline() ? 4 : 1) * hours) / 24;
  clubPlayers(gameState.myClubId).forEach((player) => {
    if (player.loan || activeNegoFor(player.id) || player.injuryDays > 20) return;
    if (absDay() - (player.joinedAbs || -9999) < 45 && !player.listed) return;
    const chance =
      0.006 *
      mult *
      (player.listed ? 5 : 1) *
      (player.wantOut ? 2 : 1) *
      (player.ovr > 65 ? 1.6 : 1);
    if (Math.random() > chance) return;
    const buyers = Object.values(gameState.clubs).filter(
      (club) =>
        club.id !== gameState.myClubId &&
        club.budget >= player.marketValue * 0.8 &&
        Math.abs(club.strength - player.ovr) <= 8,
    );
    if (!buyers.length) return;
    const club = pickRandom(buyers);
    const fee = roundToTen(
      player.marketValue * (player.listed ? randomBetween(0.78, 1) : randomBetween(0.88, 1.15)),
    );
    const negotiation = newNego({
      playerId: player.id,
      type: "transfer",
      isSellOffer: true,
      buyer: club.id,
      stage: "offer",
      fee,
      installments: Math.random() < 0.25 ? 2 : 1,
      maxFee: roundToTen(fee * randomBetween(1.05, 1.35)),
      message: `${club.name} gửi đề nghị ${formatMoney(fee)} cho ${player.name}.`,
    });
    logNegotiation(negotiation, "them", negotiation.message);
    inbox({
      kind: "offer",
      title: `Lời đề nghị cho ${player.name}`,
      body: `${club.name} (${getLeague(club.leagueId).name}) đề nghị ${formatMoney(fee)}${(negotiation.installments || 1) > 1 ? " trả góp 2 mùa" : ""}. Giá trị ước tính: ${formatMoney(player.marketValue)}.`,
      negotiationId: negotiation.id,
      playerId: player.id,
    });
  });
  clubPlayers(gameState.myClubId)
    .filter((player) => player.loanList && !activeNegoFor(player.id))
    .forEach((player) => {
      if (Math.random() > 0.03 * mult * 3) return;
      const pool = Object.values(gameState.clubs).filter(
        (club) => club.id !== gameState.myClubId && club.strength <= player.ovr + 6,
      );
      if (!pool.length) return;
      const club = pickRandom(pool);
      const negotiation = newNego({
        playerId: player.id,
        type: "loanout",
        isSellOffer: true,
        buyer: club.id,
        stage: "offer",
        percent: randomInt(50, 100),
        message: `${club.name} muốn mượn ${player.name} đến hết mùa.`,
      });
      logNegotiation(negotiation, "them", negotiation.message);
      inbox({
        kind: "offer",
        title: `Đề nghị mượn ${player.name}`,
        body: `${club.name} muốn mượn ${player.name} đến hết mùa, trả ${negotiation.percent}% lương.`,
        negotiationId: negotiation.id,
        playerId: player.id,
      });
    });
}

export const MIN_SQUAD = 18;

export function respondSell(
  negotiation: Negotiation,
  action: "accept" | "reject" | "counter",
  counter = 0,
  reply?: Reply,
): Res {
  const player = getPlayer(negotiation.playerId),
    club = getClub(negotiation.buyer!);
  if (action === "reject") {
    negotiation.stage = "failed";
    negotiation.message = "Bạn đã từ chối.";
    logNegotiation(negotiation, "me", negotiation.message);
    return {};
  }
  if (negotiation.type === "loanout") {
    if (action === "accept") {
      movePlayer(player, negotiation.buyer!);
      player.away = null;
      player.loanOut = {
        toClub: negotiation.buyer!,
        fromClub: gameState.myClubId,
        percent: negotiation.percent || 0,
      };
      player.homeClub = gameState.myClubId;
      news(`${player.name} được cho ${club.name} mượn đến hết mùa.`, "transfer");
      negotiation.stage = "done";
      negotiation.message = "Đã cho mượn.";
    }
    return {};
  }
  if (action === "counter") {
    // CLB mua cần thời gian cân nhắc: câu trả lời đến sau respWait() (xem processSellCounter)
    negotiation.myCounter = counter;
    negotiation.tone = reply?.tone;
    negotiation.waiting = true;
    negotiation.readyAt = tick() + responseWait();
    logNegotiation(negotiation, "me", `Phản giá ${formatMoney(counter)}`);
    if (reply) logNegotiation(negotiation, "me", reply.text);
    return {};
  }
  return completeSale(negotiation);
}

/** CLB mua trả lời phản giá của bạn */
function processSellCounter(negotiation: Negotiation): void {
  negotiation.waiting = false;
  const club = getClub(negotiation.buyer!),
    max = negotiation.maxFee || 0,
    counter = negotiation.myCounter || 0;
  negotiation.myCounter = undefined;
  if (getPlayer(negotiation.playerId)?.club !== gameState.myClubId)
    return failNegotiation(
      negotiation,
      `${getPlayer(negotiation.playerId)?.name ?? "Cầu thủ"} không còn thuộc đội của bạn, ${club.name} rút lui.`,
    );
  const effect = toneEffect(negotiation.tone),
    tensionBefore = negotiation.tension;
  negotiation.tone = undefined;
  if (counter <= max * (1 + effect.bonus)) {
    if (effect.line) logNegotiation(negotiation, "them", effect.line);
    negotiation.fee = counter;
    const result = completeSale(negotiation);
    if (result.error) {
      negotiation.message = `${club.name} đồng ý mức ${formatMoney(counter)} nhưng bạn chưa thể bán lúc này: ${result.error}`;
      logNegotiation(negotiation, "them", negotiation.message);
    }
    return;
  }
  if (counter <= max * 1.15) {
    negotiation.tension += 25;
    negotiation.fee = max;
    negotiation.message = `${club.name} cân nhắc, rồi nâng lên ${formatMoney(max)}. "Đây là mức cuối cùng," họ nói.`;
  } else {
    negotiation.tension += 40;
    negotiation.message = `${club.name} nhíu mày nhìn con số bạn phản giá: quá cao với họ.`;
  }
  applyToneTension(negotiation, tensionBefore, effect);
  logNegotiation(negotiation, "them", negotiation.message);
  if (negotiation.tension >= 100)
    failNegotiation(negotiation, `${club.name} đóng hồ sơ và rút lui.`);
}

/** Chốt bán cho CLB mua với n.fee (kiểm tra đội tối thiểu, ý muốn của cầu thủ) */
function completeSale(negotiation: Negotiation): Res {
  const player = getPlayer(negotiation.playerId),
    club = getClub(negotiation.buyer!);
  if (
    clubPlayers(gameState.myClubId).filter((squadPlayer) => !squadPlayer.loan).length <= MIN_SQUAD
  )
    return { error: `Đội cần tối thiểu ${MIN_SQUAD} cầu thủ. Hãy mua thêm trước khi bán.` };
  const ok =
    club.prestige >= myClub().prestige - 1 ||
    player.morale < 45 ||
    player.wantOut ||
    Math.random() < 0.5;
  if (!ok) {
    failNegotiation(
      negotiation,
      `${player.name} từ chối chuyển đến ${club.name} vì không thấy đó là bước tiến.`,
    );
    return {};
  }
  const fee = negotiation.fee || 0,
    inst = negotiation.installments || 1;
  let received = fee;
  if (player.sellOn) {
    const sellOnCut = roundToTen((fee * player.sellOn.percent) / 100);
    received -= sellOnCut;
    news(
      `${getClub(player.sellOn.club).name} nhận ${formatMoney(sellOnCut)} nhờ điều khoản ${player.sellOn.percent}% bán lại.`,
      "transfer",
    );
    getClub(player.sellOn.club).budget += sellOnCut;
  }
  myClub().budget += inst > 1 ? roundToTen(received / inst) : received;
  for (let installmentIndex = 1; installmentIndex < inst; installmentIndex++)
    gameState.liabilities.push({
      year: gameState.year + installmentIndex,
      amount: -roundToTen(received / inst),
      toClub: club.name,
      playerId: player.id,
    });
  club.budget -= fee;
  player.transferHistory.push({
    year: gameState.year,
    fromClub: myClub().name,
    toClub: club.name,
    fee,
  });
  movePlayer(player, club.id);
  player.contract!.expiryYear = Math.max(player.contract!.expiryYear, gameState.year + 3);
  player.sellOn = null;
  player.addon = null;
  news(
    `${player.name} rời ${myClub().name} để gia nhập ${club.name} với giá ${formatMoney(fee)}.`,
    "transfer",
  );
  negotiation.stage = "done";
  negotiation.message = `Thỏa thuận hoàn tất: ${player.name} sẽ khoác áo ${club.name} với giá ${formatMoney(fee)}.`;
  logNegotiation(negotiation, "them", negotiation.message);
  return {};
}

// ---------- Giám đốc thể thao đàm phán thay ----------
export function delegate(playerId: string, maxFee: number): Res {
  const result = enquire(playerId, "transfer");
  if (result.error || !result.negotiation) return result;
  const negotiation = result.negotiation;
  negotiation.sportingDirector = { maxFee };
  negotiation.readyAt = tick() + (isDeadline() ? 2 : 48);
  negotiation.stage = "dof";
  negotiation.message = `Giám đốc thể thao nhận hồ sơ và bước vào phòng họp, với trần ngân sách ${formatMoney(maxFee)}.`;
  logNegotiation(negotiation, "me", negotiation.message);
  return result;
}
function processDof(negotiation: Negotiation): void {
  const player = getPlayer(negotiation.playerId);
  if (!player || player.club == null || player.club === gameState.myClubId)
    return failNegotiation(negotiation, "Thương vụ không còn khả thi.");
  const fee = roundToTen(player.marketValue * askFactor(player) * randomBetween(0.92, 1.08));
  if (fee > negotiation.sportingDirector!.maxFee || fee > myClub().budget)
    return failNegotiation(
      negotiation,
      `Giám đốc thể thao báo cáo: ${getClub(player.club).name} đòi khoảng ${formatMoney(fee)}, vượt trần bạn đặt.`,
    );
  if (willingness(player) < 25)
    return failNegotiation(
      negotiation,
      `Giám đốc thể thao báo cáo: ${player.name} không muốn chuyển đến.`,
    );
  const contractOffer = contractAsk(player, "transfer");
  negotiation.seller = player.club;
  negotiation.offer = { fee, installments: 1, timing: "now" };
  negotiation.contractOffer = {
    wage: Math.round(contractOffer.wage * 1.03),
    years: contractOffer.years,
    signingBonus: contractOffer.signingBonus,
    role: contractOffer.role,
    releaseClause: 0,
  };
  if (myWages() + negotiation.contractOffer.wage > gameState.wageCap)
    return failNegotiation(
      negotiation,
      "Giám đốc thể thao báo cáo: lương cầu thủ đòi vượt quỹ lương.",
    );
  completeBuy(negotiation);
  inbox({
    kind: "dof",
    title: `Giám đốc thể thao chốt ${player.name}`,
    body: `Phí ${formatMoney(fee)}, lương ${formatWage(negotiation.contractOffer.wage)}, ${contractOffer.years} năm.`,
    playerId: player.id,
  });
}

// ---------- AI mua bán với nhau ----------
/** Vị trí yếu nhất của CLB: tuyến có điểm trung bình các cầu thủ hàng đầu thấp nhất. */
function weakestLine(buyer: Club): { pos: Line; averageOvr: number } {
  return (["GK", "DF", "MF", "FW"] as Line[])
    .map((pos) => {
      const lineSize = pos === "GK" ? 1 : 3;
      return {
        pos,
        averageOvr:
          clubPlayers(buyer.id)
            .filter((player) => player.pos === pos)
            .sort((playerA, playerB) => playerB.ovr - playerA.ovr)
            .slice(0, lineSize)
            .reduce((total, player) => total + player.ovr, 0) / lineSize,
      };
    })
    .sort((lineA, lineB) => lineA.averageOvr - lineB.averageOvr)[0];
}

/** CLB AI ký cầu thủ tự do (không phí, quanh năm): cầu thủ chỉ đồng ý nếu CLB đủ tầm và họ giúp đội mạnh lên. */
function aiFreeAgentsTick(hours: number): void {
  if (!gameState.free.length) return;
  const tries = Math.max(1, Math.round((hours / 24) * 4));
  const others = Object.values(gameState.clubs).filter((club) => club.id !== gameState.myClubId);
  for (let attempt = 0; attempt < tries; attempt++) {
    const buyer = pickRandom(others);
    if (buyer.playerIds.length >= 27 || Math.random() > 0.3) continue;
    const need = weakestLine(buyer);
    const pool = gameState.free
      .map(getPlayer)
      .filter(
        (player) =>
          player &&
          player.pos === need.pos &&
          player.ovr >= need.averageOvr + 1 &&
          player.ovr <= buyer.strength + 7 &&
          !activeNegoFor(player.id) &&
          !gameState.pending.some((pendingTransfer) => pendingTransfer.playerId === player.id),
      );
    const player =
      buyer.philosophy === "young"
        ? pool.sort((playerA, playerB) => playerA.age - playerB.age)[0]
        : pickRandom(pool);
    if (!player) continue;
    const wage = Math.round(Math.max(player.contract?.wage ?? 0, wageBase(player)));
    if (buyer.budget < wage * 20) continue;
    buyer.budget -= wage * 10;
    movePlayer(player, buyer.id);
    player.contract = {
      wage,
      expiryYear: gameState.year + randomInt(1, 3),
      releaseClause: 0,
      role: "Xoay tua",
    };
    player.transferHistory.push({
      year: gameState.year,
      fromClub: "Tự do",
      toClub: buyer.name,
      fee: 0,
    });
    gameState.aiDone++;
    if (buyer.leagueId === myLeagueId() || player.ovr >= 75)
      news(`${player.name} đặt bút ký hợp đồng tự do với ${buyer.name}.`, "deal");
  }
}

export function aiTransfersTick(hours: number): void {
  aiFreeAgentsTick(hours);
  if (!windowNow()) return;
  const tries = Math.max(1, Math.round((((isDeadline() ? 3 : 1) * hours) / 24) * 5));
  const others = Object.values(gameState.clubs).filter((club) => club.id !== gameState.myClubId);
  for (let attempt = 0; attempt < tries; attempt++) {
    const buyer = pickRandom(others);
    if (Math.random() > 0.35) continue;
    const need = weakestLine(buyer);
    const pool = Object.values(gameState.players).filter(
      (player) =>
        player.club != null &&
        player.club !== gameState.myClubId &&
        player.club !== buyer.id &&
        player.pos === need.pos &&
        player.ovr >= need.averageOvr + 1 &&
        player.ovr <= buyer.strength + 7 &&
        getClub(player.club).prestige <= buyer.prestige + 1 &&
        !player.homeClub &&
        !player.reserved &&
        !activeNegoFor(player.id) &&
        absDay() - (player.joinedAbs || -9999) > 150 &&
        getClub(player.club).playerIds.length > 20 &&
        getClub(player.club).rival !== buyer.id,
    );
    if (buyer.philosophy === "young") pool.sort((playerA, playerB) => playerA.age - playerB.age);
    const player = pool.length ? (buyer.philosophy === "young" ? pool[0] : pickRandom(pool)) : null;
    if (!player) continue;
    const fee = roundToTen(player.marketValue * askFactor(player) * randomBetween(0.9, 1.05));
    if (fee > buyer.budget) {
      if (buyer.leagueId === myLeagueId() && player.ovr >= 72 && Math.random() < 0.25)
        news(
          `${buyer.name} theo đuổi ${player.name} (${getClub(player.club!).name}) nhưng ngân sách không đủ cho mức giá ${formatMoney(fee)}.`,
          "deal",
        );
      continue;
    }
    const from = getClub(player.club!);
    buyer.budget -= fee;
    from.budget += fee;
    movePlayer(player, buyer.id);
    player.contract!.expiryYear = gameState.year + randomInt(2, 4);
    player.contract!.wage = Math.round(player.contract!.wage * 1.1);
    player.transferHistory.push({
      year: gameState.year,
      fromClub: from.name,
      toClub: buyer.name,
      fee,
    });
    gameState.aiDone++;
    if (buyer.leagueId === myLeagueId() || from.leagueId === myLeagueId() || fee > 30000)
      news(
        `Sau vài vòng đàm phán, ${from.name} đồng ý bán ${player.name} cho ${buyer.name} với giá ${formatMoney(fee)}.`,
        "deal",
      );
  }
}

// ---------- xử lý phản hồi theo thời gian ----------
/** Có phản hồi mới: báo vào hộp thư (đổ vỡ đã có thông báo riêng từ failN) */
function notifyReply(negotiation: Negotiation): void {
  const player = getPlayer(negotiation.playerId);
  if (!player) return;
  if (negotiation.stage === "failed" && (negotiation.isBuyOffer || negotiation.isSellOffer)) return;
  const author = negotiation.isSellOffer
    ? getClub(negotiation.buyer!).name
    : negotiation.type === "renew" ||
        negotiation.stage === "contract" ||
        negotiation.stage === "final"
      ? `Người đại diện của ${player.name}`
      : getClub(negotiation.seller ?? player.club ?? gameState.myClubId).name;
  inbox({
    kind: "reply",
    title: `Phản hồi từ ${author}`,
    body: negotiation.message,
    negotiationId: negotiation.id,
    playerId: negotiation.playerId,
  });
}

export function processNegos(): void {
  const now = tick();
  gameState.negos.forEach((negotiation) => {
    if (
      negotiation.stage === "done" ||
      negotiation.stage === "failed" ||
      (!negotiation.readyAt && !negotiation.waiting)
    )
      return;
    if (negotiation.readyAt && now >= negotiation.readyAt) {
      const stage = negotiation.stage;
      negotiation.readyAt = null;
      if (
        negotiation.isBuyOffer &&
        negotiation.seller != null &&
        stage !== "enquiry" &&
        stage !== "dof" &&
        getPlayer(negotiation.playerId) &&
        getPlayer(negotiation.playerId).club !== negotiation.seller
      ) {
        failNegotiation(
          negotiation,
          `Chậm một bước: ${getPlayer(negotiation.playerId).name} đã đặt bút ký cho CLB khác trước khi thương vụ hoàn tất.`,
        );
        return;
      }
      if (stage === "enquiry") processEnquiry(negotiation);
      else if (stage === "dof") processDof(negotiation);
      else if (stage === "club" && negotiation.waiting) processClubOffer(negotiation);
      else if (stage === "contract" && negotiation.waiting) processContract(negotiation);
      else if (negotiation.isSellOffer && stage === "offer" && negotiation.waiting)
        processSellCounter(negotiation);
      notifyReply(negotiation);
    }
  });
  gameState.negos.forEach((negotiation) => {
    if (
      negotiation.isSellOffer &&
      negotiation.stage === "offer" &&
      !negotiation.waiting &&
      now - negotiation.created > 72
    ) {
      negotiation.stage = "failed";
      negotiation.message = "Thời gian đã hết. Đề nghị trôi vào quên lãng.";
    }
  });
  gameState.negos = gameState.negos
    .filter(
      (negotiation) =>
        !(
          (negotiation.stage === "done" || negotiation.stage === "failed") &&
          now -
            (negotiation.log.length
              ? negotiation.log[negotiation.log.length - 1].tickAt
              : negotiation.created) >
            24 * 20
        ),
    )
    .slice(0, 40);
}
