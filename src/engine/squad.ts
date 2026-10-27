import { FORMS } from "./constants";
import { fifacmPlayerPositionOfSlot, fifacmPositionLine } from "./fifacm";
import { myPitchLayout } from "./formationLayout";
import { dynamicRating } from "./players";
import { getClub, getPlayer, gameState } from "./state";
import type { Formation, Line, Player, Role, TableRow } from "./types";

export function clubPlayers(clubId: string): Player[] {
  return getClub(clubId).playerIds.map(getPlayer).filter(Boolean);
}
export function slotPositions(formation: Formation): Line[] {
  const [defenders, midfielders, attackers] = FORMS[formation];
  return [
    "GK",
    ...Array<Line>(defenders).fill("DF"),
    ...Array<Line>(midfielders).fill("MF"),
    ...Array<Line>(attackers).fill("FW"),
  ];
}
export function fitAt(player: Player, pos: Line): number {
  if (player.pos === pos || player.secondaryPositions.includes(pos)) return 1;
  if (player.pos === "GK" || pos === "GK") return 0.4;
  return 0.85;
}
/** Điểm chỉ số bị trừ khi cầu thủ đứng đúng tuyến nhưng ở vị trí chi tiết không nằm trong danh sách vị trí chơi được */
export const OFF_POSITION_PENALTY = 4;
/** Các vị trí chi tiết cầu thủ chơi được (vị trí tốt nhất đứng đầu), ví dụ ["CM", "CDM"]; rỗng nếu không có dữ liệu */
export const playablePositions = (player: Player): string[] =>
  (player.positionDetail ?? "")
    .split(",")
    .map((position) => position.trim())
    .filter(Boolean);
/** Điểm bị trừ vì vị trí chi tiết của ô (LB, CDM...); 0 nếu không biết ô, không có dữ liệu hoặc ô nằm trong vị trí chơi được. Khác tuyến đã bị trừ qua `fitAt` nên không trừ thêm */
export function positionPenalty(player: Player, slotPosition?: string): number {
  if (!slotPosition) return 0;
  const playable = playablePositions(player);
  if (!playable.length || playable.includes(fifacmPlayerPositionOfSlot(slotPosition))) return 0;
  return fitAt(player, fifacmPositionLine(slotPosition)) === 1 ? OFF_POSITION_PENALTY : 0;
}
/** Chỉ số của cầu thủ khi đứng ở một ô của đội hình: đã tính phong độ/thể lực và phạt trái tuyến, trái vị trí */
export function slotRating(player: Player, line: Line, slotPosition?: string): number {
  return dynamicRating(player) * fitAt(player, line) - positionPenalty(player, slotPosition);
}
/** Chỉ số cầu thủ hiển thị khi đứng ở ô `slotPosition` (đã trừ phạt trái tuyến, trái vị trí) */
export const ratingAtSlot = (player: Player, slotPosition: string): number =>
  Math.round(slotRating(player, fifacmPositionLine(slotPosition), slotPosition));
/** Tên vị trí từng ô trên sân của bạn (đúng thứ tự `gameState.lineup`) */
export const mySlotPositions = (): string[] => myPitchLayout().map((slot) => slot.position);
/** Thủ môn chỉ đứng ô GK và cầu thủ khác không đứng ô GK */
export const canPlayInSlot = (player: Player, slotPosition: string): boolean =>
  (player.pos === "GK") === (slotPosition === "GK");
/** Đưa `playerId` vào ô `slotIndex` hợp lệ: người đó hợp ô, và nếu hoán đổi thì người đang ở ô cũng hợp chỗ của người kia */
export function canSwapInto(playerId: string, slotIndex: number): boolean {
  const slotNames = mySlotPositions();
  const lineup = myLineup();
  if (!canPlayInSlot(getPlayer(playerId), slotNames[slotIndex])) return false;
  const occupantId = lineup[slotIndex];
  const previousSlotIndex = lineup.indexOf(playerId);
  if (!occupantId || previousSlotIndex < 0) return true;
  return canPlayInSlot(getPlayer(occupantId), slotNames[previousSlotIndex]);
}
export const available = (player: Player | undefined): player is Player =>
  !!player && player.injuryDays <= 0 && !player.away;

export function bestLineup(
  clubId: string,
  form: Formation,
  slotNames?: string[],
): (string | null)[] {
  const pool = clubPlayers(clubId).filter(available);
  const used = new Set<string>();
  return slotPositions(form).map((pos, slotIndex) => {
    let player: Player | null = null;
    let bestValue = -1;
    pool.forEach((candidate) => {
      if (used.has(candidate.id)) return;
      const score =
        slotRating(candidate, pos, slotNames?.[slotIndex]) + (candidate.fitness - 80) / 20;
      if (score > bestValue) {
        bestValue = score;
        player = candidate;
      }
    });
    if (player) used.add((player as Player).id);
    return player ? (player as Player).id : null;
  });
}

