// Các phần tử giao diện nhỏ dùng chung.
import { Fragment, type ReactNode } from "react";
import { fmtM, fmtW } from "@/engine/format";
import { useUi } from "@/stores/uiStore";
import { cx } from "@/utils/display";

export function Seg<K extends string>({ items, value, onChange }: { items: [K, ReactNode][]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="seg" role="tablist">
      {items.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export type Fmt = "m" | "w" | "p" | "n";
export const fmtVal = (v: number, f: Fmt): string => (f === "m" ? fmtM(v) : f === "w" ? fmtW(v) : f === "p" ? v + "%" : String(v));

/** Thanh trượt gắn với một khóa trong uiStore.form */
export function RangeField({
  k,
  label,
  min,
  max,
  step,
  fmt,
  def,
}: {
  k: string;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: Fmt;
  def: number;
}) {
  const v = useUi((s) => (s.form[k] as number | undefined) ?? def);
  const setForm = useUi((s) => s.setForm);
  return (
    <div className="fld">
      <div className="top">
        <span>{label}</span>
        <b>{fmtVal(v, fmt)}</b>
      </div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => setForm(k, +e.target.value)} aria-label={label} />
    </div>
  );
}

/** Nhóm nút chọn một gắn với một khóa trong uiStore.form */
export function OptsField<V extends string | number>({ k, label, list, def }: { k: string; label: string; list: [V, string][]; def: V }) {
  const v = useUi((s) => (s.form[k] as V | undefined) ?? def);
  const setForm = useUi((s) => s.setForm);
  return (
    <div className="fld">
      <div className="top">
        <span>{label}</span>
      </div>
      <div className="opts">
        {list.map(([val, l]) => (
          <button key={String(val)} aria-pressed={String(v) === String(val)} onClick={() => setForm(k, val)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Sum({ rows }: { rows: [ReactNode, ReactNode, string?][] }) {
  return (
    <div className="sum">
      {rows.map(([a, b, cls], i) => (
        <Fragment key={i}>
          <span>{a}</span>
          <span className={cx(cls)}>{b}</span>
        </Fragment>
      ))}
    </div>
  );
}

export function KV({ rows }: { rows: ([ReactNode, ReactNode, string?] | false | null | undefined)[] }) {
  return (
    <div className="kv">
      {rows
        .filter((r): r is [ReactNode, ReactNode, string?] => !!r)
        .map(([a, b, cls], i) => (
          <Fragment key={i}>
            <span>{a}</span>
            <span className={cx(cls)}>{b}</span>
          </Fragment>
        ))}
    </div>
  );
}

export function Toast() {
  const t = useUi((s) => s.toast);
  return t ? (
    <div className="toast" role="status">
      {t}
    </div>
  ) : null;
}

/** Nút chọn file ẩn trong label */
export function FileButton({
  label,
  accept,
  multiple,
  onFiles,
  className = "btn ghost sm",
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  onFiles: (f: File[]) => void;
  className?: string;
}) {
  return (
    <label className={className} style={{ textAlign: "center" }}>
      {label}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const f = [...(e.target.files || [])];
          e.target.value = "";
          if (f.length) onFiles(f);
        }}
      />
    </label>
  );
}
