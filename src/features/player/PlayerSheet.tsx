import { setRole, toggleListed, toggleLoanList, toggleShortlist } from "@/engine/actions";
import { ROLES, WIN_WINTER } from "@/engine/constants";
import { appeaseChance, nextRole, PROMISE_OPTS, respondDemand, type DemandChoice } from "@/engine/mood";
import { fmtM, fmtW } from "@/engine/format";
import { yearsLeft } from "@/engine/players";
import { available, myXI } from "@/engine/squad";
import { C, P, S } from "@/engine/state";
import { activeNegoFor, delegate, enquire, feeEstimate, renew } from "@/engine/transfers";
import type { NegoType, Player, Role } from "@/engine/types";
import { r10 } from "@/engine/util";
import { Sheet } from "@/components/Sheet";
import { KV, RangeField, Seg } from "@/components/ui";
import { commit, useGameVersion } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { mcol, sn } from "@/utils/display";
import { PlayerHead } from "@/components/PlayerHead";
import { ScoutReport } from "./ScoutReport";
import { Button } from "@/components/shadcn/button";
import { SelectField } from "@/components/ui";

function Stats({ p }: { p: Player }) {
  return (
    <div className="stats">
      <div className="stat">
        <b style={{ color: mcol(p.form) }}>{Math.round(p.form)}</b>
        <span>Phong độ</span>
      </div>
      <div className="stat">
        <b style={{ color: mcol(p.mor) }}>{Math.round(p.mor)}</b>
        <span>Tinh thần</span>
      </div>
      <div className="stat">
        <b style={{ color: p.fit < 70 ? "var(--lv-1)" : "var(--lv-5)" }}>{Math.round(p.fit)}</b>
        <span>Thể lực</span>
      </div>
      <div className="stat">
        <b>{p.inj > 0 ? p.inj + "n" : "Khỏe"}</b>
        <span>Chấn thương</span>
      </div>
    </div>
  );
}

function Info({ p }: { p: Player }) {
  return (
    <>
      <KV
        rows={[
          ["Giá trị", fmtM(p.val)],
          ["Lương", p.c ? fmtW(p.c.wage) : "—"],
          ["Hợp đồng đến", p.c && p.club != null ? "30/6/" + p.c.exp : "Tự do"],
          ["Điều khoản giải phóng", p.c?.rc ? fmtM(p.c.rc) : "Không có"],
          ["Vai trò", p.c ? p.c.role : "—"],
          ["Mùa này", `${p.apps} trận · ${p.goals} bàn`],
          ["Tổng từ khi bạn dẫn dắt", `${p.tot.apps} trận · ${p.tot.goals} bàn`],
          !!p.sellOn && ["Điều khoản bán lại", `${p.sellOn.pct}% cho ${C(p.sellOn.club).n}`],
          !!p.addon && !p.addon.paid && ["Thưởng theo số trận", `${fmtM(p.addon.amt)} sau ${p.addon.apps} trận`],
          !!p.promise && ["Cam kết với cầu thủ", `Đá chính ${p.promise.left} trận nữa`],
          !!p.loan && ["Đang mượn từ", `${C(p.loan.from).n} · trả ${p.loan.pct}% lương`],
        ]}
      />
      {p.hist.length > 0 && (
        <>
          <h3>Lịch sử chuyển nhượng</h3>
          {p.hist.map((h, i) => (
            <p key={i} className="hint">
              {h.y}: {h.from} → {h.to} · {h.fee ? fmtM(h.fee) : h.fee === null ? "đã có trong dữ liệu" : "miễn phí"}
            </p>
          ))}
        </>
      )}
    </>
  );
}

