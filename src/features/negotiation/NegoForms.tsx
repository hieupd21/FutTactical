// Các biểu mẫu trong bảng đàm phán. Giá trị lưu trong uiStore.form với khóa n.id + tên trường.
import { ROLES } from "@/engine/constants";
import { myWages } from "@/engine/board";
import { fmtM, fmtW } from "@/engine/format";
import { ovrR } from "@/engine/players";
import { clubPlayers } from "@/engine/squad";
import { C, me, P, S, windowNow } from "@/engine/state";
import {
  completeBuy,
  completeRenew,
  finalPush,
  resolveTwist,
  respondSell,
  submitClubOffer,
  submitContract,
  triggerRC,
} from "@/engine/transfers";
import type { ClubOffer, ContractOffer, Negotiation, Player, Role } from "@/engine/types";
import { r10 } from "@/engine/util";
import { OptsField, RangeField, Sum } from "@/components/ui";
import { commit } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";

type Vals = Record<string, number | string>;
/** Đọc giá trị biểu mẫu kèm mặc định */
function useVals(n: Negotiation, defs: Vals) {
  const form = useUi((s) => s.form);
  const out: Vals = {};
  Object.keys(defs).forEach((k) => (out[k] = form[n.id + k] ?? defs[k]));
  return out;
}
/** Chạy hành động engine, hiện lỗi trong bảng nếu có */
function act(fn: () => { err?: string } | void, ok?: string) {
  const r = commit(fn);
  if (r && r.err) useUi.getState().setErr(r.err);
  else {
    useUi.getState().setErr(null);
    if (ok) toast(ok);
  }
}

export function ClubForm({ n, p }: { n: Negotiation; p: Player }) {
  const ask = n.ask || 0;
  const defs: Vals = { fee: r10(ask * 0.9), inst: 1, addon: 0, sellon: 0, lb: 0, swap: "", timing: windowNow() ? "now" : "next" };
  const v = useVals(n, defs);
  const setForm = useUi((s) => s.setForm);
  const fee = v.fee as number,
    inst = v.inst as number;
  const mine = clubPlayers(S.me)
    .filter((x) => !x.loan && !x.away)
    .sort((a, b) => b.val - a.val);
  const now = inst > 1 ? fee / inst : fee;
  const k = (s: string) => n.id + s;
  const send = () => {
    const o: ClubOffer = {
      fee,
      inst,
      addon: v.addon as number,
      sellon: v.sellon as number,
      loanback: !!v.lb,
      swap: (v.swap as string) || null,
      timing: v.timing as "now" | "next",
    };
    act(() => submitClubOffer(n, o), "Đã gửi đề nghị.");
  };
  return (
    <>
      {n.counter ? (
        <p className="hint">
          Mức họ đang đòi: <b>{fmtM(n.counter)}</b> (đã quy đổi trả góp, thưởng, trao đổi)
        </p>
      ) : null}
      <RangeField
        k={k("fee")}
        label="Phí chuyển nhượng"
        min={r10(ask * 0.3)}
        max={r10(ask * 2)}
        step={10}
        fmt="m"
        def={defs.fee as number}
      />
      <div className="quick">
        {(
          [
            [0.8, "−20%"],
            [0.9, "−10%"],
            [1, "Giá họ đòi"],
            [1.1, "+10%"],
          ] as const
        ).map(([m, l]) => (
          <button key={l} onClick={() => setForm(k("fee"), r10(ask * m))}>
            {l}
          </button>
        ))}
      </div>
      <OptsField
        k={k("inst")}
        label="Hình thức thanh toán"
        def={1}
        list={[
          [1, "Trả ngay"],
          [2, "Góp 2 mùa"],
          [3, "Góp 3 mùa"],
        ]}
      />
      <OptsField
        k={k("addon")}
        label="Thưởng khi đá đủ 20 trận"
        def={0}
        list={[
          [0, "Không"],
          [r10(fee * 0.1), "+" + fmtM(fee * 0.1)],
          [r10(fee * 0.2), "+" + fmtM(fee * 0.2)],
        ]}
      />
      <OptsField
        k={k("sellon")}
        label="% phí chia cho họ khi bạn bán lại"
        def={0}
        list={[
          [0, "0%"],
          [10, "10%"],
          [20, "20%"],
          [30, "30%"],
        ]}
      />
      <OptsField
        k={k("lb")}
        label="Cho mượn lại"
        def={0}
        list={[
          [0, "Không"],
          [1, "Cho mượn lại đến hết mùa"],
        ]}
      />
      <OptsField
        k={k("timing")}
        label="Thời điểm"
        def={defs.timing as string}
        list={
          windowNow()
            ? [
                ["now", "Gia nhập ngay"],
                ["next", "Kỳ chuyển nhượng sau"],
              ]
            : [["next", "Kỳ chuyển nhượng sau"]]
        }
      />
      <label className="lbl">
        Trao đổi cầu thủ
        <select value={v.swap as string} onChange={(e) => setForm(k("swap"), e.target.value)}>
          <option value="">Không trao đổi</option>
          {mine.map((x) => (
            <option key={x.id} value={x.id}>
              {x.n} ({x.pos}, {ovrR(x)}, {fmtM(x.val)})
            </option>
          ))}
        </select>
      </label>
      <Sum
        rows={[
          ["Trả ngay", fmtM(now)],
          ["Ngân sách sau thương vụ", fmtM(me().budget - now), me().budget - now < 0 ? "no" : ""],
          ...(inst > 1 ? [["Các mùa sau", `${inst - 1} × ${fmtM(fee / inst)}`] as [string, string]] : []),
        ]}
      />
      <button className="btn hot block" onClick={send}>
        Gửi đề nghị
      </button>
      {p.c?.rc ? (
        <button className="btn ghost block" onClick={() => act(() => triggerRC(n))}>
          Kích hoạt điều khoản giải phóng · {fmtM(p.c.rc)}
        </button>
      ) : null}
    </>
  );
}

