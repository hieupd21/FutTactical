// Màn hình chờ khi chuyển screen: vòng tròn tự vẽ với vạch ngang kéo giãn xuyên qua.
import { cn } from "@/lib/utils";

export function Preloader({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Đang tải"
      className={cn(
        "pointer-events-none fixed inset-0 z-20 grid place-items-center text-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 120 80" width="144" height="96" fill="none" aria-hidden="true">
        <circle
          cx="60"
          cy="40"
          r="28"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="176"
          className="animate-preloader-ring origin-[60px_40px] motion-reduce:animate-none"
        />
        <line
          x1="4"
          y1="40"
          x2="116"
          y2="40"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="animate-preloader-bar origin-[60px_40px] motion-reduce:animate-none"
        />
      </svg>
    </div>
  );
}
