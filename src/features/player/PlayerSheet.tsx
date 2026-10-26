import { setRole, toggleListed, toggleLoanList, toggleShortlist } from "@/engine/actions";
import { ROLES, WINTER_WINDOW } from "@/engine/constants";
import {
  appeaseChance,
  nextRole,
  PROMISE_OPTS,
  respondDemand,
  type DemandChoice,
} from "@/engine/mood";
import { formatMoney, formatWage } from "@/engine/format";
import { yearsLeft } from "@/engine/players";
import { available, myLineup } from "@/engine/squad";
import { getClub, getPlayer, gameState } from "@/engine/state";
import { activeNegoFor, delegate, enquire, feeEstimate, renew } from "@/engine/transfers";
import type { NegoType, Player, Role } from "@/engine/types";
import { roundToTen } from "@/engine/util";
import { Sheet } from "@/components/Sheet";
import { KeyValueRows, RangeField, SegmentedControl } from "@/components/ui";
import { commit, useGameVersion } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { moraleColor, shortName } from "@/utils/display";
import { PlayerHead } from "@/components/PlayerHead";
import { ScoutReport } from "./ScoutReport";
import { Button } from "@/components/shadcn/button";
import { SelectField } from "@/components/ui";

function Stats({ player }: { player: Player }) {
  return (
    <div className="stats">
      <div className="stat">
        <b style={{ color: moraleColor(player.form) }}>{Math.round(player.form)}</b>
        <span>Phong độ</span>
      </div>
      <div className="stat">
        <b style={{ color: moraleColor(player.morale) }}>{Math.round(player.morale)}</b>
        <span>Tinh thần</span>
      </div>
      <div className="stat">
        <b style={{ color: player.fitness < 70 ? "var(--lv-1)" : "var(--lv-5)" }}>
          {Math.round(player.fitness)}
        </b>
        <span>Thể lực</span>
      </div>
      <div className="stat">
        <b>{player.injuryDays > 0 ? player.injuryDays + "n" : "Khỏe"}</b>
        <span>Chấn thương</span>
      </div>
    </div>
  );
}

function Info({ player }: { player: Player }) {
  return (
    <>
      <KeyValueRows
        rows={[
          ["Giá trị", formatMoney(player.marketValue)],
          ["Lương", player.contract ? formatWage(player.contract.wage) : "—"],
          [
            "Hợp đồng đến",
            player.contract && player.club != null ? "30/6/" + player.contract.expiryYear : "Tự do",
          ],
          [
            "Điều khoản giải phóng",
            player.contract?.releaseClause
              ? formatMoney(player.contract.releaseClause)
              : "Không có",
          ],
          ["Vai trò", player.contract ? player.contract.role : "—"],
          ["Mùa này", `${player.apps} trận · ${player.goals} bàn`],
          [
            "Tổng từ khi bạn dẫn dắt",
            `${player.careerTotals.apps} trận · ${player.careerTotals.goals} bàn`,
          ],
          !!player.sellOn && [
            "Điều khoản bán lại",
            `${player.sellOn.percent}% cho ${getClub(player.sellOn.club).name}`,
          ],
          !!player.addon &&
            !player.addon.paid && [
              "Thưởng theo số trận",
              `${formatMoney(player.addon.amount)} sau ${player.addon.apps} trận`,
            ],
          !!player.promise && ["Cam kết với cầu thủ", `Đá chính ${player.promise.left} trận nữa`],
          !!player.loan && [
            "Đang mượn từ",
            `${getClub(player.loan.fromClub).name} · trả ${player.loan.percent}% lương`,
          ],
        ]}
      />
      {player.transferHistory.length > 0 && (
        <>
          <h3>Lịch sử chuyển nhượng</h3>
          {player.transferHistory.map((transferRecord, i) => (
            <p key={i} className="hint">
              {transferRecord.year}: {transferRecord.fromClub} → {transferRecord.toClub} ·{" "}
              {transferRecord.fee
                ? formatMoney(transferRecord.fee)
                : transferRecord.fee === null
                  ? "đã có trong dữ liệu"
                  : "miễn phí"}
            </p>
          ))}
        </>
      )}
    </>
  );
}

