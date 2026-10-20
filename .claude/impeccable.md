# Ghi chú dùng Impeccable

Impeccable là skill thiết kế giao diện của Claude Code. Gõ `/impeccable <lệnh> [đối tượng]`. Gõ `/impeccable` không kèm gì thì nó hiện menu gợi ý theo tình trạng dự án và không tự chạy lệnh nào.

## Thứ tự nên làm

1. `/impeccable init`: ghi bối cảnh sản phẩm vào `PRODUCT.md` (đã làm). Cần trước khi làm giao diện mới hoặc làm lại giao diện. Các lệnh chỉnh nhỏ như `audit`, `polish` thì không bắt buộc.
2. `/impeccable document`: ghi hệ thống hình ảnh hiện có vào `DESIGN.md` (chưa làm).
3. Đánh giá: `critique` hoặc `audit`.
4. Sửa: `polish` hoặc các lệnh tinh chỉnh bên dưới.

Gắn đối tượng bằng đường dẫn hoặc tên màn hình, ví dụ `/impeccable audit src/features/market`.

## Các lệnh

| Nhóm                 | Lệnh                                                               | Dùng khi                                                                      |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Xây dựng             | `shape <màn hình>`                                                 | Lập kế hoạch UX/UI trước khi viết code                                        |
|                      | `init`                                                             | Ghi hoặc cập nhật `PRODUCT.md`                                                |
|                      | `document`                                                         | Sinh `DESIGN.md` từ code hiện có                                              |
|                      | `extract <đích>`                                                   | Gom token và component dùng lại được                                          |
| Đánh giá             | `critique <đích>`                                                  | Đánh giá UX theo heuristic, có điểm                                           |
|                      | `audit <đích>`                                                     | Kiểm tra kỹ thuật: a11y, hiệu năng, responsive                                |
| Tinh chỉnh           | `polish <đích>`                                                    | Lượt hoàn thiện cuối trước khi xong                                           |
|                      | `bolder` / `quieter`                                               | Làm giao diện táo bạo hơn / dịu hơn                                           |
|                      | `distill`                                                          | Bỏ bớt cho gọn                                                                |
|                      | `harden`                                                           | Xử lý lỗi, i18n, trường hợp biên                                              |
|                      | `onboard`                                                          | Thiết kế lần chạy đầu, trạng thái rỗng                                        |
| Nâng cao             | `animate`, `colorize`, `typeset`, `layout`, `delight`, `overdrive` | Chuyển động, màu, chữ, bố cục, chi tiết thú vị, đẩy xa hơn thông thường       |
| Sửa lỗi              | `clarify`, `adapt`, `optimize`                                     | Câu chữ giao diện, thích ứng thiết bị, hiệu năng                              |
| Lặp trên trình duyệt | `live`, `generate [n] [hành động] [phần tử]`                       | Cần dev server đang chạy; chọn phần tử trên trình duyệt rồi thử các phương án |

## Cấu hình của dự án này

- `PRODUCT.md`: bối cảnh sản phẩm. Sửa bằng `/impeccable init` chứ không sửa tay tuỳ ý.
- `.impeccable/config.json`: `"buildPath": "comp"` nghĩa là sinh ảnh mẫu trước rồi mới code. Đổi thành `"code"` để dựng thẳng bằng code. Sinh ảnh dùng API OpenAI và tính phí vào key của bạn.
- Chế độ giao diện phù hợp với game này là Operate (thao tác nhanh, dễ đọc, nhất quán).

## Lệnh phụ trợ

- `/impeccable doctor`: báo và sửa chỗ lệch giữa `PRODUCT.md`, `DESIGN.md`, cấu hình và phiên bản skill.
- `/impeccable hooks <on|off|status>`: bật tắt hook tự chạy bộ dò lỗi thiết kế sau mỗi lần sửa file giao diện.
- `/impeccable pin <lệnh>` và `unpin <lệnh>`: tạo hoặc xoá phím tắt `/<lệnh>` riêng.
- Bộ dò thủ công: `.claude/skills/impeccable/scripts/impeccable detect --json <file>`, chỉ dùng cho web.
- Cập nhật skill: `npx impeccable update` (đang là v4.5.0, mới nhất v4.6.0). Chỉ chạy khi bạn yêu cầu, có hiệu lực từ phiên sau.

## Lưu ý khi dùng

- Mỗi lệnh chỉ chạy khi bạn gõ, skill không tự chạy lệnh.
- Skill kiểm tra theo đợt: dựng xong, soi một lượt trên desktop và mobile, sửa một lượt, soi lại tối đa một lần rồi dừng.
- Làm lại giao diện (redesign) sẽ thay hệ thống hình ảnh cũ; chỉnh sửa (refinement) thì giữ nguyên danh tính hiện có.
- Quy tắc dự án vẫn áp dụng: chữ giao diện tiếng Việt, không thêm logo hay ảnh thật, không tự commit.
