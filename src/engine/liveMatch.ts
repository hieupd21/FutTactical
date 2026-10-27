// Trận đấu trực tiếp: mô phỏng theo từng tick (phút + bù giờ); bạn có thể tạm dừng để đổi chiến thuật / thay người bất cứ lúc nào.
// Mọi thứ nằm trong LiveSim; chỉ buildSim mới đụng tới cầu thủ thật (chấn thương).
import { FORMS } from "./constants";
import { dynamicRating } from "./players";
import {
  available,
  bestLineup,
  clubPlayers,
  slotRating,
  myLineup,
  mySlotPositions,
  slotPositions,
  strength,
} from "./squad";
import { getClub, getPlayer, gameState } from "./state";
import type {
  Formation,
  Line,
  LiveSide,
  LiveSim,
  MatchEvent,
  MatchSim,
  Mentality,
  Press,
  Tactic,
} from "./types";
import { clamp, pickRandom, randomInt, randomBetween } from "./util";

export const expectedGoalsRate = (attack: number, defence: number): number =>
  clamp(1.25 * Math.exp((attack - defence) / 9), 0.15, 4.5);

export const MAX_SUBS = 5;
const BENCH_SIZE = 9;
const DEFAULT_TACTIC: Tactic = { ment: "bal", press: "mid" };
const myTactic = (): Tactic => gameState.tactic ?? DEFAULT_TACTIC;

export const MENTALITY_LABEL: Record<Mentality, string> = {
  att: "Tấn công",
  bal: "Cân bằng",
  def: "Phòng ngự",
};
export const PRESS_LABEL: Record<Press, string> = {
  low: "Lùi thấp",
  mid: "Vừa phải",
  high: "Pressing cao",
};

// ---------- hệ số chiến thuật (cân bằng giữa lợi và hại) ----------
const MENTALITY_OWN_FACTOR: Record<Mentality, number> = { att: 1.15, bal: 1, def: 0.85 };
const MENTALITY_OPPONENT_FACTOR: Record<Mentality, number> = { att: 1.12, bal: 1, def: 0.86 }; // đối thủ chọn lối này thì cơ hội của mình thay đổi
const MENTALITY_POSSESSION: Record<Mentality, number> = { att: 1, bal: 0, def: -1 };
const PRESS_POSSESSION: Record<Press, number> = { low: -1, mid: 0, high: 1 };
const PRESS_FATIGUE: Record<Press, number> = { low: 0.8, mid: 1, high: 1.35 };
const LINE_FATIGUE: Record<Line, number> = { GK: 0.2, DF: 0.85, MF: 1.15, FW: 1 };
const SHOOTER_WEIGHT: Record<Line, number> = { GK: 0, DF: 1, MF: 3, FW: 6 };
const CARD_WEIGHT: Record<Line, number> = { GK: 0.15, DF: 1.3, MF: 1.2, FW: 0.8 };

const CHANCE_XG = 0.11; // xG trung bình mỗi cơ hội thường
const CHANCE_SHARE = 0.93; // phần xG dành cho cơ hội thường (còn lại là penalty)
const PENALTY_CHANCE = 0.0033; // xác suất có penalty mỗi trận / mỗi tick tổng
const PENALTY_XG = 0.78;
const YELLOW_RATE = 2.0; // số thẻ vàng trung bình mỗi trận
const RED_RATE = 0.05;
const INJURY_CHANCE = 0.011; // xác suất chấn thương mỗi cầu thủ ra sân (như bản cũ)
const INJURY_CHANCE_TIRED = 0.025;
const VAR_CHANCE = 0.04;
const FATIGUE_PER_TICK = 0.33; // thể lực mất mỗi tick (MF, pressing vừa)
const AUTO_MINUTES = [58, 66, 74, 82];

function aiTactic(ownPower: number, opponent: number): Tactic {
  const powerGap = ownPower - opponent;
  return {
    ment: powerGap >= 4 ? "att" : powerGap <= -4 ? "def" : "bal",
    press: powerGap >= 4 ? "high" : powerGap <= -4 ? "low" : "mid",
  };
}

