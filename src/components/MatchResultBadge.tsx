import { classNames } from "@/utils/display";

const OUTCOME_CLASS = {
  W: "bg-(--win)",
  D: "bg-(--draw)",
  L: "bg-(--loss)",
} as const;

/** Tỷ số (góc nhìn CLB bạn) kèm huy hiệu tròn W/D/L */
export function MatchResultBadge({
  result,
  size = "md",
}: {
  result: { ownGoals: number; opponentGoals: number; outcome: "W" | "D" | "L" };
  size?: "md" | "lg";
}) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span
        className={classNames(
          "grid place-items-center rounded-full font-bold leading-none text-background",
          OUTCOME_CLASS[result.outcome],
          size === "lg" ? "size-7 text-sm" : "size-5 text-[10px]",
        )}
      >
        {result.outcome}
      </span>
      <b className={classNames("tabular-nums", size === "lg" ? "text-xl" : "text-sm")}>
        {result.ownGoals}–{result.opponentGoals}
      </b>
    </span>
  );
}
