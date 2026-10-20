// Các biểu mẫu trong bảng đàm phán. Giá trị lưu trong uiStore.form với khóa n.id + tên trường.
import { ROLES, TONES } from "@/engine/constants";
import { suggestReplies, type Reply } from "@/engine/dialogue";
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
  roleIdx,
  submitContract,
  triggerRC,
} from "@/engine/transfers";
import type { ClubOffer, ContractOffer, Negotiation, Player, Role } from "@/engine/types";
import { r10 } from "@/engine/util";
import { OptsField, RangeField, Sum, TermBadge, type TermState } from "@/components/ui";
import { commit } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { Button } from "@/components/shadcn/button";
import { SelectField } from "@/components/ui";

type Vals = Record<string, number | string>;
/** Đọc giá trị biểu mẫu kèm mặc định */
function useVals(n: Negotiation, defs: Vals) {
  const form = useUi((s) => s.form);
  const out: Vals = {};
  Object.keys(defs).forEach((k) => (out[k] = form[n.id + k] ?? defs[k]));
  return out;
}
/** Gợi ý ba câu trả lời để gửi kèm đề nghị; mỗi câu mang một giọng điệu khác nhau về rủi ro/lợi ích */
function ReplyField({ n, stage }: { n: Negotiation; stage: "club" | "contract" | "sell" }) {
  const key = n.id + "reply";
  const idx = (useUi((s) => s.form[key]) as number | undefined) ?? 0;
  const setForm = useUi((s) => s.setForm);
  const replies = suggestReplies(n, stage);
  return (
    <div className="fld">
      <div className="top">
        <span>Bạn đáp lại</span>
      </div>
      <div className="replies" role="radiogroup" aria-label="Câu trả lời gợi ý">
        {replies.map((r, i) => (
          <button key={r.tone} role="radio" aria-checked={idx === i} data-tone={r.tone} className="reply" onClick={() => setForm(key, i)}>
            <b>{TONES[r.tone].label}</b>
            <span>{r.text}</span>
          </button>
        ))}
      </div>
      <p className="hint">{TONES[replies[idx]?.tone ?? "calm"].hint}</p>
    </div>
  );
}
const replyOf = (n: Negotiation, stage: "club" | "contract" | "sell"): Reply => {
  const idx = (useUi.getState().form[n.id + "reply"] as number | undefined) ?? 0;
  const list = suggestReplies(n, stage);
  return list[idx] ?? list[0];
};

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
    act(() => submitClubOffer(n, o, replyOf(n, "club")), "Đã gửi đề nghị.");
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
      <SelectField
        label="Trao đổi cầu thủ"
        value={v.swap as string}
        onChange={(x) => setForm(k("swap"), x)}
        options={[["", "Không trao đổi"], ...mine.map((x): [string, string] => [x.id, `${x.n} (${x.pos}, ${ovrR(x)}, ${fmtM(x.val)})`])]}
      />
      <Sum
        rows={[
          ["Trả ngay", fmtM(now)],
          ["Ngân sách sau thương vụ", fmtM(me().budget - now), me().budget - now < 0 ? "no" : ""],
          ...(inst > 1 ? [["Các mùa sau", `${inst - 1} × ${fmtM(fee / inst)}`] as [string, string]] : []),
        ]}
      />
      <ReplyField n={n} stage="club" />
      <Button variant="hot" className="w-full" onClick={send}>
        Gửi đề nghị
      </Button>
      {p.c?.rc ? (
        <Button variant="ghost" className="w-full" onClick={() => act(() => triggerRC(n))}>
          Kích hoạt điều khoản giải phóng · {fmtM(p.c.rc)}
        </Button>
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
      <Button variant="hot" className="w-full" onClick={() => act(() => submitClubOffer(n, { fee: 0, inst: 1, pct }), "Đã gửi đề nghị.")}>
        Gửi đề nghị mượn
      </Button>
    </>
  );
}

