import type { ReactNode } from "react";
import { isClosed, quitNego } from "@/engine/actions";
import { getClub, isDeadline, getNegotiation, getPlayer } from "@/engine/state";
import type { Negotiation } from "@/engine/types";
import { PlayerHead } from "@/components/PlayerHead";
import { Sheet } from "@/components/Sheet";
import { commit, useGameVersion } from "@/stores/gameStore";
import { useUi } from "@/stores/uiStore";
import { classNames, formatShortDate } from "@/utils/display";
import { ClubForm, ContractForm, FinalForm, LoanForm, SellForm } from "./NegoForms";
import { Button } from "@/components/shadcn/button";

function Steps({ negotiation }: { negotiation: Negotiation }) {
  const stage = negotiation.stage;
  const steps = negotiation.isSellOffer
    ? ["Đề nghị", "Phản hồi", "Hoàn tất"]
    : negotiation.type === "renew"
      ? ["Hợp đồng", "Ký"]
      : negotiation.type === "loan"
        ? ["Thăm dò", "Điều kiện mượn", "Hoàn tất"]
        : ["Thăm dò", "CLB bán", "Hợp đồng", "Hoàn tất"];
  const order: Record<string, number> =
    negotiation.type === "loan"
      ? { enquiry: 0, club: 1, final: 2, done: 3, failed: -1 }
      : { enquiry: 0, dof: 0, club: 1, contract: 2, final: 3, done: 4, failed: -1 };
  const current = negotiation.isSellOffer
    ? stage === "offer"
      ? 0
      : 2
    : negotiation.type === "renew"
      ? stage === "contract"
        ? 0
        : 1
      : (order[stage] ?? 0);
  return (
    <div className="steps">
      {steps.map((step, i) => (
        <div
          key={step}
          className={i < current || stage === "done" ? "done" : i === current ? "on" : ""}
        >
          {step}
        </div>
      ))}
    </div>
  );
}

function Tension({ negotiation }: { negotiation: Negotiation }) {
  if (isClosed(negotiation)) return null;
  if (negotiation.isSellOffer)
    return negotiation.tension ? (
      <div className="tension">
        <div
          className="bar"
          role="img"
          aria-label={"Căng thẳng " + Math.round(negotiation.tension) + "/100"}
        >
          <i style={{ left: `${negotiation.tension}%` }} />
        </div>
      </div>
    ) : null;
  if (negotiation.type === "free") return null;
  return (
    <div className="tension">
      <div className="lab">
        <span>Thuận lợi</span>
        <span>Căng thẳng {Math.round(negotiation.tension)}/100</span>
        <span>Đổ vỡ</span>
      </div>
      <div
        className="bar"
        role="img"
        aria-label={"Căng thẳng " + Math.round(negotiation.tension) + "/100"}
      >
        <i style={{ left: `${negotiation.tension}%` }} />
      </div>
    </div>
  );
}

const kindText = (negotiation: Negotiation, club: string | null): string =>
  negotiation.isSellOffer
    ? `Bán cho ${getClub(negotiation.buyer!).name}`
    : negotiation.type === "renew"
      ? "Gia hạn hợp đồng"
      : negotiation.type === "loan"
        ? `Mượn từ ${getClub(negotiation.seller!).name}`
        : negotiation.type === "free"
          ? "Ký cầu thủ tự do"
          : negotiation.type === "pre"
            ? "Ký trước hợp đồng"
            : `Mua từ ${club ? getClub(club).name : "?"}`;

export function NegoSheet({ id }: { id: string }) {
  useGameVersion();
  const { closeSheet, error, setTab } = useUi();
  const negotiation = getNegotiation(id);
  const player = negotiation && getPlayer(negotiation.playerId);
  if (!negotiation || !player) return null;
  const stage = negotiation.stage;
  let form: ReactNode = null;
  if (stage === "failed")
    form = (
      <Button variant="ghost" className="w-full" onClick={closeSheet}>
        Đóng
      </Button>
    );
  else if (stage === "done")
    form = (
      <Button variant="hot" className="w-full" onClick={closeSheet}>
        Tuyệt vời
      </Button>
    );
  else if (negotiation.waiting || stage === "enquiry" || stage === "dof")
    form = (
      <>
        <div className="say">
          Đang chờ phản hồi{isDeadline() ? " (khoảng 1 giờ)" : " (khoảng 1 ngày)"}. Bấm "Tiếp tục" ở
          Trang chủ để thời gian trôi.
        </div>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            closeSheet();
            setTab("central");
          }}
        >
          Về Trang chủ
        </Button>
      </>
    );
  else if (negotiation.isSellOffer) form = <SellForm negotiation={negotiation} player={player} />;
  else if (stage === "club")
    form =
      negotiation.type === "loan" ? (
        <LoanForm negotiation={negotiation} player={player} />
      ) : (
        <ClubForm negotiation={negotiation} player={player} />
      );
  else if (stage === "contract") form = <ContractForm negotiation={negotiation} player={player} />;
  else if (stage === "final") form = <FinalForm negotiation={negotiation} player={player} />;

  const sayCls = stage === "failed" ? "bad" : stage === "done" || stage === "final" ? "good" : "";
  return (
    <Sheet onClose={closeSheet}>
      <PlayerHead
        player={player}
        onClose={closeSheet}
        extra={
          <div className="hint" style={{ marginTop: 4 }}>
            {kindText(negotiation, negotiation.seller || player.club)}
          </div>
        }
      />
      <Steps negotiation={negotiation} />
      <Tension negotiation={negotiation} />
      <div className={classNames("say", sayCls)}>{negotiation.message}</div>
      {error && <p className="err">{error}</p>}
      {form}
      {negotiation.log.length > 1 && (
        <details>
          <summary className="hint">Diễn biến ({negotiation.log.length})</summary>
          <div className="logl">
            {negotiation.log.map((logEntry, i) => (
              <div key={i} className={logEntry.author}>
                <span className="mono">{formatShortDate(Math.floor(logEntry.tickAt / 24))}</span>
                <span>
                  {logEntry.author === "me" ? "Bạn: " : ""}
                  {logEntry.text}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
      {!isClosed(negotiation) && !negotiation.isSellOffer && (
        <Button
          variant="ghost"
          size="sm"
          style={{ alignSelf: "flex-start" }}
          onClick={() => commit(() => quitNego(negotiation.id))}
        >
          Rút lui
        </Button>
      )}
    </Sheet>
  );
}
