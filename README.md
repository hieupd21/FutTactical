# Sân Cỏ Career

Game quản lý bóng đá kiểu Career Mode của FC: giả lập trận đấu, chuyển nhượng, đàm phán hợp đồng. Dữ liệu cầu thủ thật theo FC 27/FC 26. Đây là bản dùng riêng, chưa phát hành công khai.

## Chạy dự án

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # kiểm thử engine và bộ nhập CSV (Vitest)
npm run build      # kiểm tra kiểu (tsc -b) rồi build ra dist/
npm run preview    # chạy thử bản build
```

## Công nghệ

Dự án dùng React 18, TypeScript (strict), Vite 5, React Router 6 (HashRouter), Zustand 5, idb-keyval (IndexedDB) và Vitest.

## Cấu trúc thư mục

Thư mục được chia theo tính năng, theo hướng dẫn của tài liệu React ("Build a React app from scratch") và bulletproof-react.

```
public/data/            Gói dữ liệu cầu thủ (fc27.json, fc26.json), tải bằng fetch khi chọn
scripts/                Script Python ghép dữ liệu FC 27 + FC 26
src/
  app/                  Ghép ứng dụng: App (router, khung), SheetHost (bảng trượt)
  engine/               Logic game thuần TypeScript, không phụ thuộc React
    types.ts            Kiểu dữ liệu: Player, Club, Negotiation, GameState…
    constants.ts        Lịch mùa giải, sơ đồ, kiểu phát triển, giải đấu
    state.ts            Trạng thái S và các bộ chọn cơ bản (P, C, me, lịch)
    players.ts          Giá trị, lương, chỉ số động
    squad.ts            Đội hình, sức mạnh, bảng xếp hạng
    match.ts            Giả lập trận đấu
    transfers.ts        Thăm dò, đàm phán CLB, hợp đồng, bán, mượn, GĐTT, AI ↔ AI
    season.ts           Tua ngày/giờ, Deadline Day, phát triển tháng, sang mùa
    board.ts            Mục tiêu và niềm tin của ban lãnh đạo
    world.ts            Khởi tạo thế giới (hư cấu hoặc dữ liệu thật)
    actions.ts          Thao tác nhỏ của người chơi cho UI gọi
    *.test.ts           Kiểm thử: chạy trọn mùa, thương vụ mua
  features/             Mỗi màn hình là một thư mục; feature không import lẫn nhau
    start/  home/  squad/  market/  league/  club/  player/  negotiation/  match/
  components/           Thành phần dùng chung: ClubBadge, Avatar, PlayerRow, Sheet, ui
  stores/               gameStore (cầu nối engine ↔ React, lưu game), uiStore, matchFlow
  lib/                  persist (IndexedDB), data (tải gói), images, clubVisual, import/
  utils/                Định dạng ngày, màu
  styles/global.css
```

**Luồng dữ liệu.** Engine sửa trực tiếp trạng thái `S`. Mọi thao tác từ UI đi qua `commit(fn)` trong `gameStore`. Hàm này chạy `fn`, tăng số phiên bản để các component đăng ký bằng `useGameVersion()` vẽ lại, rồi lưu vào IndexedDB sau 250 ms.

## Nhập dữ liệu CSV

Bộ nhập tự nhận diện định dạng theo tiêu đề cột:

| Định dạng | Nguồn | Cột bắt buộc | Xử lý |
|---|---|---|---|
| sofifa | Bộ FC 24/25/26 trên Kaggle, GitHub | league_id, club_name, short_name, long_name, player_positions, overall, potential, value_eur, wage_eur, age, club_contract_valid_until_year, release_clause_eur, nationality_name, fifa_version | Dùng trực tiếp |
| FIFPlay | Bộ FC 27 | first_name, last_name, nation_name, club_name, position, rating | Ghép với FC 26 theo tên và quốc tịch để lấy tuổi, tiềm năng, lương, hợp đồng. Tân binh không có trong FC 26 được ước lượng. |

Trước khi chọn CLB, game hiện báo cáo nhập gồm: số cầu thủ nhận theo từng giải, số dòng bỏ qua kèm lý do, và các cảnh báo.

## Hình ảnh

Game không kèm logo hay ảnh thật. Huy hiệu được vẽ bằng SVG theo màu áo, ảnh cầu thủ là hình cách điệu. Người chơi có thể tự thêm ảnh trong tab CLB, kể cả nhập hàng loạt: tên file phải trùng tên cầu thủ hoặc tên CLB. Ảnh chỉ lưu trong trình duyệt.
