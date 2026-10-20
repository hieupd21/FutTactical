# Kiến trúc

- `src/engine/` là logic thuần TS, không import React. Trạng thái toàn cục mutable `S` (state.ts). Tiền tính bằng nghìn € (k€).
- UI chỉ sửa trạng thái qua `commit(fn)` (stores/gameStore.ts). Thao tác nhỏ của người chơi đặt trong `engine/actions.ts`; không sửa `S` trực tiếp trong component.
- `features/*` không import lẫn nhau, ghép ở `src/app/`. Không dùng barrel file.
- Style: `src/styles/global.css` (token + class prototype) nạp qua `src/styles/tailwind.css` vào layer `legacy`; Tailwind v4 + shadcn/ui (`src/components/shadcn/`) cho thành phần mới, icon `lucide-react`. Toàn bộ chữ giao diện là tiếng Việt.
- Không đổi số luật game (lịch, giá trị, đàm phán) nếu không được yêu cầu; xem CLAUDE.md.
