# Tailwind

- Bắt buộc (Tailwind v4): dùng biến CSS làm giá trị thì viết rút gọn bằng ngoặc tròn, không viết `[var(--...)]`. Ví dụ `border-(--accent)`, `bg-(--surface)`, `text-(--muted)`, `data-[state=on]:border-(--accent)`; KHÔNG viết `border-[var(--accent)]`.
- Khi tiện ích có nhiều kiểu giá trị và Tailwind không tự đoán được, gợi kiểu: `text-(color:--accent)`, `text-(length:--size)`.
- Giá trị có dự phòng (`var(--x, red)`) hoặc biểu thức (`calc(...)`) vẫn phải dùng ngoặc vuông.
- Khi sửa code cũ còn dạng `[var(--...)]` trong phạm vi đang chạm tới thì đổi luôn sang dạng rút gọn; không đổi hàng loạt ngoài phạm vi yêu cầu.
