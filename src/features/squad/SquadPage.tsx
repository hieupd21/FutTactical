import { m, useReducedMotion } from "framer-motion";
import { type ReactNode, useState } from "react";
import { autoLineup, setFormation, swapInto } from "@/engine/actions";
import { FORMS } from "@/engine/constants";
import { pickBench } from "@/engine/liveMatch";
import { dynamicRating } from "@/engine/players";
import { clubPlayers, clubStrength, myLineup } from "@/engine/squad";
import { getPlayer, gameState } from "@/engine/state";
import type { Formation, Player } from "@/engine/types";
import { commit, useGameVersion } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { Button } from "@/components/shadcn/button";
import { SelectField } from "@/components/ui";
import { GlassPanel } from "@/components/GlassPanel";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { shortName } from "@/utils/display";
import { PlayerCard, useCardSize } from "./PlayerCard";
import { PlayerDetailPanel } from "./PlayerDetailPanel";
import { PitchView } from "./PitchView";
import "./pitch.css";

const ORDER = "GKDFMFFW";

/** Dòng tiêu đề của một nhóm trong khối dự bị (đang cho mượn) */
function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="col-span-full m-0 mt-1 text-xs font-semibold text-muted-foreground">{children}</p>
  );
}

export function SquadPage() {
  useGameVersion();
  const { swapIn, setSwapIn } = useUi();
  const [chosenPlayerId, setChosenPlayerId] = useState<string | null>(null);
  const isWideScreen = useMediaQuery("(min-width: 1024px)");
  const cardSize = useCardSize();
  const shouldReduceMotion = useReducedMotion();
  const lineup = myLineup(),
    teamStrength = clubStrength(gameState.myClubId);
  const players = clubPlayers(gameState.myClubId);
  const benchIds = pickBench(gameState.myClubId, lineup);
  const byPositionThenRating = (playerA: Player, playerB: Player) =>
    ORDER.indexOf(playerA.pos) - ORDER.indexOf(playerB.pos) ||
    dynamicRating(playerB) - dynamicRating(playerA);
  const bench = benchIds.map((id) => getPlayer(id)).sort(byPositionThenRating);
  const reserves = players
    .filter((player) => !lineup.includes(player.id) && !benchIds.includes(player.id))
    .sort(byPositionThenRating);
  const loanedOut = Object.values(gameState.players).filter(
    (player) => player.homeClub === gameState.myClubId,
  );
  // Vào màn hình là có sẵn một cầu thủ được chọn (người đá chính có chỉ số cao nhất), panel thông số luôn hiện
  const defaultPlayerId = lineup
    .flatMap((id) => (id ? [getPlayer(id)] : []))
    .sort((playerA, playerB) => dynamicRating(playerB) - dynamicRating(playerA))[0]?.id;
  const selectedPlayerId =
    chosenPlayerId && gameState.players[chosenPlayerId]
      ? chosenPlayerId
      : (defaultPlayerId ?? null);
  const selectedPlayer = selectedPlayerId ? gameState.players[selectedPlayerId] : null;

  const selectPlayer = (player: Player) => setChosenPlayerId(player.id);
  const onSlot = (slotIndex: number, player: Player | null) => {
    if (swapIn) {
      commit(() => swapInto(swapIn, slotIndex));
      setSwapIn(null);
      toast("Đã cập nhật đội hình.");
    } else if (player) selectPlayer(player);
  };
  const onBench = (player: Player) => {
    if (swapIn) toast("Hãy chọn một cầu thủ trong đội hình ra sân để thay.");
    else selectPlayer(player);
  };
  const benchCard = (player: Player) => (
    <PlayerCard
      key={player.id}
      player={player}
      positionLabel={player.pos}
      isSelected={player.id === selectedPlayerId}
      isTarget={!!swapIn}
      onClick={() => onBench(player)}
    />
  );

  const detailPanel = selectedPlayer && (
    <m.div
      key={selectedPlayer.id}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <PlayerDetailPanel player={selectedPlayer} />
    </m.div>
  );

  return (
    <div
      style={
        {
          "--card-width": `${cardSize.width}px`,
          "--card-height": `${cardSize.height}px`,
        } as React.CSSProperties
      }
      className="flex flex-col lg:h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]"
    >
      <div className="flex min-h-0 flex-1 items-stretch gap-6">
        <div className="flex min-h-0 w-full shrink-0 flex-col gap-6 py-1 lg:w-[calc(6*var(--card-width)+5*1.5rem+1.5rem+2rem)]">
          {swapIn && (
            <div className="swapbar">
              <span>
                Chọn vị trí trong đội hình cho <b>{shortName(getPlayer(swapIn).name)}</b>
              </span>
              <Button variant="onAccent" size="sm" onClick={() => setSwapIn(null)}>
                Hủy
              </Button>
            </div>
          )}
          <div className="flex shrink-0 flex-wrap items-end gap-x-2 gap-y-1 sm:gap-x-3">
            <SelectField
              label="Sơ đồ"
              value={gameState.form}
              onChange={(formation) => commit(() => setFormation(formation as Formation))}
              options={Object.keys(FORMS).map((formationName): [string, string] => [
                formationName,
                formationName,
              ])}
              style={{ width: "7rem" }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                commit(autoLineup);
                toast("Đã xếp đội hình mạnh nhất.");
              }}
            >
              Tự xếp mạnh nhất
            </Button>
            <div className="ml-auto flex gap-2 self-center text-sm text-muted-foreground">
              <span>
                Công <b className="text-foreground tabular-nums">{Math.round(teamStrength.att)}</b>
              </span>
              <span>
                Thủ <b className="text-foreground tabular-nums">{Math.round(teamStrength.def)}</b>
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <PitchView
              className="h-144 sm:h-168 lg:h-full"
              lineup={lineup}
              selectedPlayerId={selectedPlayerId}
              isChoosingSlot={!!swapIn}
              onSelectSlot={onSlot}
            />
          </div>

          {!isWideScreen && detailPanel && (
            <GlassPanel aria-label="Thông số cầu thủ" className="p-5">
              {detailPanel}
            </GlassPanel>
          )}

          <GlassPanel className="squad-bench flex shrink-0 flex-col gap-2 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="m-0 text-sm whitespace-nowrap">Dự bị và đội hình phụ</h2>
              <span className="text-xs text-muted-foreground">
                {bench.length + reserves.length} cầu thủ
              </span>
            </div>
            {/* Desktop: khối luôn cao đúng 2 hàng thẻ, nhiều hơn thì cuộn dọc trong khối. Điện thoại: hiện hết, cuộn cùng trang */}
            <div className="grid auto-rows-(--card-height) grid-cols-6 justify-items-center gap-x-6 gap-y-1.5 lg:max-h-[calc(2*var(--card-height)+0.375rem)] lg:grid-cols-[repeat(6,var(--card-width))] lg:justify-between lg:px-3 lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:scrollbar-thin">
              {bench.map(benchCard)}
              {reserves.map(benchCard)}
              {loanedOut.length > 0 && (
                <>
                  <GroupLabel>Đang cho mượn · {loanedOut.length} cầu thủ</GroupLabel>
                  {loanedOut.map(benchCard)}
                </>
              )}
            </div>
          </GlassPanel>
        </div>

        {isWideScreen && detailPanel && (
          <aside aria-label="Thông số cầu thủ" className="min-w-0 flex-1 py-1">
            <GlassPanel className="h-full overflow-y-auto p-4">{detailPanel}</GlassPanel>
          </aside>
        )}
      </div>
    </div>
  );
}
