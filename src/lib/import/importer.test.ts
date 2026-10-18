import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DataRow } from "@/engine/types";
import { importCSV } from "./importer";

const base: DataRow[] = [
  [13, "Arsenal", "B. Saka", "Bukayo Saka", "RW, RM", 87, 91, 140000000, 195000, 24, 2029, 0, "England", 26, ""],
  [13, "Chelsea", "C. Palmer", "Cole Palmer", "CAM, RW", 87, 90, 130000000, 180000, 23, 2033, 0, "England", 26, ""],
];

describe("importCSV", () => {
  it("đọc định dạng sofifa", async () => {
    const csv =
      "league_id,club_name,short_name,long_name,player_positions,overall,potential,value_eur,wage_eur,age,club_contract_valid_until_year,release_clause_eur,nationality_name,fifa_version\n" +
      '13,Arsenal,B. Saka,Bukayo Saka,"RW, RM",87,91,140000000,195000,24,2029,0,England,26\n' +
      "999999,Somewhere,X,X Y,ST,60,60,0,0,20,2027,0,Spain,26\n";
    const r = await importCSV(csv, "a.csv", async () => base);
    expect(r.report.format).toBe("sofifa");
    expect(r.rows).toHaveLength(1);
    expect(r.report.skipped[0].reason).toMatch(/Giải/);
  });

  it("ghép định dạng FIFPlay với dữ liệu gốc", async () => {
    const csv =
      "first_name,last_name,nation_name,club_name,common_name,position,rating\n" +
      "Bukayo,Saka,England,Arsenal,,RW,88\n" + // ở lại
      "Cole,Palmer,England,Man Utd,,CAM,88\n" + // chuyển CLB
      "New,Guy,Spain,Arsenal,,CB,70\n" + // tân binh
      "Some,One,Spain,Unknown FC,,CB,70\n";
    const r = await importCSV(csv, "b.csv", async () => base);
    expect(r.report.format).toBe("fifplay");
    expect(r.report.matched).toBe(2);
    expect(r.report.estimated).toBe(1);
    const palmer = r.rows.find((x) => x[3] === "Cole Palmer")!;
    expect(palmer[1]).toBe("Manchester United");
    expect(palmer[9]).toBe(24);
    expect(palmer[14]).toBe("Chelsea");
  });

  it("báo lỗi khi không nhận ra định dạng", async () => {
    await expect(importCSV("a,b\n1,2\n", "c.csv", async () => base)).rejects.toThrow(/định dạng/);
  });

  const real = process.env.FC27_CSV;
  it.skipIf(!real || !existsSync(real))("file FC 27 thật cho kết quả giống gói dựng sẵn", async () => {
    const pack = JSON.parse(readFileSync("public/data/fc26.json", "utf8")) as DataRow[];
    const r = await importCSV(readFileSync(real!, "utf8"), "fc27.csv", async () => pack);
    console.log(JSON.stringify(r.report, null, 1));
    expect(r.rows.length).toBeGreaterThan(3000);
  });
});
