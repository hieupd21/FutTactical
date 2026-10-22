// Khởi tạo thế giới: dữ liệu FIFACM hoặc gói dòng cũ dùng cho tương thích.
import { allLeagueInfos, findLeagueByPackId, mockData, setMockData } from "./mockData";
import { fifacmPositionLine, type FifacmPack } from "./fifacm";
import { setBoard } from "./board";
import { AI_FORMS, PHILOSOPHY_LABEL } from "./constants";
import { formatMoney, formatWage } from "./format";
import { makePlayer, valueOf, wageBase } from "./players";
import { clubRequirement, NEWBIE_REPUTATION } from "./career";
import { bestLineup, clubPlayers } from "./squad";
import { getClub, inbox, myClub, news, gameState, setLeagues, setState, simLeagues } from "./state";
import type { Club, DataRow, GameState, League, Line, Philosophy, Player, Role } from "./types";
import { clamp, pickRandom, roundToTen, randomInt, randomBetween } from "./util";

function blankState(year: number, extra: Partial<GameState> = {}): GameState {
  return {
    saveVersion: 3,
    nextPlayerNumber: 1,
    year,
    day: 0,
    hour: 9,
    players: {},
    clubs: {},
    myClubId: "",
    fixtures: {},
    results: {},
    news: [],
    inbox: [],
    negos: [],
    nextRecordNumber: 1,
    liabilities: [],
    pending: [],
    leagueNames: {},
    form: "4-3-3",
    lineup: [],
    scout: 2,
    shortlist: [],
    board: { target: 1, objectives: [] },
    boardConfidence: 60,
    sacked: false,
    matchToday: null,
    lastMatch: null,
    free: [],
    aiDone: 0,
    seasonLog: [],
    wageCap: 0,
    ...extra,
  };
}

export function makeFixtures(clubIds: string[]): [string, string][][] {
  const clubCount = clubIds.length,
    rotation = clubIds.slice(),
    rounds: [string, string][][] = [];
  for (let roundIndex = 0; roundIndex < clubCount - 1; roundIndex++) {
    const roundFixtures: [string, string][] = [];
    for (let i = 0; i < clubCount / 2; i++) {
      const homeId = rotation[i],
        awayId = rotation[clubCount - 1 - i];
      roundFixtures.push(roundIndex % 2 ? [awayId, homeId] : [homeId, awayId]);
    }
    rounds.push(roundFixtures);
    rotation.splice(1, 0, rotation.pop() as string);
  }
  return rounds.concat(
    rounds.map((roundFixtures) =>
      roundFixtures.map(([homeId, awayId]) => [awayId, homeId] as [string, string]),
    ),
  );
}
export const leagueIndex = (club: Club): number =>
  Object.values(gameState.clubs)
    .filter((otherClub) => otherClub.leagueId === club.leagueId)
    .findIndex((otherClub) => otherClub.id === club.id);

function assignRoles(clubId: string, bumpStars = false): void {
  clubPlayers(clubId)
    .sort((playerA, playerB) => playerB.ovr - playerA.ovr)
    .forEach((player, j) => {
      const role: Role =
        j < 2
          ? "Ngôi sao"
          : j < 11
            ? "Đá chính"
            : j < 15
              ? "Xoay tua"
              : player.age <= 20
                ? "Triển vọng"
                : "Dự bị";
      player.contract!.role = role;
      if (bumpStars && j < 2) player.contract!.wage = Math.round(player.contract!.wage * 1.3);
    });
}
function makeAllFixtures(): void {
  simLeagues().forEach((league) => {
    gameState.fixtures[league.id] = makeFixtures(
      Object.values(gameState.clubs)
        .filter((club) => club.leagueId === league.id)
        .map((club) => club.id),
    );
    gameState.results[league.id] = [];
  });
}
const randomPhilosophy = (): Philosophy =>
  pickRandom(Object.keys(PHILOSOPHY_LABEL) as Philosophy[]);

function finishSetup(wageCapMultiplier: number, shouldKeepBudget = false): void {
  const club = myClub();
  if (!shouldKeepBudget) club.budget = roundToTen(4000 * Math.pow(club.prestige, 2.1));
  gameState.wageCap = Math.round(
    clubPlayers(gameState.myClubId).reduce((total, player) => total + player.contract!.wage, 0) *
      wageCapMultiplier,
  );
  makeAllFixtures();
  gameState.lineup = bestLineup(gameState.myClubId, gameState.form);
  setBoard();
}

