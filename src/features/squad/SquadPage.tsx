import { autoLineup, setFormation, swapInto } from "@/engine/actions";
import { FORMS, POSITION_NAMES } from "@/engine/constants";
import { dynamicRating, moraleLabel } from "@/engine/players";
import { clubPlayers, clubStrength, myLineup, slotPositions } from "@/engine/squad";
import { getClub, getPlayer, gameState } from "@/engine/state";
import type { Formation, Player } from "@/engine/types";
import { FitBar, PlayerRow } from "@/components/PlayerRow";
import { commit, useGameVersion } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { shortName } from "@/utils/display";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { SelectField } from "@/components/ui";
import { Badge } from "@/components/shadcn/badge";

const ORDER = "GKDFMFFW";

export function SquadPage() {
  useGameVersion();
  const { swapIn, setSwapIn, openPlayer } = useUi();
  const lineup = myLineup(),
    lines = slotPositions(gameState.form),
    teamStrength = clubStrength(gameState.myClubId);
  const players = clubPlayers(gameState.myClubId);
  const bench = players
    .filter((player) => !lineup.includes(player.id))
    .sort(
      (playerA, playerB) =>
        ORDER.indexOf(playerA.pos) - ORDER.indexOf(playerB.pos) ||
        dynamicRating(playerB) - dynamicRating(playerA),
    );
  const loanedOut = Object.values(gameState.players).filter(
    (player) => player.homeClub === gameState.myClubId,
  );

  const onSlot = (i: number, player: Player) => {
    if (swapIn) {
      commit(() => swapInto(swapIn, i));
      setSwapIn(null);
      toast("Đã cập nhật đội hình.");
    } else openPlayer(player.id);
  };
  const onBench = (player: Player) => {
    if (swapIn) toast("Hãy chọn một cầu thủ trong đội hình ra sân để thay.");
    else openPlayer(player.id);
  };

  const slots = lines.map((pos, i) => {
    const player = lineup[i] ? getPlayer(lineup[i]!) : null;
    const head =
      i === 0 || lines[i - 1] !== pos ? <div className="slot-h">{POSITION_NAMES[pos]}</div> : null;
    return (
      <div key={i} style={{ display: "contents" }}>
        {head}
        {player && (
          <PlayerRow
            player={player}
            className={swapIn ? "target" : ""}
            onClick={() => onSlot(i, player)}
            right={
              <>
                <FitBar fitness={player.fitness} />
                <span>
                  {player.lastRating ? "Điểm " + player.lastRating : moraleLabel(player.morale)}
                </span>
              </>
            }
          />
        )}
      </div>
    );
  });

  return (
    <>
      {swapIn && (
        <div className="swapbar">
          <span>
            Chọn vị trí trong đội hình cho <b>{shortName(getPlayer(swapIn).name)}</b>
          </span>
          <Button variant="onAccent" size="sm" onClick={() => setSwapIn(null)}>
            Hủy
          </Button>
        </div>
      )}
      <div className="grid2">
        <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
          <div className="row between">
            <h2>Đội hình ra sân</h2>
            <div className="row">
              <Badge variant="chip" className="chip">
                Công <b>{Math.round(teamStrength.att)}</b>
              </Badge>
              <Badge variant="chip" className="chip">
                Thủ <b>{Math.round(teamStrength.def)}</b>
              </Badge>
            </div>
          </div>
          <div className="row">
            <SelectField
              label="Sơ đồ"
              value={gameState.form}
              onChange={(formation) => commit(() => setFormation(formation as Formation))}
              options={Object.keys(FORMS).map((formationName): [string, string] => [
                formationName,
                formationName,
              ])}
              style={{ flex: 1 }}
            />
            <Button
              variant="ghost"
              size="sm"
              style={{ alignSelf: "flex-end" }}
              onClick={() => {
                commit(autoLineup);
                toast("Đã xếp đội hình mạnh nhất.");
              }}
            >
              Tự xếp mạnh nhất
            </Button>
          </div>
          <p className="hint">
            Số lớn là chỉ số động (theo phong độ, tinh thần, thể lực); số nhỏ là chênh lệch so với
            chỉ số gốc. Cầu thủ chấn thương được thay tự động.
          </p>
          <div className="plist">{slots}</div>
        </Card>
        <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
          <div className="row between">
            <h2>Dự bị & đội trẻ</h2>
            <Badge variant="chip" className="chip">
              {players.length} cầu thủ
            </Badge>
          </div>
          <div className="plist">
            {bench.map((player) => (
              <PlayerRow key={player.id} player={player} onClick={() => onBench(player)} />
            ))}
          </div>
          {loanedOut.length > 0 && (
            <>
              <h3>Đang cho mượn</h3>
              <div className="plist">
                {loanedOut.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    onClick={() => openPlayer(player.id)}
                    right={<span>{getClub(player.club!).name}</span>}
                  />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
