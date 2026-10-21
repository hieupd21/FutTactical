// Các biểu mẫu trong bảng đàm phán. Giá trị lưu trong uiStore.form với khóa n.id + tên trường.
import { ROLES, TONES } from "@/engine/constants";
import { suggestReplies, type Reply } from "@/engine/dialogue";
import { myWages } from "@/engine/board";
import { formatMoney, formatWage } from "@/engine/format";
import { ovrRange } from "@/engine/players";
import { clubPlayers } from "@/engine/squad";
import { getClub, myClub, getPlayer, gameState, windowNow } from "@/engine/state";
import {
  completeBuy,
  completeRenew,
  finalPush,
  resolveTwist,
  respondSell,
  submitClubOffer,
  roleIdx,
  submitContract,
  triggerReleaseClause,
} from "@/engine/transfers";
import type { ClubOffer, ContractOffer, Negotiation, Player, Role } from "@/engine/types";
import { roundToTen } from "@/engine/util";
import { OptsField, RangeField, SummaryRows, TermBadge, type TermState } from "@/components/ui";
import { commit } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { Button } from "@/components/shadcn/button";
import { SelectField } from "@/components/ui";

type Vals = Record<string, number | string>;
/** Đọc giá trị biểu mẫu kèm mặc định */
function useFormValues(negotiation: Negotiation, defs: Vals) {
  const form = useUi((ui) => ui.form);
  const values: Vals = {};
  Object.keys(defs).forEach((key) => (values[key] = form[negotiation.id + key] ?? defs[key]));
  return values;
}
/** Gợi ý ba câu trả lời để gửi kèm đề nghị; mỗi câu mang một giọng điệu khác nhau về rủi ro/lợi ích */
function ReplyField({
  negotiation,
  stage,
}: {
  negotiation: Negotiation;
  stage: "club" | "contract" | "sell";
}) {
  const key = negotiation.id + "reply";
  const selectedIndex = (useUi((ui) => ui.form[key]) as number | undefined) ?? 0;
  const setForm = useUi((ui) => ui.setForm);
  const replies = suggestReplies(negotiation, stage);
  return (
    <div className="fld">
      <div className="top">
        <span>Bạn đáp lại</span>
      </div>
      <div className="replies" role="radiogroup" aria-label="Câu trả lời gợi ý">
        {replies.map((reply, i) => (
          <button
            key={reply.tone}
            role="radio"
            aria-checked={selectedIndex === i}
            data-tone={reply.tone}
            className="reply"
            onClick={() => setForm(key, i)}
          >
            <b>{TONES[reply.tone].label}</b>
            <span>{reply.text}</span>
          </button>
        ))}
      </div>
      <p className="hint">{TONES[replies[selectedIndex]?.tone ?? "calm"].hint}</p>
    </div>
  );
}
const replyOf = (negotiation: Negotiation, stage: "club" | "contract" | "sell"): Reply => {
  const selectedIndex =
    (useUi.getState().form[negotiation.id + "reply"] as number | undefined) ?? 0;
  const list = suggestReplies(negotiation, stage);
  return list[selectedIndex] ?? list[0];
};

/** Chạy hành động engine, hiện lỗi trong bảng nếu có */
function runAction(action: () => { error?: string } | void, ok?: string) {
  const outcome = commit(action);
  if (outcome && outcome.error) useUi.getState().setErr(outcome.error);
  else {
    useUi.getState().setErr(null);
    if (ok) toast(ok);
  }
}

