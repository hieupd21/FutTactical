// Thanh trên (CLB, ngày, ngân sách) và thanh tab dưới.
import { NavLink } from "react-router-dom";
import { myWages } from "@/engine/board";
import { needsAct } from "@/engine/actions";
import { fmtM } from "@/engine/format";
import { isDeadline, me, S, windowNow } from "@/engine/state";
import { useGameVersion } from "@/stores/gameStore";
import { useUi } from "@/stores/uiStore";
import { dstr } from "@/utils/display";
import { ClubBadge } from "./ClubBadge";

export function Header() {
  useGameVersion();
  if (!S) return <header className="top"><div className="brand"><b>Sân Cỏ <span>Career</span></b></div></header>;
  const w = myWages(), win = windowNow(), c = me();
  return (
    <header className="top">
      <div className="brand">
        <b>Sân Cỏ <span>Career</span></b>
        <small className="mine">
          <ClubBadge name={c.n} size={22} /> {c.n} · {"★".repeat(c.pres)}<br />
          {dstr(S.d)}{isDeadline() && win ? ` · ${String(S.h).padStart(2, "0")}:00` : ""}
        </small>
      </div>
      <div className="meta">
        <span className="chip">Ngân sách <b>{fmtM(c.budget)}</b></span>
        <span className={`chip ${w > S.wageCap ? "bad" : "ok"}`}>Lương <b>{Math.round(w)}</b>/{Math.round(S.wageCap)}k €</span>
        <span className={`chip ${S.conf < 30 ? "bad" : "ok"}`}>Niềm tin <b>{Math.round(S.conf)}</b></span>
        <span className="chip">{win ? (isDeadline() ? <b>DEADLINE DAY</b> : `CN ${win === "summer" ? "hè" : "đông"} mở`) : "CN đóng"}</span>
      </div>
    </header>
  );
}

const I = {
  home: <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>,
  squad: <svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="8" r="2.5" /><path d="M16 14c2.8 0 5 2.2 5 5" /></svg>,
  market: <svg viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>,
  league: <svg viewBox="0 0 24 24"><path d="M8 4h8v4a4 4 0 0 1-8 0zM6 5H4v2a3 3 0 0 0 3 3M18 5h2v2a3 3 0 0 1-3 3M12 12v4M8 20h8M10 16h4v4h-4z" /></svg>,
  club: <svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /></svg>,
};
export const TABS = [
  { to: "/", k: "home", l: "Trang chủ" },
  { to: "/squad", k: "squad", l: "Đội hình" },
  { to: "/market", k: "market", l: "Mua bán" },
  { to: "/league", k: "league", l: "Giải đấu" },
  { to: "/club", k: "club", l: "CLB" },
] as const;

export function BottomNav() {
  useGameVersion();
  const reset = () => useUi.setState({ sheet: null, swapIn: null });
  const unread = S.inbox.filter((m) => !m.read).length, acts = S.negos.filter(needsAct).length;
  return (
    <nav className="tabs">
      {TABS.map((t) => {
        const c = t.k === "home" ? unread : t.k === "market" ? acts : 0;
        return (
          <NavLink key={t.k} to={t.to} end={t.to === "/"} onClick={() => { reset(); window.scrollTo(0, 0); }}
            className="tabbtn">
            {({ isActive }) => <span className="tabin" data-on={isActive || undefined}>{I[t.k]}<span>{t.l}</span>{c ? <span className="dotn">{c}</span> : null}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}
