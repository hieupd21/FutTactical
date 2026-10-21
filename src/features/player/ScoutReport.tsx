import type { ReactNode } from "react";
import { POSITION_NAMES, PROFILES } from "@/engine/constants";
import { formatMoney, formatWage } from "@/engine/format";
import { dynamicRating, moraleLabel, ovrRange } from "@/engine/players";
import { clubPlayers, squadRank } from "@/engine/squad";
import { getClub, myClub, gameState } from "@/engine/state";
import {
  contractAsk,
  feeEstimate,
  scoutRange,
  willingness,
  willingnessLabel,
} from "@/engine/transfers";
import type { Player } from "@/engine/types";
import { clamp } from "@/engine/util";
import { stars } from "@/utils/display";

const grade = (score: number): [string, string] =>
  score >= 80
    ? ["A", "g-a"]
    : score >= 60
      ? ["B", "g-b"]
      : score >= 40
        ? ["C", "g-c"]
        : ["D", "g-d"];
function ScoreRow({
  title,
  score,
  children,
}: {
  title: string;
  score: number;
  children: ReactNode;
}) {
  const [gradeLetter, gradeClass] = grade(score);
  return (
    <div className="rep">
      <h4>
        {title} <span className={`grade ${gradeClass}`}>{gradeLetter}</span>
      </h4>
      <p className="hint" style={{ color: "var(--ink)" }}>
        {children}
      </p>
    </div>
  );
}

/** Báo cáo tuyển trạch 4 phần: hợp chiến thuật, tương lai, tài chính, trạng thái */
export function ScoutReport({ player }: { player: Player }) {
  const squadStanding = squadRank(player, gameState.myClubId);
  const best = clubPlayers(gameState.myClubId)
    .filter(
      (teammate) =>
        teammate.id !== player.id &&
        (teammate.pos === player.pos || teammate.secondaryPositions.includes(player.pos)),
    )
    .sort((playerA, playerB) => dynamicRating(playerB) - dynamicRating(playerA))[0];
  const fitScore = clamp(
    100 - (squadStanding.rank - 1) * 22 + (squadStanding.slots >= 3 ? 5 : 0),
    5,
    100,
  );
  const [low, high] = scoutRange(player),
    profile = PROFILES[player.profile];
  const futScore = clamp(
    (high - ovrRange(player)) * 5 + (player.age <= 23 ? 30 : player.age <= 27 ? 15 : 0) + 30,
    5,
    100,
  );
  const free = player.club == null;
  const estimate = free ? [0, 0] : feeEstimate(player);
  const contractOffer = contractAsk(player, free ? "free" : "transfer");
  const finScore = free
    ? 90
    : clamp(100 - (estimate[1] / Math.max(1, myClub().budget)) * 80, 5, 100);
  const willingnessScore = willingness(player);
  const diff = best ? dynamicRating(player) - dynamicRating(best) : 0;
  return (
    <>
      <p className="hint">
        Độ chính xác phụ thuộc trưởng bộ phận tuyển trạch ({stars(gameState.scout)}).
      </p>
      <ScoreRow title="Độ hợp chiến thuật" score={fitScore}>
        Nếu gia nhập, cậu ấy xếp <b>#{squadStanding.rank}</b> trong số cầu thủ{" "}
        {POSITION_NAMES[player.pos].toLowerCase()} của bạn (sơ đồ {gameState.form} cần{" "}
        {squadStanding.slots}). Vai trò dự kiến: <b>{squadStanding.role}</b>.
        {best && ` So với ${best.name} (${dynamicRating(best)}): ${diff >= 0 ? "+" : ""}${diff}.`}
      </ScoreRow>
      <ScoreRow title="Tương lai" score={futScore}>
        Tiềm năng ước tính{" "}
        <b>
          {low}–{high}
        </b>
        . Kiểu phát triển: <b>{profile.label}</b> (đỉnh cao {profile.peak[0]}–{profile.peak[1]}{" "}
        tuổi).
      </ScoreRow>
      <ScoreRow title="Đánh giá tài chính" score={finScore}>
        {free ? (
          "Cầu thủ tự do, không mất phí chuyển nhượng."
        ) : (
          <>
            Phí ước tính{" "}
            <b>
              {formatMoney(estimate[0])}–{formatMoney(estimate[1])}
            </b>{" "}
            (giá trị {formatMoney(player.marketValue)}).
          </>
        )}{" "}
        Lương đòi khoảng <b>{formatWage(contractOffer.wage)}</b>
        {player.contract?.releaseClause
          ? `, điều khoản giải phóng ${formatMoney(player.contract.releaseClause)}`
          : ""}
        . Hợp đồng{" "}
        {!free && player.contract ? `hết hạn 30/6/${player.contract.expiryYear}` : "không có"}.
      </ScoreRow>
      <ScoreRow title="Trạng thái" score={willingnessScore}>
        <b>{willingnessLabel(willingnessScore)}</b>. Tinh thần{" "}
        {moraleLabel(player.morale).toLowerCase()}, phong độ {Math.round(player.form)}/100.
        {!free && getClub(player.club!).rival === gameState.myClubId
          ? " CLB của cậu ấy là kình địch của bạn."
          : ""}
        {player.interest &&
        gameState.day - player.interest.day >= 0 &&
        gameState.day - player.interest.day < 60
          ? " Cậu ấy đã công khai bày tỏ thiện cảm với CLB bạn."
          : ""}
      </ScoreRow>
    </>
  );
}