export function ClubForm({ negotiation, player }: { negotiation: Negotiation; player: Player }) {
  const askingFee = negotiation.askingFee || 0;
  const defs: Vals = {
    fee: roundToTen(askingFee * 0.9),
    installmentCount: 1,
    addon: 0,
    sellOnPercent: 0,
    loanBack: 0,
    swap: "",
    timing: windowNow() ? "now" : "next",
  };
  const values = useFormValues(negotiation, defs);
  const setForm = useUi((ui) => ui.setForm);
  const fee = values.fee as number,
    installmentCount = values.installmentCount as number;
  const mine = clubPlayers(gameState.myClubId)
    .filter((candidate) => !candidate.loan && !candidate.away)
    .sort((playerA, playerB) => playerB.marketValue - playerA.marketValue);
  const payNow = installmentCount > 1 ? fee / installmentCount : fee;
  const fieldKey = (suffix: string) => negotiation.id + suffix;
  const send = () => {
    const clubOffer: ClubOffer = {
      fee,
      installments: installmentCount,
      addon: values.addon as number,
      sellOnPercent: values.sellOnPercent as number,
      loanback: !!values.loanBack,
      swapPlayerId: (values.swap as string) || null,
      timing: values.timing as "now" | "next",
    };
    runAction(
      () => submitClubOffer(negotiation, clubOffer, replyOf(negotiation, "club")),
      "Đã gửi đề nghị.",
    );
  };
  return (
    <>
      {negotiation.counter ? (
        <p className="hint">
          Mức họ đang đòi: <b>{formatMoney(negotiation.counter)}</b> (đã quy đổi trả góp, thưởng,
          trao đổi)
        </p>
      ) : null}
      <RangeField
        fieldKey={fieldKey("fee")}
        label="Phí chuyển nhượng"
        min={roundToTen(askingFee * 0.3)}
        max={roundToTen(askingFee * 2)}
        step={10}
        format="m"
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
        ).map(([multiplier, label]) => (
          <button
            key={label}
            onClick={() => setForm(fieldKey("fee"), roundToTen(askingFee * multiplier))}
          >
            {label}
          </button>
        ))}
      </div>
      <OptsField
        fieldKey={fieldKey("installmentCount")}
        label="Hình thức thanh toán"
        def={1}
        list={[
          [1, "Trả ngay"],
          [2, "Góp 2 mùa"],
          [3, "Góp 3 mùa"],
        ]}
      />
      <OptsField
        fieldKey={fieldKey("addon")}
        label="Thưởng khi đá đủ 20 trận"
        def={0}
        list={[
          [0, "Không"],
          [roundToTen(fee * 0.1), "+" + formatMoney(fee * 0.1)],
          [roundToTen(fee * 0.2), "+" + formatMoney(fee * 0.2)],
        ]}
      />
      <OptsField
        fieldKey={fieldKey("sellOnPercent")}
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
        fieldKey={fieldKey("loanBack")}
        label="Cho mượn lại"
        def={0}
        list={[
          [0, "Không"],
          [1, "Cho mượn lại đến hết mùa"],
        ]}
      />
      <OptsField
        fieldKey={fieldKey("timing")}
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
        value={values.swap as string}
        onChange={(swapPlayerId) => setForm(fieldKey("swap"), swapPlayerId)}
        options={[
          ["", "Không trao đổi"],
          ...mine.map((candidate): [string, string] => [
            candidate.id,
            `${candidate.name} (${candidate.pos}, ${ovrRange(candidate)}, ${formatMoney(candidate.marketValue)})`,
          ]),
        ]}
      />
      <SummaryRows
        rows={[
          ["Trả ngay", formatMoney(payNow)],
          [
            "Ngân sách sau thương vụ",
            formatMoney(myClub().budget - payNow),
            myClub().budget - payNow < 0 ? "no" : "",
          ],
          ...(installmentCount > 1
            ? [
                [
                  "Các mùa sau",
                  `${installmentCount - 1} × ${formatMoney(fee / installmentCount)}`,
                ] as [string, string],
              ]
            : []),
        ]}
      />
      <ReplyField negotiation={negotiation} stage="club" />
      <Button variant="hot" className="w-full" onClick={send}>
        Gửi đề nghị
      </Button>
      {player.contract?.releaseClause ? (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => runAction(() => triggerReleaseClause(negotiation))}
        >
          Kích hoạt điều khoản giải phóng · {formatMoney(player.contract.releaseClause)}
        </Button>
      ) : null}
    </>
  );
}

