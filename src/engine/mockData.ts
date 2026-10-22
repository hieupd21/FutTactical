// Kho tham chiếu (quốc tịch, giải đấu, màu và ảnh CLB) dựng từ data/fifacm bởi createFifacmPack, đặt vào đây khi nạp gói FIFACM.
// Engine chỉ đọc qua mockData(); không viết bảng dữ liệu trực tiếp trong code.
import type { League } from "./types";

export type LeagueInfo = Omit<
  League,
  "foreignRatio" | "importNationalities" | "clubs" | "nationality"
> & {
  /** ID giải trong dữ liệu FIFACM (cột league_id của DataRow) */
  packId: number;
};
interface CountryInfo {
  name: string;
  leagues: LeagueInfo[];
}

export interface MockData {
  playerImageUrlBySourceId: Record<number, string>;
  nationalities: {
    shortNameByCode: Record<string, string>;
    codeByDataName: Record<string, string>;
  };
  leagues: {
    /** Giải nhóm theo quốc gia (khóa là mã quốc tịch), từ mạnh xuống yếu */
    countries: Record<string, CountryInfo>;
  };
  clubVisuals: {
    imageUrlByName: Record<string, string>;
    colors: Record<string, [string, string]>;
  };
}

let loaded: MockData | null = null;

export function setMockData(data: MockData | null): void {
  loaded = data;
}

export function mockData(): MockData {
  if (!loaded) throw new Error("Dữ liệu mock chưa được nạp (gọi loadPack trước).");
  return loaded;
}

/** Mọi giải thật kèm mã quốc gia, theo thứ tự quốc gia rồi hạng đấu */
export function allLeagueInfos(): (LeagueInfo & { nationality: string })[] {
  return Object.entries(mockData().leagues.countries).flatMap(([nationality, country]) =>
    country.leagues.map((league) => ({ ...league, nationality })),
  );
}

export const findLeagueByPackId = (packId: number) =>
  allLeagueInfos().find((league) => league.packId === packId);
