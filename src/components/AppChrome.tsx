// Thanh trên (CLB, ngày, ngân sách) và thanh tab dưới.
import { ArrowLeftRight, House, Shield, Trophy, Users } from "lucide-react";
import { myWages } from "@/engine/board";
import { negotiationNeedsAction } from "@/engine/actions";
import { formatMoney } from "@/engine/format";
import { agentLetters } from "@/engine/transfers";
import { isDeadline, myClub, gameState, windowNow } from "@/engine/state";
import { useGameVersion } from "@/stores/gameStore";
import { type TabKey, useUi } from "@/stores/uiStore";
import { formatDate } from "@/utils/display";
import { ClubBadge } from "./ClubBadge";
import { Badge } from "@/components/shadcn/badge";

export function Header() {
  useGameVersion();
  if (!gameState)
    return (
      <header className="top">
        <div className="brand">
          <b>
            Sân Cỏ <span>Career</span>
          </b>
        </div>
      </header>
    );
  const totalWages = myWages(),
    transferWindow = windowNow(),
    club = myClub();
  return (
    <header className="top">
      <div className="brand">
        <b>
          Sân Cỏ <span>Career</span>
        </b>
        <small className="mine">
          <ClubBadge name={club.name} size={22} /> {club.name} · {"★".repeat(club.prestige)}
          <br />
          {formatDate(gameState.day)}
          {isDeadline() && transferWindow ? ` · ${String(gameState.hour).padStart(2, "0")}:00` : ""}
        </small>
      </div>
      <div className="meta">
        <Badge variant="chip" className="chip">
          Ngân sách <b>{formatMoney(club.budget)}</b>
        </Badge>
        <Badge variant="chip" className={`chip ${totalWages > gameState.wageCap ? "bad" : "ok"}`}>
          Lương <b>{Math.round(totalWages)}</b>/{Math.round(gameState.wageCap)}k €
        </Badge>
        <Badge variant="chip" className={`chip ${gameState.boardConfidence < 30 ? "bad" : "ok"}`}>
          Niềm tin <b>{Math.round(gameState.boardConfidence)}</b>
        </Badge>
        <Badge variant="chip" className="chip">
          {transferWindow ? (
            isDeadline() ? (
              <b>DEADLINE DAY</b>
            ) : (
              `CN ${transferWindow === "summer" ? "hè" : "đông"} mở`
            )
          ) : (
            "CN đóng"
          )}
        </Badge>
      </div>
    </header>
  );
}

const TAB_ICONS = {
  home: <House />,
  squad: <Users />,
  market: <ArrowLeftRight />,
  league: <Trophy />,
  club: <Shield />,
};
export const TABS = [
  { tab: "home", label: "Trang chủ" },
  { tab: "squad", label: "Đội hình" },
  { tab: "market", label: "Mua bán" },
  { tab: "league", label: "Giải đấu" },
  { tab: "club", label: "CLB" },
] as const satisfies readonly { tab: TabKey; label: string }[];

export function BottomNav() {
  useGameVersion();
  const currentTab = useUi((ui) => ui.currentTab);
  const unread = gameState.inbox.filter((message) => !message.read).length,
    acts = gameState.negos.filter(negotiationNeedsAction).length + agentLetters().length;
  return (
    <nav className="tabs">
      {TABS.map((tabItem) => {
        const badgeCount = tabItem.tab === "home" ? unread : tabItem.tab === "market" ? acts : 0;
        return (
          <button
            key={tabItem.tab}
            type="button"
            aria-current={currentTab === tabItem.tab ? "page" : undefined}
            onClick={() => {
              useUi.setState({ sheet: null, swapIn: null });
              useUi.getState().setTab(tabItem.tab);
              window.scrollTo(0, 0);
            }}
            className="tabbtn"
          >
            <span className="tabin" data-on={currentTab === tabItem.tab || undefined}>
              {TAB_ICONS[tabItem.tab]}
              <span>{tabItem.label}</span>
              {badgeCount ? <span className="dotn">{badgeCount}</span> : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