export function pickBench(clubId: string, lineup: (string | null)[]): string[] {
  const used = new Set(lineup);
  const pool = clubPlayers(clubId)
    .filter((player) => available(player) && !used.has(player.id))
    .sort((playerA, playerB) => dynamicRating(playerB) - dynamicRating(playerA));
  const player = pool.find((squadPlayer) => squadPlayer.pos === "GK");
  const rest = pool
    .filter((squadPlayer) => squadPlayer !== player)
    .slice(0, player ? BENCH_SIZE - 1 : BENCH_SIZE);
  return [...(player ? [player] : []), ...rest].map((squadPlayer) => squadPlayer.id);
}

function makeSide(
  clubId: string,
  lineup: (string | null)[],
  formation: Formation,
  tactic: Tactic,
  isAuto: boolean,
): LiveSide {
  const slotNames = clubId === gameState.myClubId ? mySlotPositions() : undefined;
  const bench = pickBench(clubId, lineup);
  const startFitness: Record<string, number> = {};
  const minutesSpan: Record<string, [number, number | null]> = {};
  [...lineup, ...bench].forEach((playerId) => {
    if (playerId) startFitness[playerId] = getPlayer(playerId).fitness;
  });
  lineup.forEach((playerId) => {
    if (playerId) minutesSpan[playerId] = [0, null];
  });
  return {
    club: clubId,
    form: formation,
    startingLineup: lineup.slice(),
    lineup: lineup.slice(),
    slotNames,
    bench,
    subsLeft: MAX_SUBS,
    tactic,
    startFitness,
    fatigue: {},
    removed: [],
    yellowCarded: [],
    minutesSpan,
    isAuto,
  };
}

/** Khởi tạo trận. isAutoBoth = true: máy điều hành cả hai bên; ngược lại chỉ đội của bạn do bạn điều khiển */
export function newLive(homeId: string, awayId: string, isAutoBoth: boolean): LiveSim {
  const homeForm = homeId === gameState.myClubId ? gameState.form : getClub(homeId).form,
    awayForm = awayId === gameState.myClubId ? gameState.form : getClub(awayId).form;
  const homeLineup = homeId === gameState.myClubId ? myLineup() : bestLineup(homeId, homeForm),
    awayLineup = awayId === gameState.myClubId ? myLineup() : bestLineup(awayId, awayForm);
  const slotNamesOf = (clubId: string) =>
    clubId === gameState.myClubId ? mySlotPositions() : undefined;
  const homePower = strength(homeId, homeLineup, homeForm, slotNamesOf(homeId)).power,
    awayPower = strength(awayId, awayLineup, awayForm, slotNamesOf(awayId)).power;
  const firstHalfStoppage = randomInt(1, 3),
    secondHalfStoppage = randomInt(2, 6);
  const ticks: [number, number][] = [];
  for (let minute = 1; minute <= 45; minute++) ticks.push([minute, 0]);
  for (let extra = 1; extra <= firstHalfStoppage; extra++) ticks.push([45, extra]);
  for (let minute = 46; minute <= 90; minute++) ticks.push([minute, 0]);
  for (let extra = 1; extra <= secondHalfStoppage; extra++) ticks.push([90, extra]);
  const tickAfter = (isTarget: (tick: [number, number]) => boolean): number =>
    ticks.map(isTarget).lastIndexOf(true) + 1;
  const pauses = [tickAfter(([minute]) => minute === 45)]; // chỉ tự dừng ở nghỉ giữa hiệp; các lúc khác bạn tự bấm tạm dừng
  const isMyTeamHome = homeId === gameState.myClubId;
  return {
    sides: [
      makeSide(
        homeId,
        homeLineup,
        homeForm,
        isMyTeamHome ? myTactic() : aiTactic(homePower, awayPower),
        isAutoBoth || !isMyTeamHome,
      ),
      makeSide(
        awayId,
        awayLineup,
        awayForm,
        !isMyTeamHome && awayId === gameState.myClubId
          ? myTactic()
          : aiTactic(awayPower, homePower),
        isAutoBoth || isMyTeamHome,
      ),
    ],
    ticks,
    pauses,
    tickIndex: 0,
    events: [],
    homeGoals: 0,
    awayGoals: 0,
    shots: [0, 0],
    shotsOnTarget: [0, 0],
    expectedGoals: [0, 0],
    possessionHistory: [],
    injuryAlert: null,
    mySide: isMyTeamHome ? 0 : 1,
  };
}

