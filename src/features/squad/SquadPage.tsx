import { autoXI, setFormation, swapInto } from "@/engine/actions";
import { FORMS, POSN } from "@/engine/constants";
import { dyn, moraleLbl } from "@/engine/players";
import { clubPlayers, clubStr, myXI, slotPos } from "@/engine/squad";
import { C, P, S } from "@/engine/state";
import type { Formation, Player } from "@/engine/types";
import { FitBar, PlayerRow } from "@/components/PlayerRow";
import { commit, useGameVersion } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { sn } from "@/utils/display";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { SelectField } from "@/components/ui";
import { Badge } from "@/components/shadcn/badge";

const ORDER = "GKDFMFFW";

export function SquadPage() {
  useGameVersion();
  const { swapIn, setSwapIn, openPlayer } = useUi();
  const xi = myXI(),
    sp = slotPos(S.form),
    st = clubStr(S.me);
  const all = clubPlayers(S.me);
  const bench = all.filter((p) => !xi.includes(p.id)).sort((a, b) => ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos) || dyn(b) - dyn(a));
  const loanedOut = Object.values(S.P).filter((p) => p.homeClub === S.me);

  const onSlot = (i: number, p: Player) => {
    if (swapIn) {
      commit(() => swapInto(swapIn, i));
      setSwapIn(null);
      toast("Đã cập nhật đội hình.");
    } else openPlayer(p.id);
  };
  const onBench = (p: Player) => {
    if (swapIn) toast("Hãy chọn một cầu thủ trong đội hình ra sân để thay.");
    else openPlayer(p.id);
  };

  const slots = sp.map((pos, i) => {
    const p = xi[i] ? P(xi[i]!) : null;
    const head = i === 0 || sp[i - 1] !== pos ? <div className="slot-h">{POSN[pos]}</div> : null;
    return (
      <div key={i} style={{ display: "contents" }}>
        {head}
        {p && (
          <PlayerRow
            p={p}
            cls={swapIn ? "target" : ""}
            onClick={() => onSlot(i, p)}
            right={
              <>
                <FitBar fit={p.fit} />
                <span>{p.lastR ? "Điểm " + p.lastR : moraleLbl(p.mor)}</span>
              </>
            }
          />
        )}
      </div>
    );
  });

  return (
    <>
      {swapIn && (
        <div className="swapbar">
          <span>
            Chọn vị trí trong đội hình cho <b>{sn(P(swapIn).n)}</b>
          </span>
          <Button variant="onAccent" size="sm" onClick={() => setSwapIn(null)}>
            Hủy
          </Button>
        </div>
      )}
      <div className="grid2">
        <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
          <div className="row between">
            <h2>Đội hình ra sân</h2>
            <div className="row">
              <Badge variant="chip" className="chip">
                Công <b>{Math.round(st.att)}</b>
              </Badge>
              <Badge variant="chip" className="chip">
                Thủ <b>{Math.round(st.def)}</b>
              </Badge>
            </div>
          </div>
          <div className="row">
            <SelectField
              label="Sơ đồ"
              value={S.form}
              onChange={(v) => commit(() => setFormation(v as Formation))}
              options={Object.keys(FORMS).map((f): [string, string] => [f, f])}
              style={{ flex: 1 }}
            />
            <Button
              variant="ghost"
              size="sm"
              style={{ alignSelf: "flex-end" }}
              onClick={() => {
                commit(autoXI);
                toast("Đã xếp đội hình mạnh nhất.");
              }}
            >
              Tự xếp mạnh nhất
            </Button>
          </div>
          <p className="hint">
            Số lớn là chỉ số động (theo phong độ, tinh thần, thể lực); số nhỏ là chênh lệch so với chỉ số gốc. Cầu thủ chấn thương được thay
            tự động.
          </p>
          <div className="plist">{slots}</div>
        </Card>
        <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
          <div className="row between">
            <h2>Dự bị & đội trẻ</h2>
            <Badge variant="chip" className="chip">
              {all.length} cầu thủ
            </Badge>
          </div>
          <div className="plist">
            {bench.map((p) => (
              <PlayerRow key={p.id} p={p} onClick={() => onBench(p)} />
            ))}
          </div>
          {loanedOut.length > 0 && (
            <>
              <h3>Đang cho mượn</h3>
              <div className="plist">
                {loanedOut.map((p) => (
                  <PlayerRow key={p.id} p={p} onClick={() => openPlayer(p.id)} right={<span>{C(p.club!).n}</span>} />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
