import { setRole, toggleListed, toggleLoanList, toggleShortlist } from "@/engine/actions";
import { ROLES, WIN_WINTER } from "@/engine/constants";
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
import { useNavigate } from "react-router-dom";
import { PlayerHead } from "@/components/PlayerHead";
import { ScoutReport } from "./ScoutReport";

function Stats({ p }: { p: Player }) {
  return (
    <div className="stats">
      <div className="stat"><b style={{ color: mcol(p.form) }}>{Math.round(p.form)}</b><span>Phong độ</span></div>
      <div className="stat"><b style={{ color: mcol(p.mor) }}>{Math.round(p.mor)}</b><span>Tinh thần</span></div>
      <div className="stat"><b style={{ color: p.fit < 70 ? "var(--loss)" : "var(--win)" }}>{Math.round(p.fit)}</b><span>Thể lực</span></div>
      <div className="stat"><b>{p.inj > 0 ? p.inj + "n" : "Khỏe"}</b><span>Chấn thương</span></div>
    </div>
  );
}

function Info({ p }: { p: Player }) {
  return (
    <>
      <KV rows={[
        ["Giá trị", fmtM(p.val)],
        ["Lương", p.c ? fmtW(p.c.wage) : "—"],
        ["Hợp đồng đến", p.c && p.club != null ? "30/6/" + p.c.exp : "Tự do"],
        ["Điều khoản giải phóng", p.c?.rc ? fmtM(p.c.rc) : "Không có"],
        ["Vai trò", p.c ? p.c.role : "—"],
        ["Mùa này", `${p.apps} trận · ${p.goals} bàn`],
        ["Tổng từ khi bạn dẫn dắt", `${p.tot.apps} trận · ${p.tot.goals} bàn`],
        !!p.sellOn && ["Điều khoản bán lại", `${p.sellOn.pct}% cho ${C(p.sellOn.club).n}`],
        !!p.addon && !p.addon.paid && ["Thưởng theo số trận", `${fmtM(p.addon.amt)} sau ${p.addon.apps} trận`],
        !!p.loan && ["Đang mượn từ", `${C(p.loan.from).n} · trả ${p.loan.pct}% lương`],
      ]} />
      {p.hist.length > 0 && (
        <>
          <h3>Lịch sử chuyển nhượng</h3>
          {p.hist.map((h, i) => <p key={i} className="hint">{h.y}: {h.from} → {h.to} · {h.fee ? fmtM(h.fee) : h.fee === null ? "đã có trong dữ liệu" : "miễn phí"}</p>)}
        </>
      )}
    </>
  );
}

function MineActions({ p }: { p: Player }) {
  const nav = useNavigate();
  const { setSwapIn, closeSheet, openNego } = useUi();
  const inXI = myXI().includes(p.id);
  return (
    <div className="col">
      {!inXI && available(p) && <button className="btn block" onClick={() => { closeSheet(); setSwapIn(p.id); nav("/squad"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Đưa vào đội hình chính</button>}
      {!p.loan && (
        <div className="row">
          <button className="btn ghost sm" onClick={() => { const r = commit(() => renew(p.id))!; if (r.err) toast(r.err); else openNego(r.n!.id); }}>Gia hạn hợp đồng</button>
          <button className="btn ghost sm" onClick={() => toast(commit(() => toggleListed(p.id)) ? "Đã rao bán. Các CLB sẽ sớm liên hệ." : "Đã gỡ rao bán.")}>{p.listed ? "Gỡ rao bán" : "Rao bán"}</button>
          {p.age <= 23 && <button className="btn ghost sm" onClick={() => commit(() => toggleLoanList(p.id))}>{p.loanList ? "Gỡ khỏi DS cho mượn" : "Cho mượn"}</button>}
        </div>
      )}
      <label className="lbl">Vai trò trong đội
        <select value={p.c!.role} onChange={(e) => { if (commit(() => setRole(p.id, e.target.value as Role))) toast(`${sn(p.n)} không vui khi bị hạ vai trò.`); }}>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <p className="hint">Vai trò là lời hứa về thời gian thi đấu. Cầu thủ "Ngôi sao" mong đá chính khoảng 80% số trận, "Dự bị" khoảng 10%. Không giữ lời thì tinh thần giảm.</p>
    </div>
  );
}

function BuyActions({ p }: { p: Player }) {
  const { openNego, form } = useUi();
  const free = p.club == null, pre = !free && yearsLeft(p) <= 1 && S.d >= WIN_WINTER[0];
  const est = feeEstimate(p);
  const dofKey = "dof:" + p.id, dofDef = r10(est[1] * 1.05);
  const go = (type: NegoType) => {
    const r = commit(() => enquire(p.id, type))!;
    if (r.err) toast(r.err); else openNego(r.n!.id);
  };
  const dof = () => {
    const max = (form[dofKey] as number | undefined) ?? dofDef;
    const r = commit(() => delegate(p.id, max))!;
    if (r.err) toast(r.err); else { toast("Đã giao cho Giám đốc thể thao."); openNego(r.n!.id); }
  };
  return (
    <div className="col">
      {free ? <button className="btn hot block" onClick={() => go("free")}>Đàm phán hợp đồng (tự do)</button> : (
        <>
          <div className="row"><button className="btn hot" style={{ flex: 1 }} onClick={() => go("transfer")}>Thăm dò mua</button><button className="btn ghost" onClick={() => go("loan")}>Hỏi mượn</button></div>
          {pre && <button className="btn ghost block" onClick={() => go("pre")}>Ký trước (miễn phí từ 1/7)</button>}
          <RangeField k={dofKey} label="Giao Giám đốc thể thao, trần phí" min={r10(est[0] * 0.6)} max={Math.max(r10(est[1] * 2), r10(est[0] * 0.6) + 10)} step={10} fmt="m" def={dofDef} />
          <button className="btn ghost sm" onClick={dof}>Giao việc</button>
          <span className="hint">GĐTT tự đàm phán trong 2 ngày, không vượt trần bạn đặt.</span>
        </>
      )}
      <button className="btn ghost sm" onClick={() => commit(() => toggleShortlist(p.id))}>{S.shortlist.includes(p.id) ? "Bỏ theo dõi" : "Theo dõi"}</button>
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
      <Seg value={tab} onChange={setPtab} items={[["info", "Tổng quan"], ["scout", "Báo cáo tuyển trạch"]]} />
      {tab === "info" ? <Info p={p} /> : <ScoutReport p={p} />}
      {neg ? <button className="btn hot block" onClick={() => openNego(neg.id)}>Xem thương vụ đang diễn ra</button>
        : mine && !p.homeClub ? <MineActions p={p} />
        : !mine ? <BuyActions p={p} /> : null}
    </Sheet>
  );
}
