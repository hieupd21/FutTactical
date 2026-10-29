import { table } from "@/engine/squad";
import type { MatchResult } from "@/engine/types";
import { getClub, leagueName, myLeagueId, getPlayer, gameState, simLeagues } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { SegmentedControl } from "@/components/ui";
import { useGameVersion } from "@/stores/gameStore";
import { useUi } from "@/stores/uiStore";
import { classNames } from "@/utils/display";
import { Card } from "@/components/shadcn/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";

const FORM_VI = { W: "T", D: "H", L: "B" } as const;

function topPlayersBy(
  leagueId: string,
  pickPlayerIds: (matchResult: MatchResult) => string[],
): [string, number][] {
  const countByPlayerId: Record<string, number> = {};
  (gameState.results[leagueId] || []).forEach((matchResults) =>
    matchResults?.forEach((matchResult) =>
      pickPlayerIds(matchResult).forEach(
        (playerId) => (countByPlayerId[playerId] = (countByPlayerId[playerId] || 0) + 1),
      ),
    ),
  );
  return Object.entries(countByPlayerId)
    .filter(([playerId]) => getPlayer(playerId))
    .sort((entryA, entryB) => entryB[1] - entryA[1])
    .slice(0, 10);
}

function TopPlayersCard({
  title,
  entries,
  emptyText,
}: {
  title: string;
  entries: [string, number][];
  emptyText: string;
}) {
  return (
    <Card className="panel min-w-0 gap-0 rounded-2xl border-white/20 bg-card/40 p-4 shadow-lg backdrop-blur-xl">
      <h2>{title}</h2>
      {entries.length ? (
        <div className="tw">
          <Table>
            <TableBody>
              {entries.map(([playerId, count]) => (
                <TableRow key={playerId}>
                  <TableCell>{getPlayer(playerId).name}</TableCell>
                  <TableCell className="muted">
                    {getPlayer(playerId).club != null
                      ? getClub(getPlayer(playerId).club!).name
                      : ""}
                  </TableCell>
                  <TableCell className="n">
                    <b>{count}</b>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="hint">{emptyText}</p>
      )}
    </Card>
  );
}

export function LeaguePage() {
  useGameVersion();
  const { lgView, setLgView } = useUi();
  const ownLeagueId = myLeagueId();
  const leagueId = lgView && gameState.fixtures[lgView] ? lgView : ownLeagueId;
  const tableRows = table(leagueId);
  const topScorers = topPlayersBy(leagueId, (matchResult) => matchResult.scorers);
  const topAssisters = topPlayersBy(leagueId, (matchResult) => matchResult.assisters ?? []);

  return (
    <>
      <SegmentedControl
        value={leagueId}
        onChange={setLgView}
        items={simLeagues().map((league) => [league.id, leagueName(league.id)] as [string, string])}
      />
      <div className="grid2">
        <Card className="panel min-w-0 gap-0 rounded-2xl border-white/20 bg-card/40 p-4 shadow-lg backdrop-blur-xl">
          <h2>{leagueName(leagueId)}</h2>
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
                      <span className="row max-w-36" style={{ gap: 6, flexWrap: "nowrap" }}>
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
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <TopPlayersCard
            title="Vua phá lưới"
            entries={topScorers}
            emptyText="Chưa có bàn thắng."
          />
          <TopPlayersCard
            title="Vua kiến tạo"
            entries={topAssisters}
            emptyText="Chưa có kiến tạo."
          />
        </div>
      </div>
    </>
  );
}
