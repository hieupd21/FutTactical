import { useState } from "react";
import { renameClub, renameLeague } from "@/engine/actions";
import { table } from "@/engine/squad";
import { C, lgName, myLg, P, roundDay, S, simLeagues } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { Seg } from "@/components/ui";
import { commit, useGameVersion } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { cx, shortD } from "@/utils/display";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { FieldLabel } from "@/components/ui";
import { Input } from "@/components/shadcn/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";

const FORM_VI = { W: "T", D: "H", L: "B" } as const;

export function LeaguePage() {
  useGameVersion();
  const { lgView, setLgView } = useUi();
  const [rename, setRename] = useState(false);
  const ML = myLg();
  const lg = lgView && S.fx[lgView] ? lgView : ML;
  const tb = table(lg);
  const myFx =
    lg === ML
      ? S.fx[ML].map((r, i) => {
          const m = r.find((x) => x.includes(S.me))!;
          const res = S.res[ML][i]?.find((x) => x.h === m[0] && x.a === m[1]);
          return { i, m, res, d: roundDay(i, S.fx[ML].length) };
        })
      : [];
  const scorers: Record<string, number> = {};
  (S.res[lg] || []).forEach((rs) => rs?.forEach((r) => r.sc.forEach((id) => (scorers[id] = (scorers[id] || 0) + 1))));
  const top = Object.entries(scorers)
    .filter(([id]) => P(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const save = (fn: () => void) => {
    commit(fn);
    toast("Đã lưu tên.");
  };

  return (
    <>
      <Seg
        value={lg}
        onChange={setLgView}
        items={simLeagues().map((l) => [l.id, lgName(l.id).replace("Giải VĐQG ", "")] as [string, string])}
      />
      <div className="grid2">
        <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
          <div className="row between">
            <h2>{lgName(lg)}</h2>
            <Button variant="ghost" size="sm" onClick={() => setRename(!rename)}>
              {rename ? "Xong" : "Sửa tên"}
            </Button>
          </div>
          {rename ? (
            <div className="col">
              <p className="hint">Đổi tên giải và các CLB theo ý bạn. Thay đổi được lưu khi rời ô nhập.</p>
              <FieldLabel>
                Tên giải
                <Input type="text" defaultValue={lgName(lg)} maxLength={40} onBlur={(e) => save(() => renameLeague(lg, e.target.value))} />
              </FieldLabel>
              {Object.values(S.clubs)
                .filter((c) => c.lg === lg)
                .map((c) => (
                  <Input
                    key={c.id}
                    type="text"
                    defaultValue={c.n}
                    maxLength={32}
                    aria-label="Tên CLB"
                    onBlur={(e) => e.target.value !== c.n && save(() => renameClub(c.id, e.target.value))}
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
                  {tb.map((t, i) => (
                    <TableRow key={t.id} className={t.id === S.me ? "me" : ""}>
                      <TableCell className="n">{i + 1}</TableCell>
                      <TableCell>
                        <span className="row max-w-[9rem]" style={{ gap: 6, flexWrap: "nowrap" }}>
                          <ClubBadge name={C(t.id).n} size={20} />
                          <span className="truncate">{C(t.id).n}</span>
                        </span>
                      </TableCell>
                      <TableCell className="n">{t.p}</TableCell>
                      <TableCell className="n">
                        {t.gf - t.ga > 0 ? "+" : ""}
                        {t.gf - t.ga}
                      </TableCell>
                      <TableCell className="n">
                        <b>{t.pts}</b>
                      </TableCell>
                      <TableCell>
                        <span className="form">
                          {t.form.slice(-5).map((f, j, a) => (
                            <i key={j} className={cx(f, j < a.length - 3 && "max-[520px]:hidden")}>
                              {FORM_VI[f]}
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
          {lg === ML && (
            <>
              <h2>Lịch đấu của bạn</h2>
              <div className="tw">
                <Table>
                  <TableBody>
                    {myFx.map((f) => (
                      <TableRow key={f.i} className={f.res ? "" : "muted"}>
                        <TableCell className="n">{f.i + 1}</TableCell>
                        <TableCell>{shortD(f.d)}</TableCell>
                        <TableCell>{f.m[0] === S.me ? "vs " + C(f.m[1]).n : "@ " + C(f.m[0]).n}</TableCell>
                        <TableCell className="n">{f.res ? `${f.res.hg}–${f.res.ag}` : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <h2>Vua phá lưới</h2>
          {top.length ? (
            <div className="tw">
              <Table>
                <TableBody>
                  {top.map(([id, g]) => (
                    <TableRow key={id}>
                      <TableCell>{P(id).n}</TableCell>
                      <TableCell className="muted">{P(id).club != null ? C(P(id).club!).n : ""}</TableCell>
                      <TableCell className="n">
                        <b>{g}</b>
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
