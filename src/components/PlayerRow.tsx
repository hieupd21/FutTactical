import type { ReactNode } from "react";
import { fmtM } from "@/engine/format";
import { dyn, moraleLbl, ovrR, yearsLeft } from "@/engine/players";
import { C, S } from "@/engine/state";
import type { Player } from "@/engine/types";
import { cx, mcol } from "@/utils/display";
import { Avatar } from "./Avatar";
import { ClubBadge } from "./ClubBadge";

export function FitBar({ fit }: { fit: number }) {
  return (
    <span className="fit">
      <i className={fit < 70 ? "low" : ""} style={{ width: `${fit}%` }} />
    </span>
  );
}

/** Một dòng cầu thủ trong danh sách */
export function PlayerRow({ p, right, cls, onClick }: { p: Player; right?: ReactNode; cls?: string; onClick: () => void }) {
  const d = dyn(p),
    diff = d - ovrR(p);
  const mine = p.club === S.me;
  const rt =
    right ??
    (mine ? (
      <>
        <FitBar fit={p.fit} />
        <span>{moraleLbl(p.mor)}</span>
      </>
    ) : (
      <>
        <b>{fmtM(p.val)}</b>
        <span className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
          {p.club != null ? (
            <>
              <ClubBadge name={C(p.club).n} size={16} />
              {C(p.club).n}
            </>
          ) : (
            "Tự do"
          )}
        </span>
      </>
    ));
  return (
    <button className={cx("prow", cls)} onClick={onClick}>
      <span className="ovr">
        {d}
        <small>{diff ? (diff > 0 ? "+" : "") + diff : "·"}</small>
      </span>
      <Avatar p={p} size={36} />
      <span>
        <span className="nm">{p.n}</span>
        <span className="sub">
          <span className={`pos ${p.pos}`}>{p.pos}</span>
          {p.pos2.map((x) => (
            <span key={x} className={`pos ${x}`} style={{ opacity: 0.55 }}>
              {x}
            </span>
          ))}
          <span>{p.age} tuổi</span>
          <span className="mdot" style={{ background: mcol(p.mor) }} title={moraleLbl(p.mor)} />
          {p.inj > 0 && <span className="tag inj">Chấn thương {p.inj}n</span>}
          {p.away && <span className="tag away">Đang ở {C(p.away.club).n}</span>}
          {p.loan && <span className="tag loan">Mượn</span>}
          {p.listed && <span className="tag sale">Rao bán</span>}
          {mine && yearsLeft(p) <= 1 && !p.loan && <span className="tag exp">HĐ hết 30/6</span>}
        </span>
      </span>
      <span className="rt">{rt}</span>
    </button>
  );
}
