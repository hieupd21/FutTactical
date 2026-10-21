import type { ReactNode } from "react";
import { isClosed, negotiationNeedsAction, stageText } from "@/engine/actions";
import { formatMoney } from "@/engine/format";
import { clubPlayers } from "@/engine/squad";
import { getClub, getPlayer, gameState } from "@/engine/state";
import { agentLetters } from "@/engine/transfers";
import type { MoodCause } from "@/engine/types";
import { PlayerRow } from "@/components/PlayerRow";
import { SegmentedControl } from "@/components/ui";
import { useGameVersion } from "@/stores/gameStore";
import { useUi, type MarketSub } from "@/stores/uiStore";
import { formatShortDate } from "@/utils/display";
import { SearchView } from "./SearchView";
import { buttonVariants } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Progress } from "@/components/shadcn/progress";

const MOOD_REASONS: Record<MoodCause | "free", string> = {
  playtime: "muốn được đá nhiều hơn",
  tactics: "không hợp hệ thống hiện tại",
  morale: "không còn hạnh phúc ở CLB",
  free: "đang tự do",
};

/** Thư thăm dò từ người đại diện: cầu thủ chủ động tìm đến CLB bạn */
function AgentLetters() {
  const openPlayer = useUi((ui) => ui.openPlayer);
  const list = agentLetters();
  if (!list.length) return null;
  return (
    <Card className="panel min-w-0 gap-0 rounded-xl border-[var(--accent)] p-4 shadow-none">
      <h2>Thư từ người đại diện ({list.length})</h2>
      <p className="hint">
        Các cầu thủ này sẵn sàng ngồi xuống nói chuyện với bạn. Mở hồ sơ rồi bấm "Thăm dò" để bắt
        đầu đàm phán.
      </p>
      <div className="plist">
        {list.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            onClick={() => openPlayer(player.id)}
            right={
              <>
                <b>{player.club != null ? getClub(player.club).name : "Tự do"}</b>
                <span>
                  {MOOD_REASONS[player.interest!.cause]} · {formatShortDate(player.interest!.day)}
                </span>
              </>
            }
          />
        ))}
      </div>
    </Card>
  );
}

function NegoList() {
  const openNego = useUi((ui) => ui.openNego);
  if (!gameState.negos.length)
    return (
      <>
        <AgentLetters />
        <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
          <h2>Các thương vụ</h2>
          <p className="hint">
            Chưa có thương vụ nào. Tìm cầu thủ ở tab Tìm kiếm rồi bấm "Thăm dò".
          </p>
        </Card>
      </>
    );
  return (
    <>
      <AgentLetters />
      <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
        <h2>Các thương vụ</h2>
        {gameState.negos.map((negotiation) => {
          const player = getPlayer(negotiation.playerId);
          if (!player) return null;
          const needsAction = negotiationNeedsAction(negotiation);
          const kind = negotiation.isSellOffer
            ? "Bán · "
            : negotiation.type === "renew"
              ? "Gia hạn · "
              : negotiation.type === "loan"
                ? "Mượn · "
                : "Mua · ";
          return (
            <button
              key={negotiation.id}
              className={`ncard ${needsAction ? "act" : ""}`}
              onClick={() => openNego(negotiation.id)}
            >
              <span>
                <b>{player.name}</b>
                <br />
                <span className="hint">
                  {kind}
                  {stageText(negotiation)}
                </span>
              </span>
              <span
                className={needsAction ? buttonVariants({ variant: "hot", size: "sm" }) : "hint"}
              >
                {needsAction
                  ? "Xử lý"
                  : isClosed(negotiation)
                    ? negotiation.stage === "done"
                      ? "Xong"
                      : "Đổ vỡ"
                    : "Đang chờ"}
              </span>
              {!isClosed(negotiation) && negotiation.tension > 0 && (
                <Progress
                  value={negotiation.tension}
                  aria-label={"Căng thẳng " + Math.round(negotiation.tension) + "/100"}
                  className="mini col-span-full h-[5px] bg-border"
                  indicatorClassName="bg-[linear-gradient(90deg,var(--win),var(--gold),var(--loss))]"
                />
              )}
            </button>
          );
        })}
      </Card>
    </>
  );
}

export function MarketPage() {
  useGameVersion();
  const { marketSub, setMarketSub, openPlayer } = useUi();
  const letters = agentLetters().length,
    acts = gameState.negos.filter(negotiationNeedsAction).length + letters,
    live = gameState.negos.filter((negotiation) => !isClosed(negotiation)).length;
  const subs: [MarketSub, ReactNode][] = [
    ["search", "Tìm kiếm"],
    ["short", "Theo dõi"],
    ["nego", <>Đàm phán{acts ? <span className="cnt">{acts}</span> : live ? ` (${live})` : ""}</>],
    ["mine", "Bán & cho mượn"],
    ["news", "Tin tức"],
  ];
  let body: ReactNode;
  if (marketSub === "search") body = <SearchView />;
  else if (marketSub === "short") {
    const list = gameState.shortlist.map(getPlayer).filter(Boolean);
    body = (
      <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
        <h2>Danh sách theo dõi</h2>
        <div className="plist">
          {list.length ? (
            list.map((player) => (
              <PlayerRow key={player.id} player={player} onClick={() => openPlayer(player.id)} />
            ))
          ) : (
            <p className="hint">Bấm "Theo dõi" trong hồ sơ cầu thủ để thêm vào đây.</p>
          )}
        </div>
      </Card>
    );
  } else if (marketSub === "nego") body = <NegoList />;
  else if (marketSub === "mine") {
    const mine = clubPlayers(gameState.myClubId)
      .filter((player) => !player.loan)
      .sort((playerA, playerB) => playerB.marketValue - playerA.marketValue);
    body = (
      <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
        <h2>Cầu thủ của bạn</h2>
        <p className="hint">
          Rao bán giúp nhận nhiều lời đề nghị hơn nhưng giá thấp hơn. Cầu thủ trẻ trong danh sách
          cho mượn sẽ nhận đề nghị mượn.
        </p>
        <div className="plist">
          {mine.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              onClick={() => openPlayer(player.id)}
              right={
                <>
                  <b>{formatMoney(player.marketValue)}</b>
                  <span>
                    {player.listed
                      ? "Đang rao bán"
                      : player.loanList
                        ? "DS cho mượn"
                        : player.contract!.role}
                  </span>
                </>
              }
            />
          ))}
        </div>
      </Card>
    );
  } else {
    const items = gameState.news.filter((newsItem) => newsItem.kind === "transfer").slice(0, 40);
    body = (
      <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
        <h2>Tin chuyển nhượng</h2>
        {items.length ? (
          items.map((newsItem, i) => (
            <div key={i} className="msg" style={{ cursor: "default" }}>
              <i />
              <span>
                <p style={{ color: "var(--ink)" }}>{newsItem.text}</p>
              </span>
              <span className="when">{formatShortDate(newsItem.day)}</span>
            </div>
          ))
        ) : (
          <p className="hint">Chưa có tin.</p>
        )}
      </Card>
    );
  }
  return (
    <>
      <SegmentedControl value={marketSub} onChange={setMarketSub} items={subs} />
      {body}
    </>
  );
}