// ---------- chỉ số trên sân ----------
const tired = (side: LiveSide, id: string): number => {
  const fatigueLoss = side.fatigue[id] ?? 0;
  return fatigueLoss > 15 ? (fatigueLoss - 15) / 4 : 0;
};
/** `slotName` là vị trí chi tiết của ô; bỏ trống thì lấy theo ô đang đứng (nếu cầu thủ đang trên sân) */
export const effectiveRating = (
  side: LiveSide,
  id: string,
  pos: Line,
  slotName?: string,
): number => {
  const player = getPlayer(id);
  const lineupIndex = side.lineup.indexOf(id);
  const resolvedSlotName =
    slotName ?? (lineupIndex >= 0 ? side.slotNames?.[lineupIndex] : undefined);
  return slotRating(player, pos, resolvedSlotName) - tired(side, id);
};
const onPitch = (side: LiveSide): { id: string; i: number; pos: Line }[] => {
  const lines = slotPositions(side.form);
  return side.lineup.flatMap((id, i) =>
    id && !side.removed.includes(id) ? [{ id, i, pos: lines[i] }] : [],
  );
};

function rateSide(side: LiveSide): { att: number; def: number; mid: number; playerCount: number } {
  const effByLine: Record<Line, number[]> = { GK: [], DF: [], MF: [], FW: [] };
  const onPitchPlayers = onPitch(side);
  onPitchPlayers.forEach(({ id, pos }) => effByLine[pos].push(effectiveRating(side, id, pos)));
  const average = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 35;
  const [defenders, , awayFormation] = FORMS[side.form];
  return {
    att:
      average(effByLine.FW) * 0.45 +
      average(effByLine.MF) * 0.38 +
      average(effByLine.DF) * 0.17 +
      (awayFormation - 2) * 1.4,
    def:
      average(effByLine.DF) * 0.42 +
      average(effByLine.GK) * 0.3 +
      average(effByLine.MF) * 0.28 +
      (defenders - 4) * 1.4,
    mid: average(effByLine.MF),
    playerCount: onPitchPlayers.length,
  };
}
const averageFatigue = (side: LiveSide): number => {
  const onPitchPlayers = onPitch(side).filter((pitchPlayer) => pitchPlayer.pos !== "GK");
  return onPitchPlayers.length
    ? onPitchPlayers.reduce(
        (total, pitchPlayer) => total + (side.fatigue[pitchPlayer.id] ?? 0),
        0,
      ) / onPitchPlayers.length
    : 0;
};

// ---------- sự kiện ----------
function pushEvent(
  liveSim: LiveSim,
  eventDraft: Omit<MatchEvent, "minute" | "stoppageMinute">,
): void {
  const [minute, stoppageMinute] =
    liveSim.ticks[Math.min(liveSim.tickIndex, liveSim.ticks.length - 1)];
  liveSim.events.push({ ...eventDraft, minute, ...(stoppageMinute ? { stoppageMinute } : {}) });
}
function pickWeighted<Item>(weightedItems: readonly (readonly [Item, number])[]): Item | null {
  const totalWeight = weightedItems.reduce((total, weightedItem) => total + weightedItem[1], 0);
  if (totalWeight <= 0) return null;
  let remaining = Math.random() * totalWeight;
  for (const [item, weight] of weightedItems) {
    remaining -= weight;
    if (remaining <= 0) return item;
  }
  return weightedItems[weightedItems.length - 1][0];
}
function pickShooter(side: LiveSide): string | null {
  return pickWeighted(
    onPitch(side).map(
      (pitchPlayer) =>
        [
          pitchPlayer.id,
          SHOOTER_WEIGHT[pitchPlayer.pos] *
            Math.pow(Math.max(effectiveRating(side, pitchPlayer.id, pitchPlayer.pos), 30) / 70, 2),
        ] as const,
    ),
  );
}
function keeperFactor(side: LiveSide): { goalkeeper: string | null; factor: number } {
  const goalkeeperEntry = onPitch(side).find((pitchPlayer) => pitchPlayer.pos === "GK");
  return goalkeeperEntry
    ? {
        goalkeeper: goalkeeperEntry.id,
        factor: clamp(1 - (effectiveRating(side, goalkeeperEntry.id, "GK") - 70) / 120, 0.8, 1.2),
      }
    : { goalkeeper: null, factor: 1.4 };
}