// ---------- dữ liệu thật ----------
export interface PackClub {
  leagueId: number;
  name: string;
  rows: DataRow[];
  strength: number;
}
export function packClubs(rows: DataRow[], dataset?: FifacmPack): PackClub[] {
  const clubs: Record<string, PackClub> = {};
  const knownLeagueIds = new Set(allLeagueInfos().map((league) => league.packId));
  rows.forEach((dataRow) => {
    if (!knownLeagueIds.has(dataRow[0])) return;
    const clubKey = dataRow[0] + "|" + dataRow[1];
    (clubs[clubKey] = clubs[clubKey] || {
      leagueId: dataRow[0],
      name: dataRow[1],
      rows: [],
      strength: 0,
    }).rows.push(dataRow);
  });
  Object.values(clubs).forEach((packClub) => {
    const topOvrs = packClub.rows
      .map((dataRow) => dataRow[5])
      .sort((ovrA, ovrB) => ovrB - ovrA)
      .slice(0, 14);
    packClub.strength =
      dataset?.clubByName.get(packClub.name)?.overallRating ??
      Math.round(topOvrs.reduce((sum, ovr) => sum + ovr, 0) / topOvrs.length);
  });
  return Object.values(clubs);
}

const LINE_SAMPLE_SIZE: Record<Line, number> = { GK: 1, DF: 4, MF: 4, FW: 3 };

/** Sức mạnh từng nhóm vị trí của CLB: trung bình ovr các cầu thủ mạnh nhất, xếp theo vị trí chính (cột đầu của dòng dữ liệu) */
export function packClubLineStrengths(packClub: PackClub): Record<Line, number> {
  const { positionLine } = mockData().nationalities;
  const ovrsByLine: Record<Line, number[]> = { GK: [], DF: [], MF: [], FW: [] };
  packClub.rows.forEach((dataRow) => {
    const mainPosition = String(dataRow[4]).split(",")[0].trim();
    ovrsByLine[(positionLine[mainPosition] || "MF") as Line].push(dataRow[5]);
  });
  const averageOf = (line: Line): number => {
    const topOvrs = ovrsByLine[line]
      .sort((ovrA, ovrB) => ovrB - ovrA)
      .slice(0, LINE_SAMPLE_SIZE[line]);
    return topOvrs.length
      ? Math.round(topOvrs.reduce((sum, ovr) => sum + ovr, 0) / topOvrs.length)
      : 0;
  };
  return { GK: averageOf("GK"), DF: averageOf("DF"), MF: averageOf("MF"), FW: averageOf("FW") };
}

export interface RealStart {
  /** true = HLV mới vô danh, chỉ nhận được các đội hạng dưới; false = tự chọn CLB bất kỳ */
  rookie?: boolean;
  dataset?: FifacmPack;
}

