// Nút Back của trình duyệt: lùi từng lớp trong app (sheet, chọn thay người, tab) rồi mới rời trang.
import { useEffect } from "react";
import { useUi } from "@/stores/uiStore";

export function useBackNavigation(): void {
  useEffect(() => {
    // Một mục đệm nằm trên mục gốc để Back bắn popstate mà vẫn ở lại trang.
    history.replaceState({ sc: 0 }, "");
    history.pushState({ sc: 1 }, "");
    const onPop = () => {
      if (useUi.getState().goBack()) history.pushState({ sc: 1 }, "");
      else history.back();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
