import { useEffect, type ReactNode } from "react";

/** Bảng trượt từ dưới lên (hồ sơ cầu thủ, đàm phán, trận đấu) */
export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <>
      <div className="sheet-bg anim" onClick={onClose} />
      <div className="sheet anim" role="dialog" aria-modal="true">
        {children}
      </div>
    </>
  );
}
