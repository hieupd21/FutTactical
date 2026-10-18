import { FORMS } from "./constants";
import { dyn } from "./players";
import { C, P, S } from "./state";
import type { Formation, Line, Player, Role, TableRow } from "./types";

export function clubPlayers(cid: string): Player[] {
  return C(cid).ids.map(P).filter(Boolean);
}
export function slotPos(f: Formation): Line[] {
  const [d, m, a] = FORMS[f];
  return ["GK", ...Array<Line>(d).fill("DF"), ...Array<Line>(m).fill("MF"), ...Array<Line>(a).fill("FW")];
}
export function fitAt(p: Player, pos: Line): number {
  if (p.pos === pos || p.pos2.includes(pos)) return 1;
  if (p.pos === "GK" || pos === "GK") return 0.4;
  return 0.85;
}
export const available = (p: Player | undefined): p is Player => !!p && p.inj <= 0 && !p.away;

export function bestXI(cid: string, form: Formation): (string | null)[] {
  const pool = clubPlayers(cid).filter(available);
  const used = new Set<string>();
  return slotPos(form).map((pos) => {
    let b: Player | null = null;
    let bv = -1;
    pool.forEach((p) => {
      if (used.has(p.id)) return;
      const v = dyn(p) * fitAt(p, pos) + (p.fit - 80) / 20;
      if (v > bv) { bv = v; b = p; }
    });
    if (b) used.add((b as Player).id);
    return b ? (b as Player).id : null;
  });
}

/** Đội hình của bạn; tự lấp chỗ trống khi cầu thủ chấn thương / rời đội */
export function myXI(): (string | null)[] {
  const f = S.form;
  const need = slotPos(f);
  let xi = (S.xi || []).slice(0, 11);
  const ok = (id: string | null): id is string => !!id && !!P(id) && P(id).club === S.me && available(P(id));
  if (xi.length !== 11 || xi.some((id) => !ok(id))) {
    const auto = bestXI(S.me, f);
    const used = new Set(xi.filter(ok));
    xi = need.map((_, i) => (ok(xi[i]) ? xi[i] : null));
    xi = xi.map((id) => {
      if (id) return id;
      const c = auto.find((a) => a && !used.has(a));
      if (c) used.add(c);
      return c || null;
    });
    S.xi = xi;
  }
  return xi;
}

export function strength(_cid: string, xi: (string | null)[], form: Formation): { att: number; def: number; pow: number } {
  const sp = slotPos(form);
  const g: Record<Line, number[]> = { GK: [], DF: [], MF: [], FW: [] };
  xi.forEach((id, i) => {
    const p = id ? P(id) : null;
    g[sp[i]].push(p ? dyn(p) * fitAt(p, sp[i]) : 35);
  });
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 35);
  const att = avg(g.FW) * 0.45 + avg(g.MF) * 0.38 + avg(g.DF) * 0.17 + (g.FW.length - 2) * 1.4;
  const def = avg(g.DF) * 0.42 + avg(g.GK) * 0.3 + avg(g.MF) * 0.28 + (g.DF.length - 4) * 1.4;
  return { att, def, pow: Math.round((att + def) / 2) };
}
export function clubStr(cid: string) {
  const c = C(cid);
  const f = cid === S.me ? S.form : c.form;
  return strength(cid, cid === S.me ? myXI() : bestXI(cid, f), f);
}

/** Thứ hạng của cầu thủ ở vị trí của cậu ấy trong một đội, và vai trò tương ứng */
export function squadRank(p: Player, cid: string, form?: Formation): { rank: number; slots: number; role: Role } {
  const f = form || (cid === S.me ? S.form : C(cid).form);
  const slots = slotPos(f).filter((x) => x === p.pos).length;
  const mates = clubPlayers(cid).filter((x) => x.id !== p.id && (x.pos === p.pos || x.pos2.includes(p.pos)));
  const rank = 1 + mates.filter((x) => x.ovr > p.ovr).length;
  const top = clubPlayers(cid).filter((x) => x.id !== p.id && x.ovr > p.ovr).length < 2;
  const role: Role = top && rank <= slots ? "Ngôi sao" : rank <= slots ? "Đá chính" : rank <= slots + 1 ? "Xoay tua" : p.age <= 20 ? "Triển vọng" : "Dự bị";
  return { rank, slots, role };
}

export function table(lg: string): TableRow[] {
  const T: Record<string, TableRow> = {};
  Object.values(S.clubs).filter((c) => c.lg === lg).forEach((c) => (T[c.id] = { id: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }));
  (S.res[lg] || []).forEach((rs) => rs && rs.forEach((r) => {
    const H = T[r.h], A = T[r.a];
    H.p++; A.p++; H.gf += r.hg; H.ga += r.ag; A.gf += r.ag; A.ga += r.hg;
    if (r.hg > r.ag) { H.w++; A.l++; H.pts += 3; H.form.push("W"); A.form.push("L"); }
    else if (r.hg < r.ag) { A.w++; H.l++; A.pts += 3; A.form.push("W"); H.form.push("L"); }
    else { H.d++; A.d++; H.pts++; A.pts++; H.form.push("D"); A.form.push("D"); }
  }));
  return Object.values(T).sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
}
export const myPos = (): number => table(C(S.me).lg).findIndex((t) => t.id === S.me) + 1;
