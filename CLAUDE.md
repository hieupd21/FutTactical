# Sân Cỏ Career — ghi chú cho Claude Code

Game quản lý bóng đá kiểu Career Mode của EA FC: trận đấu chạy từng phút (người chơi chỉ tạm dừng, thay người, đổi chiến thuật; không điều khiển cầu thủ), chuyển nhượng và đàm phán giống FC. Mobile-first, chạy trên web. Dùng riêng nên được phép dùng tên cầu thủ/CLB thật. KHÔNG thêm logo hoặc ảnh thật (chỉ huy hiệu SVG tự vẽ + ảnh người chơi tự tải lên).

Luôn trả lời người dùng bằng tiếng Việt. Toàn bộ chữ trong giao diện là tiếng Việt.

## Quy tắc git (bắt buộc)

- NGHIÊM CẤM tự ý `git commit` (kể cả `--amend`) và `git push`. Chỉ commit khi người dùng ra lệnh rõ ràng trong chính lượt đó; lệnh commit trước đó không áp dụng cho lần sau.
- Khi được lệnh commit: viết message bằng tiếng Anh (conventional commits).

## Quy tắc đặt tên (bắt buộc)

- Key của object, biến, hàm (cả tham số, type, field) phải có nghĩa, đọc là hiểu vai trò; không dùng tên viết tắt mơ hồ hay một chữ cái (trừ `i`/`j` và thuật ngữ domain như `ovr`, `pot`, `xg`). Chi tiết: `.claude/rules/naming.md`.

## Lệnh

- `pnpm dev` — chạy thử
- `pnpm test` — Vitest (engine). Chạy sau mọi thay đổi engine.
- `pnpm build` — `tsc -b` (strict, noUnused*) rồi vite build. Phải sạch lỗi trước khi xong việc.
- `pnpm lint` / `pnpm lint:fix` — ESLint; `pnpm format` / `pnpm format:check` — Prettier (dấu ; , nháy kép, rộng 140).
- Husky: pre-commit chạy lint-staged (eslint --fix + prettier); pre-push chạy `pnpm typecheck && pnpm test`. Chỉ dùng pnpm, không dùng npm.

## Kiến trúc (xem README.md để biết chi tiết thư mục)

- `src/engine/` là logic thuần TS, KHÔNG import React. Trạng thái toàn cục mutable `gameState` (state.ts). Tiền tính bằng nghìn € (k€); `formatMoney` hiển thị.
- UI chỉ sửa trạng thái qua `commit(fn)` (stores/gameStore.ts): chạy hàm engine → tăng version → lưu IndexedDB. Component gọi `useGameVersion()` để vẽ lại.
- Thao tác nhỏ của người chơi đặt trong `engine/actions.ts`, không sửa `gameState` trực tiếp trong component.
- `features/*` không import lẫn nhau; ghép ở `src/app/`. Thành phần dùng chung ở `src/components/`. Không dùng barrel file.
- Trạng thái giao diện (sheet đang mở, bộ lọc, giá trị form đàm phán `form[negotiation.id+key]`) ở `stores/uiStore.ts`.
- Style: `src/styles/global.css` giữ token màu sáng/tối trên `:root` và class từ bản prototype. Nó được nạp qua `src/styles/tailwind.css` vào layer `legacy` (thấp hơn utilities) nên Tailwind v4 (chỉ theme + utilities, không preflight) và shadcn/ui chạy song song. Màu shadcn ánh xạ vào token của global.css trong `tailwind.css`; không thêm biến `--muted`/`--accent` kiểu shadcn vào `:root` vì trùng tên token cũ.
- shadcn/ui: component sinh ra nằm ở `src/components/shadcn/` (alias trong `components.json`), thêm bằng `pnpm dlx shadcn@latest add <tên>`; sau khi thêm kiểm tra import `cn` phải là `@/lib/utils` (CLI từng sinh nhầm `from "cn"`). Component mới ưu tiên dùng shadcn + Tailwind; màn hình cũ thay dần. Icon dùng `lucide-react`; font Unbounded nạp từ `public/fonts/*.woff2` (subset Latin + tiếng Việt, 5 độ đậm).

## Luật game quan trọng (đừng đổi số nếu không được yêu cầu)