function shoot(
  liveSim: LiveSim,
  sideIndex: 0 | 1,
  chanceQuality: number,
  isPenalty: boolean,
): void {
  const side = liveSim.sides[sideIndex],
    opponentSide = liveSim.sides[1 - sideIndex];
  const id = isPenalty ? bestTaker(side) : pickShooter(side);
  if (!id) return;
  const line = slotPositions(side.form)[side.lineup.indexOf(id)];
  const shooter = clamp(1 + (effectiveRating(side, id, line) - 70) / 70, 0.6, 1.5);
  const { goalkeeper, factor } = keeperFactor(opponentSide);
  const goalProbability = clamp(chanceQuality * shooter * factor, 0.01, 0.92);
  liveSim.shots[sideIndex]++;
  liveSim.expectedGoals[sideIndex] += chanceQuality;
  const xg = Math.round(chanceQuality * 100) / 100;
  if (Math.random() < goalProbability) {
    liveSim.shotsOnTarget[sideIndex]++;
    if (!isPenalty && Math.random() < VAR_CHANCE) {
      pushEvent(liveSim, { side: sideIndex, varDisallowed: id });
      return;
    }
    const assist = !isPenalty && Math.random() < 0.65 ? assister(side, id) : undefined;
    if (sideIndex) liveSim.awayGoals++;
    else liveSim.homeGoals++;
    pushEvent(liveSim, {
      side: sideIndex,
      goal: id,
      ...(assist ? { assist } : {}),
      ...(isPenalty ? { isPenalty: true } : {}),
      expectedGoals: xg,
    });
    return;
  }
  const roll = Math.random();
  const missKind = roll < 0.25 ? "save" : roll < 0.53 ? "block" : roll < 0.56 ? "post" : "off";
  if (missKind === "save") liveSim.shotsOnTarget[sideIndex]++;
  pushEvent(liveSim, {
    side: sideIndex,
    miss: id,
    missKind,
    ...(missKind === "save" && goalkeeper ? { goalkeeper } : {}),
    ...(isPenalty ? { isPenalty: true } : {}),
    expectedGoals: xg,
  });
}
function bestTaker(side: LiveSide): string | null {
  const onPitchPlayers = onPitch(side).filter((pitchPlayer) => pitchPlayer.pos !== "GK");
  onPitchPlayers.sort(
    (pitchPlayerA, pitchPlayerB) =>
      effectiveRating(side, pitchPlayerB.id, pitchPlayerB.pos) -
      effectiveRating(side, pitchPlayerA.id, pitchPlayerA.pos),
  );
  return onPitchPlayers.length ? onPitchPlayers[0].id : null;
}
function assister(side: LiveSide, excludedId: string): string | undefined {
  return (
    pickWeighted(
      onPitch(side)
        .filter((pitchPlayer) => pitchPlayer.id !== excludedId && pitchPlayer.pos !== "GK")
        .map((pitchPlayer) => [pitchPlayer.id, pitchPlayer.pos === "DF" ? 1 : 3] as const),
    ) ?? undefined
  );
}