/** Cầu thủ đang đòi ra sân hoặc đòi ra đi: người chơi chọn cách đáp lại */
function DemandPanel({ player }: { player: Player }) {
  const demand = player.demand!;
  const leave = demand.kind === "leave";
  const role = nextRole(player.contract!.role);
  const answer = (choice: DemandChoice) =>
    toast(commit(() => respondDemand(player.id, choice))?.message ?? "");
  return (
    <div
      className="say bad flex flex-col gap-2.5"
      role="group"
      aria-label={leave ? "Cầu thủ đòi ra đi" : "Cầu thủ đòi được ra sân"}
    >
      <b>
        {leave
          ? `${shortName(player.name)} muốn ra đi`
          : `${shortName(player.name)} đòi được ra sân`}
      </b>
      <p className="hint">
        {leave
          ? "Bạn có thể cam kết để xoa dịu, hoặc đồng ý rao bán / cho mượn. Giữ lại bằng mọi giá sẽ làm tinh thần sa sút."
          : "Cam kết cho đá chính nhiều trận thì cậu ấy yên tâm hơn, nhưng thất hứa sẽ phải trả giá."}
      </p>
      <div className="opts">
        {PROMISE_OPTS.map((years) => (
          <Button
            key={years}
            variant="ghost"
            size="sm"
            onClick={() => answer({ action: "promise", starts: years })}
          >
            Cam kết đá chính {years} trận
            {leave ? ` (${Math.round(appeaseChance(player, years) * 100)}%)` : ""}
          </Button>
        ))}
      </div>
      <div className="opts">
        {!leave && role && (
          <Button variant="ghost" size="sm" onClick={() => answer({ action: "promote" })}>
            Nâng vai trò lên "{role}"
          </Button>
        )}
        {!leave && (
          <Button variant="ghost" size="sm" onClick={() => answer({ action: "persuade" })}>
            Khuyên nhủ, chờ cơ hội
          </Button>
        )}
        {leave && (
          <>
            <Button variant="ghost" size="sm" onClick={() => answer({ action: "sell" })}>
              Đồng ý rao bán
            </Button>
            <Button variant="ghost" size="sm" onClick={() => answer({ action: "loan" })}>
              Cho mượn
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => answer({ action: leave ? "hold" : "refuse" })}
        >
          {leave ? "Giữ lại bằng mọi giá" : "Từ chối thẳng"}
        </Button>
      </div>
    </div>
  );
}

function MineActions({ player }: { player: Player }) {
  const { setSwapIn, closeSheet, openNego, setTab } = useUi();
  const inXI = myLineup().includes(player.id);
  return (
    <div className="flex flex-col gap-2.5">
      {!inXI && available(player) && (
        <Button
          className="w-full"
          onClick={() => {
            closeSheet();
            setSwapIn(player.id);
            setTab("squad");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Đưa vào đội hình chính
        </Button>
      )}
      {!player.loan && (
        <div className="row">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const result = commit(() => renew(player.id))!;
              if (result.error) toast(result.error);
              else openNego(result.negotiation!.id);
            }}
          >
            Gia hạn hợp đồng
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              toast(
                commit(() => toggleListed(player.id))
                  ? "Đã rao bán. Các CLB sẽ sớm liên hệ."
                  : "Đã gỡ rao bán.",
              )
            }
          >
            {player.listed ? "Gỡ rao bán" : "Rao bán"}
          </Button>
          {player.age <= 23 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => commit(() => toggleLoanList(player.id))}
            >
              {player.loanList ? "Gỡ khỏi DS cho mượn" : "Cho mượn"}
            </Button>
          )}
        </div>
      )}
      <SelectField
        label="Vai trò trong đội"
        value={player.contract!.role}
        onChange={(value) => {
          if (commit(() => setRole(player.id, value as Role)))
            toast(`${shortName(player.name)} không vui khi bị hạ vai trò.`);
        }}
        options={ROLES.map((role): [string, string] => [role, role])}
      />
      <p className="hint">
        Vai trò là lời hứa về thời gian thi đấu. Cầu thủ "Ngôi sao" mong đá chính khoảng 80% số
        trận, "Dự bị" khoảng 10%. Không giữ lời thì tinh thần giảm.
      </p>
    </div>
  );
}

