import { acceptJob, declineJob, takeNewJob } from "@/engine/actions";
import { clubRequirement, offerClubs } from "@/engine/career";
import { leagueName, gameState } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { commit } from "@/stores/gameStore";
import { toast } from "@/stores/uiStore";

/** Danh sách CLB ngỏ lời dẫn dắt: sau tổng kết mùa hoặc sau khi bị sa thải */
export function OfferList({ sacked = false }: { sacked?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {offerClubs().map((club) => {
        const taken = gameState.job === club.id;
        return (
          <div key={club.id} className="need" style={{ cursor: "default" }}>
            <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
              <ClubBadge name={club.name} size={36} />
              <span>
                <b>{club.name}</b>
                <br />
                <span className="hint">
                  {leagueName(club.leagueId)} · sức mạnh {club.strength} · yêu cầu uy tín{" "}
                  {clubRequirement(club)}
                </span>
              </span>
            </span>
            <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              {taken ? (
                <Button variant="ghost" size="sm" onClick={() => commit(() => declineJob(club.id))}>
                  Rút lại
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => commit(() => declineJob(club.id))}
                  >
                    Từ chối
                  </Button>
                  <Button
                    variant="hot"
                    size="sm"
                    onClick={() =>
                      toast(commit(() => (sacked ? takeNewJob(club.id) : acceptJob(club.id))) ?? "")
                    }
                  >
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
  if (!(gameState.offers ?? []).length) return null;
  const pendingJobClub = gameState.job && gameState.clubs[gameState.job];
  return (
    <Card id="job-offers" className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h3>Lời mời làm việc ({gameState.offers!.length})</h3>
      <p className="hint">
        {pendingJobClub
          ? `Bạn đã nhận lời ${pendingJobClub.name}. Bạn sẽ chuyển sang khi mùa mới bắt đầu.`
          : "Các CLB lớn hơn để ý thành tích của bạn. Nhận lời thì mùa tới bạn sẽ đổi đội; không nhận thì ở lại đội hiện tại."}
      </p>
      <OfferList />
    </Card>
  );
}
