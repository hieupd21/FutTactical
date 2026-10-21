import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { myWages } from "./board";
import { playMyMatch } from "./match";
import { advance } from "./season";
import { clubPlayers, table } from "./squad";
import { myClub, myLeagueId, gameState, simLeagues } from "./state";
import { completeBuy, enquire, submitClubOffer } from "./transfers";
import type { DataRow } from "./types";
import { newGameReal } from "./world";
import { startTestGame } from "@/test/helpers";

const pack = (fileName: string): DataRow[] =>
  JSON.parse(readFileSync(resolve(__dirname, "../../public/data", fileName), "utf8"));

function playSeason(): void {
  const startYear = gameState.year;
  let guard = 0;
  while (gameState.year === startYear && guard++ < 2000 && !gameState.sacked) {
    if (gameState.matchToday) playMyMatch();
    else advance("next");
  }
}

describe("engine", () => {
  it("sự nghiệp chạy trọn một mùa với CLB mặc định", () => {
    startTestGame();
    expect(Object.keys(gameState.clubs).length).toBeGreaterThan(80);
    playSeason();
    expect(gameState.inbox.length).toBeGreaterThan(0);
    expect(gameState.inbox.every((message) => !!message.kind)).toBe(true);
    if (!gameState.sacked) {
      expect(gameState.year).toBe(2027);
      expect(gameState.seasonLog.length).toBe(1);
      expect(clubPlayers(gameState.myClubId).length).toBeGreaterThanOrEqual(18);
    }
  });

  it("dữ liệu FC 27 khởi tạo đúng và chạy trọn một mùa", () => {
    const rows = pack("fc27.json");
    newGameReal(rows, "EN", "Arsenal", "FC 27");
    expect(gameState.year).toBe(2026);
    expect(myClub().name).toBe("Arsenal");
    simLeagues().forEach((league) =>
      expect(gameState.fixtures[league.id].length).toBeGreaterThanOrEqual(30),
    );
    expect(myWages()).toBeLessThanOrEqual(gameState.wageCap);
    playSeason();
    if (!gameState.sacked) {
      expect(gameState.year).toBe(2027);
      const tableRows = table(myLeagueId());
      expect(tableRows.every((tableRow) => tableRow.played === 0)).toBe(true);
      expect(gameState.aiDone).toBeGreaterThan(0);
    }
  });

  it("cầu thủ hết hợp đồng trong dữ liệu là cầu thủ tự do và CLB AI ký được", () => {
    newGameReal(pack("fc27.json"), "EN", "Arsenal", "FC 27");
    const free = gameState.free.map((id) => gameState.players[id]);
    expect(free.length).toBeGreaterThan(100);
    expect(free.every((player) => player.club == null)).toBe(true);
    expect(free.some((player) => player.name === "Carvajal")).toBe(true);
    const before = gameState.free.length;
    for (let i = 0; i < 30; i++) advance("day");
    expect(gameState.free.length).toBeLessThan(before);
    const signed = Object.values(gameState.players).find(
      (player) =>
        player.club &&
        player.club !== gameState.myClubId &&
        player.transferHistory.some((transferRecord) => transferRecord.fromClub === "Tự do"),
    );
    expect(signed?.contract?.expiryYear).toBeGreaterThan(gameState.year);
  });

  it("thương vụ mua qua điều khoản đàm phán hoàn tất được", () => {
    newGameReal(pack("fc27.json"), "EN", "Arsenal", "FC 27");
    myClub().budget = 500000;
    gameState.wageCap = 99999;
    const target = Object.values(gameState.players).find(
      (player) =>
        player.club && player.club !== gameState.myClubId && player.ovr >= 70 && player.ovr <= 76,
    )!;
    const result = enquire(target.id, "transfer");
    expect(result.error).toBeUndefined();
    const negotiation = result.negotiation!;
    for (let i = 0; i < 3 && negotiation.stage === "enquiry"; i++) advance("day");
    if (negotiation.stage === "club") {
      submitClubOffer(negotiation, {
        fee: negotiation.askingFee! * 1.1,
        installments: 1,
        timing: "now",
      });
      advance("day");
      expect(["contract", "failed"]).toContain(negotiation.stage);
      if ((negotiation.stage as string) === "contract") {
        negotiation.contractOffer = { ...negotiation.contractAsk!, releaseClause: 0 };
        negotiation.stage = "final";
        completeBuy(negotiation);
        expect(target.club).toBe(gameState.myClubId);
      }
    }
  });
});
