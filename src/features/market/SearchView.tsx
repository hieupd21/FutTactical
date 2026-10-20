import { useMemo } from "react";
import { POSN } from "@/engine/constants";
import { fmtM } from "@/engine/format";
import { dyn, yearsLeft } from "@/engine/players";
import { C, LEAGUES, lgName, P, S } from "@/engine/state";
import { scoutRange } from "@/engine/transfers";
import type { Player } from "@/engine/types";
import { PlayerRow } from "@/components/PlayerRow";
import { useGameVersion } from "@/stores/gameStore";
import { useUi, type Filters } from "@/stores/uiStore";
import { Card } from "@/components/shadcn/card";
import { SelectField } from "@/components/ui";

const SHOW = 60;

export function SearchView() {
  const v = useGameVersion();
  const { flt: f, setFlt, openPlayer } = useUi();
  const list = useMemo(() => {
    let l: Player[] =
      f.lg === "free"
        ? S.free.map(P).filter(Boolean)
        : Object.values(S.P).filter((p) => p.club != null && p.club !== S.me && !p.homeClub && (!f.lg || C(p.club).lg === f.lg));
    l = l.filter(
      (p) =>
        (!f.pos || p.pos === f.pos || p.pos2.includes(f.pos as Player["pos"])) &&
        p.age <= f.age &&
        (!f.max || p.val <= f.max) &&
        (!f.exp || yearsLeft(p) <= 1),
    );
    const key: Record<Filters["sort"], (p: Player) => number> = {
      ovr: (p) => -dyn(p),
      val: (p) => p.val,
      age: (p) => p.age,
      pot: (p) => -scoutRange(p)[1],
    };
    return l.sort((a, b) => key[f.sort](a) - key[f.sort](b));
  }, [f, v]);

  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <div className="filters">
        <SelectField
          label="Vị trí"
          value={f.pos}
          onChange={(v) => setFlt({ pos: v })}
          options={[["", "Tất cả"], ...(["GK", "DF", "MF", "FW"] as const).map((x): [string, string] => [x, POSN[x]])]}
        />
        <SelectField
          label="Giải"
          value={f.lg}
          onChange={(v) => setFlt({ lg: v })}
          options={[["", "Tất cả"], ...LEAGUES.map((l): [string, string] => [String(l.id), lgName(l.id)]), ["free", "Cầu thủ tự do"]]}
        />
        <SelectField
          label="Tuổi tối đa"
          value={String(f.age)}
          onChange={(v) => setFlt({ age: +v })}
          options={[40, 30, 26, 23, 21].map((a): [string, string] => [String(a), a === 40 ? "Không giới hạn" : "≤ " + a])}
        />
        <SelectField
          label="Giá trị tối đa"
          value={String(f.max)}
          onChange={(v) => setFlt({ max: +v })}
          options={[0, 500, 1000, 2000, 5000, 10000, 30000].map((a): [string, string] => [
            String(a),
            a ? "≤ " + fmtM(a) : "Không giới hạn",
          ])}
        />
        <SelectField
          label="Sắp xếp"
          value={f.sort}
          onChange={(v) => setFlt({ sort: v as Filters["sort"] })}
          options={[
            ["ovr", "Chỉ số"],
            ["pot", "Tiềm năng ước tính"],
            ["val", "Giá rẻ nhất"],
            ["age", "Trẻ nhất"],
          ]}
        />
        <SelectField
          label="Hợp đồng"
          value={String(f.exp)}
          onChange={(v) => setFlt({ exp: v === "true" })}
          options={[
            ["false", "Tất cả"],
            ["true", "Hết hạn 30/6"],
          ]}
        />
      </div>
      <p className="hint">
        {list.length} cầu thủ · hiện {Math.min(SHOW, list.length)} người đầu.
      </p>
      <div className="plist">
        {list.length ? (
          list.slice(0, SHOW).map((p) => <PlayerRow key={p.id} p={p} onClick={() => openPlayer(p.id)} />)
        ) : (
          <p className="hint">Không có cầu thủ phù hợp.</p>
        )}
      </div>
    </Card>
  );
}
