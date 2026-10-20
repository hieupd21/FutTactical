// Màn hình bắt đầu sự nghiệp: chọn nguồn dữ liệu → giải → CLB.
import { useEffect, useMemo, useState } from "react";
import { REP_NEWBIE, strReq } from "@/engine/career";
import { FICT_LEAGUES, OPTIONAL_LG, REAL_LG } from "@/engine/constants";
import type { DataRow, LowerLeagueData } from "@/engine/types";
import { packClubs } from "@/engine/world";
import { ClubBadge } from "@/components/ClubBadge";
import { Seg } from "@/components/ui";
import { loadLower, loadPack, PACKS, type PackId } from "@/lib/data";
import { useGame } from "@/stores/gameStore";
import { Card } from "@/components/shadcn/card";

type Src = PackId | "fict";
const LG_ORDER = ["EN", "ES", "DE", "IT", "FR"];
type Mode = "rookie" | "free";

export function StartScreen() {
  const [src, setSrc] = useState<Src>("fc27");
  const [rows, setRows] = useState<DataRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pickLg, setPickLg] = useState("");
  const [mode, setMode] = useState<Mode>("rookie");
  const [lower, setLower] = useState<LowerLeagueData[]>([]);
  const { startReal, startFict } = useGame();

  useEffect(() => {
    setErr(null);
    if (src === "fc27") {
      setRows(null);
      loadPack(src)
        .then(setRows)
        .catch((e: Error) => setErr(e.message));
    } else setRows(null);
  }, [src]);

  useEffect(() => {
    loadLower()
      .then(setLower)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const real = src !== "fict";
  const have = useMemo(() => new Set((rows ? packClubs(rows) : []).map((c) => c.lid)), [rows]);
  // hạng thấp hư cấu chỉ dùng khi gói dữ liệu chưa có League One/Two thật
  const fallback = lower.filter((l) => !Object.entries(REAL_LG).some(([k, r]) => r.id === l.id && have.has(+k)));
  // HLV mới chỉ nhận được các đội có yêu cầu uy tín trong tầm; chế độ tự chọn mở hết
  const rookie = real && mode === "rookie";
  const lgs = real
    ? [
        ...[...LG_ORDER, "DE2", "FR2", "ES2", "IT2", "EN3", "EN4"]
          .map((id) => Object.entries(REAL_LG).find(([k, l]) => l.id === id && (!OPTIONAL_LG.includes(+k) || have.has(+k)))?.[1])
          .filter((l) => !!l),
        ...fallback,
      ].sort((a, b) => (rookie ? a.lvl - b.lvl : b.lvl - a.lvl))
    : FICT_LEAGUES;
  const lg = lgs.some((l) => l.id === pickLg) ? pickLg : lgs[0].id;

  const clubs = useMemo(() => {
    if (!real) return (FICT_LEAGUES.find((l) => l.id === lg)?.clubs || []).map(([n, str], i) => ({ n, str, k: String(i) }));
    const low = fallback.find((l) => l.id === lg);
    if (low) return [...low.clubs].sort((a, b) => b[1] - a[1]).map(([n, str]) => ({ n, str, k: n }));
    if (!rows) return [];
    const lid = Object.keys(REAL_LG).find((k) => REAL_LG[+k].id === lg);
    return packClubs(rows)
      .filter((c) => String(c.lid) === lid)
      .sort((a, b) => b.str - a.str)
      .map((c) => ({ n: c.n, str: c.str, k: c.n }));
  }, [real, rows, lg, fallback]);

  const n = clubs.length;
  const tier = (i: number) => (i < 3 ? "Ứng viên vô địch" : i < 7 ? "Nhóm dự cúp châu Âu" : i < n - 5 ? "Nhóm giữa" : "Đội cửa dưới");
  const locked = (str: number) => rookie && strReq(str) > REP_NEWBIE;

  const pick = (k: string) => {
    if (!real) {
      startFict(lg, +k);
      return;
    }
    if (!rows) return;
    startReal(rows, lg, k, PACKS[src as PackId].src, { lower: fallback, rookie });
  };

  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h2>Bắt đầu sự nghiệp</h2>
      <div className="col" style={{ gap: 6 }}>
        <h3>Nguồn dữ liệu</h3>
        <Seg<Src>
          value={src}
          onChange={setSrc}
          items={[
            ["fc27", PACKS.fc27.label],
            ["fict", "Thế giới hư cấu"],
          ]}
        />
        {src === "fc27" && <p className="hint">{PACKS[src].note}</p>}
        {src === "fict" && <p className="hint">Tên CLB theo địa danh và màu áo, cầu thủ hư cấu. Dùng bản này khi phát hành công khai.</p>}
        {err && <p className="err">{err}</p>}
      </div>
      {real && (
        <div className="col" style={{ gap: 6 }}>
          <h3>Cách bắt đầu</h3>
          <Seg<Mode>
            value={mode}
            onChange={setMode}
            items={[
              ["rookie", "HLV mới"],
              ["free", "Tự chọn CLB"],
            ]}
          />
          <p className="hint">
            {mode === "rookie"
              ? "Bạn còn vô danh nên chỉ được các đội hạng dưới giao ghế. Hãy đạt thành tích để tăng uy tín, các CLB lớn hơn sẽ gửi lời mời cuối mùa."
              : "Chọn thẳng bất kỳ CLB nào, kể cả đội mạnh nhất. Uy tín khởi đầu tương xứng với CLB đã chọn."}
          </p>
        </div>
      )}
      {
        <>
          <Seg value={lg} onChange={setPickLg} items={lgs.map((l) => [l.id, l.n.replace("Giải VĐQG ", "")] as [string, string])} />
          {real && !rows && !err ? (
            <p className="hint">Đang tải dữ liệu…</p>
          ) : (
            <div className="pick">
              {clubs.map((c, i) => (
                <button
                  key={c.k}
                  onClick={() => pick(c.k)}
                  disabled={locked(c.str)}
                  style={locked(c.str) ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                  <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                    <ClubBadge name={c.n} size={36} />
                    <span className="nm">{c.n}</span>
                  </span>
                  <span className="hint">
                    {locked(c.str) ? `Cần uy tín ${strReq(c.str)}, bạn mới có ${REP_NEWBIE}` : `${tier(i)} · sức mạnh ${c.str}`}
                  </span>
                </button>
              ))}
              {real && rows && !clubs.length && <p className="hint">Dữ liệu không có CLB nào của giải này.</p>}
            </div>
          )}
        </>
      }
    </Card>
  );
}