// ---------- một tick ----------
function tickOnce(liveSim: LiveSim): void {
  const [minute, stoppageMinute] = liveSim.ticks[liveSim.tickIndex];
  const totalTicks = liveSim.ticks.length;
  const ratings = [rateSide(liveSim.sides[0]), rateSide(liveSim.sides[1])] as const;
  const baseChances = [
    expectedGoalsRate(ratings[0].att + 1.5, ratings[1].def),
    expectedGoalsRate(ratings[1].att, ratings[0].def + 1.5),
  ];
  const goalDiffNow = liveSim.homeGoals - liveSim.awayGoals;
  const freshness = [
    clamp(1 - averageFatigue(liveSim.sides[0]) / 40, 0, 1),
    clamp(1 - averageFatigue(liveSim.sides[1]) / 40, 0, 1),
  ];
  const chanceRates = ([0, 1] as const).map((sideIndex) => {
    const mine = liveSim.sides[sideIndex].tactic,
      tactic = liveSim.sides[1 - sideIndex].tactic;
    let chanceRate =
      baseChances[sideIndex] *
      MENTALITY_OWN_FACTOR[mine.ment] *
      MENTALITY_OPPONENT_FACTOR[tactic.ment];
    chanceRate *=
      mine.press === "high" ? 1 + 0.06 * freshness[sideIndex] : mine.press === "low" ? 0.96 : 1;
    chanceRate *=
      tactic.press === "high"
        ? 1 - 0.03 * freshness[1 - sideIndex]
        : tactic.press === "low"
          ? 0.98
          : 1;
    chanceRate *=
      1 +
      clamp(
        (FORMS[liveSim.sides[sideIndex].form][1] - FORMS[liveSim.sides[1 - sideIndex].form][1]) *
          0.03,
        -0.06,
        0.06,
      );
    chanceRate *=
      Math.pow(ratings[sideIndex].playerCount / 11, 1.3) *
      Math.pow(11 / Math.max(ratings[1 - sideIndex].playerCount, 1), 0.6);
    if (minute >= 55) {
      const goalDiffForSide = sideIndex ? -goalDiffNow : goalDiffNow;
      if (goalDiffForSide < 0) chanceRate *= 1 + 0.05 * Math.min(-goalDiffForSide, 2);
      else if (goalDiffForSide > 0) chanceRate *= 1 - 0.035 * Math.min(goalDiffForSide, 2);
    }
    return chanceRate;
  });

  // thể lực
  ([0, 1] as const).forEach((sideIndex) => {
    const side = liveSim.sides[sideIndex];
    onPitch(side).forEach(({ id, pos }) => {
      const slow = 1 + (100 - (side.startFitness[id] ?? 100)) / 150;
      side.fatigue[id] =
        (side.fatigue[id] ?? 0) +
        FATIGUE_PER_TICK * LINE_FATIGUE[pos] * PRESS_FATIGUE[side.tactic.press] * slow;
    });
  });

  // kiểm soát bóng
  const possessionBias =
    (ratings[0].mid - ratings[1].mid) / 12 +
    (MENTALITY_POSSESSION[liveSim.sides[0].tactic.ment] -
      MENTALITY_POSSESSION[liveSim.sides[1].tactic.ment]) *
      0.12 +
    (PRESS_POSSESSION[liveSim.sides[0].tactic.press] -
      PRESS_POSSESSION[liveSim.sides[1].tactic.press]) *
      0.05 +
    0.08;
  const homePower = 1 / (1 + Math.exp(-possessionBias));
  const prev = liveSim.possessionHistory.length
    ? liveSim.possessionHistory[liveSim.possessionHistory.length - 1] *
      liveSim.possessionHistory.length
    : 0;
  liveSim.possessionHistory.push((prev + homePower) / (liveSim.possessionHistory.length + 1));

  // cơ hội thường
  ([0, 1] as const).forEach((sideIndex) => {
    if (
      Math.random() <
      Math.min(0.5, (chanceRates[sideIndex] * CHANCE_SHARE) / (CHANCE_XG * totalTicks))
    )
      shoot(liveSim, sideIndex, 0.02 + 0.36 * Math.random() ** 3, false);
  });
  // penalty
  if (Math.random() < PENALTY_CHANCE * (90 / totalTicks)) {
    const sideIndex = pickWeighted([
      [0, chanceRates[0]],
      [1, chanceRates[1]],
    ] as const);
    if (sideIndex !== null) shoot(liveSim, sideIndex, PENALTY_XG, true);
  }
  // thẻ phạt
  if (Math.random() < YELLOW_RATE / totalTicks) {
    const sideIndex = pickWeighted([
      [0, 1 + 0.15 * PRESS_POSSESSION[liveSim.sides[0].tactic.press]],
      [1, 1 + 0.15 * PRESS_POSSESSION[liveSim.sides[1].tactic.press]],
    ] as const);
    if (sideIndex !== null) {
      const side = liveSim.sides[sideIndex];
      const id = pickWeighted(
        onPitch(side).map((pitchPlayer) => [pitchPlayer.id, CARD_WEIGHT[pitchPlayer.pos]] as const),
      );
      if (id) {
        if (side.yellowCarded.includes(id)) sendOff(liveSim, sideIndex, id, true);
        else {
          side.yellowCarded.push(id);
          pushEvent(liveSim, { side: sideIndex, card: id });
        }
      }
    }
  }
  if (Math.random() < RED_RATE / totalTicks) {
    const sideIndex = Math.random() < 0.5 ? 0 : 1;
    const id = pickWeighted(
      onPitch(liveSim.sides[sideIndex]).map(
        (pitchPlayer) => [pitchPlayer.id, CARD_WEIGHT[pitchPlayer.pos]] as const,
      ),
    );
    if (id) sendOff(liveSim, sideIndex, id, false);
  }
  // chấn thương
  ([0, 1] as const).forEach((sideIndex) => {
    const side = liveSim.sides[sideIndex];
    onPitch(side).forEach(({ id }) => {
      if (
        Math.random() <
        ((side.startFitness[id] ?? 100) < 60 ? INJURY_CHANCE_TIRED : INJURY_CHANCE) / totalTicks
      )
        injure(liveSim, sideIndex, id);
    });
  });

  // HLV máy
  if (stoppageMinute === 0 && AUTO_MINUTES.includes(minute))
    ([0, 1] as const).forEach(
      (sideIndex) => liveSim.sides[sideIndex].isAuto && autoManage(liveSim, sideIndex, minute),
    );
}

