import type { ReactNode } from "react";
import { isClosed, needsAct, stageTxt } from "@/engine/actions";
import { fmtM } from "@/engine/format";
import { clubPlayers } from "@/engine/squad";
import { P, S } from "@/engine/state";
import { PlayerRow } from "@/components/PlayerRow";
import { Seg } from "@/components/ui";
import { useGameVersion } from "@/stores/gameStore";
import { useUi, type MarketSub } from "@/stores/uiStore";
import { shortD } from "@/utils/display";
import { SearchView } from "./SearchView";

function NegoList() {
  const openNego = useUi((s) => s.openNego);
  if (!S.negos.length)
    return (
      <section className="panel">
        <h2>Các thương vụ</h2>
        <p className="hint">Chưa có thương vụ nào. Tìm cầu thủ ở tab Tìm kiếm rồi bấm "Thăm dò".</p>
      </section>
    );
  return (
    <section className="panel">
      <h2>Các thương vụ</h2>
      {S.negos.map((n) => {
        const p = P(n.pid);
        if (!p) return null;
        const act = needsAct(n);
        const kind = n.sell ? "Bán · " : n.type === "renew" ? "Gia hạn · " : n.type === "loan" ? "Mượn · " : "Mua · ";
        return (
          <button key={n.id} className={`ncard ${act ? "act" : ""}`} onClick={() => openNego(n.id)}>
            <span>
              <b>{p.n}</b>
              <br />
              <span className="hint">
                {kind}
                {stageTxt(n)}
              </span>
            </span>
            <span className={act ? "btn sm hot" : "hint"}>
              {act ? "Xử lý" : isClosed(n) ? (n.stage === "done" ? "Xong" : "Đổ vỡ") : "Đang chờ"}
            </span>
            {!isClosed(n) && n.tension > 0 && (
              <div className="mini">
                <i style={{ width: `${n.tension}%` }} />
              </div>
            )}
          </button>
        );
      })}
    </section>
  );
}

export function MarketPage() {
  useGameVersion();
  const { marketSub, setMarketSub, openPlayer } = useUi();
  const acts = S.negos.filter(needsAct).length,
    live = S.negos.filter((n) => !isClosed(n)).length;
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
    const list = S.shortlist.map(P).filter(Boolean);
    body = (
      <section className="panel">
        <h2>Danh sách theo dõi</h2>
        <div className="plist">
          {list.length ? (
            list.map((p) => <PlayerRow key={p.id} p={p} onClick={() => openPlayer(p.id)} />)
          ) : (
            <p className="hint">Bấm "Theo dõi" trong hồ sơ cầu thủ để thêm vào đây.</p>
          )}
        </div>
      </section>
    );
  } else if (marketSub === "nego") body = <NegoList />;
  else if (marketSub === "mine") {
    const mine = clubPlayers(S.me)
      .filter((p) => !p.loan)
      .sort((a, b) => b.val - a.val);
    body = (
      <section className="panel">
        <h2>Cầu thủ của bạn</h2>
        <p className="hint">
          Rao bán giúp nhận nhiều lời đề nghị hơn nhưng giá thấp hơn. Cầu thủ trẻ trong danh sách cho mượn sẽ nhận đề nghị mượn.
        </p>
        <div className="plist">
          {mine.map((p) => (
            <PlayerRow
              key={p.id}
              p={p}
              onClick={() => openPlayer(p.id)}
              right={
                <>
                  <b>{fmtM(p.val)}</b>
                  <span>{p.listed ? "Đang rao bán" : p.loanList ? "DS cho mượn" : p.c!.role}</span>
                </>
              }
            />
          ))}
        </div>
      </section>
    );
  } else {
    const items = S.news.filter((x) => x.k === "transfer").slice(0, 40);
    body = (
      <section className="panel">
        <h2>Tin chuyển nhượng</h2>
        {items.length ? (
          items.map((x, i) => (
            <div key={i} className="msg" style={{ cursor: "default" }}>
              <i />
              <span>
                <p style={{ color: "var(--ink)" }}>{x.t}</p>
              </span>
              <span className="when">{shortD(x.d)}</span>
            </div>
          ))
        ) : (
          <p className="hint">Chưa có tin.</p>
        )}
      </section>
    );
  }
  return (
    <>
      <Seg value={marketSub} onChange={setMarketSub} items={subs} />
      {body}
    </>
  );
}
