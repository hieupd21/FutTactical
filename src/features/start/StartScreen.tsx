// Màn hình bắt đầu sự nghiệp: chọn nguồn dữ liệu → giải → CLB.
import { useEffect, useMemo, useState } from "react";
import { FICT_LEAGUES, REAL_LG } from "@/engine/constants";
import type { DataRow } from "@/engine/types";
import { packClubs } from "@/engine/world";
import { ClubBadge } from "@/components/ClubBadge";
import { FileButton, Seg } from "@/components/ui";
import { loadPack, PACKS, type PackId } from "@/lib/data";
import { importCSV, type ImportResult } from "@/lib/import/importer";
import { useGame } from "@/stores/gameStore";
import { ImportReportView } from "./ImportReportView";

type Src = PackId | "import" | "fict";
const LG_ORDER = ["EN", "ES", "DE", "IT", "FR"];

export function StartScreen() {
  const [src, setSrc] = useState<Src>("fc27");
  const [rows, setRows] = useState<DataRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [imp, setImp] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickLg, setPickLg] = useState("EN");
  const { startReal, startFict } = useGame();

  useEffect(() => {
    setErr(null);
    if (src === "fc27" || src === "fc26") {
      setRows(null);
      loadPack(src)
        .then(setRows)
        .catch((e: Error) => setErr(e.message));
    } else setRows(src === "import" && imp ? imp.rows : null);
  }, [src, imp]);

  const real = src !== "fict";
  const lgs = real ? LG_ORDER.map((id) => Object.values(REAL_LG).find((l) => l.id === id)!).filter(Boolean) : FICT_LEAGUES;
  const lg = lgs.some((l) => l.id === pickLg) ? pickLg : lgs[0].id;

  const clubs = useMemo(() => {
    if (!real) return (FICT_LEAGUES.find((l) => l.id === lg)?.clubs || []).map(([n, str], i) => ({ n, str, k: String(i) }));
    if (!rows) return [];
    const lid = Object.keys(REAL_LG).find((k) => REAL_LG[+k].id === lg);
    return packClubs(rows)
      .filter((c) => String(c.lid) === lid)
      .sort((a, b) => b.str - a.str)
      .map((c) => ({ n: c.n, str: c.str, k: c.n }));
  }, [real, rows, lg]);

  const n = clubs.length;
  const tier = (i: number) => (i < 3 ? "Ứng viên vô địch" : i < 7 ? "Nhóm dự cúp châu Âu" : i < n - 5 ? "Nhóm giữa" : "Đội cửa dưới");

  const onFile = async (f: File) => {
    setBusy(true);
    setErr(null);
    try {
      setImp(await importCSV(await f.text(), f.name, () => loadPack("fc26")));
    } catch (e) {
      setImp(null);
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const pick = (k: string) => {
    if (!real) {
      startFict(lg, +k);
      return;
    }
    if (!rows) return;
    const label = src === "import" ? `Tệp ${imp?.report.fileName}` : PACKS[src as PackId].src;
    startReal(rows, lg, k, label);
  };

  const showClubs = src !== "import" || !!imp;
  return (
    <section className="panel">
      <h2>Bắt đầu sự nghiệp</h2>
      <div className="col" style={{ gap: 6 }}>
        <h3>Nguồn dữ liệu</h3>
        <Seg<Src>
          value={src}
          onChange={setSrc}
          items={[
            ["fc27", PACKS.fc27.label],
            ["fc26", PACKS.fc26.label],
            ["import", "Nhập file CSV"],
            ["fict", "Thế giới hư cấu"],
          ]}
        />
        {(src === "fc27" || src === "fc26") && <p className="hint">{PACKS[src].note}</p>}
        {src === "import" && (
          <>
            <p className="hint">
              Hỗ trợ 2 định dạng, tự nhận diện theo tiêu đề cột: <b>sofifa</b> (các bộ FC 24/25/26 trên Kaggle, GitHub: league_id,
              club_name, short_name, overall, value_eur, wage_eur, age…) và <b>FIFPlay</b> (bộ FC 27: first_name, last_name, nation_name,
              club_name, position, rating). File FIFPlay thiếu tuổi, lương, hợp đồng nên được ghép với dữ liệu FC 26.
            </p>
            <FileButton
              className="btn ghost"
              label={busy ? "Đang đọc…" : "Chọn file CSV"}
              accept=".csv,text/csv"
              onFiles={(f) => onFile(f[0])}
            />
            {imp && <ImportReportView r={imp.report} onClear={() => setImp(null)} />}
          </>
        )}
        {src === "fict" && <p className="hint">Tên CLB theo địa danh và màu áo, cầu thủ hư cấu. Dùng bản này khi phát hành công khai.</p>}
        {err && <p className="err">{err}</p>}
      </div>
      {showClubs && (
        <>
          <Seg value={lg} onChange={setPickLg} items={lgs.map((l) => [l.id, l.n.replace("Giải VĐQG ", "")] as [string, string])} />
          {real && !rows && !err ? (
            <p className="hint">Đang tải dữ liệu…</p>
          ) : (
            <div className="pick">
              {clubs.map((c, i) => (
                <button key={c.k} onClick={() => pick(c.k)}>
                  <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                    <ClubBadge name={c.n} size={36} />
                    <span className="nm">{c.n}</span>
                  </span>
                  <span className="hint">
                    {tier(i)} · sức mạnh {c.str}
                  </span>
                </button>
              ))}
              {real && rows && !clubs.length && <p className="hint">Dữ liệu không có CLB nào của giải này.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
