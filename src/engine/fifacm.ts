import type { MockData } from "./mockData";
import type { DataRow, Formation, Line } from "./types";

export function fifacmPositionLine(position: string): Line {
  if (position === "GK") return "GK";
  if (/^(?:[LR]?CB|[LR]W?B)$/.test(position)) return "DF";
  if (/^(?:ST|[LR]S|CF|[LR]F|[LR]W)$/.test(position)) return "FW";
  return "MF";
}

export interface FifacmNation {
  id: number;
  label: string;
  imageUrl: string | null;
}

export interface FifacmPlayer {
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

export interface FifacmClub {
  id: number;
  label: string;
  imageUrl: string | null;
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

export interface FifacmLeague {
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

/** Join provider IDs without merging in player data from the former FC26/FC27 pack. */
export function createFifacmPack(dataset: FifacmDataset, defaults: MockData): FifacmPack {
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

  const countries = Object.fromEntries(
    Object.entries(defaults.leagues.countries).map(([code, country]) => [
      code,
      { ...country, leagues: country.leagues.filter((league) => leagues.has(league.packId)) },
    ]),
  );
  const configuredIds = new Set(
    Object.values(countries).flatMap((country) => country.leagues.map((league) => league.packId)),
  );
  const otherLeagues = dataset.leagues.filter((league) => !configuredIds.has(league.id));
  if (otherLeagues.length)
    countries.XX = {
      name: "Các giải khác",
      leagues: otherLeagues.map((league) => ({
        packId: league.id,
        id: `fifacm-${league.id}`,
        name: league.label,
        level: 2,
        isSimulated: false,
      })),
    };
  const nationalities = {
    ...defaults.nationalities,
    shortNameByCode: { ...defaults.nationalities.shortNameByCode },
    codeByDataName: { ...defaults.nationalities.codeByDataName },
  };
  dataset.nations.forEach((nation) => {
    const code = nationalities.codeByDataName[nation.label] ?? `nation-${nation.id}`;
    nationalities.codeByDataName[nation.label] = code;
    nationalities.shortNameByCode[code] ??= nation.label;
  });
  const references: MockData = {
    ...defaults,
    playerImageUrlBySourceId: Object.fromEntries(
      dataset.players.flatMap((player) =>
        player.avatarUrl ? [[player.id, player.avatarUrl]] : [],
      ),
    ),
    clubVisuals: {
      ...defaults.clubVisuals,
      imageUrlByName: Object.fromEntries(
        dataset.clubs.flatMap((club) => (club.imageUrl ? [[club.label, club.imageUrl]] : [])),
      ),
    },
    nationalities,
    leagues: { ...defaults.leagues, countries },
  };
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
