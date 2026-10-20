// Các phần tử giao diện nhỏ dùng chung.
import { Check, Minus, X } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Slider } from "@/components/shadcn/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { fmtM, fmtW } from "@/engine/format";
import { useUi } from "@/stores/uiStore";
import { cn } from "@/lib/utils";
import { cx } from "@/utils/display";
import { Button } from "@/components/shadcn/button";

export function Seg<K extends string>({ items, value, onChange }: { items: [K, ReactNode][]; value: K; onChange: (k: K) => void }) {
  return (
    <Tabs value={value} onValueChange={(k) => onChange(k as K)}>
      <TabsList className="seg h-auto w-full justify-start gap-1 overflow-x-auto rounded-[10px] bg-secondary p-1 group-data-[orientation=horizontal]/tabs:h-auto">
        {items.map(([k, l]) => (
          <TabsTrigger
            key={k}
            value={k}
            className="h-auto min-h-11 flex-[1_0_auto] rounded-[7px] border-0 px-2.5 text-[13px] font-semibold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
          >
            {l}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export type Fmt = "m" | "w" | "p" | "n";
export const fmtVal = (v: number, f: Fmt): string => (f === "m" ? fmtM(v) : f === "w" ? fmtW(v) : f === "p" ? v + "%" : String(v));

/** Trạng thái một điều khoản so với mức người đại diện đòi: đạt / gần đạt / chưa đạt */
export type TermState = "ok" | "near" | "no";
const TERM_LABEL: Record<TermState, string> = { ok: "Đạt", near: "Gần đạt", no: "Chưa đạt" };
/** Chỉ báo trạng thái dạng icon; chữ nằm trong aria-label và title để trình đọc màn hình vẫn nhận được */
export function TermBadge({ state }: { state: TermState }) {
  const Icon = state === "ok" ? Check : state === "near" ? Minus : X;
  return (
    <em className="term-badge" data-state={state} role="img" aria-label={TERM_LABEL[state]} title={TERM_LABEL[state]}>
      <Icon aria-hidden size={12} strokeWidth={3} />
    </em>
  );
}

/** Thanh trượt gắn với một khóa trong uiStore.form */
export function RangeField({
  k,
  label,
  min,
  max,
  step,
  fmt,
  def,
  status,
}: {
  k: string;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: Fmt;
  def: number;
  status?: TermState;
}) {
  const v = useUi((s) => (s.form[k] as number | undefined) ?? def);
  const setForm = useUi((s) => s.setForm);
  return (
    <div className="fld" data-term={status}>
      <div className="top">
        <span>
          {label}
          {status ? <TermBadge state={status} /> : null}
        </span>
        <b>{fmtVal(v, fmt)}</b>
      </div>
      <Slider min={min} max={max} step={step} value={[v]} onValueChange={([n]) => setForm(k, n)} aria-label={label} className="py-[14px]" />
    </div>
  );
}

/** Nhóm nút chọn một gắn với một khóa trong uiStore.form */
export function OptsField<V extends string | number>({
  k,
  label,
  list,
  def,
  status,
}: {
  k: string;
  label: string;
  list: [V, string][];
  def: V;
  status?: TermState;
}) {
  const v = useUi((s) => (s.form[k] as V | undefined) ?? def);
  const setForm = useUi((s) => s.setForm);
  return (
    <div className="fld" data-term={status}>
      <div className="top">
        <span>
          {label}
          {status ? <TermBadge state={status} /> : null}
        </span>
      </div>
      <ToggleGroup
        type="single"
        value={String(v)}
        onValueChange={(x) => {
          const hit = list.find(([val]) => String(val) === x);
          if (hit) setForm(k, hit[0]);
        }}
        spacing={1.5}
        className="opts w-full flex-wrap justify-start"
      >
        {list.map(([val, l]) => (
          <ToggleGroupItem
            key={String(val)}
            value={String(val)}
            className="h-auto min-h-11 rounded-lg border-[1.5px] border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-card hover:text-foreground data-[state=on]:border-[var(--accent)] data-[state=on]:bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] data-[state=on]:text-foreground"
          >
            {l}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
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

/** Nút chọn file ẩn trong label */
export function FileButton({
  label,
  accept,
  multiple,
  onFiles,
  variant = "ghost",
  size = "sm",
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  onFiles: (f: File[]) => void;
  variant?: "default" | "ghost" | "hot";
  size?: "default" | "sm";
}) {
  return (
    <Button asChild variant={variant} size={size}>
      <label style={{ textAlign: "center" }}>
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
    </Button>
  );
}

/** Nhãn trên ô nhập (chữ hoa nhỏ, xếp dọc) */
export function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      className={cn(
        "lbl flex-col items-stretch gap-1 text-xs leading-normal font-semibold tracking-[0.06em] text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

const NONE = "__none";

/** Ô chọn một giá trị; value rỗng được ánh xạ qua giá trị đệm vì Radix Select không nhận "" */
export function SelectField({
  label,
  value,
  onChange,
  options,
  style,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: [string, ReactNode][];
  style?: React.CSSProperties;
}) {
  return (
    <FieldLabel style={style}>
      {label}
      <Select value={value === "" ? NONE : value} onValueChange={(x) => onChange(x === NONE ? "" : x)}>
        <SelectTrigger className="w-full gap-1 bg-card px-2.5 text-[13px] font-normal tracking-normal text-foreground normal-case">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[70]">
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v === "" ? NONE : v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldLabel>
  );
}
