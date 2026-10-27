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

/** Thông tin hiển thị từ FIFACM mà cầu thủ trong game không lưu (không nằm trong bản lưu) */
export interface PlayerProfile {
  skillMoves: number | null;
  weakFoot: number | null;
  preferredFoot: string | null;
  heightCm: number | null;
  /** 34 chỉ số chi tiết của FIFACM (tên camelCase như trong players.json) */
  attributes: Record<string, number> | null;
  playStyles: { name: string; isPlus: boolean }[];
  /** chỉ số của cầu thủ ở từng vị trí (ST, CAM, CB...) */
  positionRatings: Record<string, number>;
  /** tốc độ công / thủ, ví dụ "M / M" */
  workRates: string | null;
  /** danh hiệu năng khiếu (Speedster, Poacher...) */
  specialities: string[];
}

export interface MockData {
  playerImageUrlBySourceId: Record<number, string>;
  playerProfileBySourceId: Record<number, PlayerProfile>;
  nationalities: {
    shortNameByCode: Record<string, string>;
    codeByDataName: Record<string, string>;
    /** ảnh cờ quốc gia của FIFACM theo mã quốc tịch; quốc gia không có ảnh thì không có khóa */
    flagUrlByCode: Record<string, string>;
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
