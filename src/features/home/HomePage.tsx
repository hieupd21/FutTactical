import { gameState } from "@/engine/state";
import { useGame, useGameVersion } from "@/stores/gameStore";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { JobOffersCard, OfferList } from "./JobOffers";
import { TodayPanel } from "./TodayPanel";
import { WeeklyNews } from "./WeeklyNews";

export function HomePage() {
  useGameVersion();
  const reset = useGame((store) => store.reset);
  if (gameState.sacked) {
    return (
      <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
        <h2>Bạn đã bị sa thải</h2>
        <p>{gameState.sacked}</p>
        {(gameState.offers ?? []).length > 0 ? (
          <>
            <p className="hint">
              Uy tín của bạn giảm, nhưng vẫn có CLB chịu giao ghế. Nhận một lời mời để tiếp tục sự
              nghiệp:
            </p>
            <OfferList sacked />
          </>
        ) : (
          <p className="hint">Sự nghiệp kéo dài {gameState.seasonLog.length} mùa giải.</p>
        )}
        <Button variant="ghost" onClick={() => void reset()}>
          Bắt đầu sự nghiệp mới
        </Button>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
        <TodayPanel />
        <WeeklyNews />
      </div>
      <JobOffersCard />
    </div>
  );
}
