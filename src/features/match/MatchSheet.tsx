import { C, P, S } from "@/engine/state";
import type { MatchEvent } from "@/engine/types";
import { ClubBadge } from "@/components/ClubBadge";
import { Sheet } from "@/components/Sheet";
import { closeMatch, skipMatch } from "@/stores/matchFlow";
import { useUi } from "@/stores/uiStore";
import { sn } from "@/utils/display";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";

const MISS = ["thủ môn cản phá", "bóng đi chệch cột", "hậu vệ chặn kịp"];
const nm = (id?: string) => (id && P(id) ? sn(P(id).n) : "?");

function line(e: MatchEvent, i: number, home: string, away: string): string {
  if (e.goal) return `VÀO! ${nm(e.goal)} ghi bàn cho ${C(e.s ? away : home).n}`;
  if (e.miss) return `${nm(e.miss)} dứt điểm, ${MISS[(e.m + i) % MISS.length]}`;
  if (e.card) return `${nm(e.card)} nhận thẻ vàng`;
  if (e.inj) return `${nm(e.inj)} dính chấn thương (${e.days} ngày)`;
  return "";
}

/** Trận đấu: diễn biến chạy theo phút, sau đó là điểm số cầu thủ */
export function MatchSheet() {
  const M = useUi((s) => s.match);
  if (!M) return null;
  const m = M.m;
  const shown = m.ev.map((e, i) => ({ e, i })).filter(({ e }) => e.m <= M.min);
  const hg = shown.filter(({ e }) => e.goal && e.s === 0).length,
    ag = shown.filter(({ e }) => e.goal && e.s === 1).length;
  const myXI = (m.h === S.me ? m.xh : m.xa).map((id) => (id ? P(id) : null)).filter(Boolean);
  return (
    <Sheet onClose={M.done ? closeMatch : undefined}>
      <div className="grab" />
      <div className="board">
        <div className="tm r">
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <ClubBadge name={C(m.h).n} size={36} />
          </div>
          {C(m.h).n}
        </div>
        <div>
          <div className="sc">
            {hg}–{ag}
          </div>
          <div className="min">{M.done ? "KẾT THÚC" : M.min + "'"}</div>
        </div>
        <div className="tm">
          <div>
            <ClubBadge name={C(m.a).n} size={36} />
          </div>
          {C(m.a).n}
        </div>
      </div>
      {!M.done && (
        <Button variant="ghost" size="sm" style={{ alignSelf: "flex-start" }} onClick={skipMatch}>
          Xem kết quả ngay
        </Button>
      )}
      <div className="feed" aria-live="polite">
        {shown.length ? (
          shown
            .slice()
            .reverse()
            .map(({ e, i }) => (
              <div key={i} className={`ev ${e.goal ? "goal" : ""}`}>
                <span className="m">{e.m}'</span>
                <span>{line(e, i, m.h, m.a)}</span>
              </div>
            ))
        ) : (
          <p className="hint">Trọng tài nổi còi khai cuộc…</p>
        )}
      </div>
      {M.done && (
        <>
          <h3>Điểm số cầu thủ</h3>
          <div className="plist">
            {myXI.map((p) => (
              <div key={p!.id} className="row between" style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                <span>
                  <Badge variant="pos" className={`pos ${p!.pos}`}>
                    {p!.pos}
                  </Badge>{" "}
                  {p!.n}
                </span>
                <b className="mono">{p!.lastR ?? "-"}</b>
              </div>
            ))}
          </div>
          <Button variant="hot" className="w-full" onClick={closeMatch}>
            Tiếp tục
          </Button>
        </>
      )}
    </Sheet>
  );
}
