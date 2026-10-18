import type { ReactNode } from "react";
import { POSN, PROFILES } from "@/engine/constants";
import { fmtM, fmtW } from "@/engine/format";
import { dyn, moraleLbl, ovrR } from "@/engine/players";
import { clubPlayers, squadRank } from "@/engine/squad";
import { C, me, S } from "@/engine/state";
import { contractAsk, feeEstimate, scoutRange, willingness, willLbl } from "@/engine/transfers";
import type { Player } from "@/engine/types";
import { clamp } from "@/engine/util";
import { stars } from "@/utils/display";

const grade = (v: number): [string, string] => (v >= 80 ? ["A", "g-a"] : v >= 60 ? ["B", "g-b"] : v >= 40 ? ["C", "g-c"] : ["D", "g-d"]);
function Rep({ title, score, children }: { title: string; score: number; children: ReactNode }) {
  const [g, c] = grade(score);
  return <div className="rep"><h4>{title} <span className={`grade ${c}`}>{g}</span></h4><p className="hint" style={{ color: "var(--ink)" }}>{children}</p></div>;
}

/** Báo cáo tuyển trạch 4 phần: hợp chiến thuật, tương lai, tài chính, trạng thái */
export function ScoutReport({ p }: { p: Player }) {
  const sr = squadRank(p, S.me);
  const best = clubPlayers(S.me).filter((x) => x.id !== p.id && (x.pos === p.pos || x.pos2.includes(p.pos))).sort((a, b) => dyn(b) - dyn(a))[0];
  const fitScore = clamp(100 - (sr.rank - 1) * 22 + (sr.slots >= 3 ? 5 : 0), 5, 100);
  const [lo, hi] = scoutRange(p), pr = PROFILES[p.prof];
  const futScore = clamp((hi - ovrR(p)) * 5 + (p.age <= 23 ? 30 : p.age <= 27 ? 15 : 0) + 30, 5, 100);
  const free = p.club == null;
  const est = free ? [0, 0] : feeEstimate(p);
  const ask = contractAsk(p, free ? "free" : "transfer");
  const finScore = free ? 90 : clamp(100 - (est[1] / Math.max(1, me().budget)) * 80, 5, 100);
  const w = willingness(p);
  const diff = best ? dyn(p) - dyn(best) : 0;
  return (
    <>
      <p className="hint">Độ chính xác phụ thuộc trưởng bộ phận tuyển trạch ({stars(S.scout)}).</p>
      <Rep title="Độ hợp chiến thuật" score={fitScore}>
        Nếu gia nhập, cậu ấy xếp <b>#{sr.rank}</b> trong số cầu thủ {POSN[p.pos].toLowerCase()} của bạn (sơ đồ {S.form} cần {sr.slots}). Vai trò dự kiến: <b>{sr.role}</b>.
        {best && ` So với ${best.n} (${dyn(best)}): ${diff >= 0 ? "+" : ""}${diff}.`}
      </Rep>
      <Rep title="Tương lai" score={futScore}>
        Tiềm năng ước tính <b>{lo}–{hi}</b>. Kiểu phát triển: <b>{pr.n}</b> (đỉnh cao {pr.peak[0]}–{pr.peak[1]} tuổi).
      </Rep>
      <Rep title="Đánh giá tài chính" score={finScore}>
        {free ? "Cầu thủ tự do, không mất phí chuyển nhượng." : <>Phí ước tính <b>{fmtM(est[0])}–{fmtM(est[1])}</b> (giá trị {fmtM(p.val)}).</>}{" "}
        Lương đòi khoảng <b>{fmtW(ask.wage)}</b>{p.c?.rc ? `, điều khoản giải phóng ${fmtM(p.c.rc)}` : ""}. Hợp đồng {!free && p.c ? `hết hạn 30/6/${p.c.exp}` : "không có"}.
      </Rep>
      <Rep title="Trạng thái" score={w}>
        <b>{willLbl(w)}</b>. Tinh thần {moraleLbl(p.mor).toLowerCase()}, phong độ {Math.round(p.form)}/100.
        {!free && C(p.club!).rival === S.me ? " CLB của cậu ấy là kình địch của bạn." : ""}
      </Rep>
    </>
  );
}
