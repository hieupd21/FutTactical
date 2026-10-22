# Sân Cỏ Career

Game quản lý bóng đá kiểu Career Mode của FC: trận đấu chạy từng phút (tạm dừng, thay người, đổi chiến thuật), chuyển nhượng, đàm phán hợp đồng. Sự nghiệp mới dùng bộ bóng đá nam FC27 từ FIFACM, snapshot 06/10/2026. Đây là bản dùng riêng, chưa phát hành công khai.

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
data/fifacm/            Nguồn cầu thủ, CLB, giải, quốc tịch, đội tuyển và sơ đồ
plugins/fifacmData.ts   Phục vụ nguồn JSON khi dev và xuất vào dist/data/fifacm khi build
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
    fifacm.ts           Đọc quan hệ ID và chuyển dữ liệu FIFACM sang định dạng engine
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

Nguồn chuẩn nằm trong `data/fifacm/`: **18.763 cầu thủ nam, 663 CLB, 36 nhóm giải, 169 quốc tịch và 22 sơ đồ**. Các file này được phục vụ tại `data/fifacm/*.json` và xuất nguyên bản vào bản build; không cần sao chép sang public thủ công. Danh mục đội tuyển cũng được xuất để dùng cho tính năng sau này; hiện game quản lý CLB.

`src/lib/data.ts` tải nguồn khi tạo sự nghiệp. `src/engine/fifacm.ts` nối `players.clubId` → `clubs.id`, `clubs.leagueIds` → `leagues.id`, `players.nationality.id` → `nations.id`, rồi tạo `DataRow` trong bộ nhớ cho engine. Cầu thủ và CLB giữ `sourceId`; không ghép dữ liệu cầu thủ FC26 vào nguồn mới. Cầu thủ tự do có `club: null` và `contract: null`.

Lương, giá trị, hợp đồng và điều khoản giải phóng lấy từ nguồn; tiền được đổi từ € sang nghìn €. Khởi tạo không thêm cầu thủ giả vào đội hình FIFACM. Formation và đội hình của CLB người chơi lấy theo nguồn; `engine/constants.ts` đọc 22 sơ đồ từ `formations.json` và gộp các tuyến tiền vệ cho engine GK/DF/MF/FW. Ngân sách 0 ở nguồn chưa xác minh nên game tiếp tục dùng công thức ngân sách sự nghiệp và trần lương hiện có; `worthEur` không được dùng làm tiền chuyển nhượng.

Giải, quốc tịch, độ mạnh giải, màu CLB đều được suy ra từ `data/fifacm`. mọi hạng đấu của 5 quốc gia có giải hạng 1 mạnh nhất được mô phỏng, các giải còn lại cung cấp CLB/cầu thủ cho thị trường. Bản lưu cũ tiếp tục dùng thế giới đã lưu; tạo sự nghiệp mới để dùng FIFACM.

## Hình ảnh

Tên cầu thủ, CLB, giải và ảnh (chân dung, logo) lấy nguyên từ dữ liệu FIFACM trong `data/fifacm/`; game không cho đổi tên hay tự thêm ảnh. Khi ảnh nguồn không tải được, game dùng huy hiệu SVG theo màu áo và chân dung cách điệu.
