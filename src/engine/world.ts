// Khởi tạo thế giới: hư cấu hoặc dữ liệu thật (gói FC 27 dựng sẵn).
import { setBoard } from "./board";
import { AI_FORMS, FICT_LEAGUES, NAMES, NAT_VI, NATCODE, OPTIONAL_LG, PHIL, POSLINE, REAL_LG, RIVALS } from "./constants";
import { fmtM, fmtW } from "./format";
import { makeP, valueOf, wageBase } from "./players";
import { clubReq, REP_NEWBIE } from "./career";
import { bestXI, clubPlayers } from "./squad";
import { C, inbox, LEAGUES, LG, me, news, S, setLeagues, setState, simLeagues } from "./state";
import type { Club, DataRow, GameState, League, Line, LowerLeagueData, Philosophy, Player, Role } from "./types";
import { clamp, pickA, r10, ri, rnd } from "./util";

function blankState(year: number, extra: Partial<GameState> = {}): GameState {
  return {
    v: 3,
    nid: 1,
    year,
    d: 0,
    h: 9,
    P: {},
    clubs: {},
    me: "",
    fx: {},
    res: {},
    news: [],
    inbox: [],
    negos: [],
    nnid: 1,
    liab: [],
    pending: [],
    lgN: {},
    form: "4-3-3",
    xi: [],
    scout: 2,
    shortlist: [],
    board: { target: 1, objs: [] },
    conf: 60,
    sacked: false,
    matchToday: null,
    lastMatch: null,
    free: [],
    aiDone: 0,
    seasonLog: [],
    wageCap: 0,
    ...extra,
  };
}

export function makeFixtures(ids: string[]): [string, string][][] {
  const n = ids.length,
    arr = ids.slice(),
    rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const m: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i],
        b = arr[n - 1 - i];
      m.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(m);
    arr.splice(1, 0, arr.pop() as string);
  }
  return rounds.concat(rounds.map((r) => r.map(([a, b]) => [b, a] as [string, string])));
}
export const lgIdx = (c: Club): number =>
  Object.values(S.clubs)
    .filter((x) => x.lg === c.lg)
    .findIndex((x) => x.id === c.id);

function assignRoles(cid: string, bumpStars = false): void {
  clubPlayers(cid)
    .sort((a, b) => b.ovr - a.ovr)
    .forEach((p, j) => {
      const role: Role = j < 2 ? "Ngôi sao" : j < 11 ? "Đá chính" : j < 15 ? "Xoay tua" : p.age <= 20 ? "Triển vọng" : "Dự bị";
      p.c!.role = role;
      if (bumpStars && j < 2) p.c!.wage = Math.round(p.c!.wage * 1.3);
    });
}
function makeAllFixtures(): void {
  simLeagues().forEach((lg) => {
    S.fx[lg.id] = makeFixtures(
      Object.values(S.clubs)
        .filter((c) => c.lg === lg.id)
        .map((c) => c.id),
    );
    S.res[lg.id] = [];
  });
}
const SQUAD_PLAN: Line[] = [
  "GK",
  "GK",
  "GK",
  "DF",
  "DF",
  "DF",
  "DF",
  "DF",
  "DF",
  "DF",
  "DF",
  "MF",
  "MF",
  "MF",
  "MF",
  "MF",
  "MF",
  "MF",
  "MF",
  "FW",
  "FW",
  "FW",
  "FW",
  "FW",
];
const randPhil = (): Philosophy => pickA(Object.keys(PHIL) as Philosophy[]);

