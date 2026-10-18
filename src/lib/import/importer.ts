// Nhập dữ liệu cầu thủ từ CSV. Hỗ trợ 2 định dạng:
//  1. sofifa (FC 24/25/26… trên Kaggle/GitHub): đủ cột tuổi, giá trị, lương, hợp đồng → dùng trực tiếp.
//  2. FIFPlay (FC 27): chỉ có CLB + chỉ số → ghép với dữ liệu gốc (FC 26) để lấy tuổi, tiềm năng, lương, hợp đồng.
import { POSLINE, REAL_LG } from "@/engine/constants";
import type { DataRow } from "@/engine/types";
import { norm, parseCSV } from "./csv";
import { FIFPLAY_CLUBS, NATFIX } from "./fifplayClubs";

export type ImportFormat = "sofifa" | "fifplay";
export interface ImportReport {
  format: ImportFormat;
  fileName: string;
  total: number;
  accepted: number;
  matched: number; // FIFPlay: ghép được với dữ liệu gốc
  estimated: number; // FIFPlay: tân binh chưa có trong dữ liệu gốc, tuổi/lương được ước lượng
  version: number;
  byLeague: Record<string, number>;
  skipped: { reason: string; count: number }[];
  warnings: string[];
}
export interface ImportResult {
  rows: DataRow[];
  report: ImportReport;
}

const SOFIFA_COLS = [
  "league_id",
  "club_name",
  "short_name",
  "long_name",
  "player_positions",
  "overall",
  "potential",
  "value_eur",
  "wage_eur",
  "age",
  "club_contract_valid_until_year",
  "release_clause_eur",
  "nationality_name",
  "fifa_version",
];
const FIFPLAY_COLS = ["first_name", "last_name", "nation_name", "club_name", "position", "rating"];

export function detectFormat(header: string[]): ImportFormat | null {
  if (SOFIFA_COLS.every((c) => header.includes(c))) return "sofifa";
  if (FIFPLAY_COLS.every((c) => header.includes(c))) return "fifplay";
  return null;
}

const num = (v: string | undefined): number => Math.round(parseFloat(v || "") || 0);
const leagueLabel = (lid: number): string => REAL_LG[lid]?.n ?? String(lid);

class Skips {
  private m = new Map<string, number>();
  add(reason: string, n = 1) {
    this.m.set(reason, (this.m.get(reason) || 0) + n);
  }
  list() {
    return [...this.m].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  }
}

function finish(rows: DataRow[], rep: Omit<ImportReport, "accepted" | "byLeague" | "version">): ImportResult {
  const byLeague: Record<string, number> = {};
  rows.forEach((r) => (byLeague[leagueLabel(r[0])] = (byLeague[leagueLabel(r[0])] || 0) + 1));
  const simIds = Object.entries(REAL_LG)
    .filter(([, l]) => l.sim !== false)
    .map(([k]) => +k);
  const warnings = [...rep.warnings];
  simIds.forEach((lid) => {
    const clubs = new Set(rows.filter((r) => r[0] === lid).map((r) => r[1]));
    if (clubs.size && clubs.size % 2) warnings.push(`${leagueLabel(lid)} có số CLB lẻ (${clubs.size}); lịch thi đấu sẽ lệch.`);
    if (!clubs.size) warnings.push(`Không có CLB nào của ${leagueLabel(lid)}.`);
  });
  return { rows, report: { ...rep, warnings, accepted: rows.length, byLeague, version: rows[0]?.[13] || 0 } };
}

// ---------- định dạng sofifa ----------
function importSofifa(header: string[], data: string[][], fileName: string): ImportResult {
  const I = SOFIFA_COLS.map((c) => header.indexOf(c));
  const iPrev = header.indexOf("club_name_prev");
  const skips = new Skips();
  const rows: DataRow[] = [];
  data.forEach((r) => {
    const lid = num(r[I[0]]);
    if (!REAL_LG[lid]) {
      skips.add("Giải không được hỗ trợ");
      return;
    }
    if (!r[I[1]]) {
      skips.add("Thiếu tên CLB");
      return;
    }
    if (!num(r[I[5]])) {
      skips.add("Thiếu chỉ số");
      return;
    }
    rows.push([
      lid,
      r[I[1]],
      r[I[2]],
      r[I[3]],
      r[I[4]],
      num(r[I[5]]),
      num(r[I[6]]),
      num(r[I[7]]),
      num(r[I[8]]),
      num(r[I[9]]),
      num(r[I[10]]),
      num(r[I[11]]),
      r[I[12]],
      num(r[I[13]]) || 26,
      iPrev >= 0 ? r[iPrev] : "",
    ]);
  });
  return finish(rows, {
    format: "sofifa",
    fileName,
    total: data.length,
    matched: rows.length,
    estimated: 0,
    skipped: skips.list(),
    warnings: [],
  });
}

