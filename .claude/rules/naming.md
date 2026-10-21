# Đặt tên

- Bắt buộc: key của object, tên biến, tên hàm (và tham số, type, field) phải có nghĩa, đọc là hiểu vai trò. Ví dụ `homeRevenue`, `pendingNegotiations`, `agentLetters()`.
- Không đặt tên viết tắt mơ hồ hoặc một chữ cái (`a`, `x`, `tmp`, `d2`, `fn1`, `o`, `res`) trừ chỉ số vòng lặp ngắn (`i`, `j`) hoặc tên đã quen trong domain (`ovr`, `pot`, `xg`, `k€`).
- Hàm đặt bằng động từ nói rõ hành động (`completeSale`, `processSellCounter`); biến boolean bắt đầu bằng `is`/`has`/`can`/`should`.
- Key trong object/JSON mới phải tự mô tả; không dùng key vô nghĩa hoặc đánh số (`a1`, `v2`). Riêng mảng dòng `DataRow` của `fc27.json` giữ nguyên định dạng cũ.
- Khi sửa code cũ có tên mơ hồ trong phạm vi đang chạm tới thì đổi luôn sang tên có nghĩa; không đổi hàng loạt ngoài phạm vi yêu cầu.
