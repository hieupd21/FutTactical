import { useState } from "react";
import { readAll, readMessage } from "@/engine/actions";
import { N, P, S } from "@/engine/state";
import type { NewsItem } from "@/engine/types";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Seg } from "@/components/ui";
import { commit } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { shortD } from "@/utils/display";

const PREVIEW = 5;
const FULL = 25;
const KIND: Record<NewsItem["k"], string> = {
  gen: "Chung",
  club: "CLB",
  transfer: "Chuyển nhượng",
  deal: "Đàm phán",
  flirt: "Thả thính",
  rebel: "Nổi loạn",
  match: "Trận đấu",
};
const FILTERS: [NewsItem["k"] | "all", string][] = [
  ["all", "Tất cả"],
  ["deal", "Đàm phán"],
  ["transfer", "Chuyển nhượng"],
  ["flirt", "Thả thính"],
  ["rebel", "Nổi loạn"],
  ["match", "Trận đấu"],
  ["club", "CLB"],
];

function More({ shown, total, open, onToggle }: { shown: number; total: number; open: boolean; onToggle: () => void }) {
  if (total <= PREVIEW) return null;
  return (
    <Button variant="ghost" size="sm" className="mt-1 self-start" onClick={onToggle} aria-expanded={open}>
      {open ? "Thu gọn" : `Xem thêm (${Math.min(total, FULL) - shown})`}
    </Button>
  );
}

/** Hộp thư: thứ gửi cho người chơi, có thể bấm để xử lý */
export function InboxCard() {
  const { openNego, openPlayer } = useUi();
  const [all, setAll] = useState(false);
  const unread = S.inbox.filter((m) => !m.read).length;
  const list = S.inbox.slice(0, all ? FULL : PREVIEW);
  const openMsg = (id: string) => {
    const m = S.inbox.find((x) => x.id === id)!;
    commit(() => readMessage(id));
    if (m.nid && N(m.nid)) openNego(m.nid);
    else if (m.pid && P(m.pid)) openPlayer(m.pid);
    else toast(m.b);
  };
  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <div className="row between">
        <h3>Hộp thư{unread > 0 && ` (${unread} mới)`}</h3>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => commit(readAll)}>
            Đánh dấu đã đọc
          </Button>
        )}
      </div>
      {list.length ? (
        <div>
          {list.map((m) => (
            <button key={m.id} className={`msg ${m.read ? "" : "unread"}`} onClick={() => openMsg(m.id)}>
              <i aria-hidden="true" />
              <span>
                <b>
                  {!m.read && <span className="sr-only">Chưa đọc: </span>}
                  {m.t}
                </b>
                <p>{m.b}</p>
              </span>
              <span className="when">{shortD(m.d)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">Chưa có thư.</p>
      )}
      <More shown={list.length} total={S.inbox.length} open={all} onToggle={() => setAll((v) => !v)} />
    </Card>
  );
}

/** Tin tức: chuyện xảy ra trong thế giới game, chỉ để đọc */
export function NewsCard() {
  const [all, setAll] = useState(false);
  const [kind, setKind] = useState<NewsItem["k"] | "all">("all");
  const pool = kind === "all" ? S.news : S.news.filter((x) => x.k === kind);
  const list = pool.slice(0, all ? FULL : PREVIEW);
  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h3>Tin tức</h3>
      <Seg items={FILTERS} value={kind} onChange={setKind} />
      {list.length ? (
        <ul className="nws">
          {list.map((x, i) => (
            <li key={i}>
              <span className="nk">{KIND[x.k]}</span>
              <span>{x.t}</span>
              <span className="when">{shortD(x.d)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Chưa có tin.</p>
      )}
      <More shown={list.length} total={pool.length} open={all} onToggle={() => setAll((v) => !v)} />
    </Card>
  );
}
