import type { ComponentProps } from "react";
import { classNames } from "@/utils/display";

/** Khung kính mờ dùng chung cho các màn có nền gradient (Trang chủ, Lịch) */
export function GlassPanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-white/20 bg-card/40 shadow-lg backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}
