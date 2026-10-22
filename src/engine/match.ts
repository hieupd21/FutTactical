import { ROLE_START } from "./constants";
import { autoRest, buildSim, newLive, expectedGoalsRate } from "./liveMatch";
import { bestLineup, clubPlayers, myLineup, slotPositions, strength } from "./squad";
import { trackPromise } from "./mood";
import { getClub, inbox, myClub, news, getPlayer, roundOn, gameState, simLeagues } from "./state";
import type { Formation, Line, LiveSim, MatchEvent, MatchResult, MatchSim } from "./types";
import { clamp, roundToTen, randomInt, randomBetween } from "./util";

function poisson(expectedGoals: number): number {
  const limit = Math.exp(-expectedGoals);
  let goals = 0,
    product = 1;
  do {
    goals++;
    product *= Math.random();
  } while (product > limit);
  return goals - 1;
}
function pickScorer(lineup: (string | null)[], form: Formation): string {
  const lines = slotPositions(form);
  const weightByLine: Record<Line, number> = { GK: 0, DF: 1, MF: 3, FW: 6 };
  const candidates = lineup
    .map((id, i) => [id, weightByLine[lines[i]]] as const)
    .filter((candidate): candidate is readonly [string, number] => !!candidate[0]);
  const totalWeight = candidates.reduce((total, candidate) => total + candidate[1], 0);
  let remaining = Math.random() * totalWeight;
  for (const [id, weight] of candidates) {
    remaining -= weight;
    if (remaining <= 0) return id;
  }
  return candidates[0] ? candidates[0][0] : "";
}

/** Mô phỏng nhanh một trận (các trận của đội khác): chỉ ra tỷ số + người ghi bàn */
export function simMatch(homeId: string, awayId: string): MatchSim {
  const formation = homeId === gameState.myClubId ? gameState.form : getClub(homeId).form,
    awayFormation = awayId === gameState.myClubId ? gameState.form : getClub(awayId).form;
  const homeLineup = homeId === gameState.myClubId ? myLineup() : bestLineup(homeId, formation),
    awayLineup = awayId === gameState.myClubId ? myLineup() : bestLineup(awayId, awayFormation);
  const homeStrength = strength(homeId, homeLineup, formation),
    awayStrength = strength(awayId, awayLineup, awayFormation);
  const homeGoals = poisson(expectedGoalsRate(homeStrength.att + 1.5, awayStrength.def)),
    awayGoals = poisson(expectedGoalsRate(awayStrength.att, homeStrength.def + 1.5));
  const events: MatchEvent[] = [];
  for (let i = 0; i < homeGoals; i++)
    events.push({ minute: randomInt(1, 90), side: 0, goal: pickScorer(homeLineup, formation) });
  for (let i = 0; i < awayGoals; i++)
    events.push({ minute: randomInt(1, 90), side: 1, goal: pickScorer(awayLineup, awayFormation) });
  // chấn thương
  (
    [
      [homeLineup, 0],
      [awayLineup, 1],
    ] as const
  ).forEach(([lineup, sideIndex]) =>
    lineup.forEach((id) => {
      const player = id ? getPlayer(id) : null;
      if (player && Math.random() < (player.fitness < 60 ? 0.025 : 0.011)) {
        player.injuryDays = randomInt(4, 45);
        events.push({
          minute: randomInt(10, 88),
          side: sideIndex,
          injured: player.id,
          days: player.injuryDays,
        });
      }
    }),
  );
  events.sort((eventA, eventB) => eventA.minute - eventB.minute);
  return {
    homeId,
    awayId,
    homeGoals,
    awayGoals,
    events,
    homeLineup,
    awayLineup,
    shots: [0, 0],
    power: [homeStrength.power, awayStrength.power],
  };
}

