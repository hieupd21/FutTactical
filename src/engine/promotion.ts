// Lên/xuống hạng cuối mùa: mỗi quốc gia có nhiều hạng được mô phỏng thì các đội cuối bảng hạng trên đổi chỗ với các đội đầu bảng hạng dưới.
import { PROMOTION_SLOTS } from "./constants";
import { mockData } from "./mockData";
import { table } from "./squad";
import { getClub, gameState, getLeague, inbox, news, simLeagues } from "./state";

interface LeagueSwap {
  clubId: string;
  fromLeagueId: string;
  toLeagueId: string;
}

/** Tính trước mọi lượt đổi chỗ từ bảng xếp hạng cuối mùa, rồi mới áp dụng, để đội vừa lên không bị xét xuống ở cặp hạng kế tiếp */
function planSwaps(): LeagueSwap[] {
  const simulatedLeagueIds = new Set(simLeagues().map((league) => league.id));
  const swaps: LeagueSwap[] = [];
  Object.values(mockData().leagues.countries).forEach((country) => {
    const tiers = country.leagues
      .filter((league) => simulatedLeagueIds.has(league.id))
      .sort((leagueA, leagueB) => leagueB.level - leagueA.level);
    for (let tierIndex = 0; tierIndex + 1 < tiers.length; tierIndex++) {
      const upperTable = table(tiers[tierIndex].id);
      const lowerTable = table(tiers[tierIndex + 1].id);
      const slotCount = Math.min(PROMOTION_SLOTS, upperTable.length, lowerTable.length);
      // chưa đá trận nào (bản lưu lạ): bỏ qua cặp hạng này
      if (!slotCount || upperTable.every((tableRow) => tableRow.played === 0)) continue;
      upperTable.slice(-slotCount).forEach((tableRow) =>
        swaps.push({
          clubId: tableRow.id,
          fromLeagueId: tiers[tierIndex].id,
          toLeagueId: tiers[tierIndex + 1].id,
        }),
      );
      lowerTable.slice(0, slotCount).forEach((tableRow) =>
        swaps.push({
          clubId: tableRow.id,
          fromLeagueId: tiers[tierIndex + 1].id,
          toLeagueId: tiers[tierIndex].id,
        }),
      );
    }
  });
  return swaps;
}

/** Áp dụng lên/xuống hạng; gọi trước khi dựng lịch đấu mùa mới */
export function applyPromotionRelegation(): void {
  const swaps = planSwaps();
  const ownLeagueIdBefore = getClub(gameState.myClubId).leagueId;
  swaps.forEach((swap) => {
    getClub(swap.clubId).leagueId = swap.toLeagueId;
  });
  swaps.forEach((swap) => {
    const club = getClub(swap.clubId);
    const isPromotion = getLeague(swap.toLeagueId).level > getLeague(swap.fromLeagueId).level;
    const involvesOwnLeague =
      swap.fromLeagueId === ownLeagueIdBefore || swap.toLeagueId === ownLeagueIdBefore;
    if (club.id === gameState.myClubId) {
      const leagueName = getLeague(swap.toLeagueId).name;
      news(
        isPromotion
          ? `${club.name} thăng hạng lên ${leagueName}.`
          : `${club.name} xuống hạng ${leagueName}.`,
        "club",
      );
      inbox({
        kind: "season",
        title: isPromotion ? "Thăng hạng!" : "Xuống hạng",
        body: isPromotion
          ? `${club.name} lên chơi ${leagueName} ở mùa tới. Ban lãnh đạo kỳ vọng giữ vững vị trí.`
          : `${club.name} phải chơi ${leagueName} ở mùa tới. Ban lãnh đạo yêu cầu lên hạng ngay.`,
      });
    } else if (involvesOwnLeague)
      news(
        isPromotion
          ? `${club.name} thăng hạng lên ${getLeague(swap.toLeagueId).name}.`
          : `${club.name} xuống hạng ${getLeague(swap.toLeagueId).name}.`,
        "club",
      );
  });
  summarizeForOwnLeague(swaps, ownLeagueIdBefore);
  // kình địch phải cùng giải: đội đổi hạng chọn lại theo sức mạnh gần nhất
  const clubs = Object.values(gameState.clubs);
  clubs.forEach((club) => {
    const rivalLeagueId = club.rival ? gameState.clubs[club.rival]?.leagueId : null;
    if (rivalLeagueId === club.leagueId) return;
    club.rival =
      clubs
        .filter((otherClub) => otherClub.leagueId === club.leagueId && otherClub.id !== club.id)
        .sort(
          (clubA, clubB) =>
            Math.abs(clubA.strength - club.strength) - Math.abs(clubB.strength - club.strength),
        )[0]?.id ?? null;
  });
}

/** Thư tổng kết: các đội lên/xuống hạng ở giải của bạn và hạng kề nó */
function summarizeForOwnLeague(swaps: LeagueSwap[], ownLeagueIdBefore: string): void {
  const relatedSwaps = swaps.filter(
    (swap) => swap.fromLeagueId === ownLeagueIdBefore || swap.toLeagueId === ownLeagueIdBefore,
  );
  if (!relatedSwaps.length) return;
  const isPromotion = (swap: LeagueSwap): boolean =>
    getLeague(swap.toLeagueId).level > getLeague(swap.fromLeagueId).level;
  const namesOf = (swapsToList: LeagueSwap[]): string =>
    swapsToList.map((swap) => getClub(swap.clubId).name).join(", ");
  const leagueIds = [
    ...new Set(relatedSwaps.flatMap((swap) => [swap.fromLeagueId, swap.toLeagueId])),
  ];
  const lines = leagueIds.flatMap((leagueId) => {
    const promoted = relatedSwaps.filter(
      (swap) => isPromotion(swap) && swap.toLeagueId === leagueId,
    );
    const relegated = relatedSwaps.filter(
      (swap) => !isPromotion(swap) && swap.fromLeagueId === leagueId,
    );
    return [
      ...(promoted.length ? [`Lên ${getLeague(leagueId).name}: ${namesOf(promoted)}.`] : []),
      ...(relegated.length ? [`Rớt khỏi ${getLeague(leagueId).name}: ${namesOf(relegated)}.`] : []),
    ];
  });
  inbox({ kind: "season", title: "Tổng kết lên/xuống hạng", body: lines.join(" ") });
}
