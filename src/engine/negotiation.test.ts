import { beforeEach, describe, expect, it } from "vitest";
import { clubPlayers } from "./squad";
import { gameState, tick } from "./state";
import { agentLetters, enquire, processNegos, respondSell } from "./transfers";
import type { Negotiation } from "./types";
import { startTestGame } from "@/test/helpers";

describe("đàm phán có độ trễ", () => {
  beforeEach(() => startTestGame());

  function sellOffer(fee: number, max: number): Negotiation {
    const player = clubPlayers(gameState.myClubId)[5];
    player.wantOut = true; // cầu thủ muốn đi nên không từ chối ngẫu nhiên
    const buyer = Object.values(gameState.clubs).find((club) => club.id !== gameState.myClubId)!;
    const negotiation: Negotiation = {
      id: "nx",
      playerId: player.id,
      type: "transfer",
      isSellOffer: true,
      buyer: buyer.id,
      stage: "offer",
      fee,
      installments: 1,
      maxFee: max,
      tension: 0,
      round: 0,
      log: [],
      created: tick(),
      message: "",
    };
    gameState.negos.unshift(negotiation);
    return negotiation;
  }

  it("phản giá khi bán: chờ ít nhất 1 ngày mới có trả lời và thông báo", () => {
    const negotiation = sellOffer(1000, 1500);
    const playerId = negotiation.playerId;
    expect(respondSell(negotiation, "counter", 1200)).toEqual({});
    expect(negotiation.waiting).toBe(true);
    expect(negotiation.readyAt).toBe(tick() + 24);
    expect(gameState.players[playerId].club).toBe(gameState.myClubId); // chưa bán ngay
    gameState.hour += 23;
    processNegos();
    expect(negotiation.waiting).toBe(true); // 23 giờ chưa đủ
    const msgs = gameState.inbox.length;
    gameState.hour += 1;
    processNegos();
    expect(negotiation.waiting).toBe(false);
    expect(negotiation.stage).toBe("done"); // 1200 trong mức trần 1500: đồng ý
    expect(gameState.players[playerId].club).toBe(negotiation.buyer);
    expect(gameState.inbox.length).toBeGreaterThan(msgs);
  });

  it("phản giá quá cao: bị từ chối sau độ trễ, đề nghị vẫn còn", () => {
    const negotiation = sellOffer(1000, 1100);
    respondSell(negotiation, "counter", 5000);
    expect(negotiation.stage).toBe("offer");
    negotiation.readyAt = tick();
    processNegos();
    expect(negotiation.waiting).toBe(false);
    expect(negotiation.tension).toBeGreaterThan(0);
    expect(negotiation.stage).toBe("offer");
    expect(gameState.players[negotiation.playerId].club).toBe(gameState.myClubId);
  });

  it("thăm dò mua: chờ 1 ngày và có thông báo khi CLB trả lời", () => {
    const player = Object.values(gameState.players).find(
      (candidate) => candidate.club && candidate.club !== gameState.myClubId,
    )!;
    const result = enquire(player.id);
    const negotiation = result.negotiation!;
    expect(negotiation.readyAt).toBe(tick() + 24);
    const msgs = gameState.inbox.length;
    gameState.hour += 24;
    processNegos();
    expect(gameState.inbox.length).toBeGreaterThan(msgs);
    expect(gameState.inbox[0].kind).toBe(negotiation.stage === "failed" ? "dealFail" : "reply");
    expect(gameState.inbox[0].negotiationId).toBe(negotiation.id);
  });

  it("thư người đại diện hiện ở danh sách, biến mất khi hết hạn hoặc đã mở đàm phán", () => {
    const player = Object.values(gameState.players).find(
      (candidate) => candidate.club && candidate.club !== gameState.myClubId,
    )!;
    player.interest = { day: gameState.day, cause: "playtime", agent: true };
    expect(agentLetters().map((letter) => letter.id)).toContain(player.id);
    player.interest = { day: gameState.day, cause: "playtime" }; // chỉ thả thính trên báo, không có thư
    expect(agentLetters().map((letter) => letter.id)).not.toContain(player.id);
    player.interest = { day: gameState.day, cause: "playtime", agent: true };
    enquire(player.id);
    expect(agentLetters().map((letter) => letter.id)).not.toContain(player.id);
    gameState.negos = [];
    gameState.day += 61;
    expect(agentLetters().map((letter) => letter.id)).not.toContain(player.id);
  });
});
