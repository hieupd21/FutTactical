# Sân Cỏ Career

Game quản lý bóng đá kiểu Career Mode của FC: trận đấu chạy từng phút (tạm dừng, thay người, đổi chiến thuật), chuyển nhượng, đàm phán hợp đồng. Dữ liệu cầu thủ thật theo FC 27/FC 26. Đây là bản dùng riêng, chưa phát hành công khai.

## Chạy dự án

```bash
pnpm install
pnpm dev        # http://localhost:2222
pnpm test           # kiểm thử engine (Vitest)
pnpm build      # kiểm tra kiểu (tsc -b) rồi build ra dist/
pnpm preview    # chạy thử bản build
pnpm lint       # ESLint (lint:fix để tự sửa)
pnpm format     # Prettier (format:check để chỉ kiểm tra)
```

## Công nghệ

Dự án dùng React 19, TypeScript (strict), Vite 5, Tailwind CSS 4, shadcn/ui (Radix), lucide-react, Framer Motion, Zustand 5, idb-keyval (IndexedDB) và Vitest.

## Cấu trúc thư mục

Thư mục được chia theo tính năng, theo hướng dẫn của tài liệu React ("Build a React app from scratch") và bulletproof-react.

```
public/data/            Gói dữ liệu cầu thủ (fc27.json, gồm cả giải nguồn bổ sung từ FC 26), tải bằng fetch khi chọn
src/
  app/                  Ghép ứng dụng: App (khung, chuyển tab), AnimatedTabs, SheetHost (bảng trượt)
  engine/               Logic game thuần TypeScript, không phụ thuộc React
    types.ts            Kiểu dữ liệu: Player, Club, Negotiation, GameState…
    constants.ts        Lịch mùa giải, sơ đồ, kiểu phát triển, giải đấu
    state.ts            Trạng thái gameState và các bộ chọn cơ bản (getPlayer, getClub, myClub, lịch)
    players.ts          Giá trị, lương, chỉ số động
    squad.ts            Đội hình, sức mạnh, bảng xếp hạng
    match.ts            Trận đấu nhanh (AI) và chốt trận của bạn
    liveMatch.ts        Trận trực tiếp từng phút: chiến thuật, thể lực, thay người, xG
    transfers.ts        Thăm dò, đàm phán CLB, hợp đồng, bán, mượn, GĐTT, AI ↔ AI
    season.ts           Tua ngày/giờ, Deadline Day, phát triển tháng, sang mùa
    board.ts            Mục tiêu và niềm tin của ban lãnh đạo
    world.ts            Khởi tạo thế giới từ dữ liệu thật
    actions.ts          Thao tác nhỏ của người chơi cho UI gọi
    *.test.ts           Kiểm thử: chạy trọn mùa, thương vụ mua
  features/             Mỗi màn hình là một thư mục; feature không import lẫn nhau
    start/  home/  squad/  market/  league/  club/  player/  negotiation/  match/
  components/           Thành phần dùng chung: ClubBadge, Avatar, PlayerRow, Sheet, ui
  stores/               gameStore (cầu nối engine ↔ React, lưu game), uiStore, matchFlow
  lib/                  persist (IndexedDB), data (tải gói), images, clubVisual
  utils/                Định dạng ngày, màu
  styles/tailwind.css   Tailwind v4 (theme + utilities) và ánh xạ màu shadcn; nạp global.css vào layer legacy
  styles/global.css
```

**Luồng dữ liệu.** Engine sửa trực tiếp trạng thái `gameState`. Mọi thao tác từ UI đi qua `commit(fn)` trong `gameStore`. Hàm này chạy `fn`, tăng số phiên bản để các component đăng ký bằng `useGameVersion()` vẽ lại, rồi lưu vào IndexedDB sau 250 ms.

## Dữ liệu cầu thủ

Dữ liệu là các file JSON dựng sẵn trong `public/data/`, cùng định dạng `DataRow` (xem `CLAUDE.md`):

- `fc27.json`: các giải mô phỏng, giải nguồn và cầu thủ tự do.
- `nationalities.json`: tên quốc tịch, ánh xạ mã quốc tịch và vị trí.
- `leagues.json`: giải thật theo mã sofifa, giải tùy chọn, cặp kình địch.
- `club_visuals.json`: màu áo và mã viết tắt CLB.

Tất cả nạp một lần khi khởi động bởi `src/lib/mockData.ts` vào `src/engine/mockData.ts`; engine đọc qua `mockData()`.

## Hình ảnh

Game không kèm logo hay ảnh thật. Huy hiệu được vẽ bằng SVG theo màu áo, ảnh cầu thủ là hình cách điệu. Người chơi có thể tự thêm ảnh trong tab CLB, kể cả nhập hàng loạt: tên file phải trùng tên cầu thủ hoặc tên CLB. Ảnh chỉ lưu trong trình duyệt.
