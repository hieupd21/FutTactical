import { SEASON_LEN } from "@/engine/constants";
import { gameState } from "@/engine/state";
import { formatShortDate } from "@/utils/display";
import { NEWS_KIND_LABEL } from "./newsKinds";

const NEWS_WINDOW_DAYS = 7;

/** Số ngày game từ lúc tin xuất hiện tới hôm nay (qua ranh giới mùa vẫn đúng) */
const newsAgeInDays = (news: { day: number; year: number }): number =>
  (gameState.year - news.year) * SEASON_LEN + gameState.day - news.day;

/** Khối phải: tin trong 7 ngày qua, mới nhất ở trên */
export function WeeklyNews() {
  const recentNews = gameState.news.filter((newsItem) => {
    const age = newsAgeInDays(newsItem);
    return age >= 0 && age < NEWS_WINDOW_DAYS;
  });
  return (
    <section className="flex min-h-0 flex-col gap-4 py-2 lg:border-l lg:border-foreground/15 lg:pl-8">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 font-(family-name:--f-display) text-xl font-extrabold">
          Tin tức 7 ngày qua
        </h3>
        <span className="text-sm text-muted-foreground tabular-nums">{recentNews.length} tin</span>
      </div>
      {recentNews.length ? (
        <ul className="m-0 flex max-h-136 list-none flex-col divide-y divide-white/15 overflow-y-auto p-0 scrollbar-thin">
          {recentNews.map((newsItem, newsIndex) => (
            <li key={newsIndex} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 py-3">
              <span className="pt-0.5 text-sm font-semibold text-muted-foreground tabular-nums">
                {formatShortDate(newsItem.day)}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-(--accent)">
                  {NEWS_KIND_LABEL[newsItem.kind]}
                </span>
                <p className="m-0 text-[15px] leading-snug">{newsItem.text}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 py-8 text-center text-muted-foreground">
          Tuần qua chưa có tin nào. Tiếp tục để thế giới chuyển động.
        </p>
      )}
    </section>
  );
}
