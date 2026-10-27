import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FORMS } from "./constants";
import { formationLayout, formationVariants, myPitchLayout } from "./formationLayout";
import { slotPositions } from "./squad";
import { gameState } from "./state";
import type { Formation } from "./types";
import { startTestGame } from "@/test/helpers";

describe("formationLayout", () => {
  it("mọi biến thể có đúng số ô mỗi tuyến như FORMS và đủ tọa độ", () => {
    for (const formation of Object.keys(FORMS) as Formation[]) {
      for (const variant of formationVariants(formation)) {
        const layout = formationLayout(formation, variant.code);
        expect(
          layout.map((slot) => slot.line),
          `${formation} ${variant.code}`,
        ).toEqual(slotPositions(formation));
        expect(new Set(layout.map((slot) => slot.position)).size).toBe(layout.length);
        layout.forEach((slot) => {
          expect(Number.isFinite(slot.centerXPercent) && Number.isFinite(slot.centerYPercent)).toBe(
            true,
          );
        });
      }
    }
  });

  it("đội hình ban đầu đặt từng cầu thủ đúng ô vị trí của startingXI", () => {
    const clubs = JSON.parse(readFileSync("data/fifacm/clubs.json", "utf8")) as {
      label: string;
      leagueIds: number[];
      startingXI: { playerId: number; position: string }[];
    }[];
    for (const clubName of [
      "Arsenal",
      "Real Madrid",
      "Juventus",
      "Paris Saint-Germain",
      "Manchester City",
    ]) {
      const club = clubs.find((candidate) => candidate.label === clubName)!;
      startTestGame(clubName, `fl${club.leagueIds[0]}`);
      const layout = myPitchLayout();
      club.startingXI.forEach((slot) => {
        const slotIndex = layout.findIndex((candidate) => candidate.position === slot.position);
        if (slotIndex < 0) return;
        expect(gameState.lineup[slotIndex], `${clubName} ${slot.position}`).toBe(
          `f${slot.playerId}`,
        );
      });
    }
  });
});
