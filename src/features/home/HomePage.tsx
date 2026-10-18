import { needsAct, readAll, readMessage, stageTxt } from "@/engine/actions";
import { DEADLINE_HOURS, REVIEW_DAY, SEASON_LEN, WIN_SUMMER, WIN_WINTER } from "@/engine/constants";
import { advance, type AdvanceMode } from "@/engine/season";
import { clubStr } from "@/engine/squad";
import { C, isDeadline, myLg, N, P, roundOn, S, windowNow } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { useGame, useGameVersion, commit } from "@/stores/gameStore";
import { toast, useUi } from "@/stores/uiStore";
import { dstr, shortD } from "@/utils/display";
import { startMatch } from "@/stores/matchFlow";

function nextRound() {
  const L = myLg();
  for (let d = S.d + (S.matchToday ? 0 : 1); d < SEASON_LEN; d++) {
    const r = roundOn(d, L);
    if (r >= 0) return { d, r, m: S.fx[L][r].find((x) => x.includes(S.me))! };
  }
  return null;
}

function TodayCard() {
  const mt = S.matchToday,
    win = windowNow(),
    dl = isDeadline() && !!win;
  const nr = nextRound();
  const winTxt = win
    ? dl
      ? `Deadline Day · giờ ${S.h - 9}/${DEADLINE_HOURS}`
      : `Kỳ chuyển nhượng ${win === "summer" ? "hè" : "đông"} · còn ${(win === "summer" ? WIN_SUMMER[1] : WIN_WINTER[1]) - S.d} ngày`
    : S.d < WIN_WINTER[0]
      ? `Kỳ chuyển nhượng đông mở sau ${WIN_WINTER[0] - S.d} ngày`
      : "Kỳ chuyển nhượng đã đóng";
  const go = (mode: AdvanceMode) => {
    commit(() => advance(mode));
    if (S.matchToday) toast("Hôm nay có trận đấu!");
  };
  return (
    <div className="today">
      <div className="row between">
        <span className="date">{dstr(S.d)}</span>
        <span className="win">{winTxt}</span>
      </div>
      {dl && (
        <div className="dl">
          {Array.from({ length: DEADLINE_HOURS }, (_, i) => (
            <i key={i} className={i < S.h - 9 ? "on" : ""} />
          ))}
        </div>
      )}
      {nr ? (
        <>
          <div className="nm">
            <b className="tmn">
              <ClubBadge name={C(nr.m[0]).n} size={34} />
              <span>{C(nr.m[0]).n}</span>
            </b>
            <span className="mono">{mt ? "HÔM NAY" : `${nr.d - S.d} ngày`}</span>
            <b className="r tmn">
              <ClubBadge name={C(nr.m[1]).n} size={34} />
              <span>{C(nr.m[1]).n}</span>
            </b>
          </div>
          <span className="hint" style={{ color: "inherit", opacity: 0.75 }}>
            Vòng {nr.r + 1}/{S.fx[myLg()].length} · {nr.m[0] === S.me ? "Sân nhà" : "Sân khách"} · sức mạnh {clubStr(nr.m[0]).pow} vs{" "}
            {clubStr(nr.m[1]).pow}
          </span>
        </>
      ) : S.d >= REVIEW_DAY ? (
        <span>Mùa giải đã kết thúc. Tiếp tục để sang mùa mới (1/7).</span>
      ) : null}
      {mt ? (
        <div className="row">
          <button className="btn" style={{ flex: 1 }} onClick={() => startMatch(true)}>
            Vào trận
          </button>
          <button className="btn ghost" onClick={() => startMatch(false)}>
            Giả lập nhanh
          </button>
        </div>
      ) : dl ? (
        <div className="row">
          <button className="btn" style={{ flex: 1 }} onClick={() => go("h1")}>
            Tua 1 giờ
          </button>
          <button className="btn ghost" onClick={() => go("h2")}>
            Tua 2 giờ
          </button>
        </div>
      ) : (
        <div className="row">
          <button className="btn" style={{ flex: 1 }} onClick={() => go("next")}>
            Tiếp tục
          </button>
          <button className="btn ghost" onClick={() => go("day")}>
            +1 ngày
          </button>
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  useGameVersion();
  const reset = useGame((s) => s.reset);
  const { openNego, openPlayer } = useUi();
  if (S.sacked) {
    return (
      <section className="panel">
        <h2>Bạn đã bị sa thải</h2>
        <p>{S.sacked}</p>
        <p className="hint">Sự nghiệp kéo dài {S.seasonLog.length} mùa giải. Bắt đầu lại với một CLB khác?</p>
        <button className="btn hot" onClick={() => void reset()}>
          Bắt đầu sự nghiệp mới
        </button>
      </section>
    );
  }
  const acts = S.negos.filter(needsAct);
  const last = S.lastMatch?.res;
  const openMsg = (id: string) => {
    const m = S.inbox.find((x) => x.id === id)!;
    commit(() => readMessage(id));
    if (m.nid && N(m.nid)) openNego(m.nid);
    else if (m.pid && P(m.pid)) openPlayer(m.pid);
    else toast(m.b);
  };
  return (
    <div className="grid2">
      <div className="col">
        <TodayCard />
        {acts.length > 0 && (
          <section className="panel">
            <h3>Cần bạn xử lý ({acts.length})</h3>
            {acts.map((n) => (
              <button key={n.id} className="need" onClick={() => openNego(n.id)}>
                <span>
                  <b>{P(n.pid)?.n ?? "?"}</b>
                  <br />
                  <span className="hint">{stageTxt(n)}</span>
                </span>
                <span className="btn sm hot">Mở</span>
              </button>
            ))}
          </section>
        )}
        {last && (
          <section className="panel">
            <h3>Trận gần nhất</h3>
            <div className="row between">
              <b className="row" style={{ gap: 6 }}>
                <ClubBadge name={C(last.h).n} size={24} />
                {C(last.h).n}
              </b>
              <b className="mono" style={{ fontSize: 22 }}>
                {last.hg} – {last.ag}
              </b>
              <b className="row" style={{ gap: 6 }}>
                {C(last.a).n}
                <ClubBadge name={C(last.a).n} size={24} />
              </b>
            </div>
          </section>
        )}
      </div>
      <section className="panel">
        <div className="row between">
          <h2>Hộp thư</h2>
          {S.inbox.some((m) => !m.read) && (
            <button className="btn ghost sm" onClick={() => commit(readAll)}>
              Đánh dấu đã đọc
            </button>
          )}
        </div>
        <div>
          {S.inbox.length ? (
            S.inbox.slice(0, 25).map((m) => (
              <button key={m.id} className={`msg ${m.read ? "" : "unread"}`} onClick={() => openMsg(m.id)}>
                <i />
                <span>
                  <b>{m.t}</b>
                  <p>{m.b}</p>
                </span>
                <span className="when">{shortD(m.d)}</span>
              </button>
            ))
          ) : (
            <p className="hint">Chưa có thư.</p>
          )}
        </div>
      </section>
    </div>
  );
}