// ---------- thế giới hư cấu ----------
export function newGame(lgId: string, clubIdx: number): void {
  setState(blankState(2026, { v: 2 }));
  setLeagues(FICT_LEAGUES);
  let cid = 0;
  LEAGUES.forEach((lg) =>
    lg.clubs.forEach(([name, str0]) => {
      const str = Math.round(str0 + rnd(-0.8, 0.8)),
        id = "c" + cid++;
      const pres = clamp(Math.round((str - 70) / 3.4), 1, 5);
      S.clubs[id] = {
        id,
        n: name,
        lg: lg.id,
        str,
        pres,
        phil: randPhil(),
        form: pickA(AI_FORMS),
        ids: [],
        budget: r10(4000 * Math.pow(pres, 2.2) * rnd(0.8, 1.2)),
        rival: null,
      };
      SQUAD_PLAN.forEach((pos, k) => {
        const nat = Math.random() < lg.fr ? pickA(lg.imp) : lg.nat;
        const age = k % 5 === 0 ? ri(17, 21) : ri(20, 33);
        const star = k === 4 || k === 13 || k === 20 ? ri(2, 5) : 0;
        const o = Math.round(clamp(str + rnd(-9, 5) + star - (age < 20 ? 6 : 0) - (k % 3 === 2 ? 3 : 0), 48, 92));
        S.clubs[id].ids.push(makeP(nat, pos, o, age, id).id);
      });
      assignRoles(id, true);
    }),
  );
  Object.values(S.clubs).forEach((c) => {
    const same = Object.values(S.clubs).filter((x) => x.lg === c.lg && x.id !== c.id);
    c.rival = same[(lgIdx(c) + 1) % same.length].id;
  });
  for (let i = 0; i < 60; i++) {
    const p = makeP(pickA(Object.keys(NAMES)), pickA<Line>(["GK", "DF", "DF", "MF", "MF", "FW"]), ri(62, 76), ri(20, 33), null);
    p.c = null;
    S.free.push(p.id);
  }
  S.me = Object.values(S.clubs).filter((c) => c.lg === lgId)[clubIdx].id;
  finishSetup(1.1);
  news(`Bạn chính thức nhận ghế HLV trưởng ${me().n}. Ban lãnh đạo đặt niềm tin, nhưng kiên nhẫn có giới hạn.`, "club");
  inbox({
    t: "Chào mừng HLV mới",
    b: `Kỳ chuyển nhượng hè mở tới hết 31/8. Ngân sách chuyển nhượng ${fmtM(me().budget)}, quỹ lương ${fmtW(S.wageCap)}. Mục tiêu của ban lãnh đạo nằm ở tab CLB.`,
  });
}

function finishSetup(capMul: number): void {
  const mc = me();
  mc.budget = r10(4000 * Math.pow(mc.pres, 2.1));
  S.wageCap = Math.round(clubPlayers(S.me).reduce((s, p) => s + p.c!.wage, 0) * capMul);
  makeAllFixtures();
  S.xi = bestXI(S.me, S.form);
  setBoard();
}

// ---------- dữ liệu thật ----------
export interface PackClub {
  lid: number;
  n: string;
  rows: DataRow[];
  str: number;
}
export function packClubs(rows: DataRow[]): PackClub[] {
  const clubs: Record<string, PackClub> = {};
  rows.forEach((r) => {
    if (!REAL_LG[r[0]]) return;
    const k = r[0] + "|" + r[1];
    (clubs[k] = clubs[k] || { lid: r[0], n: r[1], rows: [], str: 0 }).rows.push(r);
  });
  Object.values(clubs).forEach((c) => {
    const o = c.rows
      .map((r) => r[5])
      .sort((a, b) => b - a)
      .slice(0, 14);
    c.str = Math.round(o.reduce((a, b) => a + b, 0) / o.length);
  });
  return Object.values(clubs);
}

export interface RealStart {
  /** Hạng đấu thấp bổ sung (CLB hư cấu) */
  lower?: LowerLeagueData[];
  /** true = HLV mới vô danh, chỉ nhận được các đội hạng dưới; false = tự chọn CLB bất kỳ */
  rookie?: boolean;
}

