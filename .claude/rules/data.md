# Dữ liệu

- NGHIÊM CẤM (bắt buộc): toàn bộ dữ liệu của dự án chỉ lấy từ `data/fifacm/`. Chỉ được fetch/crawl để tạo hoặc cập nhật dữ liệu đó từ nguồn FIFACM (fifacm.com, như các script `scripts/crawl_fifacm*.py`). Không fetch, crawl hay tạo dữ liệu từ bất kỳ nguồn nào khác (API/web ngoài khác, code TS, sinh ngẫu nhiên tên/CLB/giải). Cầu thủ do game sinh (học viện, bù đội hình) chỉ ghép tên từ cầu thủ trong `data/fifacm/players.json`. Không có chức năng đổi tên hay tải ảnh.
- Giải, quốc gia, quốc tịch, màu và ảnh CLB được `createFifacmPack` (`src/engine/fifacm.ts`) suy ra từ `data/fifacm` và đặt vào kho `mockData()` (`src/engine/mockData.ts`) khi `loadPack` nạp gói. Test nạp qua `fifacmPack()` trong `src/test/helpers.ts`. Không viết bảng dữ liệu (dịch thuật, mã viết tắt, kình địch, cấu hình giải) trong code TS.
- Tên cầu thủ chỉ dùng ký tự Latin. Không thêm logo hoặc ảnh thật.