function leave(side: LiveSide, id: string, minute: number): void {
  side.removed.push(id);
  if (side.minutesSpan[id]) side.minutesSpan[id][1] = minute;
}
function sendOff(liveSim: LiveSim, sideIndex: 0 | 1, id: string, isSecondYellow: boolean): void {
  pushEvent(liveSim, {
    side: sideIndex,
    card: id,
    isRedCard: true,
    ...(isSecondYellow ? { isSecondYellow: true } : {}),
  });
  leave(liveSim.sides[sideIndex], id, liveSim.ticks[liveSim.tickIndex][0]);
}
function injure(liveSim: LiveSim, sideIndex: 0 | 1, id: string): void {
  const side = liveSim.sides[sideIndex];
  pushEvent(liveSim, { side: sideIndex, injured: id, days: randomInt(4, 45) });
  leave(side, id, liveSim.ticks[liveSim.tickIndex][0]);
  if (side.subsLeft <= 0 || !side.bench.length) return;
  if (side.isAuto) autoFill(liveSim, sideIndex, id);
  else if (sideIndex === liveSim.mySide) liveSim.injuryAlert = { side: sideIndex, playerId: id };
}

// ---------- thay người / chiến thuật ----------
const currentMinute = (liveSim: LiveSim): number =>
  liveSim.ticks[Math.max(0, Math.min(liveSim.tickIndex, liveSim.ticks.length) - 1)][0];

/** Thay người. Trả về thông báo lỗi nếu không hợp lệ */
export function substitute(
  liveSim: LiveSim,
  sideIndex: 0 | 1,
  outId: string,
  inId: string,
): string | null {
  const side = liveSim.sides[sideIndex];
  const i = side.lineup.indexOf(outId);
  if (side.subsLeft <= 0) return `Đã dùng hết ${MAX_SUBS} lượt thay người.`;
  if (i < 0) return "Cầu thủ này không còn trên sân.";
  if (!side.bench.includes(inId)) return "Cầu thủ này không có trong danh sách dự bị.";
  const minute = currentMinute(liveSim);
  const slotNote = side.removed.includes(outId) ? null : outId;
  side.lineup[i] = inId;
  side.bench = side.bench.filter((playerIdB) => playerIdB !== inId);
  side.subsLeft--;
  side.fatigue[inId] = 0;
  side.minutesSpan[inId] = [minute, null];
  if (slotNote && side.minutesSpan[outId]) side.minutesSpan[outId][1] = minute;
  if (liveSim.injuryAlert && liveSim.injuryAlert.playerId === outId) liveSim.injuryAlert = null;
  pushEvent(liveSim, { side: sideIndex, subbedIn: inId, subbedOut: outId });
  return null;
}
function autoFill(liveSim: LiveSim, sideIndex: 0 | 1, outId: string): void {
  const side = liveSim.sides[sideIndex];
  const i = side.lineup.indexOf(outId);
  if (i < 0) return;
  const pos = slotPositions(side.form)[i];
  const best = side.bench
    .slice()
    .sort(
      (playerIdA, playerIdB) =>
        effectiveRating(side, playerIdB, pos, side.slotNames?.[i]) -
        effectiveRating(side, playerIdA, pos, side.slotNames?.[i]),
    )[0];
  if (best) substitute(liveSim, sideIndex, outId, best);
}
export function setTactic(liveSim: LiveSim, sideIndex: 0 | 1, tactic: Tactic): void {
  const side = liveSim.sides[sideIndex];
  if (side.tactic.ment === tactic.ment && side.tactic.press === tactic.press) return;
  const parts: string[] = [];
  if (side.tactic.ment !== tactic.ment) parts.push(MENTALITY_LABEL[tactic.ment].toLowerCase());
  if (side.tactic.press !== tactic.press) parts.push(PRESS_LABEL[tactic.press].toLowerCase());
  side.tactic = { ...tactic };
  if (liveSim.tickIndex > 0)
    pushEvent(liveSim, { side: sideIndex, tacticChange: parts.join(", ") });
}

