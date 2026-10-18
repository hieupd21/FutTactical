/** Đọc CSV chuẩn RFC 4180 (dấu phẩy, ngoặc kép, xuống dòng trong ô). Trả về tiêu đề + các dòng. */
export function parseCSV(text: string): { header: string[]; rows: string[][] } {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const rows: string[][] = [];
  let row: string[] = [],
    f = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(f);
      f = "";
    } else if (ch === "\n") {
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else if (ch !== "\r") f += ch;
  }
  if (f || row.length) {
    row.push(f);
    rows.push(row);
  }
  const header = (rows.shift() || []).map((x) => x.trim());
  return { header, rows: rows.filter((r) => r.length > 1 || (r[0] || "").trim() !== "") };
}

export const norm = (s: string | undefined | null): string =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