export function LoanForm({ negotiation, player }: { negotiation: Negotiation; player: Player }) {
  const percent = useFormValues(negotiation, { percent: 50 }).percent as number;
  const wage = player.contract!.wage;
  return (
    <>
      <RangeField
        fieldKey={negotiation.id + "percent"}
        label="Bạn trả bao nhiêu % lương"
        min={0}
        max={100}
        step={5}
        format="p"
        def={50}
      />
      <SummaryRows
        rows={[
          ["Lương cầu thủ", formatWage(wage)],
          ["Bạn trả", formatWage((wage * percent) / 100)],
          [
            "Quỹ lương còn sau đó",
            formatWage(gameState.wageCap - myWages() - (wage * percent) / 100),
          ],
        ]}
      />
      <Button
        variant="hot"
        className="w-full"
        onClick={() =>
          runAction(
            () => submitClubOffer(negotiation, { fee: 0, installments: 1, percent }),
            "Đã gửi đề nghị.",
          )
        }
      >
        Gửi đề nghị mượn
      </Button>
    </>
  );
}

export function ContractForm({
  negotiation,
  player,
}: {
  negotiation: Negotiation;
  player: Player;
}) {
  const contractOffer = negotiation.contractAsk!;
  const defs: Vals = {
    wage: Math.round(contractOffer.wage * 0.92),
    years: contractOffer.years,
    signingBonus: roundToTen(contractOffer.signingBonus * 0.8),
    role: contractOffer.role,
    releaseClause: 0,
  };
  const values = useFormValues(negotiation, defs);
  const fieldKey = (suffix: string) => negotiation.id + suffix;
  const extra =
    (values.wage as number) - (negotiation.type === "renew" ? player.contract!.wage : 0);
  // Cùng ngưỡng với engine: lương/lót tay đạt khi ≥ mức đòi, vai trò đạt khi không thấp hơn, thời hạn đạt khi lệch ≤ 1 năm
  const termStates: Record<"wage" | "years" | "signingBonus" | "role", TermState> = {
    wage:
      (values.wage as number) >= contractOffer.wage
        ? "ok"
        : (values.wage as number) >= contractOffer.wage * 0.9
          ? "near"
          : "no",
    years: Math.abs((values.years as number) - contractOffer.years) <= 1 ? "ok" : "no",
    signingBonus:
      (values.signingBonus as number) >= contractOffer.signingBonus
        ? "ok"
        : (values.signingBonus as number) >= contractOffer.signingBonus * 0.7
          ? "near"
          : "no",
    role:
      roleIdx(values.role as Role) <= roleIdx(contractOffer.role)
        ? "ok"
        : roleIdx(values.role as Role) - roleIdx(contractOffer.role) === 1
          ? "near"
          : "no",
  };
  const okCount = Object.values(termStates).filter((termState) => termState === "ok").length;
  const send = () => {
    const contractTerms: ContractOffer = {
      wage: values.wage as number,
      years: values.years as number,
      signingBonus: values.signingBonus as number,
      role: values.role as Role,
      releaseClause: values.releaseClause as number,
    };
    runAction(
      () => submitContract(negotiation, contractTerms, replyOf(negotiation, "contract")),
      "Đã gửi cho người đại diện.",
    );
  };
  return (
    <>
      <SummaryRows
        rows={[
          [
            <>
              Lương đòi <TermBadge state={termStates.wage} />
            </>,
            formatWage(contractOffer.wage),
          ],
          [
            <>
              Thời hạn mong muốn <TermBadge state={termStates.years} />
            </>,
            `${contractOffer.years} năm`,
          ],
          [
            <>
              Phí lót tay <TermBadge state={termStates.signingBonus} />
            </>,
            formatMoney(contractOffer.signingBonus),
          ],
          [
            <>
              Vai trò kỳ vọng <TermBadge state={termStates.role} />
            </>,
            contractOffer.role,
          ],
        ]}
      />
      <div
        className="term-sum"
        data-state={okCount === 4 ? "ok" : okCount >= 2 ? "near" : "no"}
        role="status"
      >
        {okCount === 4
          ? "Đủ 4/4 điều kiện, đề nghị này rất có thể được chấp nhận"
          : `Đã đạt ${okCount}/4 điều kiện`}
      </div>
      <RangeField
        fieldKey={fieldKey("wage")}
        label="Lương"
        min={Math.max(2, Math.round(contractOffer.wage * 0.5))}
        max={Math.round(contractOffer.wage * 1.8) + 2}
        step={1}
        format="w"
        def={defs.wage as number}
        status={termStates.wage}
      />
      <OptsField
        fieldKey={fieldKey("years")}
        label="Thời hạn"
        def={contractOffer.years}
        status={termStates.years}
        list={[
          [1, "1 năm"],
          [2, "2"],
          [3, "3"],
          [4, "4"],
          [5, "5"],
        ]}
      />
      <RangeField
        fieldKey={fieldKey("signingBonus")}
        label="Phí lót tay"
        min={0}
        max={roundToTen(contractOffer.signingBonus * 2.2)}
        step={10}
        format="m"
        def={defs.signingBonus as number}
        status={termStates.signingBonus}
      />
      <OptsField<string>
        fieldKey={fieldKey("role")}
        label="Vai trò trong đội"
        def={contractOffer.role}
        status={termStates.role}
        list={ROLES.map((role) => [role, role])}
      />
      <OptsField
        fieldKey={fieldKey("releaseClause")}
        label="Điều khoản giải phóng"
        def={0}
        list={[
          [0, "Không"],
          [roundToTen(player.marketValue * 2), "×2 giá trị"],
          [roundToTen(player.marketValue * 3), "×3 giá trị"],
        ]}
      />
      <SummaryRows
        rows={[
          [
            "Tổng lương sau ký",
            `${formatWage(myWages() + extra)} / ${formatWage(gameState.wageCap)}`,
            myWages() + extra > gameState.wageCap ? "no" : "",
          ],
          ["Phí lót tay + người đại diện", formatMoney((values.signingBonus as number) * 1.5)],
        ]}
      />
      <p className="hint">
        Hứa vai trò cao hơn kỳ vọng giúp dễ thuyết phục, nhưng nếu không cho đá đủ, tinh thần cầu
        thủ sẽ sụt. Có điều khoản giải phóng thì cầu thủ dễ chịu hơn một chút.
      </p>
      <ReplyField negotiation={negotiation} stage="contract" />
      <Button variant="hot" className="w-full" onClick={send}>
        Gửi đề nghị hợp đồng
      </Button>
    </>
  );
}