function autoManage(liveSim: LiveSim, sideIndex: 0 | 1, minute: number): void {
  const side = liveSim.sides[sideIndex];
  const diff = sideIndex
    ? liveSim.awayGoals - liveSim.homeGoals
    : liveSim.homeGoals - liveSim.awayGoals;
  if (diff < 0)
    setTactic(liveSim, sideIndex, {
      ment: "att",
      press: side.tactic.press === "low" ? "mid" : side.tactic.press,
    });
  else if (diff > 0 && minute >= 70) setTactic(liveSim, sideIndex, { ment: "def", press: "low" });
  const quota = minute < 62 ? 1 : minute < 70 ? 2 : minute < 78 ? 3 : minute < 86 ? 4 : MAX_SUBS;
  while (side.subsLeft > 0 && MAX_SUBS - side.subsLeft < quota && side.bench.length) {
    const cand = onPitch(side)
      .filter((pitchPlayer) => pitchPlayer.pos !== "GK")
      .map((pitchPlayer) => ({ ...pitchPlayer, loss: side.fatigue[pitchPlayer.id] ?? 0 }))
      .sort((pitchPlayerA, pitchPlayerB) => pitchPlayerB.loss - pitchPlayerA.loss)[0];
    if (!cand || (cand.loss < 18 && minute < 75)) break;
    const incoming = side.bench
      .filter((playerIdB) => getPlayer(playerIdB).pos !== "GK")
      .sort(
        (playerIdA, playerIdB) =>
          effectiveRating(side, playerIdB, cand.pos) - effectiveRating(side, playerIdA, cand.pos),
      )[0];
    if (
      !incoming ||
      effectiveRating(side, incoming, cand.pos) < effectiveRating(side, cand.id, cand.pos) - 2
    )
      break;
    substitute(liveSim, sideIndex, cand.id, incoming);
  }
}

// ---------- điều khiển luồng ----------
/** Tick kế tiếp có điểm dừng (hoặc hết trận) */
export const nextPause = (liveSim: LiveSim): number =>
  liveSim.pauses.find((i) => i > liveSim.tickIndex) ?? liveSim.ticks.length;
export const isOver = (liveSim: LiveSim): boolean => liveSim.tickIndex >= liveSim.ticks.length;

/** Mô phỏng đến tick `upto` (hoặc dừng sớm nếu cầu thủ của bạn chấn thương và cần thay). Trả về tick đã tới */
export function stepLive(liveSim: LiveSim, upto: number): number {
  while (liveSim.tickIndex < Math.min(upto, liveSim.ticks.length) && !liveSim.injuryAlert) {
    tickOnce(liveSim);
    liveSim.tickIndex++;
  }
  return liveSim.tickIndex;
}
/** Máy điều hành nốt phần còn lại */
export function autoRest(liveSim: LiveSim): void {
  liveSim.sides[liveSim.mySide].isAuto = true;
  liveSim.injuryAlert = null;
  stepLive(liveSim, liveSim.ticks.length);
}

