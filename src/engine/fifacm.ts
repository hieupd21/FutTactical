import type { MockData } from "./mockData";
import {
  LEAGUE_LEVEL_ANCHOR,
  LEAGUE_LEVEL_PER_RATING,
  LEAGUE_RATING_ANCHOR,
  MIN_LEAGUE_LEVEL,
  SIMULATED_LEAGUE_COUNT,
} from "./constants";
import type { DataRow, Formation, Line } from "./types";

export function fifacmPositionLine(position: string): Line {
  if (position === "GK") return "GK";
  if (/^(?:[LR]?CB|[LR]W?B)$/.test(position)) return "DF";
  if (/^(?:ST|[LR]S|CF|[LR]F|[LR]W)$/.test(position)) return "FW";
  return "MF";
}

interface FifacmNation {
  id: number;
  label: string;
  imageUrl: string | null;
}

interface FifacmPlayer {
  id: number;
  avatarUrl: string | null;
  name: string;
  gender: { id: number };
  fifaVersion: number;
  overallRating: number;
  potential: number;
  age: number;
  positions: string[];
  clubId: number | null;
  nationality: { id: number };
  valueEur: number;
  wageEur: number;
  contractStartYear: number;
  contractYear: number;
  releaseClauseEur: number;
}

interface FifacmClub {
  id: number;
  label: string;
  imageUrl: string | null;
  colors: { background: string; text: string } | null;
  overallRating: number;
  internationalPrestige: number;
  leagueIds: number[];
  playerIds: number[];
  formation: Formation | null;
  startingXI: { playerId: number; position: string }[];
  worthEur: number;
  budgetEur: number;
  squadValueEur: number;
  weeklyWageEur: number;
}

interface FifacmLeague {
  id: number;
  label: string;
  teamIds: number[];
}

export interface FifacmDataset {
  players: FifacmPlayer[];
  clubs: FifacmClub[];
  leagues: FifacmLeague[];
  nations: FifacmNation[];
  snapshotDate: string;
}

export interface FifacmPack {
  rows: DataRow[];
  playerByRow: Map<DataRow, FifacmPlayer>;
  clubByName: Map<string, FifacmClub>;
  references: MockData;
  snapshotDate: string;
}

const rgbToHex = (rgbText: string): string =>
  "#" +
  (rgbText.match(/\d+/g) ?? [])
    .slice(0, 3)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("");

/** Nhãn giải nguồn có hậu tố hạng đấu, ví dụ "England Premier League (1)" */
const LEAGUE_TIER_PATTERN = /\s*\((\d+)\)$/;

const nationCodeOf = (nationId: number): string => `n${nationId}`;

/** Quốc gia của giải = quốc tịch đông nhất trong các cầu thủ thuộc CLB của giải đó */
function dominantNationId(
  league: FifacmLeague,
  clubs: Map<number, FifacmClub>,
  players: Map<number, FifacmPlayer>,
): number | undefined {
  const countByNation = new Map<number, number>();
  league.teamIds.forEach((clubId) =>
    clubs.get(clubId)?.playerIds.forEach((playerId) => {
      const nationId = players.get(playerId)?.nationality.id;
      if (nationId !== undefined)
        countByNation.set(nationId, (countByNation.get(nationId) ?? 0) + 1);
    }),
  );
  return [...countByNation.entries()].sort((entryA, entryB) => entryB[1] - entryA[1])[0]?.[0];
}

