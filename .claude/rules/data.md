# Dữ liệu

- Mọi dữ liệu mock nằm trong `public/data/*.json`, nạp một lần bởi `src/lib/mockData.ts`. Không viết bảng dữ liệu trực tiếp trong code TS.
- Thêm file mock mới: tạo JSON, thêm tên vào `MOCK_FILES` và hàm nạp tương ứng trong `mockData.ts`.
- Gói cầu thủ `fc27.json`: dòng `league_id = 0` và CLB rỗng là cầu thủ tự do.
- Tên cầu thủ chỉ dùng ký tự Latin. Không thêm logo hoặc ảnh thật.
