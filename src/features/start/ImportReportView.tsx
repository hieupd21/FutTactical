import type { ImportReport } from "@/lib/import/importer";

/** Báo cáo nhập file: nhận / bỏ qua / lý do, hiện trước khi chọn CLB */
export function ImportReportView({ r, onClear }: { r: ImportReport; onClear: () => void }) {
  return (
    <div className="report">
      <div className="row between">
        <b>{r.fileName}</b>
        <button className="linkb" onClick={onClear}>
          Chọn file khác
        </button>
      </div>
      <p className="hint" style={{ color: "var(--ink)" }}>
        Định dạng <b>{r.format === "sofifa" ? "sofifa" : "FIFPlay"}</b>
        {r.version ? ` · FC ${r.version}` : ""} · đọc {r.total.toLocaleString("vi-VN")} dòng, nhận{" "}
        <b className="ok">{r.accepted.toLocaleString("vi-VN")}</b> cầu thủ
        {r.format === "fifplay" ? ` (${r.matched} ghép được với FC 26, ${r.estimated} ước lượng)` : ""}.
      </p>
      <ul>
        {Object.entries(r.byLeague)
          .sort((a, b) => b[1] - a[1])
          .map(([lg, n]) => (
            <li key={lg}>
              {lg}: {n}
            </li>
          ))}
      </ul>
      {r.skipped.length > 0 && (
        <>
          <h3>Bỏ qua</h3>
          <ul>
            {r.skipped.map((s) => (
              <li key={s.reason}>
                {s.reason}: {s.count.toLocaleString("vi-VN")}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.warnings.map((w) => (
        <p key={w} className="hint" style={{ color: "var(--gold)" }}>
          {w}
        </p>
      ))}
    </div>
  );
}
