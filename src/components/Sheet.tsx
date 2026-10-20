import type { ReactNode } from "react";
import { Sheet as SheetRoot, SheetContent, SheetTitle } from "@/components/shadcn/sheet";

/** Bảng trượt từ dưới lên (hồ sơ cầu thủ, đàm phán, trận đấu). Không truyền onClose = không cho đóng bằng Esc / bấm nền. */
export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  const block = (e: Event) => {
    if (!onClose) e.preventDefault();
  };
  return (
    <SheetRoot open onOpenChange={(open) => !open && onClose?.()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        onEscapeKeyDown={block}
        onInteractOutside={block}
        className="sheet z-[60] mx-auto max-w-[680px] gap-3.5 border-t-0 bg-card shadow-[0_-10px_40px_rgba(0,0,0,0.25)] data-[state=closed]:duration-200 data-[state=open]:duration-300"
      >
        <SheetTitle className="sr-only">Chi tiết</SheetTitle>
        {children}
      </SheetContent>
    </SheetRoot>
  );
}
