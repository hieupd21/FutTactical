import { useMemo } from "react";
import { POSITION_NAMES } from "@/engine/constants";
import { formatMoney } from "@/engine/format";
import { dynamicRating, yearsLeft } from "@/engine/players";
import { getClub, LEAGUES, leagueName, getPlayer, gameState } from "@/engine/state";
import { scoutRange } from "@/engine/transfers";
import type { Player } from "@/engine/types";
import { PlayerRow } from "@/components/PlayerRow";
import { useGameVersion } from "@/stores/gameStore";
import { useUi, type Filters } from "@/stores/uiStore";
import { Card } from "@/components/shadcn/card";
import { SelectField } from "@/components/ui";

const SHOW = 60;

export function SearchView() {
  const version = useGameVersion();
  const { filters, setFlt, openPlayer } = useUi();
  const list = useMemo(() => {
    let players: Player[] =
      filters.leagueId === "free"
        ? gameState.free.map(getPlayer).filter(Boolean)
        : Object.values(gameState.players).filter(
            (player) =>
              player.club != null &&
              player.club !== gameState.myClubId &&
              !player.homeClub &&
              (!filters.leagueId || getClub(player.club).leagueId === filters.leagueId),
          );
    players = players.filter(
      (player) =>
        (!filters.pos ||
          player.pos === filters.pos ||
          player.secondaryPositions.includes(filters.pos as Player["pos"])) &&
        player.age <= filters.age &&
        (!filters.max || player.marketValue <= filters.max) &&
        (!filters.expiringOnly || yearsLeft(player) <= 1),
    );
    const key: Record<Filters["sort"], (player: Player) => number> = {
      ovr: (player) => -dynamicRating(player),
      val: (player) => player.marketValue,
      age: (player) => player.age,
      pot: (player) => -scoutRange(player)[1],
    };
    return players.sort(
      (playerA, playerB) => key[filters.sort](playerA) - key[filters.sort](playerB),
    );
  }, [filters, version]);

  return (
    <Card className="panel min-w-0 gap-0 rounded-2xl border-white/20 bg-card/40 p-4 shadow-lg backdrop-blur-xl">
      <div className="filters">
        <SelectField
          label="Vị trí"
          value={filters.pos}
          onChange={(selected) => setFlt({ pos: selected })}
          options={[
            ["", "Tất cả"],
            ...(["GK", "DF", "MF", "FW"] as const).map((line): [string, string] => [
              line,
              POSITION_NAMES[line],
            ]),
          ]}
        />
        <SelectField
          label="Giải"
          value={filters.leagueId}
          onChange={(selected) => setFlt({ leagueId: selected })}
          options={[
            ["", "Tất cả"],
            ...LEAGUES.map((league): [string, string] => [
              String(league.id),
              leagueName(league.id),
            ]),
            ["free", "Cầu thủ tự do"],
          ]}
        />
        <SelectField
          label="Tuổi tối đa"
          value={String(filters.age)}
          onChange={(selected) => setFlt({ age: +selected })}
          options={[40, 30, 26, 23, 21].map((option): [string, string] => [
            String(option),
            option === 40 ? "Không giới hạn" : "≤ " + option,
          ])}
        />
        <SelectField
          label="Giá trị tối đa"
          value={String(filters.max)}
          onChange={(selected) => setFlt({ max: +selected })}
          options={[0, 500, 1000, 2000, 5000, 10000, 30000].map((option): [string, string] => [
            String(option),
            option ? "≤ " + formatMoney(option) : "Không giới hạn",
          ])}
        />
        <SelectField
          label="Sắp xếp"
          value={filters.sort}
          onChange={(selected) => setFlt({ sort: selected as Filters["sort"] })}
          options={[
            ["ovr", "Chỉ số"],
            ["pot", "Tiềm năng ước tính"],
            ["val", "Giá rẻ nhất"],
            ["age", "Trẻ nhất"],
          ]}
        />
        <SelectField
          label="Hợp đồng"
          value={String(filters.expiringOnly)}
          onChange={(selected) => setFlt({ expiringOnly: selected === "true" })}
          options={[
            ["false", "Tất cả"],
            ["true", "Hết hạn 30/6"],
          ]}
        />
      </div>
      <p className="hint">
        {list.length} cầu thủ · hiện {Math.min(SHOW, list.length)} người đầu.
      </p>
      <div className="plist">
        {list.length ? (
          list
            .slice(0, SHOW)
            .map((player) => (
              <PlayerRow key={player.id} player={player} onClick={() => openPlayer(player.id)} />
            ))
        ) : (
          <p className="hint">Không có cầu thủ phù hợp.</p>
        )}
      </div>
    </Card>
  );
}
