import { useState } from "react";
import { BUDGET_STEP, hireScout, reallocate, scoutCost, WAGE_STEP } from "@/engine/actions";
import { myWages, objectiveStatus } from "@/engine/board";
import { myReputation, repLabel } from "@/engine/career";
import { formatMoney, formatWage } from "@/engine/format";
import { myClub, gameState } from "@/engine/state";
import { KeyValueRows } from "@/components/ui";
import { commit, useGame, useGameVersion } from "@/stores/gameStore";
import { toast } from "@/stores/uiStore";
import { formatShortDate, stars } from "@/utils/display";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";

function Board() {
  const confC =
    gameState.boardConfidence >= 60
      ? "var(--win)"
      : gameState.boardConfidence >= 35
        ? "var(--gold-ink)"
        : "var(--loss)";
  const totalWages = myWages(),
    liab = gameState.liabilities.filter((liability) => liability.amount > 0),
    recv = gameState.liabilities.filter((liability) => liability.amount < 0);
  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h2>Ban lãnh đạo</h2>
      <div>
        <div className="row between">
          <span>Niềm tin</span>
          <b className="mono">{Math.round(gameState.boardConfidence)}/100</b>
        </div>
        <div className="conf">
          <i style={{ width: `${gameState.boardConfidence}%`, background: confC }} />
        </div>
        <div className="row between">
          <span>Uy tín HLV</span>
          <b className="mono">
            {Math.round(myReputation())}/100 · {repLabel(myReputation())}
          </b>
        </div>
        <p className="hint">Dưới 12 điểm giữa mùa hoặc dưới 15 khi tổng kết, bạn sẽ bị sa thải.</p>
      </div>
      {gameState.board.objectives.map((objective) => {
        const status = objectiveStatus(objective);
        return (
          <div key={objective.kind} className="obj">
            <span>
              <b>{objective.label}</b>
              <br />
              <span className="hint">{objective.importance}</span>
            </span>
            <span className={`st ${status.pending ? "" : status.ok ? "ok" : "no"}`}>
              {status.pending ? "Chưa bắt đầu" : status.ok ? "Đang đạt" : "Chưa đạt"}
            </span>
            <span className="hint" style={{ gridColumn: "1/-1" }}>
              {status.text}
            </span>
          </div>
        );
      })}
      <h2>Tài chính</h2>
      <KeyValueRows
        rows={[
          ["Ngân sách chuyển nhượng", formatMoney(myClub().budget)],
          ["Tổng lương", formatWage(totalWages)],
          ["Quỹ lương", formatWage(gameState.wageCap)],
          [
            "Còn trống",
            formatWage(gameState.wageCap - totalWages),
            totalWages > gameState.wageCap ? "no" : "ok",
          ],
        ]}
      />
      <div className="col" style={{ gap: 6 }}>
        <h3>Điều chỉnh ngân sách</h3>
        <p className="hint">
          {formatMoney(BUDGET_STEP)} ngân sách chuyển nhượng ↔ {formatWage(WAGE_STEP)} quỹ lương.
        </p>
        <div className="row">
          <Button
            variant="ghost"
            size="sm"
            disabled={myClub().budget < BUDGET_STEP}
            onClick={() => commit(() => reallocate("toWage"))}
          >
            {formatMoney(BUDGET_STEP)} → quỹ lương
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={gameState.wageCap - totalWages < WAGE_STEP}
            onClick={() => commit(() => reallocate("toFee"))}
          >
            Quỹ lương → {formatMoney(BUDGET_STEP)}
          </Button>
        </div>
      </div>
      {(liab.length > 0 || recv.length > 0) && (
        <>
          <h3>Các khoản trả góp</h3>
          <KeyValueRows
            rows={[
              ...liab.map((liability): [string, string, string] => [
                `Trả ${liability.toClub} (mùa ${liability.year})`,
                "−" + formatMoney(liability.amount),
                "no",
              ]),
              ...recv.map((liability): [string, string, string] => [
                `Nhận từ ${liability.toClub} (mùa ${liability.year})`,
                "+" + formatMoney(-liability.amount),
                "ok",
              ]),
            ]}
          />
        </>
      )}
    </Card>
  );
}

function Staff() {
  const reset = useGame((store) => store.reset);
  const [confirm, setConfirm] = useState(false);
  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h2>Nhân sự</h2>
      <div className="obj">
        <span>
          <b>Trưởng bộ phận tuyển trạch</b>
          <br />
          <span className="hint">
            Càng giỏi, ước tính tiềm năng và giá chuyển nhượng càng chính xác.
          </span>
        </span>
        <span className="stars">{stars(gameState.scout)}</span>
      </div>
      {gameState.scout < 5 && (
        <Button
          variant="ghost"
          size="sm"
          disabled={myClub().budget < scoutCost()}
          onClick={() => toast(commit(hireScout)!)}
        >
          Thuê người giỏi hơn · {formatMoney(scoutCost())}
        </Button>
      )}
      <h2>Lịch sử</h2>
      {gameState.seasonLog.length ? (
        gameState.seasonLog.map((season) => (
          <div key={season.year} className="row between">
            <span>
              Mùa {season.year}/{season.year + 1}
            </span>
            <b>Hạng {season.position ?? "—"}</b>
          </div>
        ))
      ) : (
        <p className="hint">Mùa giải đầu tiên.</p>
      )}
      <h2>Tin CLB</h2>
      {gameState.news
        .filter((newsItem) => newsItem.kind === "club")
        .slice(0, 10)
        .map((newsItem, i) => (
          <p key={i} className="hint" style={{ color: "var(--ink)" }}>
            {formatShortDate(newsItem.day)} · {newsItem.text}
          </p>
        ))}
      <p className="hint">Dữ liệu: {gameState.dataSource}</p>
      {confirm ? (
        <div className="row">
          <span>Xóa sự nghiệp hiện tại?</span>
          <Button variant="hot" size="sm" onClick={() => void reset()}>
            Xóa
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
            Hủy
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
          Bắt đầu lại
        </Button>
      )}
    </Card>
  );
}

export function ClubPage() {
  useGameVersion();
  return (
    <div className="grid2">
      <Board />
      <div className="col">
        <Staff />
      </div>
    </div>
  );
}
