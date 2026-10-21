import { useState } from "react";
import { renameClub, renameLeague } from "@/engine/actions";
import { table } from "@/engine/squad";
import {
  getClub,
  leagueName,
  myLeagueId,
  getPlayer,
  roundDay,
  gameState,
  simLeagues,
} from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { SegmentedControl } from "@/components/ui";
import { commit, useGameVersion } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { classNames, formatShortDate } from "@/utils/display";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { FieldLabel } from "@/components/ui";
import { Input } from "@/components/shadcn/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";

const FORM_VI = { W: "T", D: "H", L: "B" } as const;

export function LeaguePage() {
  useGameVersion();
  const { lgView, setLgView } = useUi();
  const [rename, setRename] = useState(false);
  const ownLeagueId = myLeagueId();
  const leagueId = lgView && gameState.fixtures[lgView] ? lgView : ownLeagueId;
  const tableRows = table(leagueId);
  const myFx =
    leagueId === ownLeagueId
      ? gameState.fixtures[ownLeagueId].map((roundFixtures, i) => {
          const myFixture = roundFixtures.find((fixtureClubIds) =>
            fixtureClubIds.includes(gameState.myClubId),
          )!;
          const result = gameState.results[ownLeagueId][i]?.find(
            (matchResult) =>
              matchResult.homeId === myFixture[0] && matchResult.awayId === myFixture[1],
          );
          return {
            roundIndex: i,
            fixture: myFixture,
            result,
            day: roundDay(i, gameState.fixtures[ownLeagueId].length),
          };
        })
      : [];
  const scorers: Record<string, number> = {};
  (gameState.results[leagueId] || []).forEach((matchResults) =>
    matchResults?.forEach((matchResult) =>
      matchResult.scorers.forEach((id) => (scorers[id] = (scorers[id] || 0) + 1)),
    ),
  );
  const topScorers = Object.entries(scorers)
    .filter(([id]) => getPlayer(id))
    .sort((scorerA, scorerB) => scorerB[1] - scorerA[1])
    .slice(0, 10);
  const save = (action: () => void) => {
    commit(action);
    toast("Đã lưu tên.");
  };

  return (
    <>
      <SegmentedControl
        value={leagueId}
        onChange={setLgView}
        items={simLeagues().map(
          (league) =>
            [league.id, leagueName(league.id).replace("Giải VĐQG ", "")] as [string, string],
        )}
      />
      <div className="grid2">
        <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
          <div className="row between">
            <h2>{leagueName(leagueId)}</h2>
            <Button variant="ghost" size="sm" onClick={() => setRename(!rename)}>
              {rename ? "Xong" : "Sửa tên"}
            </Button>
          </div>
          {rename ? (
            <div className="col">
              <p className="hint">
                Đổi tên giải và các CLB theo ý bạn. Thay đổi được lưu khi rời ô nhập.
              </p>
              <FieldLabel>
                Tên giải
                <Input
                  type="text"
                  defaultValue={leagueName(leagueId)}
                  maxLength={40}
                  onBlur={(event) => save(() => renameLeague(leagueId, event.target.value))}
                />
              </FieldLabel>
              {Object.values(gameState.clubs)
                .filter((club) => club.leagueId === leagueId)
                .map((club) => (
                  <Input
                    key={club.id}
                    type="text"
                    defaultValue={club.name}
                    maxLength={32}
                    aria-label="Tên CLB"
                    onBlur={(event) =>
                      event.target.value !== club.name &&
                      save(() => renameClub(club.id, event.target.value))
                    }
                  />
                ))}
            </div>
          ) : (
            <div className="tw">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="n">#</TableHead>
                    <TableHead>CLB</TableHead>
                    <TableHead className="n">Tr</TableHead>
                    <TableHead className="n">HS</TableHead>
                    <TableHead className="n">Đ</TableHead>
                    <TableHead>Phong độ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((tableRow, i) => (
                    <TableRow
                      key={tableRow.id}
                      className={tableRow.id === gameState.myClubId ? "me" : ""}
                    >
                      <TableCell className="n">{i + 1}</TableCell>
                      <TableCell>
                        <span className="row max-w-[9rem]" style={{ gap: 6, flexWrap: "nowrap" }}>
                          <ClubBadge name={getClub(tableRow.id).name} size={20} />
                          <span className="truncate">{getClub(tableRow.id).name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="n">{tableRow.played}</TableCell>
                      <TableCell className="n">
                        {tableRow.goalsFor - tableRow.goalsAgainst > 0 ? "+" : ""}
                        {tableRow.goalsFor - tableRow.goalsAgainst}
                      </TableCell>
                      <TableCell className="n">
                        <b>{tableRow.points}</b>
                      </TableCell>
                      <TableCell>
                        <span className="form">
                          {tableRow.form.slice(-5).map((formResult, j, scorerA) => (
                            <i
                              key={j}
                              className={classNames(
                                formResult,
                                j < scorerA.length - 3 && "max-[520px]:hidden",
                              )}
                            >
                              {FORM_VI[formResult]}
                            </i>
                          ))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
        <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
          {leagueId === ownLeagueId && (
            <>
              <h2>Lịch đấu của bạn</h2>
              <div className="tw">
                <Table>
                  <TableBody>
                    {myFx.map((fixtureRow) => (
                      <TableRow
                        key={fixtureRow.roundIndex}
                        className={fixtureRow.result ? "" : "muted"}
                      >
                        <TableCell className="n">{fixtureRow.roundIndex + 1}</TableCell>
                        <TableCell>{formatShortDate(fixtureRow.day)}</TableCell>
                        <TableCell>
                          {fixtureRow.fixture[0] === gameState.myClubId
                            ? "vs " + getClub(fixtureRow.fixture[1]).name
                            : "@ " + getClub(fixtureRow.fixture[0]).name}
                        </TableCell>
                        <TableCell className="n">
                          {fixtureRow.result
                            ? `${fixtureRow.result.homeGoals}–${fixtureRow.result.awayGoals}`
                            : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <h2>Vua phá lưới</h2>
          {topScorers.length ? (
            <div className="tw">
              <Table>
                <TableBody>
                  {topScorers.map(([id, goals]) => (
                    <TableRow key={id}>
                      <TableCell>{getPlayer(id).name}</TableCell>
                      <TableCell className="muted">
                        {getPlayer(id).club != null ? getClub(getPlayer(id).club!).name : ""}
                      </TableCell>
                      <TableCell className="n">
                        <b>{goals}</b>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="hint">Chưa có bàn thắng.</p>
          )}
        </Card>
      </div>
    </>
  );
}
