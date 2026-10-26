# Ảnh sân đội hình

- Asset dùng trong ứng dụng: `public/images/squad-pitch-lines.svg`.
- Nguồn: `public/images/squad-pitch-lines.webp` do người dùng chỉ định.
- Lấy vị trí các đường từ alpha ảnh gốc, sau đó chuẩn hóa đường tâm vector để loại các mép lẹm và chỗ phình của bản trace.
- Mọi vạch dùng chung stroke 6, màu `#8d9ba4`, đầu nét và giao điểm bo tròn. Đường thẳng, ellipse và Bézier có đường bao trơn, không dùng polygon trace nhiều điểm hoặc bitmap nhúng.
- Giữ bố cục và phối cảnh ảnh nguồn; không thêm đường sân.
- Khung cắt sát sân: viewBox `5 105 1503 813`, nền trong suốt.
- Các thẻ cầu thủ và dữ liệu game không nằm trong SVG.