export function ContractForm({ n, p }: { n: Negotiation; p: Player }) {
  const a = n.cAsk!;
  const defs: Vals = { wage: Math.round(a.wage * 0.92), years: a.years, signon: r10(a.signon * 0.8), role: a.role, rc: 0 };
  const v = useVals(n, defs);
  const k = (s: string) => n.id + s;
  const extra = (v.wage as number) - (n.type === "renew" ? p.c!.wage : 0);
  // Cùng ngưỡng với engine: lương/lót tay đạt khi ≥ mức đòi, vai trò đạt khi không thấp hơn, thời hạn đạt khi lệch ≤ 1 năm
  const st: Record<"wage" | "years" | "signon" | "role", TermState> = {
    wage: (v.wage as number) >= a.wage ? "ok" : (v.wage as number) >= a.wage * 0.9 ? "near" : "no",
    years: Math.abs((v.years as number) - a.years) <= 1 ? "ok" : "no",
    signon: (v.signon as number) >= a.signon ? "ok" : (v.signon as number) >= a.signon * 0.7 ? "near" : "no",
    role: roleIdx(v.role as Role) <= roleIdx(a.role) ? "ok" : roleIdx(v.role as Role) - roleIdx(a.role) === 1 ? "near" : "no",
  };
  const okCount = Object.values(st).filter((x) => x === "ok").length;
  const send = () => {
    const o: ContractOffer = {
      wage: v.wage as number,
      years: v.years as number,
      signon: v.signon as number,
      role: v.role as Role,
      rc: v.rc as number,
    };
    act(() => submitContract(n, o, replyOf(n, "contract")), "Đã gửi cho người đại diện.");
  };
  return (
    <>
      <Sum
        rows={[
          [
            <>
              Lương đòi <TermBadge state={st.wage} />
            </>,
            fmtW(a.wage),
          ],
          [
            <>
              Thời hạn mong muốn <TermBadge state={st.years} />
            </>,
            `${a.years} năm`,
          ],
          [
            <>
              Phí lót tay <TermBadge state={st.signon} />
            </>,
            fmtM(a.signon),
          ],
          [
            <>
              Vai trò kỳ vọng <TermBadge state={st.role} />
            </>,
            a.role,
          ],
        ]}
      />
      <div className="term-sum" data-state={okCount === 4 ? "ok" : okCount >= 2 ? "near" : "no"} role="status">
        {okCount === 4 ? "Đủ 4/4 điều kiện, đề nghị này rất có thể được chấp nhận" : `Đã đạt ${okCount}/4 điều kiện`}
      </div>
      <RangeField
        k={k("wage")}
        label="Lương"
        min={Math.max(2, Math.round(a.wage * 0.5))}
        max={Math.round(a.wage * 1.8) + 2}
        step={1}
        fmt="w"
        def={defs.wage as number}
        status={st.wage}
      />
      <OptsField
        k={k("years")}
        label="Thời hạn"
        def={a.years}
        status={st.years}
        list={[
          [1, "1 năm"],
          [2, "2"],
          [3, "3"],
          [4, "4"],
          [5, "5"],
        ]}
      />
      <RangeField
        k={k("signon")}
        label="Phí lót tay"
        min={0}
        max={r10(a.signon * 2.2)}
        step={10}
        fmt="m"
        def={defs.signon as number}
        status={st.signon}
      />
      <OptsField<string> k={k("role")} label="Vai trò trong đội" def={a.role} status={st.role} list={ROLES.map((r) => [r, r])} />
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
      <ReplyField n={n} stage="contract" />
      <Button variant="hot" className="w-full" onClick={send}>
        Gửi đề nghị hợp đồng
      </Button>
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
        <Button variant="hot" className="w-full" onClick={() => act(() => resolveTwist(n, true))}>
          Tăng 10% để giữ thương vụ
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => act(() => resolveTwist(n, false))}>
          Giữ nguyên, chấp nhận rủi ro (50%)
        </Button>
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
        <Button variant="hot" className="w-full" onClick={() => act(() => completeRenew(n), "Đã gia hạn hợp đồng.")}>
          Ký gia hạn
        </Button>
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
      <Button variant="hot" className="w-full" onClick={() => act(() => completeBuy(n), "Thương vụ hoàn tất!")}>
        Hoàn tất thương vụ
      </Button>
      {n.type === "transfer" && !n.pushed && !n.rcUsed && o.fee ? (
        <>
          <Button variant="ghost" className="w-full" onClick={() => act(() => finalPush(n))}>
            Ép giá lần cuối (−8%)
          </Button>
          <p className="hint">50% họ giảm giá, 35% giữ nguyên, 15% họ phật ý rút lui.</p>
        </>
      ) : null}
    </>
  );
}

export function SellForm({ n, p }: { n: Negotiation; p: Player }) {
  const fee = n.fee || 0;
  const cnt = useVals(n, { cnt: r10(fee * 1.2) }).cnt as number;
  const sell = (a: "accept" | "reject" | "counter") => act(() => respondSell(n, a, cnt, a === "counter" ? replyOf(n, "sell") : undefined));
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
        <Button variant="hot" className="w-full" onClick={() => sell("accept")}>
          Đồng ý cho mượn
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => sell("reject")}>
          Từ chối
        </Button>
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
      <Button variant="hot" className="w-full" onClick={() => sell("accept")}>
        Chấp nhận {fmtM(fee)}
      </Button>
      <RangeField k={n.id + "cnt"} label="Phản giá" min={fee} max={r10(fee * 2)} step={10} fmt="m" def={r10(fee * 1.2)} />
      <ReplyField n={n} stage="sell" />
      <Button variant="ghost" className="w-full" onClick={() => sell("counter")}>
        Gửi phản giá
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => sell("reject")}>
        Từ chối
      </Button>
    </>
  );
}