/** Cập nhật phong độ, thể lực, tinh thần sau trận */
function applyMatch(matchSim: MatchSim): void {
  (
    [
      [matchSim.homeLineup, matchSim.homeGoals - matchSim.awayGoals, matchSim.homeId, 0],
      [matchSim.awayLineup, matchSim.awayGoals - matchSim.homeGoals, matchSim.awayId, 1],
    ] as const
  ).forEach(([lineup, diff, clubId, side]) => {
    const starters = new Set(lineup);
    const played = new Set(matchSim.usedPlayers ? matchSim.usedPlayers[side] : lineup);
    clubPlayers(clubId).forEach((player) => {
      const started = starters.has(player.id);
      player.recentStarts.push(started ? 1 : 0);
      player.recentStarts = player.recentStarts.slice(-6);
      if (played.has(player.id)) {
        const mins = matchSim.minutes?.[player.id] ?? 90;
        player.apps++;
        player.careerTotals.apps++;
        player.fitness = clamp(
          player.fitness - Math.round((randomInt(16, 24) * mins) / 90),
          20,
          100,
        );
        const goals = matchSim.events.filter((event) => event.goal === player.id).length;
        player.goals += goals;
        player.careerTotals.goals += goals;
        const rating =
          matchSim.ratings?.[player.id] ??
          clamp(
            6.4 + goals * 0.9 + (diff > 0 ? 0.5 : diff < 0 ? -0.4 : 0) + randomBetween(-0.9, 0.9),
            4,
            10,
          );
        player.lastRating = Math.round(rating * 10) / 10;
        player.form = clamp(
          player.form * 0.65 + (50 + (rating - 6.4) * 22) * (mins >= 45 ? 0.35 : 0.15),
          5,
          95,
        );
      }
      if (clubId === gameState.myClubId && player.contract) {
        const expectedStarts = ROLE_START[player.contract.role] ?? 0.3;
        const share =
          player.recentStarts.reduce((sum, starts) => sum + starts, 0) / player.recentStarts.length;
        player.morale +=
          (diff > 0 ? 2 : diff < 0 ? -1 : 0) +
          (started ? 1.5 : played.has(player.id) ? 0.7 : 0) -
          (player.recentStarts.length >= 3 && share < expectedStarts - 0.15 ? 3 : 0);
        player.morale = clamp(player.morale, 0, 100);
        trackPromise(player, started);
      }
    });
  });
}

const toResult = (matchSim: MatchSim): MatchResult => ({
  homeId: matchSim.homeId,
  awayId: matchSim.awayId,
  homeGoals: matchSim.homeGoals,
  awayGoals: matchSim.awayGoals,
  scorers: matchSim.events.filter((event) => event.goal).map((event) => event.goal as string),
});

/** Đá các trận khác trong ngày ở mọi giải mô phỏng */
export function playRound(day: number): void {
  simLeagues().forEach((league) => {
    const round = roundOn(day, league.id);
    if (round < 0) return;
    const list: MatchResult[] = [];
    gameState.fixtures[league.id][round].forEach(([homeId, awayId]) => {
      if ((homeId === gameState.myClubId || awayId === gameState.myClubId) && gameState.lastMatch)
        list.push(gameState.lastMatch.result);
      else {
        const matchSim = simMatch(homeId, awayId);
        applyMatch(matchSim);
        list.push(toResult(matchSim));
      }
    });
    gameState.results[league.id][round] = list;
    roundNews(list);
  });
}

