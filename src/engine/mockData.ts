// Kho dữ liệu mock (tên, quốc tịch, giải đấu, màu CLB) do lib/mockData.ts nạp từ public/data/*.json một lần khi khởi động.
// Engine chỉ đọc qua mockData(); không viết bảng dữ liệu trực tiếp trong code.
import type { League, Line } from "./types";

export type LeagueInfo = Omit<
  League,
  "foreignRatio" | "importNationalities" | "clubs" | "nationality"
> & {
  /** Mã giải trong cột league_id của gói cầu thủ */
  packId: number;
  /** Giải chỉ dựng khi gói dữ liệu có CLB của giải đó */
  isOptional?: boolean;
};
export interface CountryInfo {
  name: string;
  leagues: LeagueInfo[];
}

export interface MockData {
  nationalities: {
    shortNameByCode: Record<string, string>;
    codeByDataName: Record<string, string>;
    vietnameseNameByDataName: Record<string, string>;
    positionLine: Record<string, Line>;
  };
  leagues: {
    /** Giải thật nhóm theo quốc gia (khóa là mã quốc tịch), từ hạng cao xuống thấp */
    countries: Record<string, CountryInfo>;
    rivals: [string, string][];
  };
  clubVisuals: {
    colors: Record<string, [string, string]>;
    shortCodes: Record<string, string>;
  };
}

let loaded: MockData | null = null;

export function setMockData(data: MockData | null): void {
  loaded = data;
}

export function mockData(): MockData {
  if (!loaded) throw new Error("Dữ liệu mock chưa được nạp (gọi loadMockData trước).");
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
