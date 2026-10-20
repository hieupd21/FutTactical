import type { ReactNode } from "react";
import { isClosed, quitNego } from "@/engine/actions";
import { C, isDeadline, N, P } from "@/engine/state";
import type { Negotiation } from "@/engine/types";
import { PlayerHead } from "@/components/PlayerHead";
import { Sheet } from "@/components/Sheet";
import { commit, useGameVersion } from "@/stores/gameStore";
import { useUi } from "@/stores/uiStore";
import { cx, shortD } from "@/utils/display";
import { ClubForm, ContractForm, FinalForm, LoanForm, SellForm } from "./NegoForms";
import { Button } from "@/components/shadcn/button";

function Steps({ n }: { n: Negotiation }) {
  const st = n.stage;
  const steps = n.sell
    ? ["Đề nghị", "Phản hồi", "Hoàn tất"]
    : n.type === "renew"
      ? ["Hợp đồng", "Ký"]
      : n.type === "loan"
        ? ["Thăm dò", "Điều kiện mượn", "Hoàn tất"]
        : ["Thăm dò", "CLB bán", "Hợp đồng", "Hoàn tất"];
  const order: Record<string, number> =
    n.type === "loan"
      ? { enquiry: 0, club: 1, final: 2, done: 3, failed: -1 }
      : { enquiry: 0, dof: 0, club: 1, contract: 2, final: 3, done: 4, failed: -1 };
  const cur = n.sell ? (st === "offer" ? 0 : 2) : n.type === "renew" ? (st === "contract" ? 0 : 1) : (order[st] ?? 0);
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <div key={s} className={i < cur || st === "done" ? "done" : i === cur ? "on" : ""}>
          {s}
        </div>
      ))}
    </div>
  );
}

function Tension({ n }: { n: Negotiation }) {
  if (isClosed(n)) return null;
  if (n.sell)
    return n.tension ? (
      <div className="tension">
        <div className="bar" role="img" aria-label={"Căng thẳng " + Math.round(n.tension) + "/100"}>
          <i style={{ left: `${n.tension}%` }} />
        </div>
      </div>
    ) : null;
  if (n.type === "free") return null;
  return (
    <div className="tension">
      <div className="lab">
        <span>Thuận lợi</span>
        <span>Căng thẳng {Math.round(n.tension)}/100</span>
        <span>Đổ vỡ</span>
      </div>
      <div className="bar" role="img" aria-label={"Căng thẳng " + Math.round(n.tension) + "/100"}>
        <i style={{ left: `${n.tension}%` }} />
      </div>
    </div>
  );
}

const kindTxt = (n: Negotiation, club: string | null): string =>
  n.sell
    ? `Bán cho ${C(n.buyer!).n}`
    : n.type === "renew"
      ? "Gia hạn hợp đồng"
      : n.type === "loan"
        ? `Mượn từ ${C(n.seller!).n}`
        : n.type === "free"
          ? "Ký cầu thủ tự do"
          : n.type === "pre"
            ? "Ký trước hợp đồng"
            : `Mua từ ${club ? C(club).n : "?"}`;

export function NegoSheet({ id }: { id: string }) {
  useGameVersion();
  const { closeSheet, err, setTab } = useUi();
  const n = N(id);
  const p = n && P(n.pid);
  if (!n || !p) return null;
  const st = n.stage;
  let form: ReactNode = null;
  if (st === "failed")
    form = (
      <Button variant="ghost" className="w-full" onClick={closeSheet}>
        Đóng
      </Button>
    );
  else if (st === "done")
    form = (
      <Button variant="hot" className="w-full" onClick={closeSheet}>
        Tuyệt vời
      </Button>
    );
  else if (n.waiting || st === "enquiry" || st === "dof")
    form = (
      <>
        <div className="say">
          Đang chờ phản hồi{isDeadline() ? " (khoảng 1 giờ)" : " (khoảng 1 ngày)"}. Bấm "Tiếp tục" ở Trang chủ để thời gian trôi.
        </div>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            closeSheet();
            setTab("home");
          }}
        >
          Về Trang chủ
        </Button>
      </>
    );
  else if (n.sell) form = <SellForm n={n} p={p} />;
  else if (st === "club") form = n.type === "loan" ? <LoanForm n={n} p={p} /> : <ClubForm n={n} p={p} />;
  else if (st === "contract") form = <ContractForm n={n} p={p} />;
  else if (st === "final") form = <FinalForm n={n} p={p} />;

  const sayCls = st === "failed" ? "bad" : st === "done" || st === "final" ? "good" : "";
  return (
    <Sheet onClose={closeSheet}>
      <PlayerHead
        p={p}
        onClose={closeSheet}
        extra={
          <div className="hint" style={{ marginTop: 4 }}>
            {kindTxt(n, n.seller || p.club)}
          </div>
        }
      />
      <Steps n={n} />
      <Tension n={n} />
      <div className={cx("say", sayCls)}>{n.msg}</div>
      {err && <p className="err">{err}</p>}
      {form}
      {n.log.length > 1 && (
        <details>
          <summary className="hint">Diễn biến ({n.log.length})</summary>
          <div className="logl">
            {n.log.map((l, i) => (
              <div key={i} className={l.who}>
                <span className="mono">{shortD(Math.floor(l.at / 24))}</span>
                <span>
                  {l.who === "me" ? "Bạn: " : ""}
                  {l.t}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
      {!isClosed(n) && !n.sell && (
        <Button variant="ghost" size="sm" style={{ alignSelf: "flex-start" }} onClick={() => commit(() => quitNego(n.id))}>
          Rút lui
        </Button>
      )}
    </Sheet>
  );
}