function BuyActions({ player }: { player: Player }) {
  const { openNego, form } = useUi();
  const free = player.club == null,
    canPreContract = !free && yearsLeft(player) <= 1 && gameState.day >= WINTER_WINDOW[0];
  const estimate = feeEstimate(player);
  const dofKey = "dof:" + player.id,
    dofDef = roundToTen(estimate[1] * 1.05);
  const startNegotiation = (type: NegoType) => {
    const result = commit(() => enquire(player.id, type))!;
    if (result.error) toast(result.error);
    else openNego(result.negotiation!.id);
  };
  const delegateToDirector = () => {
    const max = (form[dofKey] as number | undefined) ?? dofDef;
    const result = commit(() => delegate(player.id, max))!;
    if (result.error) toast(result.error);
    else {
      toast("Đã giao cho Giám đốc thể thao.");
      openNego(result.negotiation!.id);
    }
  };
  return (
    <div className="flex flex-col gap-2.5">
      {free ? (
        <Button variant="hot" className="w-full" onClick={() => startNegotiation("free")}>
          Đàm phán hợp đồng (tự do)
        </Button>
      ) : (
        <>
          <div className="row">
            <Button variant="hot" style={{ flex: 1 }} onClick={() => startNegotiation("transfer")}>
              Thăm dò mua
            </Button>
            <Button variant="ghost" onClick={() => startNegotiation("loan")}>
              Hỏi mượn
            </Button>
          </div>
          {canPreContract && (
            <Button variant="ghost" className="w-full" onClick={() => startNegotiation("pre")}>
              Ký trước (miễn phí từ 1/7)
            </Button>
          )}
          <RangeField
            fieldKey={dofKey}
            label="Giao Giám đốc thể thao, trần phí"
            min={roundToTen(estimate[0] * 0.6)}
            max={Math.max(roundToTen(estimate[1] * 2), roundToTen(estimate[0] * 0.6) + 10)}
            step={10}
            format="m"
            def={dofDef}
          />
          <Button variant="ghost" size="sm" onClick={delegateToDirector}>
            Giao việc
          </Button>
          <span className="hint">GĐTT tự đàm phán trong 2 ngày, không vượt trần bạn đặt.</span>
        </>
      )}
      <Button variant="ghost" size="sm" onClick={() => commit(() => toggleShortlist(player.id))}>
        {gameState.shortlist.includes(player.id) ? "Bỏ theo dõi" : "Theo dõi"}
      </Button>
    </div>
  );
}

export function PlayerSheet({ id }: { id: string }) {
  useGameVersion();
  const { ptab, setPtab, closeSheet, openNego } = useUi();
  const player = getPlayer(id);
  if (!player) return null;
  const mine = player.club === gameState.myClubId || player.homeClub === gameState.myClubId;
  const currentPlayerTab = ptab || (mine ? "info" : "scout");
  const negotiation = activeNegoFor(player.id);
  return (
    <Sheet onClose={closeSheet}>
      <PlayerHead player={player} onClose={closeSheet} />
      <Stats player={player} />
      <SegmentedControl
        value={currentPlayerTab}
        onChange={setPtab}
        items={[
          ["info", "Tổng quan"],
          ["scout", "Báo cáo tuyển trạch"],
        ]}
      />
      {mine && player.demand ? <DemandPanel player={player} /> : null}
      {currentPlayerTab === "info" ? <Info player={player} /> : <ScoutReport player={player} />}
      {negotiation ? (
        <Button variant="hot" className="w-full" onClick={() => openNego(negotiation.id)}>
          Xem thương vụ đang diễn ra
        </Button>
      ) : mine && !player.homeClub ? (
        <MineActions player={player} />
      ) : !mine ? (
        <BuyActions player={player} />
      ) : null}
    </Sheet>
  );
}
