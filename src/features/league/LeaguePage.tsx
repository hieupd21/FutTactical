import { useState } from "react";
import { renameClub, renameLeague } from "@/engine/actions";
import { MATCH0, MATCH_GAP } from "@/engine/constants";
import { table } from "@/engine/squad";
import { C, lgName, myLg, P, S, simLeagues } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { Seg } from "@/components/ui";
import { commit, useGameVersion } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { shortD } from "@/utils/display";

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
          return { i, m, res, d: MATCH0 + i * MATCH_GAP };
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
        <section className="panel">
          <div className="row between">
            <h2>{lgName(lg)}</h2>
            <button className="btn ghost sm" onClick={() => setRename(!rename)}>
              {rename ? "Xong" : "Sửa tên"}
            </button>
          </div>
          {rename ? (
            <div className="col">
              <p className="hint">Đổi tên giải và các CLB theo ý bạn. Thay đổi được lưu khi rời ô nhập.</p>
              <label className="lbl">
                Tên giải
                <input type="text" defaultValue={lgName(lg)} maxLength={40} onBlur={(e) => save(() => renameLeague(lg, e.target.value))} />
              </label>
              {Object.values(S.clubs)
                .filter((c) => c.lg === lg)
                .map((c) => (
                  <input
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
              <table>
                <thead>
                  <tr>
                    <th className="n">#</th>
                    <th>CLB</th>
                    <th className="n">Tr</th>
                    <th className="n">HS</th>
                    <th className="n">Đ</th>
                    <th>Phong độ</th>
                  </tr>
                </thead>
                <tbody>
                  {tb.map((t, i) => (
                    <tr key={t.id} className={t.id === S.me ? "me" : ""}>
                      <td className="n">{i + 1}</td>
                      <td>
                        <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                          <ClubBadge name={C(t.id).n} size={20} />
                          {C(t.id).n}
                        </span>
                      </td>
                      <td className="n">{t.p}</td>
                      <td className="n">
                        {t.gf - t.ga > 0 ? "+" : ""}
                        {t.gf - t.ga}
                      </td>
                      <td className="n">
                        <b>{t.pts}</b>
                      </td>
                      <td>
                        <span className="form">
                          {t.form.slice(-5).map((f, j) => (
                            <i key={j} className={f}>
                              {FORM_VI[f]}
                            </i>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel">
          {lg === ML && (
            <>
              <h2>Lịch đấu của bạn</h2>
              <div className="tw">
                <table>
                  <tbody>
                    {myFx.map((f) => (
                      <tr key={f.i} className={f.res ? "" : "muted"}>
                        <td className="n">{f.i + 1}</td>
                        <td>{shortD(f.d)}</td>
                        <td>{f.m[0] === S.me ? "vs " + C(f.m[1]).n : "@ " + C(f.m[0]).n}</td>
                        <td className="n">{f.res ? `${f.res.hg}–${f.res.ag}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <h2>Vua phá lưới</h2>
          {top.length ? (
            <div className="tw">
              <table>
                <tbody>
                  {top.map(([id, g]) => (
                    <tr key={id}>
                      <td>{P(id).n}</td>
                      <td className="muted">{P(id).club != null ? C(P(id).club!).n : ""}</td>
                      <td className="n">
                        <b>{g}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">Chưa có bàn thắng.</p>
          )}
        </section>
      </div>
    </>
  );
}
