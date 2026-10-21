# Dữ liệu

- Bắt buộc: mọi dữ liệu (cầu thủ, CLB, giải đấu, quốc gia, quốc tịch, màu CLB, cặp kình địch) chỉ lấy từ `public/data/*.json`. Không tạo dữ liệu thế giới ở nguồn nào khác (code TS, API ngoài, sinh ngẫu nhiên tên/CLB/giải). Cầu thủ do game sinh (học viện, bù đội hình) chỉ ghép tên từ cầu thủ trong `fc27.json`.

- Mọi dữ liệu mock nằm trong `public/data/*.json`, nạp một lần khi khởi động bởi `src/lib/mockData.ts` (tên, quốc tịch, giải đấu, màu CLB) và `src/lib/data.ts` (gói cầu thủ). Engine đọc qua `mockData()` trong `src/engine/mockData.ts`; test nạp qua `src/test/setup.ts`. Không viết bảng dữ liệu trực tiếp trong code TS.
- Thêm file mock mới: tạo JSON trong `public/data/`, thêm vào `MOCK_FILES`, kiểu `MockData`, `loadMockData` và `src/test/setup.ts`. Key JSON dùng tên đầy đủ (`name`, `nationality`, `level`).
- Gói cầu thủ `fc27.json`: dòng `league_id = 0` và CLB rỗng là cầu thủ tự do.
- Tên cầu thủ chỉ dùng ký tự Latin. Không thêm logo hoặc ảnh thật.