/** Dựng tham chiếu giải, quốc tịch, màu CLB và ảnh hoàn toàn từ dữ liệu FIFACM; không đọc nguồn nào khác. */
function buildReferences(
  dataset: FifacmDataset,
  clubs: Map<number, FifacmClub>,
  nations: Map<number, FifacmNation>,
  players: Map<number, FifacmPlayer>,
): MockData {
  const nationalities: MockData["nationalities"] = { shortNameByCode: {}, codeByDataName: {} };
  dataset.nations.forEach((nation) => {
    const code = nationCodeOf(nation.id);
    nationalities.codeByDataName[nation.label] = code;
    nationalities.shortNameByCode[code] = nation.label;
  });

  const leagueInfos = dataset.leagues.map((league) => {
    const clubRatings = league.teamIds.flatMap((clubId) => {
      const club = clubs.get(clubId);
      return club ? [club.overallRating] : [];
    });
    const averageRating = clubRatings.length
      ? clubRatings.reduce((total, rating) => total + rating, 0) / clubRatings.length
      : 0;
    const tier = Number(LEAGUE_TIER_PATTERN.exec(league.label)?.[1]);
    return {
      league,
      averageRating,
      isTopTier: tier === 1,
      nationId: dominantNationId(league, clubs, players),
    };
  });
  // Mô phỏng mọi hạng đấu của các quốc gia có giải hạng 1 mạnh nhất, để HLV mới chọn được hạng dưới
  const simulatedNationIds = new Set(
    leagueInfos
      .filter((info) => info.isTopTier && info.nationId !== undefined)
      .sort((infoA, infoB) => infoB.averageRating - infoA.averageRating)
      .slice(0, SIMULATED_LEAGUE_COUNT)
      .map((info) => info.nationId),
  );

  const countries: MockData["leagues"]["countries"] = {};
  leagueInfos.forEach(({ league, averageRating, nationId }) => {
    const nation = nationId === undefined ? undefined : nations.get(nationId);
    const countryCode = nationId === undefined ? "XX" : nationCodeOf(nationId);
    const country = (countries[countryCode] ??= { name: nation?.label ?? "Khác", leagues: [] });
    country.leagues.push({
      packId: league.id,
      id: `fl${league.id}`,
      name: league.label.replace(LEAGUE_TIER_PATTERN, ""),
      level: Math.max(
        MIN_LEAGUE_LEVEL,
        Math.round(
          (LEAGUE_LEVEL_ANCHOR + LEAGUE_LEVEL_PER_RATING * (averageRating - LEAGUE_RATING_ANCHOR)) *
            10,
        ) / 10,
      ),
      isSimulated: simulatedNationIds.has(nationId),
    });
  });
  Object.values(countries).forEach((country) =>
    country.leagues.sort((leagueA, leagueB) => leagueB.level - leagueA.level),
  );

  return {
    playerImageUrlBySourceId: Object.fromEntries(
      dataset.players.flatMap((player) =>
        player.avatarUrl ? [[player.id, player.avatarUrl]] : [],
      ),
    ),
    nationalities,
    leagues: { countries },
    clubVisuals: {
      imageUrlByName: Object.fromEntries(
        dataset.clubs.flatMap((club) => (club.imageUrl ? [[club.label, club.imageUrl]] : [])),
      ),
      colors: Object.fromEntries(
        dataset.clubs.flatMap((club) =>
          club.colors
            ? [[club.label, [rgbToHex(club.colors.background), rgbToHex(club.colors.text)]]]
            : [],
        ),
      ),
    },
  };
}

/** Join provider IDs without merging in player data from the former FC26/FC27 pack. */
export function createFifacmPack(dataset: FifacmDataset): FifacmPack {
  const clubs = new Map(dataset.clubs.map((club) => [club.id, club]));
  const leagues = new Map(dataset.leagues.map((league) => [league.id, league]));
  const nations = new Map(dataset.nations.map((nation) => [nation.id, nation]));
  const players = new Map(dataset.players.map((player) => [player.id, player]));
  if (
    players.size !== dataset.players.length ||
    clubs.size !== dataset.clubs.length ||
    leagues.size !== dataset.leagues.length ||
    nations.size !== dataset.nations.length
  )
    throw new Error("Dữ liệu FIFACM có ID trùng lặp.");

  const references = buildReferences(dataset, clubs, nations, players);
  const playerByRow = new Map<DataRow, FifacmPlayer>();
  const rows = dataset.players.map((player): DataRow => {
    const club = player.clubId === null ? null : clubs.get(player.clubId);
    const nation = nations.get(player.nationality.id);
    if (
      player.gender.id !== 0 ||
      player.fifaVersion !== 27 ||
      !nation ||
      (player.clubId !== null && !club)
    )
      throw new Error(`Dữ liệu cầu thủ FIFACM không hợp lệ: ${player.id}.`);
    const leagueId = club?.leagueIds[0] ?? 0;
    if (club && (!leagues.has(leagueId) || !leagues.get(leagueId)!.teamIds.includes(club.id)))
      throw new Error(`Không tìm thấy giải đấu cho CLB ${club.id}.`);
    const row: DataRow = [
      leagueId,
      club?.label ?? "",
      player.name,
      player.name,
      player.positions.join(", "),
      player.overallRating,
      player.potential,
      player.valueEur,
      player.wageEur,
      player.age,
      player.contractYear,
      player.releaseClauseEur,
      nation.label,
      player.fifaVersion,
    ];
    playerByRow.set(row, player);
    return row;
  });
  dataset.clubs.forEach((club) => {
    const memberIds = new Set(club.playerIds);
    if (
      memberIds.size !== club.playerIds.length ||
      !club.playerIds.every((id) => players.get(id)?.clubId === club.id) ||
      dataset.players.some((player) => player.clubId === club.id && !memberIds.has(player.id))
    )
      throw new Error(`Danh sách cầu thủ CLB ${club.id} không khớp.`);
  });
  const clubByName = new Map(dataset.clubs.map((club) => [club.label, club]));
  if (clubByName.size !== clubs.size) throw new Error("Tên CLB FIFACM bị trùng lặp.");
  return { rows, playerByRow, clubByName, references, snapshotDate: dataset.snapshotDate };
}