export function LoanForm({ n, p }: { n: Negotiation; p: Player }) {
  const pct = useVals(n, { pct: 50 }).pct as number;
  const wage = p.c!.wage;
  return (
    <>
      <RangeField k={n.id + "pct"} label="Bạn trả bao nhiêu % lương" min={0} max={100} step={5} fmt="p" def={50} />
      <Sum
        rows={[
          ["Lương cầu thủ", fmtW(wage)],
          ["Bạn trả", fmtW((wage * pct) / 100)],
          ["Quỹ lương còn sau đó", fmtW(S.wageCap - myWages() - (wage * pct) / 100)],
        ]}
      />
      <button className="btn hot block" onClick={() => act(() => submitClubOffer(n, { fee: 0, inst: 1, pct }), "Đã gửi đề nghị.")}>
        Gửi đề nghị mượn
      </button>
    </>
  );
}

export function ContractForm({ n, p }: { n: Negotiation; p: Player }) {
  const a = n.cAsk!;
  const defs: Vals = { wage: Math.round(a.wage * 0.92), years: a.years, signon: r10(a.signon * 0.8), role: a.role, rc: 0 };
  const v = useVals(n, defs);
  const k = (s: string) => n.id + s;
  const extra = (v.wage as number) - (n.type === "renew" ? p.c!.wage : 0);
  const send = () => {
    const o: ContractOffer = {
      wage: v.wage as number,
      years: v.years as number,
      signon: v.signon as number,
      role: v.role as Role,
      rc: v.rc as number,
    };
    act(() => submitContract(n, o), "Đã gửi cho người đại diện.");
  };
  return (
    <>
      <Sum
        rows={[
          ["Người đại diện đòi", fmtW(a.wage)],
          ["Thời hạn mong muốn", `${a.years} năm`],
          ["Phí lót tay", fmtM(a.signon)],
          ["Vai trò kỳ vọng", a.role],
        ]}
      />
      <RangeField
        k={k("wage")}
        label="Lương"
        min={Math.max(2, Math.round(a.wage * 0.5))}
        max={Math.round(a.wage * 1.8) + 2}
        step={1}
        fmt="w"
        def={defs.wage as number}
      />
      <OptsField
        k={k("years")}
        label="Thời hạn"
        def={a.years}
        list={[
          [1, "1 năm"],
          [2, "2"],
          [3, "3"],
          [4, "4"],
          [5, "5"],
        ]}
      />
      <RangeField k={k("signon")} label="Phí lót tay" min={0} max={r10(a.signon * 2.2)} step={10} fmt="m" def={defs.signon as number} />
      <OptsField<string> k={k("role")} label="Vai trò trong đội" def={a.role} list={ROLES.map((r) => [r, r])} />
      <OptsField
        k={k("rc")}
        label="Điều khoản giải phóng"
        def={0}
        list={[
          [0, "Không"],
          [r10(p.val * 2), "×2 giá trị"],
          [r10(p.val * 3), "×3 giá trị"],
        ]}
      />
      <Sum
        rows={[
          ["Tổng lương sau ký", `${fmtW(myWages() + extra)} / ${fmtW(S.wageCap)}`, myWages() + extra > S.wageCap ? "no" : ""],
          ["Phí lót tay + người đại diện", fmtM((v.signon as number) * 1.5)],
        ]}
      />
      <p className="hint">
        Hứa vai trò cao hơn kỳ vọng giúp dễ thuyết phục, nhưng nếu không cho đá đủ, tinh thần cầu thủ sẽ sụt. Có điều khoản giải phóng thì
        cầu thủ dễ chịu hơn một chút.
      </p>
      <button className="btn hot block" onClick={send}>
        Gửi đề nghị hợp đồng
      </button>
    </>
  );
}