/** Cầu thủ đang đòi ra sân hoặc đòi ra đi: người chơi chọn cách đáp lại */
function DemandPanel({ p }: { p: Player }) {
  const d = p.demand!;
  const leave = d.kind === "leave";
  const nr = nextRole(p.c!.role);
  const answer = (c: DemandChoice) => toast(commit(() => respondDemand(p.id, c))?.msg ?? "");
  return (
    <div className="say bad col" role="group" aria-label={leave ? "Cầu thủ đòi ra đi" : "Cầu thủ đòi được ra sân"}>
      <b>{leave ? `${sn(p.n)} muốn ra đi` : `${sn(p.n)} đòi được ra sân`}</b>
      <p className="hint">
        {leave
          ? "Bạn có thể cam kết để xoa dịu, hoặc đồng ý rao bán / cho mượn. Giữ lại bằng mọi giá sẽ làm tinh thần sa sút."
          : "Cam kết cho đá chính nhiều trận thì cậu ấy yên tâm hơn, nhưng thất hứa sẽ phải trả giá."}
      </p>
      <div className="opts">
        {PROMISE_OPTS.map((n) => (
          <Button key={n} variant="ghost" size="sm" onClick={() => answer({ a: "promise", n })}>
            Cam kết đá chính {n} trận{leave ? ` (${Math.round(appeaseChance(p, n) * 100)}%)` : ""}
          </Button>
        ))}
      </div>
      <div className="opts">
        {!leave && nr && (
          <Button variant="ghost" size="sm" onClick={() => answer({ a: "promote" })}>
            Nâng vai trò lên "{nr}"
          </Button>
        )}
        {!leave && (
          <Button variant="ghost" size="sm" onClick={() => answer({ a: "persuade" })}>
            Khuyên nhủ, chờ cơ hội
          </Button>
        )}
        {leave && (
          <>
            <Button variant="ghost" size="sm" onClick={() => answer({ a: "sell" })}>
              Đồng ý rao bán
            </Button>
            <Button variant="ghost" size="sm" onClick={() => answer({ a: "loan" })}>
              Cho mượn
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => answer({ a: leave ? "hold" : "refuse" })}>
          {leave ? "Giữ lại bằng mọi giá" : "Từ chối thẳng"}
        </Button>
      </div>
    </div>
  );
}

function MineActions({ p }: { p: Player }) {
  const { setSwapIn, closeSheet, openNego, setTab } = useUi();
  const inXI = myXI().includes(p.id);
  return (
    <div className="col">
      {!inXI && available(p) && (
        <Button
          className="w-full"
          onClick={() => {
            closeSheet();
            setSwapIn(p.id);
            setTab("squad");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Đưa vào đội hình chính
        </Button>
      )}
      {!p.loan && (
        <div className="row">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const r = commit(() => renew(p.id))!;
              if (r.err) toast(r.err);
              else openNego(r.n!.id);
            }}
          >
            Gia hạn hợp đồng
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast(commit(() => toggleListed(p.id)) ? "Đã rao bán. Các CLB sẽ sớm liên hệ." : "Đã gỡ rao bán.")}
          >
            {p.listed ? "Gỡ rao bán" : "Rao bán"}
          </Button>
          {p.age <= 23 && (
            <Button variant="ghost" size="sm" onClick={() => commit(() => toggleLoanList(p.id))}>
              {p.loanList ? "Gỡ khỏi DS cho mượn" : "Cho mượn"}
            </Button>
          )}
        </div>
      )}
      <SelectField
        label="Vai trò trong đội"
        value={p.c!.role}
        onChange={(v) => {
          if (commit(() => setRole(p.id, v as Role))) toast(`${sn(p.n)} không vui khi bị hạ vai trò.`);
        }}
        options={ROLES.map((r): [string, string] => [r, r])}
      />
      <p className="hint">
        Vai trò là lời hứa về thời gian thi đấu. Cầu thủ "Ngôi sao" mong đá chính khoảng 80% số trận, "Dự bị" khoảng 10%. Không giữ lời thì
        tinh thần giảm.
      </p>
    </div>
  );
}

function BuyActions({ p }: { p: Player }) {
  const { openNego, form } = useUi();
  const free = p.club == null,
    pre = !free && yearsLeft(p) <= 1 && S.d >= WIN_WINTER[0];
  const est = feeEstimate(p);
  const dofKey = "dof:" + p.id,
    dofDef = r10(est[1] * 1.05);
  const go = (type: NegoType) => {
    const r = commit(() => enquire(p.id, type))!;
    if (r.err) toast(r.err);
    else openNego(r.n!.id);
  };
  const dof = () => {
    const max = (form[dofKey] as number | undefined) ?? dofDef;
    const r = commit(() => delegate(p.id, max))!;
    if (r.err) toast(r.err);
    else {
      toast("Đã giao cho Giám đốc thể thao.");
      openNego(r.n!.id);
    }
  };
  return (
    <div className="col">
      {free ? (
        <Button variant="hot" className="w-full" onClick={() => go("free")}>
          Đàm phán hợp đồng (tự do)
        </Button>
      ) : (
        <>
          <div className="row">
            <Button variant="hot" style={{ flex: 1 }} onClick={() => go("transfer")}>
              Thăm dò mua
            </Button>
            <Button variant="ghost" onClick={() => go("loan")}>
              Hỏi mượn
            </Button>
          </div>
          {pre && (
            <Button variant="ghost" className="w-full" onClick={() => go("pre")}>
              Ký trước (miễn phí từ 1/7)
            </Button>
          )}
          <RangeField
            k={dofKey}
            label="Giao Giám đốc thể thao, trần phí"
            min={r10(est[0] * 0.6)}
            max={Math.max(r10(est[1] * 2), r10(est[0] * 0.6) + 10)}
            step={10}
            fmt="m"
            def={dofDef}
          />
          <Button variant="ghost" size="sm" onClick={dof}>
            Giao việc
          </Button>
          <span className="hint">GĐTT tự đàm phán trong 2 ngày, không vượt trần bạn đặt.</span>
        </>
      )}
      <Button variant="ghost" size="sm" onClick={() => commit(() => toggleShortlist(p.id))}>
        {S.shortlist.includes(p.id) ? "Bỏ theo dõi" : "Theo dõi"}
      </Button>
    </div>
  );
}

export function PlayerSheet({ id }: { id: string }) {
  useGameVersion();
  const { ptab, setPtab, closeSheet, openNego } = useUi();
  const p = P(id);
  if (!p) return null;
  const mine = p.club === S.me || p.homeClub === S.me;
  const tab = ptab || (mine ? "info" : "scout");
  const neg = activeNegoFor(p.id);
  return (
    <Sheet onClose={closeSheet}>
      <PlayerHead p={p} onClose={closeSheet} />
      <Stats p={p} />
      <Seg
        value={tab}
        onChange={setPtab}
        items={[
          ["info", "Tổng quan"],
          ["scout", "Báo cáo tuyển trạch"],
        ]}
      />
      {mine && p.demand ? <DemandPanel p={p} /> : null}
      {tab === "info" ? <Info p={p} /> : <ScoutReport p={p} />}
      {neg ? (
        <Button variant="hot" className="w-full" onClick={() => openNego(neg.id)}>
          Xem thương vụ đang diễn ra
        </Button>
      ) : mine && !p.homeClub ? (
        <MineActions p={p} />
      ) : !mine ? (
        <BuyActions p={p} />
      ) : null}
    </Sheet>
  );
}
