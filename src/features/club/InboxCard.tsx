import { useState } from "react";
import { readAll, readMessage } from "@/engine/actions";
import { gameState } from "@/engine/state";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { commit } from "@/stores/gameStore";
import { useUi } from "@/stores/uiStore";
import { formatShortDate } from "@/utils/display";
import { INBOX_KINDS, kindOfMsg } from "./inboxKinds";

const PREVIEW = 5;
const FULL = 25;

function More({
  shown,
  total,
  open,
  onToggle,
}: {
  shown: number;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  if (total <= PREVIEW) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="mt-1 self-start"
      onClick={onToggle}
      aria-expanded={open}
    >
      {open ? "Thu gọn" : `Xem thêm (${Math.min(total, FULL) - shown})`}
    </Button>
  );
}

/** Hộp thư: thứ gửi cho người chơi, có thể bấm để xử lý */
export function InboxCard() {
  const [showAll, setAll] = useState(false);
  const unread = gameState.inbox.filter((message) => !message.read).length;
  const list = gameState.inbox.slice(0, showAll ? FULL : PREVIEW);
  const openMsg = (id: string) => {
    const message = gameState.inbox.find((item) => item.id === id)!;
    commit(() => readMessage(id));
    INBOX_KINDS[kindOfMsg(message)].perform(message, useUi.getState());
  };
  return (
    <Card className="panel min-w-0 gap-0 rounded-2xl border-white/20 bg-card/40 p-4 shadow-lg backdrop-blur-xl">
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
          {list.map((message) => {
            const kindDef = INBOX_KINDS[kindOfMsg(message)];
            return (
              <button
                key={message.id}
                className={`msg ${message.read ? "" : "unread"}`}
                onClick={() => openMsg(message.id)}
              >
                <i aria-hidden="true" />
                <span>
                  <b>
                    {!message.read && <span className="sr-only">Chưa đọc: </span>}
                    {message.title}
                  </b>
                  <p>{message.body}</p>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                    <kindDef.icon size={14} aria-hidden />
                    {kindDef.label}
                    <span className="text-(--accent)">· {kindDef.actionLabel} →</span>
                  </span>
                </span>
                <span className="when">{formatShortDate(message.day)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="hint">Chưa có thư.</p>
      )}
      <More
        shown={list.length}
        total={gameState.inbox.length}
        open={showAll}
        onToggle={() => setAll((isOpen) => !isOpen)}
      />
    </Card>
  );
}
