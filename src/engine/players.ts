import { COMMON_PROFILES, NAMES, NATN } from "./constants";
import { C, LG, S } from "./state";
import type { Line, Player } from "./types";
import { clamp, pickA, r10, ri, rnd } from "./util";

export function genName(nat: string): string {
  const [f, l] = NAMES[nat] || NAMES.EN;
  return `${pickA(f)} ${pickA(l)}`;
}
export const natName = (p: Player): string => p.natN || NATN[p.nat] || p.nat;
export const ovrR = (p: Player): number => Math.round(p.ovr);

export function moraleAdj(m: number): number {
  return m >= 80 ? 2 : m >= 60 ? 1 : m >= 40 ? 0 : m >= 20 ? -2 : -4;
}
/** Chỉ số động: chỉ số gốc ± phong độ, tinh thần, thể lực */
export function dyn(p: Player): number {
  return Math.round(p.ovr + (p.form - 50) / 12 + moraleAdj(p.mor) - (p.fit < 75 ? (75 - p.fit) / 8 : 0));
}
export function moraleLbl(m: number): string {
  return m >= 80 ? "Rất vui" : m >= 60 ? "Vui vẻ" : m >= 40 ? "Bình thường" : m >= 20 ? "Không vui" : "Bất mãn";
}
export const yearsLeft = (p: Player): number => (p.c ? p.c.exp - S.year : 0);

/** Giá trị chuyển nhượng (nghìn €) */
export function valueOf(p: Player): number {
  const o = p.ovr;
  let v = 3000 * Math.exp((o - 70) / 6);
  v *= p.age < 21 ? 1.5 : p.age < 24 ? 1.3 : p.age < 28 ? 1.1 : p.age < 31 ? 0.85 : p.age < 33 ? 0.55 : 0.3;
  v *= 1 + Math.max(0, p.pot - o) / 30;
  const y = p.c ? p.c.exp - S.year : 2;
  v *= y <= 0 ? 0.35 : y === 1 ? 0.75 : 1;
  v *= 0.85 + (0.3 * p.form) / 100;
  const cl = p.club != null ? C(p.club) : null;
  if (cl) v *= 0.8 + 0.1 * LG(cl.lg).lvl;
  if (p.vk) v *= p.vk;
  return r10(v);
}
/** Mức lương cơ bản (nghìn € / tuần) */
export function wageBase(p: Player): number {
  return Math.max(3, Math.round(3 + valueOf(p) / 600));
}

/** Tạo cầu thủ hư cấu (thế giới hư cấu, cầu thủ trẻ học viện, cầu thủ tự do) */
export function makeP(nat: string, pos: Line, ovr: number, age: number, club: string | null): Player {
  const id = "p" + S.nid++;
  const prof = age <= 21 && Math.random() < 0.15 ? "prodigy" : pickA(COMMON_PROFILES);
  const room = age <= 20 ? ri(6, 18) : age <= 23 ? ri(3, 11) : age <= 26 ? ri(0, 5) : 0;
  const p: Player = {
    id,
    n: genName(nat),
    nat,
    pos,
    pos2: [],
    age,
    ovr,
    pot: Math.min(92, ovr + room),
    prof,
    form: ri(40, 60),
    mor: ri(55, 75),
    fit: 100,
    inj: 0,
    club,
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
  if (pos === "MF" && Math.random() < 0.35) p.pos2.push(pickA<Line>(["FW", "DF"]));
  if (pos === "DF" && Math.random() < 0.2) p.pos2.push("MF");
  if (pos === "FW" && Math.random() < 0.25) p.pos2.push("MF");
  p.val = valueOf(p);
  p.c = {
    wage: Math.round(wageBase(p) * rnd(0.85, 1.1)),
    exp: S.year + ri(1, 4),
    rc: Math.random() < 0.25 ? r10(p.val * rnd(1.8, 3)) : 0,
    role: "Xoay tua",
  };
  S.P[id] = p;
  return p;
}

export const clampStat = (v: number): number => clamp(v, 0, 100);