/** Đội hình của bạn; tự lấp chỗ trống khi cầu thủ chấn thương / rời đội */
export function myLineup(): (string | null)[] {
  const formation = gameState.form;
  const need = slotPositions(formation);
  let lineup = (gameState.lineup || []).slice(0, 11);
  const ok = (id: string | null): id is string =>
    !!id &&
    !!getPlayer(id) &&
    getPlayer(id).club === gameState.myClubId &&
    available(getPlayer(id));
  if (lineup.length !== 11 || lineup.some((id) => !ok(id))) {
    const auto = bestLineup(gameState.myClubId, formation, mySlotPositions());
    const used = new Set(lineup.filter(ok));
    lineup = need.map((_, i) => (ok(lineup[i]) ? lineup[i] : null));
    lineup = lineup.map((id) => {
      if (id) return id;
      const firstFree = auto.find((candidateId) => candidateId && !used.has(candidateId));
      if (firstFree) used.add(firstFree);
      return firstFree || null;
    });
    gameState.lineup = lineup;
  }
  return lineup;
}

export function strength(
  _cid: string,
  lineup: (string | null)[],
  form: Formation,
  slotNames?: string[],
): { att: number; def: number; power: number } {
  const lines = slotPositions(form);
  const effByLine: Record<Line, number[]> = { GK: [], DF: [], MF: [], FW: [] };
  lineup.forEach((id, i) => {
    const player = id ? getPlayer(id) : null;
    effByLine[lines[i]].push(player ? slotRating(player, lines[i], slotNames?.[i]) : 35);
  });
  const average = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 35;
  const att =
    average(effByLine.FW) * 0.45 +
    average(effByLine.MF) * 0.38 +
    average(effByLine.DF) * 0.17 +
    (effByLine.FW.length - 2) * 1.4;
  const def =
    average(effByLine.DF) * 0.42 +
    average(effByLine.GK) * 0.3 +
    average(effByLine.MF) * 0.28 +
    (effByLine.DF.length - 4) * 1.4;
  return { att, def, power: Math.round((att + def) / 2) };
}
export function clubStrength(clubId: string) {
  const club = getClub(clubId);
  const formation = clubId === gameState.myClubId ? gameState.form : club.form;
  return strength(
    clubId,
    clubId === gameState.myClubId ? myLineup() : bestLineup(clubId, formation),
    formation,
    clubId === gameState.myClubId ? mySlotPositions() : undefined,
  );
}

/** Thứ hạng của cầu thủ ở vị trí của cậu ấy trong một đội, và vai trò tương ứng */
export function squadRank(
  player: Player,
  clubId: string,
  form?: Formation,
): { rank: number; slots: number; role: Role } {
  const formation = form || (clubId === gameState.myClubId ? gameState.form : getClub(clubId).form);
  const slots = slotPositions(formation).filter((line) => line === player.pos).length;
  const mates = clubPlayers(clubId).filter(
    (teammate) =>
      teammate.id !== player.id &&
      (teammate.pos === player.pos || teammate.secondaryPositions.includes(player.pos)),
  );
  const rank = 1 + mates.filter((teammate) => teammate.ovr > player.ovr).length;
  const isTopPlayer =
    clubPlayers(clubId).filter((teammate) => teammate.id !== player.id && teammate.ovr > player.ovr)
      .length < 2;
  const role: Role =
    isTopPlayer && rank <= slots
      ? "Ngôi sao"
      : rank <= slots
        ? "Đá chính"
        : rank <= slots + 1
          ? "Xoay tua"
          : player.age <= 20
            ? "Triển vọng"
            : "Dự bị";
  return { rank, slots, role };
}

export function table(leagueId: string): TableRow[] {
  const tableByClub: Record<string, TableRow> = {};
  Object.values(gameState.clubs)
    .filter((club) => club.leagueId === leagueId)
    .forEach(
      (club) =>
        (tableByClub[club.id] = {
          id: club.id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
          form: [],
        }),
    );
  (gameState.results[leagueId] || []).forEach(
    (matchResults) =>
      matchResults &&
      matchResults.forEach((matchResult) => {
        const tableRow = tableByClub[matchResult.homeId],
          awayRow = tableByClub[matchResult.awayId];
        tableRow.played++;
        awayRow.played++;
        tableRow.goalsFor += matchResult.homeGoals;
        tableRow.goalsAgainst += matchResult.awayGoals;
        awayRow.goalsFor += matchResult.awayGoals;
        awayRow.goalsAgainst += matchResult.homeGoals;
        if (matchResult.homeGoals > matchResult.awayGoals) {
          tableRow.won++;
          awayRow.lost++;
          tableRow.points += 3;
          tableRow.form.push("W");
          awayRow.form.push("L");
        } else if (matchResult.homeGoals < matchResult.awayGoals) {
          awayRow.won++;
          tableRow.lost++;
          awayRow.points += 3;
          awayRow.form.push("W");
          tableRow.form.push("L");
        } else {
          tableRow.drawn++;
          awayRow.drawn++;
          tableRow.points++;
          awayRow.points++;
          tableRow.form.push("D");
          awayRow.form.push("D");
        }
      }),
  );
  return Object.values(tableByClub).sort(
    (tableRowA, tableRowB) =>
      tableRowB.points - tableRowA.points ||
      tableRowB.goalsFor - tableRowB.goalsAgainst - (tableRowA.goalsFor - tableRowA.goalsAgainst) ||
      tableRowB.goalsFor - tableRowA.goalsFor,
  );
}
export const myLeaguePosition = (): number =>
  table(getClub(gameState.myClubId).leagueId).findIndex(
    (tableRow) => tableRow.id === gameState.myClubId,
  ) + 1;
