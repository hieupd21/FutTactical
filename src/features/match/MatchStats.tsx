import type { LiveSim } from "@/engine/types";
import { eventTick } from "@/engine/liveMatch";

function StatRow({
  label,
  total: homeValue,
  awayValue,
  formatValue = (value: number) => String(value),
}: {
  label: string;
  total: number;
  awayValue: number;
  formatValue?: (value: number) => string;
}) {
  const total = homeValue + awayValue;
  const awayPower = total > 0 ? (homeValue / total) * 100 : 50;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <b className="mono">{formatValue(homeValue)}</b>
        <span>{label}</span>
        <b className="mono">{formatValue(awayValue)}</b>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <i className="block h-full bg-[var(--accent)]" style={{ width: `${awayPower}%` }} />
      </div>
    </div>
  );
}

/** Thống kê tính từ các sự kiện đã hiện ra tới tick hiện tại */
export function MatchStats({ liveSim, tick }: { liveSim: LiveSim; tick: number }) {
  const shown = liveSim.events.filter((event) => eventTick(liveSim, event) <= tick);
  const homeStrength = (sideIndex: 0 | 1) =>
    shown.filter((event) => event.side === sideIndex && (event.goal || event.miss)).length;
  const shotsOnTargetOf = (sideIndex: 0 | 1) =>
    shown.filter((event) => event.side === sideIndex && (event.goal || event.missKind === "save"))
      .length;
  const xg = (sideIndex: 0 | 1) =>
    shown
      .filter((event) => event.side === sideIndex)
      .reduce((total, event) => total + (event.expectedGoals ?? 0), 0);
  const cards = (sideIndex: 0 | 1) =>
    shown.filter((event) => event.side === sideIndex && event.card).length;
  const homePossession =
    tick > 0
      ? Math.round(
          liveSim.possessionHistory[Math.min(tick, liveSim.possessionHistory.length) - 1] * 100,
        )
      : 50;
  return (
    <div className="flex flex-col gap-2.5" role="group" aria-label="Thống kê trận đấu">
      <StatRow
        label="Kiểm soát bóng"
        total={homePossession}
        awayValue={100 - homePossession}
        formatValue={(value) => value + "%"}
      />
      <StatRow label="Cú sút" total={homeStrength(0)} awayValue={homeStrength(1)} />
      <StatRow label="Trúng đích" total={shotsOnTargetOf(0)} awayValue={shotsOnTargetOf(1)} />
      <StatRow
        label="xG (bàn thắng kỳ vọng)"
        total={xg(0)}
        awayValue={xg(1)}
        formatValue={(value) => value.toFixed(2)}
      />
      <StatRow label="Thẻ phạt" total={cards(0)} awayValue={cards(1)} />
    </div>
  );
}
