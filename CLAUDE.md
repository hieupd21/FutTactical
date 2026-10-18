# Sân Cỏ Career — ghi chú cho Claude Code

Game quản lý bóng đá kiểu Career Mode của EA FC: giả lập trận đấu (không điều khiển), chuyển nhượng và đàm phán giống FC. Mobile-first, chạy trên web. Dùng riêng nên được phép dùng tên cầu thủ/CLB thật. KHÔNG thêm logo hoặc ảnh thật (chỉ huy hiệu SVG tự vẽ + ảnh người chơi tự tải lên).

Luôn trả lời người dùng bằng tiếng Việt. Toàn bộ chữ trong giao diện là tiếng Việt.

## Lệnh
- `npm run dev` — chạy thử
- `npm test` — Vitest (engine + bộ nhập CSV). Chạy sau mọi thay đổi engine.
- `npm run build` — `tsc -b` (strict, noUnused*) rồi vite build. Phải sạch lỗi trước khi xong việc.

## Kiến trúc (xem README.md để biết chi tiết thư mục)
- `src/engine/` là logic thuần TS, KHÔNG import React. Trạng thái toàn cục mutable `S` (state.ts). Tiền tính bằng nghìn € (k€); `fmtM` hiển thị.
- UI chỉ sửa trạng thái qua `commit(fn)` (stores/gameStore.ts): chạy hàm engine → tăng version → lưu IndexedDB. Component gọi `useGameVersion()` để vẽ lại.
- Thao tác nhỏ của người chơi đặt trong `engine/actions.ts`, không sửa `S` trực tiếp trong component.
- `features/*` không import lẫn nhau; ghép ở `src/app/`. Thành phần dùng chung ở `src/components/`. Không dùng barrel file.
- Trạng thái giao diện (sheet đang mở, bộ lọc, giá trị form đàm phán `form[n.id+key]`) ở `stores/uiStore.ts`.
- Style: một file `src/styles/global.css` (token màu sáng/tối trên `:root`), class giữ nguyên từ bản prototype.

## Luật game quan trọng (đừng đổi số nếu không được yêu cầu)
- Lịch: ngày `d` tính từ 1/7; vòng 1 ngày 45, mỗi vòng cách 7 ngày; kỳ CN hè [0,61], đông [184,214]; Deadline Day 20 giờ tua theo giờ; tổng kết ngày 335; mùa dài 365.
- Giá trị: `3000*exp((ovr-70)/6)` × hệ số tuổi/tiềm năng/hợp đồng/phong độ/giải × `vk` (neo theo giá thật). Lương cơ bản `max(3, 3+val/600)` k€/tuần.
- Đàm phán: thăm dò → CLB (thanh căng thẳng, trả góp, thưởng 20 trận, % bán lại, cho mượn lại, trao đổi, thời điểm, điều khoản giải phóng) → hợp đồng (lương, năm, lót tay, vai trò, điều khoản) → chốt (18% CLB khác nhảy vào, ép giá 50/35/15). Còn có mượn, tự do, ký trước từ 1/1, gia hạn, Giám đốc thể thao, AI hỏi mua, AI↔AI.
- Đội tối thiểu 18 người khi bán; học viện bù đủ 20 đầu mùa.

## Dữ liệu
- `public/data/fc27.json`, `fc26.json`: mảng dòng `[league_id, club, short, long, positions, ovr, pot, value_eur, wage_eur, age, contract_year, release_clause_eur, nationality, fifa_version, prevClub?]` (kiểu `DataRow`).
- Giải mô phỏng: 13 EPL, 53 LaLiga, 19 Bundesliga, 31 Serie A, 16 Ligue 1. Giải nguồn (không đá): 14 Championship, 308 Bồ Đào Nha, 10 Hà Lan, 999 đội mới xuống hạng.
- fc27.json = FC 27 (FIFPlay, 11/10/2026: CLB + chỉ số) ghép FC 26 (sofifa: tuổi+1, tiềm năng, lương, hợp đồng, giá). Script: `scripts/merge_fc27.py`.
- Nhập CSV trong game: `src/lib/import/` tự nhận định dạng sofifa hoặc FIFPlay, có báo cáo nhập.

## Hướng phát triển đã bàn (chưa làm)
- Thêm cúp châu Âu / cúp quốc nội, chiến thuật chi tiết hơn, lịch sử nhiều mùa.
