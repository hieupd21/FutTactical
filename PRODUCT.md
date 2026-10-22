# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Một người chơi duy nhất: chủ dự án, dùng riêng. Chơi cả trên điện thoại (phiên ngắn) lẫn máy tính (phiên dài hơn). Việc chính của họ là điều hành một CLB: duyệt đội hình, tìm cầu thủ, đàm phán chuyển nhượng, rồi cho thời gian trôi qua từng ngày hoặc từng giờ.

## Product Purpose

Sân Cỏ Career là game quản lý bóng đá kiểu Career Mode của EA FC. Trận đấu chạy từng phút; người chơi không điều khiển cầu thủ nhưng có thể tạm dừng, thay người (tối đa 5) và đổi chiến thuật (tâm lý đội, pressing) bất cứ lúc nào. Trọng tâm vẫn là chuyển nhượng và đàm phán. Thành công là người chơi mở lên là chơi được ngay, và các thương vụ cùng mùa giải diễn ra đủ chân thực để muốn chơi tiếp qua nhiều mùa.

## Positioning

Phần Career Mode của FC được rút gọn thành một ứng dụng web mobile-first: mở là chơi, không cài đặt, tự lưu. Điểm khác biệt là đàm phán chuyển nhượng sâu (thăm dò, CLB, hợp đồng, chốt, ép giá, trả góp, thưởng, bán lại, mượn, trao đổi, Giám đốc thể thao) chạy trong một thế giới mà CLB AI cũng đàm phán, hỏi mua và tranh giành cầu thủ với người chơi.

## Operating Context

- Lịch mùa giải tính theo ngày từ 1/7; có kỳ chuyển nhượng hè và đông, Deadline Day tua theo giờ, tổng kết mùa ngày 335.
- Dữ liệu cầu thủ thật theo FC 27 từ FIFACM, nằm trong `data/fifacm/`.
- Chạy hoàn toàn trên trình duyệt, lưu bằng IndexedDB, không cần server hay tài khoản. Bản lưu có `saveVersion`; bản lưu cũ không tương thích sẽ bị bỏ và bắt đầu sự nghiệp mới.
- Tiền tính bằng nghìn € (k€); toàn bộ chữ trong giao diện là tiếng Việt.

## Capabilities and Constraints

- Giải mô phỏng: Premier League, LaLiga, Bundesliga, Serie A, Ligue 1. Có cầu thủ tự do, mượn, ký trước, gia hạn, thế giới AI ↔ AI.
- Quy tắc game (lịch, giá trị, đàm phán) là số liệu đã chốt, không đổi nếu không được yêu cầu (xem CLAUDE.md).
- Được dùng tên cầu thủ và CLB thật vì chỉ dùng riêng; không tự thêm logo hay ảnh ngoài dữ liệu. Tên và ảnh lấy từ `data/fifacm/`, không cho đổi tên hay tải ảnh; huy hiệu SVG tự vẽ chỉ là dự phòng khi ảnh nguồn lỗi. Tên cầu thủ chỉ dùng ký tự Latin.
- Hộp thư có 15 loại thông báo, mỗi loại một hành động riêng khi bấm. Thư của người đại diện hiện cả ở tab Chuyển nhượng. Sau mỗi lượt đàm phán hoặc phản giá, đối phương trả lời sau ít nhất 24 giờ game (Deadline Day: 1 giờ).
- Chiến thuật hiện có tâm lý đội và pressing; chưa có cúp châu Âu, cúp quốc nội, chiến thuật chi tiết hơn (sơ đồ theo tình huống) hay lịch sử nhiều mùa. Đây là hướng phát triển đã bàn, chưa làm.
- Việc đóng gói thành app (Capacitor) chưa nằm trong kế hoạch hiện tại.

## Brand Commitments

Tên sản phẩm: Sân Cỏ Career. Font chữ toàn game là Unbounded, nạp từ `public/fonts`. Không phát hành công khai.

## Evidence on Hand

Dữ liệu cầu thủ thật trong `data/fifacm/`. Không có người dùng khác, đánh giá hay số liệu sử dụng; không được bịa ra các thứ này.

## Product Principles

- Mở là chơi: mọi thao tác chính dùng được bằng một tay trên điện thoại và không bắt người chơi cài đặt hay đăng nhập.
- Chiều sâu nằm ở chuyển nhượng và đàm phán; trận đấu chỉ cần đủ quyết định (thay người, chiến thuật) để người chơi thấy mình tác động được, không cần điều khiển từng cầu thủ.
- Thế giới phải sống: CLB AI hành động độc lập, người chơi luôn thấy hệ quả.
- Dữ liệu lấy từ bộ FIFACM thật, không chỉnh sửa tên hay ảnh; chạy offline.

## Accessibility & Inclusion

Đọc được trên màn hình nhỏ: chữ đủ lớn, độ tương phản tốt. Hỗ trợ chế độ sáng và tối.
