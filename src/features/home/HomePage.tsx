import { gameState } from "@/engine/state";
import { useGame, useGameVersion } from "@/stores/gameStore";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { JobOffersCard, OfferList } from "./JobOffers";
import { TodayPanel } from "./TodayPanel";
import { NewsCarousel } from "./NewsCarousel";

export function HomePage() {
  useGameVersion();
  const reset = useGame((store) => store.reset);
  if (gameState.sacked) {
    return (
      <Card className="panel min-w-0 gap-0 rounded-2xl border-white/20 bg-card/40 p-4 shadow-lg backdrop-blur-xl">
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,60fr)_minmax(0,40fr)] lg:items-center lg:gap-8">
        <TodayPanel />
        <NewsCarousel />
      </div>
      <JobOffersCard />
    </div>
  );
}