/** Tin trận đấu: trận của bạn luôn có; các giải còn lại chọn tối đa 2 trận nổi bật mỗi vòng */
function roundNews(list: MatchResult[]): void {
  const line = (matchResult: MatchResult): string =>
    `${getClub(matchResult.homeId).name} ${matchResult.homeGoals}-${matchResult.awayGoals} ${getClub(matchResult.awayId).name}`;
  const mine = list.find(
    (matchResult) =>
      matchResult.homeId === gameState.myClubId || matchResult.awayId === gameState.myClubId,
  );
  if (mine) {
    const ourGoals = mine.homeId === gameState.myClubId ? mine.homeGoals : mine.awayGoals,
      them = mine.homeId === gameState.myClubId ? mine.awayGoals : mine.homeGoals;
    news(
      `${ourGoals > them ? "Chiến thắng" : ourGoals < them ? "Thất bại" : "Hòa"}: ${line(mine)}.`,
      "match",
    );
  }
  const highlights = list
    .filter((matchResult) => matchResult !== mine)
    .map((matchResult) => {
      const diff = Math.abs(matchResult.homeGoals - matchResult.awayGoals);
      const winner =
          matchResult.homeGoals > matchResult.awayGoals ? matchResult.homeId : matchResult.awayId,
        loser =
          matchResult.homeGoals > matchResult.awayGoals ? matchResult.awayId : matchResult.homeId;
      const upset = diff > 0 && getClub(winner).strength <= getClub(loser).strength - 8;
      const derby =
        getClub(matchResult.homeId).rival === matchResult.awayId ||
        getClub(matchResult.awayId).rival === matchResult.homeId;
      const hasHatTrick = Object.values(
        matchResult.scorers.reduce<Record<string, number>>(
          (goalsByPlayer, id) => ({ ...goalsByPlayer, [id]: (goalsByPlayer[id] || 0) + 1 }),
          {},
        ),
      ).some((goals) => goals >= 3);
      const score =
        (diff >= 3 ? 3 : 0) +
        (upset ? 3 : 0) +
        (derby ? 2 : 0) +
        (hasHatTrick ? 2 : 0) +
        (matchResult.homeGoals + matchResult.awayGoals >= 6 ? 2 : 0);
      const label = hasHatTrick
        ? "Cú hat-trick"
        : upset
          ? "Bất ngờ"
          : derby
            ? "Derby"
            : diff >= 3
              ? "Đại thắng"
              : "Mưa bàn thắng";
      return { matchResult: matchResult, score, label: label };
    })
    .filter((highlight) => highlight.score >= 2)
    .sort((highlightA, highlightB) => highlightB.score - highlightA.score)
    .slice(0, 2);
  highlights.forEach(({ matchResult: matchResult, label: label }) =>
    news(`${label}: ${line(matchResult)}.`, "match"),
  );
}

/** Khởi tạo trận của bạn (chưa đá). null nếu hôm nay không có trận */
export function beginMyMatch(): LiveSim | null {
  const matchToday = gameState.matchToday;
  return matchToday ? newLive(matchToday.homeId, matchToday.awayId, false) : null;
}

/** Chốt trận của bạn sau khi đã mô phỏng đủ: cập nhật cầu thủ, doanh thu, các trận còn lại trong ngày */
export function finishMyMatch(liveSim: LiveSim): {
  matchSim: MatchSim;
  ourGoals: number;
  them: number;
} {
  const matchSim = buildSim(liveSim);
  applyMatch(matchSim);
  const result = toResult(matchSim);
  gameState.lastMatch = { matchSim, result };
  const home = liveSim.mySide === 0;
  const ourGoals = home ? matchSim.homeGoals : matchSim.awayGoals,
    them = home ? matchSim.awayGoals : matchSim.homeGoals;
  if (home) myClub().budget += roundToTen(150 * myClub().prestige); // doanh thu sân nhà
  matchSim.events
    .filter(
      (event) =>
        event.injured &&
        getPlayer(event.injured) &&
        getPlayer(event.injured).club === gameState.myClubId,
    )
    .forEach((event) =>
      inbox({
        kind: "injury",
        title: `Chấn thương: ${getPlayer(event.injured!).name}`,
        body: `Dự kiến nghỉ ${event.days} ngày. Cẩn thận nguy cơ tái phát khi vừa trở lại.`,
        playerId: event.injured,
      }),
    );
  playRound(gameState.day);
  gameState.matchToday = null;
  return { matchSim, ourGoals, them };
}

/** Đá cả trận ngay, máy điều hành giúp bạn */
export function playMyMatch(): { matchSim: MatchSim; ourGoals: number; them: number } | null {
  const liveSim = beginMyMatch();
  if (!liveSim) return null;
  autoRest(liveSim);
  return finishMyMatch(liveSim);
}
