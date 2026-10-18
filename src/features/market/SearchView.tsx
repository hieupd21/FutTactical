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
    <section className="panel">
      <div className="filters">
        <label className="lbl">
          Vị trí
          <select value={f.pos} onChange={(e) => setFlt({ pos: e.target.value })}>
            <option value="">Tất cả</option>
            {(["GK", "DF", "MF", "FW"] as const).map((x) => (
              <option key={x} value={x}>
                {POSN[x]}
              </option>
            ))}
          </select>
        </label>
        <label className="lbl">
          Giải
          <select value={f.lg} onChange={(e) => setFlt({ lg: e.target.value })}>
            <option value="">Tất cả</option>
            {LEAGUES.map((l) => (
              <option key={l.id} value={l.id}>
                {lgName(l.id)}
              </option>
            ))}
            <option value="free">Cầu thủ tự do</option>
          </select>
        </label>
        <label className="lbl">
          Tuổi tối đa
          <select value={f.age} onChange={(e) => setFlt({ age: +e.target.value })}>
            {[40, 30, 26, 23, 21].map((a) => (
              <option key={a} value={a}>
                {a === 40 ? "Không giới hạn" : "≤ " + a}
              </option>
            ))}
          </select>
        </label>
        <label className="lbl">
          Giá trị tối đa
          <select value={f.max} onChange={(e) => setFlt({ max: +e.target.value })}>
            {[0, 500, 1000, 2000, 5000, 10000, 30000].map((a) => (
              <option key={a} value={a}>
                {a ? "≤ " + fmtM(a) : "Không giới hạn"}
              </option>
            ))}
          </select>
        </label>
        <label className="lbl">
          Sắp xếp
          <select value={f.sort} onChange={(e) => setFlt({ sort: e.target.value as Filters["sort"] })}>
            <option value="ovr">Chỉ số</option>
            <option value="pot">Tiềm năng ước tính</option>
            <option value="val">Giá rẻ nhất</option>
            <option value="age">Trẻ nhất</option>
          </select>
        </label>
        <label className="lbl">
          Hợp đồng
          <select value={String(f.exp)} onChange={(e) => setFlt({ exp: e.target.value === "true" })}>
            <option value="false">Tất cả</option>
            <option value="true">Hết hạn 30/6</option>
          </select>
        </label>
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
    </section>
  );
}
