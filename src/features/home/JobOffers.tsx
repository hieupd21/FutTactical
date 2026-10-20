import { acceptJob, declineJob, takeNewJob } from "@/engine/actions";
import { clubReq, offerClubs } from "@/engine/career";
import { lgName, S } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { commit } from "@/stores/gameStore";
import { toast } from "@/stores/uiStore";

/** Danh sách CLB ngỏ lời dẫn dắt: sau tổng kết mùa hoặc sau khi bị sa thải */
export function OfferList({ sacked = false }: { sacked?: boolean }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {offerClubs().map((c) => {
        const taken = S.job === c.id;
        return (
          <div key={c.id} className="need" style={{ cursor: "default" }}>
            <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
              <ClubBadge name={c.n} size={36} />
              <span>
                <b>{c.n}</b>
                <br />
                <span className="hint">
                  {lgName(c.lg)} · sức mạnh {c.str} · yêu cầu uy tín {clubReq(c)}
                </span>
              </span>
            </span>
            <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              {taken ? (
                <Button variant="ghost" size="sm" onClick={() => commit(() => declineJob(c.id))}>
                  Rút lại
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => commit(() => declineJob(c.id))}>
                    Từ chối
                  </Button>
                  <Button variant="hot" size="sm" onClick={() => toast(commit(() => (sacked ? takeNewJob(c.id) : acceptJob(c.id))) ?? "")}>
                    {sacked ? "Nhận việc" : "Nhận lời"}
                  </Button>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function JobOffersCard() {
  if (!(S.offers ?? []).length) return null;
  const job = S.job && S.clubs[S.job];
  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h3>Lời mời làm việc ({S.offers!.length})</h3>
      <p className="hint">
        {job
          ? `Bạn đã nhận lời ${job.n}. Bạn sẽ chuyển sang khi mùa mới bắt đầu.`
          : "Các CLB lớn hơn để ý thành tích của bạn. Nhận lời thì mùa tới bạn sẽ đổi đội; không nhận thì ở lại đội hiện tại."}
      </p>
      <OfferList />
    </Card>
  );
}
