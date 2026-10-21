// Các phần tử giao diện nhỏ dùng chung.
import { Check, Minus, X } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { Slider } from "@/components/shadcn/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { formatMoney, formatWage } from "@/engine/format";
import { useUi } from "@/stores/uiStore";
import { cn } from "@/lib/utils";
import { classNames } from "@/utils/display";
import { Button } from "@/components/shadcn/button";

export function SegmentedControl<K extends string>({
  items,
  value,
  onChange,
}: {
  items: [K, ReactNode][];
  value: K;
  onChange: (optionKey: K) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(selectedKey) => onChange(selectedKey as K)}>
      <TabsList className="seg h-auto w-full justify-start gap-1 overflow-x-auto rounded-[10px] bg-secondary p-1 group-data-[orientation=horizontal]/tabs:h-auto">
        {items.map(([optionKey, label]) => (
          <TabsTrigger
            key={optionKey}
            value={optionKey}
            className="h-auto min-h-11 flex-[1_0_auto] rounded-[7px] border-0 px-2.5 text-[13px] font-semibold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export type Fmt = "m" | "w" | "p" | "n";
export const formatValue = (value: number, format: Fmt): string =>
  format === "m"
    ? formatMoney(value)
    : format === "w"
      ? formatWage(value)
      : format === "p"
        ? value + "%"
        : String(value);

/** Trạng thái một điều khoản so với mức người đại diện đòi: đạt / gần đạt / chưa đạt */
export type TermState = "ok" | "near" | "no";
const TERM_LABEL: Record<TermState, string> = { ok: "Đạt", near: "Gần đạt", no: "Chưa đạt" };
/** Chỉ báo trạng thái dạng icon; chữ nằm trong aria-label và title để trình đọc màn hình vẫn nhận được */
export function TermBadge({ state }: { state: TermState }) {
  const Icon = state === "ok" ? Check : state === "near" ? Minus : X;
  return (
    <em
      className="term-badge"
      data-state={state}
      role="img"
      aria-label={TERM_LABEL[state]}
      title={TERM_LABEL[state]}
    >
      <Icon aria-hidden size={12} strokeWidth={3} />
    </em>
  );
}

/** Thanh trượt gắn với một khóa trong uiStore.form */
export function RangeField({
  fieldKey,
  label,
  min,
  max,
  step,
  format,
  def,
  status,
}: {
  fieldKey: string;
  label: string;
  min: number;
  max: number;
  step: number;
  format: Fmt;
  def: number;
  status?: TermState;
}) {
  const value = useUi((ui) => (ui.form[fieldKey] as number | undefined) ?? def);
  const setForm = useUi((ui) => ui.setForm);
  return (
    <div className="fld" data-term={status}>
      <div className="top">
        <span>
          {label}
          {status ? <TermBadge state={status} /> : null}
        </span>
        <b>{formatValue(value, format)}</b>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([newValue]) => setForm(fieldKey, newValue)}
        aria-label={label}
        className="py-[14px]"
      />
    </div>
  );
}

/** Nhóm nút chọn một gắn với một khóa trong uiStore.form */
export function OptsField<V extends string | number>({
  fieldKey,
  label,
  list,
  def,
  status,
}: {
  fieldKey: string;
  label: string;
  list: [V, string][];
  def: V;
  status?: TermState;
}) {
  const fieldValue = useUi((ui) => (ui.form[fieldKey] as V | undefined) ?? def);
  const setForm = useUi((ui) => ui.setForm);
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
        value={String(fieldValue)}
        onValueChange={(selectedValue) => {
          const selectedOption = list.find(
            ([optionValue]) => String(optionValue) === selectedValue,
          );
          if (selectedOption) setForm(fieldKey, selectedOption[0]);
        }}
        spacing={1.5}
        className="opts w-full flex-wrap justify-start"
      >
        {list.map(([optionValue, optionLabel]) => (
          <ToggleGroupItem
            key={String(optionValue)}
            value={String(optionValue)}
            className="h-auto min-h-11 rounded-lg border-[1.5px] border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-card hover:text-foreground data-[state=on]:border-[var(--accent)] data-[state=on]:bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] data-[state=on]:text-foreground"
          >
            {optionLabel}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function SummaryRows({ rows }: { rows: [ReactNode, ReactNode, string?][] }) {
  return (
    <div className="sum">
      {rows.map(([labelText, valueText, className], i) => (
        <Fragment key={i}>
          <span>{labelText}</span>
          <span className={classNames(className)}>{valueText}</span>
        </Fragment>
      ))}
    </div>
  );
}

export function KeyValueRows({
  rows,
}: {
  rows: ([ReactNode, ReactNode, string?] | false | null | undefined)[];
}) {
  return (
    <div className="kv">
      {rows
        .filter((row): row is [ReactNode, ReactNode, string?] => !!row)
        .map(([labelText, valueText, className], i) => (
          <Fragment key={i}>
            <span>{labelText}</span>
            <span className={classNames(className)}>{valueText}</span>
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
  onFiles: (files: File[]) => void;
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
          onChange={(event) => {
            const files = [...(event.target.files || [])];
            event.target.value = "";
            if (files.length) onFiles(files);
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
  onChange: (selectedValue: string) => void;
  options: [string, ReactNode][];
  style?: React.CSSProperties;
}) {
  return (
    <FieldLabel style={style}>
      {label}
      <Select
        value={value === "" ? NONE : value}
        onValueChange={(selectedValue) => onChange(selectedValue === NONE ? "" : selectedValue)}
      >
        <SelectTrigger className="w-full gap-1 bg-card px-2.5 text-[13px] font-normal tracking-normal text-foreground normal-case">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[70]">
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue === "" ? NONE : optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldLabel>
  );
}