export function FinalForm({ n, p }: { n: Negotiation; p: Player }) {
  if (n.twist) {
    return (
      <>
        <div className="say bad">
          {C(n.twist.club).n} cũng muốn {p.n}. Bạn phản ứng thế nào?
        </div>
        <button className="btn hot block" onClick={() => act(() => resolveTwist(n, true))}>
          Tăng 10% để giữ thương vụ
        </button>
        <button className="btn ghost block" onClick={() => act(() => resolveTwist(n, false))}>
          Giữ nguyên, chấp nhận rủi ro (50%)
        </button>
      </>
    );
  }
  const co = n.cOffer!;
  if (n.type === "renew") {
    return (
      <>
        <Sum
          rows={[
            ["Lương mới", fmtW(co.wage)],
            ["Đến", `30/6/${S.year + co.years}`],
            ["Vai trò", co.role],
          ]}
        />
        <button className="btn hot block" onClick={() => act(() => completeRenew(n), "Đã gia hạn hợp đồng.")}>
          Ký gia hạn
        </button>
      </>
    );
  }
  const o = n.offer || { fee: 0, inst: 1 };
  const rows: [string, string][] =
    n.type === "loan"
      ? [["Hình thức", `Mượn đến 30/6 · trả ${o.pct}% lương`]]
      : [
          ["Phí", `${fmtM(o.fee)}${o.inst > 1 ? ` · góp ${o.inst} mùa` : ""}`],
          ...(o.addon ? [["Thưởng 20 trận", fmtM(o.addon)] as [string, string]] : []),
          ...(o.sellon ? [["Bán lại", `${o.sellon}%`] as [string, string]] : []),
          ...(o.swap && P(o.swap) ? [["Trao đổi", P(o.swap).n] as [string, string]] : []),
          ...(o.loanback ? [["Cho mượn lại", "Đến hết mùa"] as [string, string]] : []),
          ["Lương", `${fmtW(co.wage)} · ${co.years} năm`],
          ["Lót tay + người đại diện", fmtM(co.signon * 1.5)],
          ["Vai trò", co.role],
        ];
  return (
    <>
      <Sum rows={rows} />
      <button className="btn hot block" onClick={() => act(() => completeBuy(n), "Thương vụ hoàn tất!")}>
        Hoàn tất thương vụ
      </button>
      {n.type === "transfer" && !n.pushed && !n.rcUsed && o.fee ? (
        <>
          <button className="btn ghost block" onClick={() => act(() => finalPush(n))}>
            Ép giá lần cuối (−8%)
          </button>
          <p className="hint">50% họ giảm giá, 35% giữ nguyên, 15% họ phật ý rút lui.</p>
        </>
      ) : null}
    </>
  );
}

export function SellForm({ n, p }: { n: Negotiation; p: Player }) {
  const fee = n.fee || 0;
  const cnt = useVals(n, { cnt: r10(fee * 1.2) }).cnt as number;
  const sell = (a: "accept" | "reject" | "counter") => act(() => respondSell(n, a, cnt));
  if (n.type === "loanout") {
    return (
      <>
        <Sum
          rows={[
            ["CLB", C(n.buyer!).n],
            ["Họ trả", `${n.pct}% lương`],
            ["Thời hạn", "Đến 30/6"],
          ]}
        />
        <button className="btn hot block" onClick={() => sell("accept")}>
          Đồng ý cho mượn
        </button>
        <button className="btn ghost block" onClick={() => sell("reject")}>
          Từ chối
        </button>
      </>
    );
  }
  return (
    <>
      <Sum
        rows={[
          ["Đề nghị", `${fmtM(fee)}${(n.inst || 1) > 1 ? " · góp 2 mùa" : ""}`],
          ["Giá trị cầu thủ", fmtM(p.val)],
          ...(p.sellOn ? [[`Chia cho ${C(p.sellOn.club).n}`, `${p.sellOn.pct}%`] as [string, string]] : []),
          ["Mua về với giá", p.joinedFee != null ? fmtM(p.joinedFee) : "Đào tạo / có sẵn"],
        ]}
      />
      <button className="btn hot block" onClick={() => sell("accept")}>
        Chấp nhận {fmtM(fee)}
      </button>
      <RangeField k={n.id + "cnt"} label="Phản giá" min={fee} max={r10(fee * 2)} step={10} fmt="m" def={r10(fee * 1.2)} />
      <button className="btn ghost block" onClick={() => sell("counter")}>
        Gửi phản giá
      </button>
      <button className="btn ghost block" onClick={() => sell("reject")}>
        Từ chối
      </button>
    </>
  );
}