- Lịch: ngày `day` tính từ 1/7; vòng 1 ngày 45, mỗi vòng cách 7 ngày; kỳ CN hè [0,61], đông [184,214]; Deadline Day 20 giờ tua theo giờ; tổng kết ngày 335; mùa dài 365.
- Giá trị: `3000*exp((ovr-70)/6)` × hệ số tuổi/tiềm năng/hợp đồng/phong độ/giải × `valueAnchor` (neo theo giá thật). Lương cơ bản `max(3, 3+marketValue/600)` k€/tuần.
- Đàm phán: thăm dò → CLB (thanh căng thẳng, trả góp, thưởng 20 trận, % bán lại, cho mượn lại, trao đổi, thời điểm, điều khoản giải phóng) → hợp đồng (lương, năm, lót tay, vai trò, điều khoản) → chốt (18% CLB khác nhảy vào, ép giá 50/35/15). Còn có mượn, tự do, ký trước từ 1/1, gia hạn, Giám đốc thể thao, AI hỏi mua, AI↔AI.
- Đội tối thiểu 18 người khi bán; học viện bù đủ 20 đầu mùa.
- Sau mỗi lượt đàm phán/phản giá, đối phương trả lời sau tối thiểu 24 giờ game (`responseWait`); Deadline Day là 1 giờ.
- Trận của bạn: `engine/liveMatch.ts` mô phỏng từng tick (phút + bù giờ), tối đa 5 lượt thay người, tâm lý đội + pressing ảnh hưởng xG và thể lực; đường nhanh `simMatch` dùng cho trận AI và phải giữ số bàn trung bình tương đương.
- Hộp thư: mỗi thông báo có `InboxKind`, hành động khi bấm khai báo ở `features/home/inboxKinds.ts`; thư người đại diện (`agentLetters`) hiện ở tab Chuyển nhượng.
- Save có `saveVersion`; `lib/persist.ts` bỏ bản lưu không có trường này. Đổi tên field của `GameState` cần cân nhắc tương thích save.

## Dữ liệu

- Sự nghiệp mới dùng `data/fifacm/` (FC27 nam, snapshot 06/10/2026). `src/lib/data.ts` tải players/clubs/leagues/nations/manifest; `src/engine/fifacm.ts` nối ID và tạo DataRow trong bộ nhớ. Không ghép tuổi, tiềm năng, hợp đồng hoặc tài chính FC26 vào nguồn này.
- `plugins/fifacmData.ts` phục vụ JSON tại `data/fifacm/*.json` khi dev, xuất nguyên bản vào `dist/data/fifacm/` khi build. Không tạo bản sao thủ công trong public. `formations.json` cũng được engine dùng để dựng 22 sơ đồ; các tuyến giữa gộp thành MF cho logic GK/DF/MF/FW hiện có.
- ID game của cầu thủ nguồn là `f<sourceId>`, CLB là `fc<sourceId>`; trường `sourceId` giữ ID số để truy nguồn. Cầu thủ tự do có `club = null`, `contract = null`. Lương/giá trị/điều khoản đổi từ EUR sang nghìn EUR; không làm tròn lương thấp thành 1k. `nationId` tham chiếu nations.json.
- Mọi CLB/cầu thủ của bộ FIFACM được nạp. Phạm vi mô phỏng và cân bằng giải vẫn theo cấu hình public/data/leagues.json; các giải mới còn lại chỉ là nguồn thị trường. Khởi tạo giữ đúng danh sách cầu thủ FIFACM, không bù cầu thủ giả; học viện và phát triển trong quá trình chơi vẫn theo luật game.
- Budget nguồn hiện toàn 0 và chưa xác minh: tiếp tục dùng công thức ngân sách game, không dùng Worth làm tiền chuyển nhượng. Quỹ lương tính trên lương cầu thủ nguồn × hệ số trần lương hiện có.
- Bản lưu cũ vẫn dùng dữ liệu đã lưu; FIFACM áp dụng khi tạo sự nghiệp mới. `saveVersion` giữ tương thích, trường `dataProvider: "fifacm"` nhận diện nguồn mới.

### Định dạng cũ (lưu trữ, không còn được giao diện tải để tạo sự nghiệp)

- `public/data/fc27.json`: mảng dòng `[league_id, club, short, long, positions, ovr, pot, value_eur, wage_eur, age, contract_year, release_clause_eur, nationality, fifa_version, prevClub?]` (kiểu `DataRow`).
- Dòng có `league_id = 0` và CLB rỗng là cầu thủ tự do (hết hợp đồng): vào `gameState.free`, người chơi và CLB AI đều ký được (`aiFreeAgentsTick` trong transfers.ts).
- Giải mô phỏng: 13 EPL, 53 LaLiga, 19 Bundesliga, 31 Serie A, 16 Ligue 1. Giải nguồn (không đá): 14 Championship, 308 Bồ Đào Nha, 10 Hà Lan, 999 đội mới xuống hạng.
- fc27.json = FC 27 (FIFPlay, 11/10/2026: CLB + chỉ số) ghép FC 26 (sofifa: tuổi+1, tiềm năng, lương, hợp đồng, giá). Gói đã hoàn thiện sẵn, được cập nhật tay; không còn script ghép. Chỉ dùng dữ liệu thật, không có thế giới hư cấu. Cấu hình giải/quốc tịch/màu CLB nằm ở `nationalities.json`, `leagues.json`, `club_visuals.json`, nạp qua `lib/mockData.ts`, không viết bảng dữ liệu trong TS. Cầu thủ do game tạo (học viện, bù đội hình) lấy tên ghép từ cầu thủ thật cùng quốc tịch.

## Hướng phát triển đã bàn (chưa làm)

- Thêm cúp châu Âu / cúp quốc nội, chiến thuật chi tiết hơn (đã có tâm lý đội + pressing), lịch sử nhiều mùa.