// ---------- định dạng FIFPlay ----------
function importFifplay(header: string[], data: string[][], fileName: string, base: DataRow[]): ImportResult {
  const col = (k: string) => header.indexOf(k);
  const C = {
    fn: col("first_name"),
    ln: col("last_name"),
    nat: col("nation_name"),
    club: col("club_name"),
    common: col("common_name"),
    pos: col("position"),
    rating: col("rating"),
    pot: col("potential"),
  };
  const alt = ["position_alt", "position_alt_2", "position_alt_3"].map(col).filter((i) => i >= 0);
  const skips = new Skips();

  // chỉ mục dữ liệu gốc theo (tên, quốc tịch)
  const idx = new Map<string, number[]>();
  base.forEach((b, i) => {
    const nat = norm(b[12]);
    new Set([norm(b[3]), norm(b[2])]).forEach((k) => {
      const key = k + "|" + nat;
      (idx.get(key) || idx.set(key, []).get(key)!).push(i);
    });
  });
  const baseClub = new Map<string, [number, string]>();
  base.forEach((b) => baseClub.set(norm(b[1]), [b[0], b[1]]));

  type Y = { fn: string; ln: string; nat: string; club: string; common: string; pos: string; rating: number; pot: number; alts: string[] };
  const ys: Y[] = data.map((r) => ({
    fn: r[C.fn] || "",
    ln: r[C.ln] || "",
    nat: NATFIX[r[C.nat]] || r[C.nat] || "",
    club: (r[C.club] || "").trim(),
    common: C.common >= 0 ? (r[C.common] || "").trim() : "",
    pos: (r[C.pos] || "").trim(),
    rating: num(r[C.rating]),
    pot: C.pot >= 0 ? num(r[C.pot]) : 0,
    alts: alt.map((i) => (r[i] || "").trim()).filter((x) => POSLINE[x]),
  }));

  const line = (pos: string) => POSLINE[pos] || "MF";
  const match = (y: Y): number | null => {
    const nat = norm(y.nat),
      fn = norm(y.fn),
      ln = norm(y.ln);
    const keys = [norm(`${y.fn} ${y.ln}`), norm(y.common), fn && ln ? `${fn[0]}. ${ln}` : "", !fn ? ln : ""];
    const cands = keys.filter(Boolean).flatMap((k) => idx.get(k + "|" + nat) || []);
    if (!cands.length) return null;
    const score = (i: number) => Math.abs(base[i][5] - y.rating) + (line(base[i][4].split(",")[0].trim()) === line(y.pos) ? 0 : 6);
    const best = cands.reduce((a, b) => (score(b) < score(a) ? b : a));
    return score(best) <= 12 ? best : null;
  };

  // xác định giải của CLB: bảng ánh xạ FC 27 → tên CLB trùng dữ liệu gốc → đa số cầu thủ đã ghép
  const matches = ys.map(match);
  const clubOf = new Map<string, [number, string]>();
  Object.entries(FIFPLAY_CLUBS).forEach(([k, v]) => clubOf.set(k, v));
  const maj = new Map<string, Map<number, number>>();
  ys.forEach((y, i) => {
    const m = matches[i];
    if (m == null || clubOf.has(y.club)) return;
    const c = maj.get(y.club) || new Map<number, number>();
    c.set(base[m][0], (c.get(base[m][0]) || 0) + 1);
    maj.set(y.club, c);
  });
  new Set(ys.map((y) => y.club)).forEach((club) => {
    if (clubOf.has(club)) return;
    const same = baseClub.get(norm(club));
    if (same) {
      clubOf.set(club, same);
      return;
    }
    const c = maj.get(club);
    if (!c) return;
    const [lid, n] = [...c].sort((a, b) => b[1] - a[1])[0];
    if (n >= 8) clubOf.set(club, [lid === 13 ? 14 : lid, club]);
  });

  const unmatchedPerClub = new Map<string, number>();
  ys.forEach((y, i) => {
    if (matches[i] == null) unmatchedPerClub.set(y.club, (unmatchedPerClub.get(y.club) || 0) + 1);
  });

  const rows: DataRow[] = [];
  const seen = new Set<number>();
  let matched = 0,
    estimated = 0;
  const year = 2026;
  ys.forEach((y, i) => {
    const cl = clubOf.get(y.club);
    if (!cl) {
      skips.add("CLB ngoài các giải được hỗ trợ");
      return;
    }
    if (!y.rating) {
      skips.add("Thiếu chỉ số");
      return;
    }
    const [lid, clubName] = cl;
    const positions = [y.pos, ...y.alts].filter(Boolean);
    const m = matches[i];
    if (m == null) {
      // CLB có nhiều cầu thủ không ghép được thường là đội nữ trong cùng file → bỏ
      if ((unmatchedPerClub.get(y.club) || 0) > 10) {
        skips.add("Không có trong dữ liệu gốc (thường là cầu thủ nữ)");
        return;
      }
      const short = y.common || `${y.fn.slice(0, 1)}. ${y.ln}`.replace(/^\. /, "");
      rows.push([
        lid,
        clubName,
        short,
        `${y.fn} ${y.ln}`.trim(),
        positions.join(", "),
        y.rating,
        Math.max(y.rating, y.pot),
        0,
        0,
        0,
        year + 2 + (i % 3),
        0,
        y.nat,
        27,
        "",
      ]);
      estimated++;
      return;
    }
    if (seen.has(m)) {
      skips.add("Trùng cầu thủ");
      return;
    }
    seen.add(m);
    const b = base[m];
    const ovr = y.rating,
      o26 = b[5] || ovr,
      age = (b[9] || 25) + 1;
    const same = norm(b[1]) === norm(clubName);
    const val = b[7] * Math.exp((ovr - o26) / 6) * (age >= 31 ? 0.85 : 1);
    const wage = b[8] * (same ? 1 : 1.15);
    const contract = same && b[10] >= year + 1 ? b[10] : same ? year + 1 + (i % 2) : year + 3 + (i % 3);
    const rc = lid === 53 ? (same && b[11] ? b[11] * Math.exp((ovr - o26) / 6) : val * 2.2) : 0;
    const pos = [
      ...new Set([
        ...positions,
        ...b[4]
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      ]),
    ];
    rows.push([
      lid,
      clubName,
      y.common || b[2],
      b[3],
      pos.join(", "),
      ovr,
      Math.max(ovr, y.pot || b[6]),
      Math.round(val),
      Math.round(wage),
      age,
      contract,
      Math.round(rc),
      b[12],
      27,
      same ? "" : b[1],
    ]);
    matched++;
  });

  const warnings: string[] = [];
  if (estimated) warnings.push(`${estimated} cầu thủ chưa có trong dữ liệu gốc: tuổi, lương, giá trị sẽ được ước lượng.`);
  return finish(rows, { format: "fifplay", fileName, total: ys.length, matched, estimated, skipped: skips.list(), warnings });
}

/** base: dữ liệu gốc để ghép (gói FC 26). Chỉ cần với định dạng FIFPlay. */
export async function importCSV(text: string, fileName: string, loadBase: () => Promise<DataRow[]>): Promise<ImportResult> {
  const { header, rows } = parseCSV(text);
  const fmt = detectFormat(header);
  if (!fmt) {
    const missS = SOFIFA_COLS.filter((c) => !header.includes(c));
    throw new Error(
      `Không nhận ra định dạng. Định dạng sofifa còn thiếu cột: ${missS.slice(0, 6).join(", ")}${missS.length > 6 ? "…" : ""}. Định dạng FIFPlay cần: ${FIFPLAY_COLS.join(", ")}.`,
    );
  }
  const res = fmt === "sofifa" ? importSofifa(header, rows, fileName) : importFifplay(header, rows, fileName, await loadBase());
  if (!res.rows.length) throw new Error("Không tìm thấy cầu thủ nào thuộc các giải được hỗ trợ.");
  return res;
}