export function newGameReal(
  rows: DataRow[],
  lgId: string,
  clubName: string,
  dataSource?: string,
  opts: RealStart = {},
): void {
  const dataset = opts.dataset;
  if (dataset) setMockData(dataset.references);
  const version = rows[0][13] || 26,
    year = 2000 + version - 1;
  const present = new Set(packClubs(rows, dataset).map((packClub) => packClub.leagueId));
  const realMeta = allLeagueInfos().filter(
    (league) => !league.isOptional || present.has(league.packId),
  );
  const meta: League[] = [
    ...realMeta.map(({ packId: _packId, isOptional: _isOptional, ...realLeague }) => ({
      ...realLeague,
      foreignRatio: 0,
      importNationalities: [],
      clubs: [],
    })),
  ].sort((leagueA, leagueB) => leagueB.level - leagueA.level);
  setState(
    blankState(year, {
      leagueMeta: meta,
      dataSource: dataSource || `FC ${version}`,
      ...(dataset ? { dataProvider: "fifacm" as const } : {}),
    }),
  );
  setLeagues(meta);
  let clubId = 0;
  const byName: Record<string, string> = {};
  const moves: [number, string, string, string][] = [];
  // dựng một cầu thủ từ dòng dữ liệu; owner = null là cầu thủ tự do (leagueId 0, không CLB)
  const addRow = (
    dataRow: DataRow,
    owner: string | null,
    toClubName: string,
    hasReleaseClauseData: boolean,
  ): void => {
    const positionTokens = String(dataRow[4])
      .split(",")
      .map((positionToken) => positionToken.trim())
      .filter(Boolean);
    const lines = [
      ...new Set(
        positionTokens.map(
          (positionToken) => mockData().nationalities.positionLine[positionToken] || "MF",
        ),
      ),
    ] as Line[];
    if (!lines.length) lines.push("MF");
    const sourcePlayer = dataset?.playerByRow.get(dataRow);
    if (dataset && !sourcePlayer) throw new Error("Không tìm thấy cầu thủ trong gói FIFACM.");
    const playerId = sourcePlayer ? `f${sourcePlayer.id}` : "p" + gameState.nextPlayerNumber++;
    const age = dataRow[9] || randomInt(20, 29);
    const player: Player = {
      id: playerId,
      ...(sourcePlayer ? { sourceId: sourcePlayer.id, nationId: sourcePlayer.nationality.id } : {}),
      name: dataRow[2],
      longName: dataRow[3] || dataRow[2],
      nationality: mockData().nationalities.codeByDataName[dataRow[12]] || "XX",
      nationalityName:
        mockData().nationalities.vietnameseNameByDataName[dataRow[12]] || dataRow[12],
      pos: lines[0],
      secondaryPositions: lines.slice(1),
      positionDetail: positionTokens.join(", "),
      age,
      ovr: dataRow[5],
      pot: Math.max(dataRow[5], dataRow[6] + (dataRow[9] ? 0 : age <= 22 ? randomInt(3, 10) : 0)),
      profile:
        dataRow[9] <= 21 && dataRow[6] - dataRow[5] >= 10
          ? "prodigy"
          : pickRandom(["early", "late", "steady", "steady", "durable", "fragile"] as const),
      form: randomInt(45, 60),
      morale: randomInt(55, 75),
      fitness: 100,
      injuryDays: 0,
      club: owner,
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
    if (dataRow[14]) {
      player.transferHistory.push({ year, fromClub: dataRow[14], toClub: toClubName, fee: null });
      if (owner) moves.push([dataRow[5], player.name, dataRow[14], toClubName]);
    }
    player.contract = {
      wage: sourcePlayer
        ? sourcePlayer.wageEur / 1000
        : Math.max(1, Math.round((dataRow[8] || 0) / 1000)) || 0,
      expiryYear: sourcePlayer
        ? sourcePlayer.contractYear
        : owner
          ? Math.max(year + 1, dataRow[10] || year + 2)
          : year,
      releaseClause: sourcePlayer
        ? sourcePlayer.releaseClauseEur / 1000
        : hasReleaseClauseData && dataRow[11]
          ? roundToTen(dataRow[11] / 1000)
          : 0,
      role: "Xoay tua",
    };
    if (sourcePlayer && !owner) player.contract = null;
    gameState.players[playerId] = player;
    if (owner) getClub(owner).playerIds.push(playerId);
    else gameState.free.push(playerId);
    const freeValue = valueOf({ ...player, valueAnchor: undefined }),
      real = (dataRow[7] || 0) / 1000;
    player.valueAnchor = sourcePlayer
      ? real / Math.max(1, freeValue)
      : real > 0
        ? clamp(real / Math.max(1, freeValue), 0.25, 4)
        : 1;
    player.marketValue = sourcePlayer ? real : valueOf(player);
    if (!sourcePlayer && !dataRow[8]) player.contract!.wage = wageBase(player);
  };
  packClubs(rows, dataset).forEach((packClub) => {
    const sourceClub = dataset?.clubByName.get(packClub.name);
    const realLeague = findLeagueByPackId(packClub.leagueId)!,
      id = sourceClub ? `fc${sourceClub.id}` : "c" + clubId++,
      pres = clamp(Math.round((packClub.strength - 68) / 3.6), 1, 5);
    const club: Club = {
      id,
      ...(sourceClub
        ? {
            sourceId: sourceClub.id,
            worthEur: sourceClub.worthEur,
            squadValueEur: sourceClub.squadValueEur,
            weeklyWageEur: sourceClub.weeklyWageEur,
          }
        : {}),
      name: packClub.name,
      leagueId: realLeague.id,
      strength: packClub.strength,
      prestige: pres,
      philosophy: randomPhilosophy(),
      form: sourceClub?.formation ?? pickRandom(AI_FORMS),
      playerIds: [],
      budget:
        sourceClub && sourceClub.budgetEur > 0
          ? sourceClub.budgetEur / 1000
          : roundToTen(4000 * Math.pow(pres, 2.2) * randomBetween(0.8, 1.2)),
      rival: null,
    };
    gameState.clubs[id] = club;
    byName[packClub.name] = id;
    packClub.rows.forEach((dataRow) => addRow(dataRow, id, packClub.name, realLeague.id === "ES"));
    if (sourceClub) {
      assignRoles(id);
      return;
    }
    // bổ sung cầu thủ trẻ nếu đội hình trong dữ liệu quá mỏng
    const need: [Line, number][] = [
      ["GK", 2],
      ["DF", 6],
      ["MF", 6],
      ["FW", 3],
    ];
    const filler = (pos: Line) => {
      const player = makePlayer(
        realLeague.nationality,
        pos,
        Math.round(packClub.strength - randomInt(10, 16)),
        randomInt(18, 21),
        id,
      );
      player.contract!.role = "Triển vọng";
      player.isGenerated = true;
      club.playerIds.push(player.id);
    };
    need.forEach(([pos, count]) => {
      while (clubPlayers(id).filter((player) => player.pos === pos).length < count) filler(pos);
    });
    while (club.playerIds.length < 20) filler(pickRandom<Line>(["DF", "MF", "FW"]));
    assignRoles(id);
  });
  moves
    .sort((rowA, rowB) => rowB[0] - rowA[0])
    .slice(0, 25)
    .reverse()
    .forEach((line) =>
      news(`Hè ${year}: ${line[1]} (${line[0]}) chuyển từ ${line[2]} sang ${line[3]}.`, "transfer"),
    );
  mockData().leagues.rivals.forEach(([clubNameA, clubNameB]) => {
    if (byName[clubNameA] && byName[clubNameB]) {
      getClub(byName[clubNameA]).rival = byName[clubNameB];
      getClub(byName[clubNameB]).rival = byName[clubNameA];
    }
  });
  Object.values(gameState.clubs).forEach((club) => {
    if (club.rival) return;
    const same = Object.values(gameState.clubs)
      .filter((otherClub) => otherClub.leagueId === club.leagueId && otherClub.id !== club.id)
      .sort(
        (clubA, clubB) =>
          Math.abs(clubA.strength - club.strength) - Math.abs(clubB.strength - club.strength),
      );
    club.rival = same[0]?.id ?? null;
  });
  // cầu thủ hết hợp đồng (leagueId 0): tự do, CLB nào cũng có thể ký
  rows
    .filter((dataRow) => !dataRow[0] && !dataRow[1])
    .forEach((dataRow) => addRow(dataRow, null, "", false));
  gameState.myClubId =
    byName[clubName] ||
    Object.values(gameState.clubs).find((club) => club.name === clubName)?.id ||
    Object.values(gameState.clubs).find((club) => club.leagueId === lgId)!.id;
  gameState.managerReputation = opts.rookie
    ? NEWBIE_REPUTATION
    : Math.min(100, clubRequirement(myClub()) + 5);
  if (dataset) gameState.form = myClub().form;
  const hasSourceBudget = (dataset?.clubByName.get(myClub().name)?.budgetEur ?? 0) > 0;
  finishSetup(1.08, hasSourceBudget);
  const sourceStartingXI = dataset?.clubByName.get(myClub().name)?.startingXI;
  if (sourceStartingXI?.length === 11) {
    const positionPriority = { GK: 0, DF: 1, MF: 2, FW: 3 };
    // The engine slots run GK -> DF -> MF -> FW; source pitch cards run in the opposite direction.
    gameState.lineup = sourceStartingXI
      .map((slot) => ({
        id: `f${slot.playerId}`,
        line: fifacmPositionLine(slot.position),
      }))
      .sort((first, second) => positionPriority[first.line] - positionPriority[second.line])
      .map((slot) => slot.id);
  }
  news(`Bạn chính thức nhận ghế HLV trưởng ${myClub().name}.`, "club");
  inbox({
    kind: "welcome",
    title: "Chào mừng HLV mới",
    body: `Dữ liệu: ${gameState.dataSource} (mùa ${year}/${year + 1}). Kỳ chuyển nhượng hè mở tới hết 31/8. Ngân sách chuyển nhượng ${formatMoney(myClub().budget)}, quỹ lương ${formatWage(gameState.wageCap)}.${opts.rookie ? " Bạn còn vô danh: hãy chứng tỏ năng lực ở đây, các CLB lớn hơn sẽ ngỏ lời khi uy tín đủ cao." : ""}`,
  });
}