export function FinalForm({ negotiation, player }: { negotiation: Negotiation; player: Player }) {
  if (negotiation.twist) {
    return (
      <>
        <div className="say bad">
          {getClub(negotiation.twist.club).name} cũng muốn {player.name}. Bạn phản ứng thế nào?
        </div>
        <Button
          variant="hot"
          className="w-full"
          onClick={() => runAction(() => resolveTwist(negotiation, true))}
        >
          Tăng 10% để giữ thương vụ
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => runAction(() => resolveTwist(negotiation, false))}
        >
          Giữ nguyên, chấp nhận rủi ro (50%)
        </Button>
      </>
    );
  }
  const contractOffer = negotiation.contractOffer!;
  if (negotiation.type === "renew") {
    return (
      <>
        <SummaryRows
          rows={[
            ["Lương mới", formatWage(contractOffer.wage)],
            ["Đến", `30/6/${gameState.year + contractOffer.years}`],
            ["Vai trò", contractOffer.role],
          ]}
        />
        <Button
          variant="hot"
          className="w-full"
          onClick={() => runAction(() => completeRenew(negotiation), "Đã gia hạn hợp đồng.")}
        >
          Ký gia hạn
        </Button>
      </>
    );
  }
  const clubOffer = negotiation.offer || { fee: 0, installments: 1 };
  const rows: [string, string][] =
    negotiation.type === "loan"
      ? [["Hình thức", `Mượn đến 30/6 · trả ${clubOffer.percent}% lương`]]
      : [
          [
            "Phí",
            `${formatMoney(clubOffer.fee)}${clubOffer.installments > 1 ? ` · góp ${clubOffer.installments} mùa` : ""}`,
          ],
          ...(clubOffer.addon
            ? [["Thưởng 20 trận", formatMoney(clubOffer.addon)] as [string, string]]
            : []),
          ...(clubOffer.sellOnPercent
            ? [["Bán lại", `${clubOffer.sellOnPercent}%`] as [string, string]]
            : []),
          ...(clubOffer.swapPlayerId && getPlayer(clubOffer.swapPlayerId)
            ? [["Trao đổi", getPlayer(clubOffer.swapPlayerId).name] as [string, string]]
            : []),
          ...(clubOffer.loanback ? [["Cho mượn lại", "Đến hết mùa"] as [string, string]] : []),
          ["Lương", `${formatWage(contractOffer.wage)} · ${contractOffer.years} năm`],
          ["Lót tay + người đại diện", formatMoney(contractOffer.signingBonus * 1.5)],
          ["Vai trò", contractOffer.role],
        ];
  return (
    <>
      <SummaryRows rows={rows} />
      <Button
        variant="hot"
        className="w-full"
        onClick={() => runAction(() => completeBuy(negotiation), "Thương vụ hoàn tất!")}
      >
        Hoàn tất thương vụ
      </Button>
      {negotiation.type === "transfer" &&
      !negotiation.pushed &&
      !negotiation.releaseClauseUsed &&
      clubOffer.fee ? (
        <>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => runAction(() => finalPush(negotiation))}
          >
            Ép giá lần cuối (−8%)
          </Button>
          <p className="hint">50% họ giảm giá, 35% giữ nguyên, 15% họ phật ý rút lui.</p>
        </>
      ) : null}
    </>
  );
}

