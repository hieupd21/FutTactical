import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import "@/styles/tailwind.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dọn service worker và cache ảnh của cơ chế đã bỏ, tránh nó tiếp tục chặn tải ảnh trên máy từng chạy bản cũ
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      registrations.forEach((registration) => void registration.unregister()),
    );
  void caches?.delete("fifacm-images-v1");
}
