import { Angry, Frown, Laugh, Meh, Smile } from "lucide-react";
import type { ReactNode } from "react";
import { fmtM } from "@/engine/format";
import { dyn, moraleLbl, ovrR, yearsLeft } from "@/engine/players";
import { C, S } from "@/engine/state";
import type { Player } from "@/engine/types";
import { cx, mcol } from "@/utils/display";
import { Avatar } from "./Avatar";
import { ClubBadge } from "./ClubBadge";
import { Badge } from "@/components/shadcn/badge";

const MOODS = [Angry, Frown, Meh, Smile, Laugh];
/** Tinh thần: biểu tượng mặt (không chỉ dựa vào màu) kèm nhãn chữ cho trình đọc màn hình */
function Mood({ mor }: { mor: number }) {
  const Icon = MOODS[mor >= 80 ? 4 : mor >= 60 ? 3 : mor >= 40 ? 2 : mor >= 20 ? 1 : 0];
  return <Icon size={14} strokeWidth={2.25} style={{ color: mcol(mor) }} role="img" aria-label={"Tinh thần: " + moraleLbl(mor)} />;
}

export function FitBar({ fit }: { fit: number }) {
  return (
    <span className="fit" role="img" aria-label={"Thể lực " + Math.round(fit) + "/100"}>
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
          <Badge variant="pos" className={`pos ${p.pos}`}>
            {p.pos}
          </Badge>
          {p.pos2.map((x) => (
            <Badge key={x} variant="pos" className={`pos alt text-foreground ${x}`}>
              {x}
            </Badge>
          ))}
          <span>{p.age} tuổi</span>
          <Mood mor={p.mor} />
          {p.inj > 0 && (
            <Badge variant="tag" className="tag inj">
              Chấn thương {p.inj}n
            </Badge>
          )}
          {p.away && (
            <Badge variant="tag" className="tag away">
              Đang ở {C(p.away.club).n}
            </Badge>
          )}
          {p.loan && (
            <Badge variant="tag" className="tag loan">
              Mượn
            </Badge>
          )}
          {p.listed && (
            <Badge variant="tag" className="tag sale">
              Rao bán
            </Badge>
          )}
          {mine && yearsLeft(p) <= 1 && !p.loan && (
            <Badge variant="tag" className="tag exp">
              HĐ hết 30/6
            </Badge>
          )}
        </span>
      </span>
      <span className="rt">{rt}</span>
    </button>
  );
}
