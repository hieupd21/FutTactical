import { ROLE_START } from "./constants";
import { bestXI, clubPlayers, myXI, slotPos, strength } from "./squad";
import { C, inbox, me, P, roundOn, S, simLeagues } from "./state";
import type { Formation, Line, MatchEvent, MatchResult, MatchSim } from "./types";
import { clamp, pickA, r10, ri, rnd } from "./util";

const xgf = (a: number, d: number): number => clamp(1.25 * Math.exp((a - d) / 9), 0.15, 4.5);
function poisson(l: number): number {
  const L = Math.exp(-l);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}
function pickScorer(xi: (string | null)[], form: Formation): string {
  const sp = slotPos(form);
  const w: Record<Line, number> = { GK: 0, DF: 1, MF: 3, FW: 6 };
  const arr = xi.map((id, i) => [id, w[sp[i]]] as const).filter((a): a is readonly [string, number] => !!a[0]);
  const t = arr.reduce((s, a) => s + a[1], 0);
  let r = Math.random() * t;
  for (const [id, ww] of arr) {
    r -= ww;
    if (r <= 0) return id;
  }
  return arr[0] ? arr[0][0] : "";
}

/** Mô phỏng một trận. detail = true: diễn biến từng phút (trận của bạn) */
export function simMatch(h: string, a: string, detail: boolean): MatchSim {
  const fh = h === S.me ? S.form : C(h).form,
    fa = a === S.me ? S.form : C(a).form;
  const xh = h === S.me ? myXI() : bestXI(h, fh),
    xa = a === S.me ? myXI() : bestXI(a, fa);
  const sh = strength(h, xh, fh),
    sa = strength(a, xa, fa);
  const lh = xgf(sh.att + 1.5, sa.def),
    la = xgf(sa.att, sh.def + 1.5);
  const ev: MatchEvent[] = [];
  let hg = 0,
    ag = 0;
  const shots: [number, number] = [0, 0];
  if (!detail) {
    hg = poisson(lh);
    ag = poisson(la);
    for (let i = 0; i < hg; i++) ev.push({ m: ri(1, 90), s: 0, goal: pickScorer(xh, fh) });
    for (let i = 0; i < ag; i++) ev.push({ m: ri(1, 90), s: 1, goal: pickScorer(xa, fa) });
  } else {
    for (let m = 1; m <= 90; m++) {
      for (const s of [0, 1] as const) {
        const l = s ? la : lh;
        if (Math.random() < (l * 3) / 90) {
          shots[s]++;
          const pid = pickScorer(s ? xa : xh, s ? fa : fh);
          if (Math.random() < 1 / 3) {
            if (s) ag++;
            else hg++;
            ev.push({ m, s, goal: pid });
          } else ev.push({ m, s, miss: pid });
        }
      }
      if (Math.random() < 0.022) {
        const s = Math.random() < 0.5 ? 0 : 1;
        const xi = (s ? xa : xh).filter((x): x is string => !!x);
        if (xi.length) ev.push({ m, s, card: pickA(xi) });
      }
    }
  }
  // chấn thương
  (
    [
      [xh, 0],
      [xa, 1],
    ] as const
  ).forEach(([xi, s]) =>
    xi.forEach((id) => {
      const p = id ? P(id) : null;
      if (p && Math.random() < (p.fit < 60 ? 0.025 : 0.011)) {
        p.inj = ri(4, 45);
        ev.push({ m: ri(10, 88), s, inj: p.id, days: p.inj });
      }
    }),
  );
  ev.sort((x, y) => x.m - y.m);
  return { h, a, hg, ag, ev, xh, xa, shots, pow: [sh.pow, sa.pow] };
}

/** Cập nhật phong độ, thể lực, tinh thần sau trận */
export function applyMatch(r: MatchSim): void {
  (
    [
      [r.xh, r.hg - r.ag, r.h],
      [r.xa, r.ag - r.hg, r.a],
    ] as const
  ).forEach(([xi, diff, cid]) => {
    const starters = new Set(xi);
    clubPlayers(cid).forEach((p) => {
      const started = starters.has(p.id);
      p.st.push(started ? 1 : 0);
      p.st = p.st.slice(-6);
      if (started) {
        p.apps++;
        p.tot.apps++;
        p.fit = clamp(p.fit - ri(16, 24), 20, 100);
        const g = r.ev.filter((e) => e.goal === p.id).length;
        p.goals += g;
        p.tot.goals += g;
        const rating = clamp(6.4 + g * 0.9 + (diff > 0 ? 0.5 : diff < 0 ? -0.4 : 0) + rnd(-0.9, 0.9), 4, 10);
        p.lastR = Math.round(rating * 10) / 10;
        p.form = clamp(p.form * 0.65 + (50 + (rating - 6.4) * 22) * 0.35, 5, 95);
      }
      if (cid === S.me && p.c) {
        const exp = ROLE_START[p.c.role] ?? 0.3;
        const share = p.st.reduce((a, b) => a + b, 0) / p.st.length;
        p.mor += (diff > 0 ? 2 : diff < 0 ? -1 : 0) + (started ? 1.5 : 0) - (p.st.length >= 3 && share < exp - 0.15 ? 3 : 0);
        p.mor = clamp(p.mor, 0, 100);
      }
    });
  });
}

const toResult = (m: MatchSim): MatchResult => ({
  h: m.h,
  a: m.a,
  hg: m.hg,
  ag: m.ag,
  sc: m.ev.filter((e) => e.goal).map((e) => e.goal as string),
});

/** Đá các trận khác trong ngày ở mọi giải mô phỏng */
export function playRound(d: number): void {
  simLeagues().forEach((lg) => {
    const r = roundOn(d, lg.id);
    if (r < 0) return;
    const list: MatchResult[] = [];
    S.fx[lg.id][r].forEach(([h, a]) => {
      if ((h === S.me || a === S.me) && S.lastMatch) list.push(S.lastMatch.res);
      else {
        const m = simMatch(h, a, false);
        applyMatch(m);
        list.push(toResult(m));
      }
    });
    S.res[lg.id][r] = list;
  });
}

export function playMyMatch(): { m: MatchSim; us: number; them: number } | null {
  const mt = S.matchToday;
  if (!mt) return null;
  const m = simMatch(mt.h, mt.a, true);
  applyMatch(m);
  const res = toResult(m);
  S.lastMatch = { m, res };
  const us = mt.h === S.me ? m.hg : m.ag,
    them = mt.h === S.me ? m.ag : m.hg;
  if (mt.h === S.me) me().budget += r10(150 * me().pres); // doanh thu sân nhà
  m.ev
    .filter((e) => e.inj && P(e.inj) && P(e.inj).club === S.me)
    .forEach((e) =>
      inbox({ t: `Chấn thương: ${P(e.inj!).n}`, b: `Dự kiến nghỉ ${e.days} ngày. Cẩn thận nguy cơ tái phát khi vừa trở lại.`, pid: e.inj }),
    );
  playRound(S.d);
  S.matchToday = null;
  return { m, us, them };
}