/** Dựng CLB hư cấu của một hạng đấu thấp; trả về số thứ tự CLB tiếp theo */
function addLowerLeague(lg: League, data: LowerLeagueData, cid: number): number {
  data.clubs.forEach(([name, str0]) => {
    const str = Math.round(str0 + rnd(-0.8, 0.8)),
      id = "c" + cid++;
    S.clubs[id] = {
      id,
      n: name,
      lg: lg.id,
      str,
      pres: 1,
      phil: randPhil(),
      form: pickA(AI_FORMS),
      ids: [],
      budget: r10(4000 * rnd(0.8, 1.2)),
      rival: null,
    };
    SQUAD_PLAN.forEach((pos, k) => {
      const age = k % 5 === 0 ? ri(17, 21) : ri(20, 33);
      const o = Math.round(clamp(str + rnd(-8, 4) - (age < 20 ? 5 : 0) - (k % 3 === 2 ? 3 : 0), 40, 80));
      S.clubs[id].ids.push(makeP(lg.nat, pos, o, age, id).id);
    });
    assignRoles(id);
  });
  return cid;
}

export function newGameReal(rows: DataRow[], lgId: string, clubName: string, src?: string, opts: RealStart = {}): void {
  const ver = rows[0][13] || 26,
    year = 2000 + ver - 1;
  const present = new Set(packClubs(rows).map((c) => c.lid));
  const realMeta = Object.entries(REAL_LG)
    .filter(([k]) => !OPTIONAL_LG.includes(+k) || present.has(+k))
    .map(([, l]) => l);
  const fallback = (opts.lower ?? []).filter((l) => !realMeta.some((r) => r.id === l.id));
  const meta: League[] = [
    ...realMeta.map((l) => ({ ...l, fr: 0, imp: [], clubs: [] })),
    ...fallback.map((l) => ({ id: l.id, n: l.n, nat: l.nat, lvl: l.lvl, fr: 0, imp: [], clubs: [] })),
  ].sort((a, b) => b.lvl - a.lvl);
  setState(blankState(year, { leagueMeta: meta, src: src || `FC ${ver}` }));
  setLeagues(meta);
  let cid = 0;
  const byName: Record<string, string> = {};
  const moves: [number, string, string, string][] = [];
  // dựng một cầu thủ từ dòng dữ liệu; owner = null là cầu thủ tự do (leagueId 0, không CLB)
  const addRow = (r: DataRow, owner: string | null, toN: string, es: boolean): void => {
    const ps = String(r[4])
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const lines = [...new Set(ps.map((x) => POSLINE[x] || "MF"))] as Line[];
    if (!lines.length) lines.push("MF");
    const pid = "p" + S.nid++;
    const age = r[9] || ri(20, 29);
    const p: Player = {
      id: pid,
      n: r[2],
      ln: r[3] || r[2],
      nat: NATCODE[r[12]] || "XX",
      natN: NAT_VI[r[12]] || r[12],
      pos: lines[0],
      pos2: lines.slice(1),
      posD: ps.join(", "),
      age,
      ovr: r[5],
      pot: Math.max(r[5], r[6] + (r[9] ? 0 : age <= 22 ? ri(3, 10) : 0)),
      prof: r[9] <= 21 && r[6] - r[5] >= 10 ? "prodigy" : pickA(["early", "late", "steady", "steady", "durable", "fragile"] as const),
      form: ri(45, 60),
      mor: ri(55, 75),
      fit: 100,
      inj: 0,
      club: owner,
      c: null,
      apps: 0,
      goals: 0,
      st: [],
      tot: { apps: 0, goals: 0 },
      joined: -999,
      pbias: rnd(-1, 1),
      hist: [],
      val: 0,
    };
    if (r[14]) {
      p.hist.push({ y: year, from: r[14], to: toN, fee: null });
      if (owner) moves.push([r[5], p.n, r[14], toN]);
    }
    p.c = {
      wage: Math.max(1, Math.round((r[8] || 0) / 1000)) || 0,
      exp: owner ? Math.max(year + 1, r[10] || year + 2) : year,
      rc: es && r[11] ? r10(r[11] / 1000) : 0,
      role: "Xoay tua",
    };
    S.P[pid] = p;
    if (owner) C(owner).ids.push(pid);
    else S.free.push(pid);
    const fv = valueOf({ ...p, vk: 0 }),
      real = (r[7] || 0) / 1000;
    p.vk = real > 0 ? clamp(real / Math.max(1, fv), 0.25, 4) : 1;
    p.val = valueOf(p);
    if (!r[8]) p.c.wage = wageBase(p);
  };
  packClubs(rows).forEach((pc) => {
    const L = REAL_LG[pc.lid],
      id = "c" + cid++,
      pres = clamp(Math.round((pc.str - 68) / 3.6), 1, 5);
    const c: Club = {
      id,
      n: pc.n,
      lg: L.id,
      str: pc.str,
      pres,
      phil: randPhil(),
      form: pickA(AI_FORMS),
      ids: [],
      budget: r10(4000 * Math.pow(pres, 2.2) * rnd(0.8, 1.2)),
      rival: null,
    };
    S.clubs[id] = c;
    byName[pc.n] = id;
    pc.rows.forEach((r) => addRow(r, id, pc.n, L.id === "ES"));
    // bổ sung cầu thủ trẻ nếu đội hình trong dữ liệu quá mỏng
    const need: [Line, number][] = [
      ["GK", 2],
      ["DF", 6],
      ["MF", 6],
      ["FW", 3],
    ];
    const filler = (pos: Line) => {
      const q = makeP(L.nat, pos, Math.round(pc.str - ri(10, 16)), ri(18, 21), id);
      q.c!.role = "Triển vọng";
      q.gen = true;
      c.ids.push(q.id);
    };
    need.forEach(([pos, n]) => {
      while (clubPlayers(id).filter((p) => p.pos === pos).length < n) filler(pos);
    });
    while (c.ids.length < 20) filler(pickA<Line>(["DF", "MF", "FW"]));
    assignRoles(id);
  });
  fallback.forEach((l) => {
    cid = addLowerLeague(LG(l.id), l, cid);
  });
  moves
    .sort((a, b) => b[0] - a[0])
    .slice(0, 25)
    .reverse()
    .forEach((m) => news(`Hè ${year}: ${m[1]} (${m[0]}) chuyển từ ${m[2]} sang ${m[3]}.`, "transfer"));
  RIVALS.forEach(([a, b]) => {
    if (byName[a] && byName[b]) {
      C(byName[a]).rival = byName[b];
      C(byName[b]).rival = byName[a];
    }
  });
  Object.values(S.clubs).forEach((c) => {
    if (c.rival) return;
    const same = Object.values(S.clubs)
      .filter((x) => x.lg === c.lg && x.id !== c.id)
      .sort((x, y) => Math.abs(x.str - c.str) - Math.abs(y.str - c.str));
    c.rival = same[0]?.id ?? null;
  });
  // cầu thủ hết hợp đồng (leagueId 0): tự do, CLB nào cũng có thể ký
  rows.filter((r) => !r[0] && !r[1]).forEach((r) => addRow(r, null, "", false));
  for (let i = S.free.length; i < 50; i++) {
    const p = makeP(
      pickA(["EN", "ES", "DE", "IT", "FR", "BR", "AR", "PT", "NL", "SN"]),
      pickA<Line>(["GK", "DF", "DF", "MF", "MF", "FW"]),
      ri(62, 74),
      ri(23, 33),
      null,
    );
    p.c = null;
    S.free.push(p.id);
  }
  S.me =
    byName[clubName] || Object.values(S.clubs).find((c) => c.n === clubName)?.id || Object.values(S.clubs).find((c) => c.lg === lgId)!.id;
  S.rep = opts.rookie ? REP_NEWBIE : Math.min(100, clubReq(me()) + 5);
  finishSetup(1.08);
  news(`Bạn chính thức nhận ghế HLV trưởng ${me().n}.`, "club");
  inbox({
    t: "Chào mừng HLV mới",
    b: `Dữ liệu: ${S.src} (mùa ${year}/${year + 1}). Kỳ chuyển nhượng hè mở tới hết 31/8. Ngân sách chuyển nhượng ${fmtM(me().budget)}, quỹ lương ${fmtW(S.wageCap)}.${opts.rookie ? " Bạn còn vô danh: hãy chứng tỏ năng lực ở đây, các CLB lớn hơn sẽ ngỏ lời khi uy tín đủ cao." : ""}`,
  });
}
