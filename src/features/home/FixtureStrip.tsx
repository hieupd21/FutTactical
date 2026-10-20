import { ArrowLeftRight, Clock, Flag, Lock, type LucideIcon } from "lucide-react";
import { DEADLINE_HOURS, REVIEW_DAY, SEASON_LEN } from "@/engine/constants";
import { C, isDeadline, myLg, roundOn, S, windowNow } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { cx, shortD } from "@/utils/display";

type Ev =
  { k: "match"; d: number; r: number; opp: string; home: boolean } | { k: "mark"; d: number; icon: LucideIcon; title: string; sub: string };

/** Các mốc sắp tới của mùa: trận của CLB mình, mở kỳ chuyển nhượng, Deadline Day, tổng kết mùa */
function upcoming(limit: number): Ev[] {
  const L = myLg(),
    out: Ev[] = [];
  for (let d = S.d + (S.matchToday ? 0 : 1); d < SEASON_LEN && out.length < limit; d++) {
    const w = windowNow(d);
    if (d > S.d && w && !windowNow(d - 1))
      out.push({ k: "mark", d, icon: ArrowLeftRight, title: "Mở kỳ chuyển nhượng", sub: w === "summer" ? "Kỳ hè" : "Kỳ đông" });
    if (d > S.d && isDeadline(d) && w) out.push({ k: "mark", d, icon: Clock, title: "Deadline Day", sub: `${DEADLINE_HOURS} giờ cuối` });
    if (d > S.d && !w && windowNow(d - 1) && !isDeadline(d - 1))
      out.push({ k: "mark", d, icon: Lock, title: "Đóng kỳ chuyển nhượng", sub: "Hết hạn" });
    if (d === REVIEW_DAY && d > S.d) out.push({ k: "mark", d, icon: Flag, title: "Tổng kết mùa", sub: "Đánh giá của ban lãnh đạo" });
    const r = roundOn(d, L);
    const m = r >= 0 ? S.fx[L][r].find((x) => x.includes(S.me)) : undefined;
    if (m) out.push({ k: "match", d, r, opp: C(m[0] === S.me ? m[1] : m[0]).n, home: m[0] === S.me });
  }
  return out.slice(0, limit);
}

const when = (d: number): string => (d === S.d ? "Hôm nay" : d - S.d === 1 ? "Ngày mai" : `Còn ${d - S.d} ngày`);

/** Dải lịch cuộn ngang: trận vừa đá (nếu có) rồi các mốc sắp tới; thẻ đầu tiên sắp tới có viền nhấn */
export function FixtureStrip() {
  const last = S.lastMatch?.res;
  const evs = upcoming(6);
  if (!last && !evs.length) return null;
  return (
    <section aria-labelledby="fxs-h" className="col" style={{ gap: 8 }}>
      <h3 id="fxs-h">Lịch sắp tới</h3>
      <ul className="fxs" tabIndex={0} aria-label="Lịch sắp tới, cuộn ngang để xem thêm">
        {last && (
          <li className="fx past">
            <span className="fx-d">Vừa đá</span>
            <span className="fx-t">
              <ClubBadge name={C(last.h).n} size={22} />
              <b className="mono">
                {last.hg}–{last.ag}
              </b>
              <ClubBadge name={C(last.a).n} size={22} />
            </span>
            <span className="fx-s">
              {C(last.h).n} – {C(last.a).n}
            </span>
          </li>
        )}
        {evs.map((e, i) => (
          <li key={`${e.d}-${i}`} className={cx("fx", i === 0 && "next")}>
            <span className="fx-d">
              {when(e.d)} · {shortD(e.d)}
            </span>
            {e.k === "match" ? (
              <>
                <span className="fx-t">
                  <ClubBadge name={e.opp} size={22} />
                  <b>{e.opp}</b>
                </span>
                <span className="fx-s">
                  Vòng {e.r + 1} · {e.home ? "Sân nhà" : "Sân khách"}
                </span>
              </>
            ) : (
              <>
                <span className="fx-t">
                  <e.icon size={18} strokeWidth={2.25} aria-hidden="true" />
                  <b>{e.title}</b>
                </span>
                <span className="fx-s">{e.sub}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
