# Khảo sát API công khai của EA DROP

Kiểm tra ngày **21/10/2026**. Base URL: `https://drop-api.ea.com`.

Đây là tài liệu khảo sát từ phản hồi thực tế và mã JavaScript công khai của EA, không phải đặc tả do EA công bố.
Các endpoint ghi nhận bên dưới có thể thay đổi. “Công khai” trong báo cáo nghĩa là đã đọc được dữ liệu mà không gửi cookie,
API key hoặc token; không đồng nghĩa với cam kết hỗ trợ hay giấy phép tái sử dụng dữ liệu.

## Tài liệu và nguồn kiểm chứng

- `GET /` trả `301`, chuyển tới `/api`.
- `/api`, `/api-json`, `/swagger.json`, `/openapi.json` đều trả `404` trong lần kiểm tra.
- Có liên kết Swagger cũ `/api#/` trong [EA Forums](https://forums.ea.com/discussions/fc-24-general-discussion-en/api-fc24-/7634428/replies/7634436),
  nhưng hiện không đọc được tài liệu ở đường dẫn đó.
- Orbit search không tìm được đặc tả phù hợp cho host DROP; các kết quả là trang EA và API khác, không dùng làm hợp đồng DROP.
- Đã đọc các tài nguyên JavaScript công khai được tải bởi trang chủ EA, FC Ratings, Madden Ratings và Apex News.
  Tìm thấy các hàm gọi API với đường dẫn và phương thức cụ thể, sau đó gọi GET để kiểm tra các ví dụ đại diện.
- Nguồn gốc chính: [EA FC Ratings](https://www.ea.com/games/ea-sports-fc/ratings),
  [Madden Ratings](https://www.ea.com/games/madden-nfl/ratings),
  [Apex News](https://www.ea.com/games/apex-legends/apex-legends/news), [EA](https://www.ea.com/).
- Mã nguồn tham chiếu tại thời điểm khảo sát:
  [rating client](https://www.ea.com/_next/static/chunks/1864-70d26eb3a5dc4cc8.js),
  [content client](https://www.ea.com/_next/static/chunks/4501-7716ae09e23266ca.js),
  [news client](https://www.ea.com/_next/static/chunks/1490-dbb99916684c2462.js).
  Tên file có hash và có thể đổi sau mỗi lần EA triển khai.

Không có OpenAPI đầy đủ để chứng minh đã liệt kê toàn bộ máy chủ. Không gửi các request thay đổi dữ liệu.

## Các mẫu endpoint đã trả dữ liệu không cần xác thực

Tất cả dùng `GET`. Trạng thái của các ví dụ dưới đây là `200` với JSON có dữ liệu.

| Đường dẫn                        | Công dụng                                                           | Ví dụ đã kiểm tra                                                     |
| -------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `/rating/{franchise}`            | Danh sách chỉ số vận động viên                                      | `/rating/ea-sports-fc?locale=en&limit=1`                              |
| `/rating/{franchise}/filters`    | Đội, nhóm giải, quốc tịch, vị trí, abilities, iterations tùy game   | `/rating/ea-sports-fc/filters?locale=en`                              |
| `/game/list`                     | Danh mục game EA                                                    | `/game/list?locale=en&limit=2`                                        |
| `/game/{slug}`                   | Trang chi tiết game, nền tảng, yêu cầu máy, phiên bản, liên kết mua | `/game/fc-27?locale=en`                                               |
| `/game/{slug}/recommended-games` | Game liên quan                                                      | `/game/fc-27/recommended-games?locale=en&limit=2`                     |
| `/game/list/subscription`        | Game thuộc gói EA Play                                              | `/game/list/subscription?locale=en&limit=2&subscriptionLevel=ea-play` |
| `/news-articles/list`            | Danh sách tin EA                                                    | `/news-articles/list?locale=en&limit=2`                               |
| `/news-articles/{slug}`          | Chi tiết bài viết                                                   | `/news-articles/ranked-roadmap-31-32?locale=en`                       |
| `/news-articles/{slug}/news`     | Danh sách tin theo slug nội dung                                    | `/news-articles/apex-legends/news?locale=en&limit=2`                  |
| `/navigation`                    | Menu theo đường dẫn website                                         | `/navigation?locale=en&path=%2Fgames%2Fea-sports-fc%2Fratings`        |
| `/route-config`                  | Cấu hình trang, theme và metadata                                   | `/route-config?locale=en&path=%2Fgames%2Fea-sports-fc%2Fratings`      |

Kết quả mẫu: danh mục game có `195` kết quả; danh mục EA Play có `90`; danh sách tin chung có `2320`.
Các con số là ảnh chụp tại thời điểm kiểm tra, không phải giới hạn của API.

`subscriptionLevel` là bắt buộc với `/game/list/subscription`. Khi thiếu, API trả `400`; thông báo liệt kê hai giá trị
`ea-play`, `ea-play-pro`. Đã xác minh dữ liệu với `ea-play`; chưa gọi riêng `ea-play-pro`.

`path` là bắt buộc với `/navigation` và `/route-config`. Thiếu trường này trả `400`.

## Ratings theo từng franchise

| Franchise                    | HTTP | `totalItems` trong request mặc định `locale=en&limit=1` | Bộ lọc                                            |
| ---------------------------- | ---- | ------------------------------------------------------- | ------------------------------------------------- |
| `ea-sports-fc`               | 200  | 17873                                                   | Có dữ liệu                                        |
| `madden-nfl`                 | 200  | 1957                                                    | Có iterations và abilities; một số danh sách rỗng |
| `f1`                         | 200  | 20                                                      | Có đội, quốc tịch, iterations                     |
| `nhl`                        | 200  | 0                                                       | Có dữ liệu bộ lọc                                 |
| `ea-sports-college-football` | 200  | 0                                                       | Có nhóm đội và class levels                       |

Danh sách rỗng không chứng minh franchise không được hỗ trợ. Có thể cần iteration, cấu hình phát hành hoặc điều kiện khác;
chưa xác minh nguyên nhân. Không mặc định coi `200` là đã lấy được dữ liệu hữu ích.

Madden có `21` iterations; F1 có `6` trong phản hồi bộ lọc. Mã client EA dùng tham số `iteration` và có logic chọn
iteration từ bộ lọc. Chưa xác minh từng iteration bằng request riêng.

## EA FC: tham số đã kiểm tra hành vi

Endpoint: `GET /rating/ea-sports-fc`.

| Tham số          | Ví dụ                         | Hành vi đã quan sát                    |
| ---------------- | ----------------------------- | -------------------------------------- |
| `locale`         | `en`                          | Các ví dụ trong báo cáo dùng tiếng Anh |
| `limit`          | `1`, `2`, `100`               | Điều khiển số bản ghi trả về           |
| `offset`         | `1`                           | Bỏ qua bản ghi đầu tiên                |
| `gender`         | `0`                           | Danh sách nam, `totalItems=16228`      |
| `search`         | `Ronaldo`                     | Trả 5 kết quả có tên phù hợp           |
| `player`         | `20801`                       | Trả 1 kết quả Cristiano Ronaldo        |
| `team`           | `112139`                      | Trả 30 cầu thủ Al Nassr                |
| `team`           | `112139,605`                  | Trả 60 cầu thủ thuộc hai CLB           |
| `nationality`    | `38`                          | Trả 302 cầu thủ Bồ Đào Nha             |
| `position`       | `0`                           | Trả thủ môn, tổng 1816                 |
| `orderBy`        | `pac:desc`                    | Các kết quả đầu có tốc độ giảm dần     |
| `player-ability` | `playstyle-plus:icontrait1_1` | Trả 5 cầu thủ có ability tương ứng     |

`gender=1` được liệt kê trong bộ lọc là bóng đá nữ. Chưa kiểm tra riêng truy vấn nữ trong khảo sát này.

Mã client EA dùng các mã sắp xếp `ovr`, `pac`, `sho`, `pas`, `dri`, `def`, `phy`, và chuỗi dạng `pac:desc`.
Khảo sát đã gọi riêng `pac:desc`; chưa xác minh tất cả tổ hợp và chiều sắp xếp.

Mã client còn gửi `exclude` dạng object (ví dụ loại vị trí thủ môn), nhưng chưa xác minh riêng tham số này.
Với mảng, client EA mã hóa thành query key lặp lại. Với object, client dùng chuỗi JSON.
Ví dụ nhiều CLB phân cách dấu phẩy ở bảng trên cũng đã trả kết quả phù hợp.

### Ví dụ gọi

```bash
# Danh sách nam, trang đầu
curl 'https://drop-api.ea.com/rating/ea-sports-fc?locale=en&gender=0&limit=100&offset=0'

# Cầu thủ theo ID
curl 'https://drop-api.ea.com/rating/ea-sports-fc?locale=en&player=20801'

# Đội hình CLB
curl 'https://drop-api.ea.com/rating/ea-sports-fc?locale=en&team=112139&limit=100'

# Bộ lọc gồm nhóm giải và CLB
curl 'https://drop-api.ea.com/rating/ea-sports-fc/filters?locale=en'

# Danh sách tin theo slug và chi tiết bài viết
curl 'https://drop-api.ea.com/news-articles/apex-legends/news?locale=en&limit=2'
curl 'https://drop-api.ea.com/news-articles/ranked-roadmap-31-32?locale=en'
```

Phản hồi danh sách ratings có dạng:

```json
{
  "items": [{ "id": 20801 }],
  "totalItems": 1
}
```

Đây là minh họa cấu trúc đã lược bỏ các trường khác của cầu thủ.
Mỗi cầu thủ thực tế còn có tên, ngày sinh, chiều cao/cân nặng, quốc tịch, CLB, vị trí chính/phụ,
chân thuận, weak foot, skill moves, abilities và `stats`.

### Những tham số dễ gây hiểu nhầm

Các truy vấn với `league=350`, `teamGroup=350`, `id=20801`, `sort=overallRating:ASC` vẫn trả `200`,
nhưng tổng số và kết quả đầu giống danh sách không lọc trong lần thử. Không dùng chúng làm bộ lọc đã được hỗ trợ.

Lọc theo giải: đọc `teamGroups` từ `/filters`, chọn nhóm cần dùng, thu thập `teams[].id`, rồi lọc qua `team`.
Mã frontend EA cũng triển khai theo cách này.

Tin tức cũng có tình huống tương tự: `/news-articles/list?gameSlug=apex-legends` vẫn chứa tin Madden và tổng số không đổi.
Dùng đường dẫn đã xác minh `/news-articles/apex-legends/news` khi cần danh sách theo slug.

## Danh sách CLB và giới hạn dữ liệu FC

`/rating/ea-sports-fc/filters?locale=en` có `57` nhóm đội cho cả nam và nữ.
Riêng nam có `45` nhóm và `582` ID đội duy nhất trong phản hồi lần kiểm tra.
Các nhóm có thể là giải vô địch hoặc đấu trường; không coi số nhóm là số giải vô địch quốc gia đầy đủ.

Đội có `id`, `label`, `imageUrl`, `isPopular`; nhóm có `id`, `label`, `region`, `gender`, `teams`.
Đây không phải bộ dữ liệu tài chính CLB: chưa thấy ngân sách, sân vận động hay hợp đồng HLV trong cấu trúc bộ lọc.

Chưa thấy các trường potential, giá chuyển nhượng, lương, hạn hợp đồng và điều khoản giải phóng trong các mẫu cầu thủ đã đọc.
Không suy ra các trường này từ overall rồi gọi là dữ liệu EA.

Không xác nhận endpoint mặc định đồng bộ với phiên bản FC đang được quảng bá: website hiện hiển thị FC 27 và `19789`
kết quả, nhưng request DROP mặc định trả `17873`. Ví dụ chỉ số tốc độ Mbappé ở trang và API cũng khác nhau.
Mã frontend có cấu hình phát hành/feature flags; chưa xác định điều kiện cần để khớp chính xác dữ liệu website.
Không gắn nhãn dữ liệu tải về là FC 27 chỉ dựa vào tên trang hoặc thư mục ảnh.

EA mô tả bảng trên website là các thẻ Gold/Silver/Bronze lúc phát hành, không bao gồm toàn bộ thẻ chiến dịch hay
cập nhật phong độ của các chế độ khác: [ghi chú trên trang Ratings](https://www.ea.com/games/ea-sports-fc/ratings).

## Đường dẫn thấy trong frontend nhưng chưa xác minh có dữ liệu công khai

| Mẫu đường dẫn                                       | Bằng chứng / giới hạn                          |
| --------------------------------------------------- | ---------------------------------------------- |
| `/franchise/{slug}`                                 | Mẫu `ea-sports-fc` trả 500; `ea-play` trả 204  |
| `/franchise/{slug}/faq`                             | Mẫu `ea-sports-fc` trả 204                     |
| `/franchise/ea-play/games-library`                  | Mẫu đã gọi trả 204                             |
| `/game/{slug}/faq`                                  | Mẫu `fc-27` trả 204                            |
| `/game/list/deals/{slug}`                           | Có hàm GET trong frontend; chưa gọi            |
| `/studio/{slug}`                                    | Mẫu `respawn` trả 204; chưa xác nhận slug đúng |
| `/studio/{slug}/games-library`                      | Mẫu `respawn` trả 204                          |
| `/corporate/{slug}`                                 | Có hàm GET trong frontend; chưa gọi            |
| `/corporate/{slug}/faq`                             | Có hàm GET trong frontend; chưa gọi            |
| `/corporate/{slug}/games-library`                   | Có hàm GET trong frontend; chưa gọi            |
| `/corporate/advertising/{slug}`                     | Có hàm GET trong frontend; chưa gọi            |
| `/corporate/ea-play-subscription/{slug}`            | Có hàm GET trong frontend; chưa gọi            |
| `/newsletter/{slug}`                                | Có hàm GET trong frontend; chưa gọi            |
| `/newsletter/game/{slug}`                           | Có hàm GET trong frontend; chưa gọi            |
| `/newsletter/franchise/{slug}`                      | Có hàm GET trong frontend; chưa gọi            |
| `/team-of-the-week/{franchise}/active-weekly-event` | Mẫu EA FC trả 404: sự kiện không khả dụng      |

`/news-articles/pagination` xuất hiện trong client cộng đồng cũ; mẫu Apex gọi lần này trả `204`.
`204` nghĩa là không có body; không tự động kết luận endpoint đã bị xóa, cũng không dùng làm bằng chứng có dữ liệu.

## Xác thực, CORS và vận hành

- `/rating/entity/20801?locale=en` trả `401`, thông báo yêu cầu xác thực cho entity. Không coi đây là endpoint công khai
  để lấy cầu thủ bằng numeric ID; dùng `/rating/ea-sports-fc?player=20801` đã xác minh.
- `/user/user-data?locale=en` trả `403` khi không có xác thực. Các hàm liên quan tài khoản/subscription không nằm trong
  tập API công khai đã chứng thực.
- Các đường dẫn `/api/v1/totw/...` trong một chunk dùng client của host voting riêng, không gộp vào DROP.
- Request ratings với `Origin: https://www.ea.com` nhận `Access-Control-Allow-Origin: https://www.ea.com`.
  Với `Origin: http://localhost:2222`, không có header cho phép origin. Browser của game sẽ không đọc được phản hồi
  cross-origin tương ứng. Shell/backend/script nhập dữ liệu không chịu CORS của trình duyệt.
- Phản hồi JSON thành công được kiểm tra có `Cache-Control: public, max-age=600, s-maxage=600`.
  Đây là TTL cache quan sát được, không phải lịch cập nhật dữ liệu hay giới hạn số request.
- Chưa tìm thấy quota, rate limit, SLA hoặc chính sách versioning dành riêng cho API DROP trong nguồn đã kiểm tra.
  Không suy ra là gọi không giới hạn. Khi tích hợp cần cache, xử lý 204, 400, 401/403, 404, 429, 5xx và timeout.
- Chưa có kết luận về quyền tái sử dụng/thương mại hóa dữ liệu từ khảo sát kỹ thuật này.

## Áp dụng cho Sân Cỏ Career

Hai endpoint ratings và filters là phần hữu ích nhất: bổ sung CLB/giải nguồn, roster và chỉ số chi tiết.
Nên nhập thành gói JSON có ngày tải và nguồn, kiểm tra phiên bản dữ liệu trước khi ghép; giữ nguồn bổ sung cho
potential, lương, giá và hợp đồng. Việc khảo sát này không thay dữ liệu cầu thủ, cấu trúc save hoặc logic game.
