// Thanh trên (CLB, ngày, ngân sách) và thanh tab dưới.
import { ArrowLeftRight, House, Shield, Trophy, Users } from "lucide-react";
import { myWages } from "@/engine/board";
import { needsAct } from "@/engine/actions";
import { fmtM } from "@/engine/format";
import { isDeadline, me, S, windowNow } from "@/engine/state";
import { useGameVersion } from "@/stores/gameStore";
import { type TabKey, useUi } from "@/stores/uiStore";
import { dstr } from "@/utils/display";
import { ClubBadge } from "./ClubBadge";
import { Badge } from "@/components/shadcn/badge";

export function Header() {
  useGameVersion();
  if (!S)
    return (
      <header className="top">
        <div className="brand">
          <b>
            Sân Cỏ <span>Career</span>
          </b>
        </div>
      </header>
    );
  const w = myWages(),
    win = windowNow(),
    c = me();
  return (
    <header className="top">
      <div className="brand">
        <b>
          Sân Cỏ <span>Career</span>
        </b>
        <small className="mine">
          <ClubBadge name={c.n} size={22} /> {c.n} · {"★".repeat(c.pres)}
          <br />
          {dstr(S.d)}
          {isDeadline() && win ? ` · ${String(S.h).padStart(2, "0")}:00` : ""}
        </small>
      </div>
      <div className="meta">
        <Badge variant="chip" className="chip">
          Ngân sách <b>{fmtM(c.budget)}</b>
        </Badge>
        <Badge variant="chip" className={`chip ${w > S.wageCap ? "bad" : "ok"}`}>
          Lương <b>{Math.round(w)}</b>/{Math.round(S.wageCap)}k €
        </Badge>
        <Badge variant="chip" className={`chip ${S.conf < 30 ? "bad" : "ok"}`}>
          Niềm tin <b>{Math.round(S.conf)}</b>
        </Badge>
        <Badge variant="chip" className="chip">
          {win ? isDeadline() ? <b>DEADLINE DAY</b> : `CN ${win === "summer" ? "hè" : "đông"} mở` : "CN đóng"}
        </Badge>
      </div>
    </header>
  );
}

const I = {
  home: <House />,
  squad: <Users />,
  market: <ArrowLeftRight />,
  league: <Trophy />,
  club: <Shield />,
};
export const TABS = [
  { k: "home", l: "Trang chủ" },
  { k: "squad", l: "Đội hình" },
  { k: "market", l: "Mua bán" },
  { k: "league", l: "Giải đấu" },
  { k: "club", l: "CLB" },
] as const satisfies readonly { k: TabKey; l: string }[];

export function BottomNav() {
  useGameVersion();
  const tab = useUi((s) => s.tab);
  const unread = S.inbox.filter((m) => !m.read).length,
    acts = S.negos.filter(needsAct).length;
  return (
    <nav className="tabs">
      {TABS.map((t) => {
        const c = t.k === "home" ? unread : t.k === "market" ? acts : 0;
        return (
          <button
            key={t.k}
            type="button"
            aria-current={tab === t.k ? "page" : undefined}
            onClick={() => {
              useUi.setState({ sheet: null, swapIn: null });
              useUi.getState().setTab(t.k);
              window.scrollTo(0, 0);
            }}
            className="tabbtn"
          >
            <span className="tabin" data-on={tab === t.k || undefined}>
              {I[t.k]}
              <span>{t.l}</span>
              {c ? <span className="dotn">{c}</span> : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