export const clockLabel = (liveSim: LiveSim, tick: number): string => {
  if (tick <= 0) return "0'";
  const [minute, stoppageMinute] = liveSim.ticks[Math.min(tick, liveSim.ticks.length) - 1];
  return stoppageMinute ? `${minute}+${stoppageMinute}'` : `${minute}'`;
};
export const eventTick = (liveSim: LiveSim, event: MatchEvent): number =>
  liveSim.ticks.findIndex(
    ([minute, stoppageMinute]) =>
      minute === event.minute && stoppageMinute === (event.stoppageMinute ?? 0),
  ) + 1;

// ---------- kết thúc ----------
/** Chốt trận: tính phút thi đấu, điểm số từng cầu thủ, chấn thương */
export function buildSim(liveSim: LiveSim): MatchSim {
  const fullTime = 90;
  const mins: Record<string, number> = {};
  const used: [string[], string[]] = [[], []];
  ([0, 1] as const).forEach((sideIndex) => {
    const side = liveSim.sides[sideIndex];
    Object.entries(side.minutesSpan).forEach(([id, [startMinute, endMinute]]) => {
      mins[id] = Math.max(1, (endMinute ?? fullTime) - startMinute);
      used[sideIndex].push(id);
    });
  });
  const goalsBy = (id: string) => liveSim.events.filter((event) => event.goal === id).length;
  const ratings: Record<string, number> = {};
  ([0, 1] as const).forEach((sideIndex) => {
    const diff = sideIndex
      ? liveSim.awayGoals - liveSim.homeGoals
      : liveSim.homeGoals - liveSim.awayGoals;
    const conceded = sideIndex ? liveSim.homeGoals : liveSim.awayGoals;
    used[sideIndex].forEach((id) => {
      const player = getPlayer(id);
      let rating =
        6.2 +
        randomBetween(-0.5, 0.5) +
        goalsBy(id) * 0.9 +
        liveSim.events.filter((event) => event.assist === id).length * 0.5;
      rating += diff > 0 ? 0.35 : diff < 0 ? -0.3 : 0;
      if (liveSim.events.some((event) => event.card === id && event.isRedCard)) rating -= 1.6;
      if (player.pos === "GK")
        rating += liveSim.events.filter((event) => event.goalkeeper === id).length * 0.25;
      if (player.pos === "GK" || player.pos === "DF")
        rating += conceded === 0 ? 0.5 : -0.25 * Math.min(conceded, 3);
      if (liveSim.events.some((event) => event.varDisallowed === id)) rating -= 0.1;
      if (mins[id] < 25) rating = 6.4 + (rating - 6.4) * 0.5;
      ratings[id] = clamp(Math.round(rating * 10) / 10, 3.5, 10);
    });
  });
  const ranked = Object.entries(ratings).sort((entryA, entryB) => entryB[1] - entryA[1]);
  const bestRated = ranked.filter((entryA) => entryA[1] === ranked[0][1]);
  liveSim.events
    .filter((event) => event.injured)
    .forEach((event) => (getPlayer(event.injured!).injuryDays = event.days!));
  const poss = liveSim.possessionHistory.length
    ? Math.round(liveSim.possessionHistory[liveSim.possessionHistory.length - 1] * 100)
    : 50;
  return {
    homeId: liveSim.sides[0].club,
    awayId: liveSim.sides[1].club,
    homeGoals: liveSim.homeGoals,
    awayGoals: liveSim.awayGoals,
    events: liveSim.events,
    homeLineup: liveSim.sides[0].startingLineup,
    awayLineup: liveSim.sides[1].startingLineup,
    shots: liveSim.shots,
    power: [
      strength(
        liveSim.sides[0].club,
        liveSim.sides[0].startingLineup,
        liveSim.sides[0].form,
        liveSim.sides[0].slotNames,
      ).power,
      strength(
        liveSim.sides[1].club,
        liveSim.sides[1].startingLineup,
        liveSim.sides[1].form,
        liveSim.sides[1].slotNames,
      ).power,
    ],
    shotsOnTarget: liveSim.shotsOnTarget,
    expectedGoals: [
      Math.round(liveSim.expectedGoals[0] * 100) / 100,
      Math.round(liveSim.expectedGoals[1] * 100) / 100,
    ],
    possession: poss,
    minutes: mins,
    usedPlayers: used,
    ratings,
    manOfTheMatch: bestRated.length ? pickRandom(bestRated)[0] : undefined,
  };
}