export function SellForm({ negotiation, player }: { negotiation: Negotiation; player: Player }) {
  const fee = negotiation.fee || 0;
  const count = useFormValues(negotiation, { counterFee: roundToTen(fee * 1.2) })
    .counterFee as number;
  const sell = (response: "accept" | "reject" | "counter") =>
    runAction(() =>
      respondSell(
        negotiation,
        response,
        count,
        response === "counter" ? replyOf(negotiation, "sell") : undefined,
      ),
    );
  if (negotiation.type === "loanout") {
    return (
      <>
        <SummaryRows
          rows={[
            ["CLB", getClub(negotiation.buyer!).name],
            ["Họ trả", `${negotiation.percent}% lương`],
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
      <SummaryRows
        rows={[
          [
            "Đề nghị",
            `${formatMoney(fee)}${(negotiation.installments || 1) > 1 ? " · góp 2 mùa" : ""}`,
          ],
          ["Giá trị cầu thủ", formatMoney(player.marketValue)],
          ...(player.sellOn
            ? [
                [`Chia cho ${getClub(player.sellOn.club).name}`, `${player.sellOn.percent}%`] as [
                  string,
                  string,
                ],
              ]
            : []),
          [
            "Mua về với giá",
            player.joinedFee != null ? formatMoney(player.joinedFee) : "Đào tạo / có sẵn",
          ],
        ]}
      />
      <Button variant="hot" className="w-full" onClick={() => sell("accept")}>
        Chấp nhận {formatMoney(fee)}
      </Button>
      <RangeField
        fieldKey={negotiation.id + "counterFee"}
        label="Phản giá"
        min={fee}
        max={roundToTen(fee * 2)}
        step={10}
        format="m"
        def={roundToTen(fee * 1.2)}
      />
      <ReplyField negotiation={negotiation} stage="sell" />
      <Button variant="ghost" className="w-full" onClick={() => sell("counter")}>
        Gửi phản giá
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => sell("reject")}>
        Từ chối
      </Button>
    </>
  );
}
