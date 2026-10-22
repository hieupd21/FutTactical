# Dữ liệu bóng đá nam FIFACM

- Phiên bản: FC27; snapshot hiển thị: **6th of Oct 2026**.
- Đã tải: **18763 cầu thủ / 626 trên 626 trang**.
- Đầy đủ danh sách: **true**; xem `manifest.json` để biết trang thiếu/lỗi.

`players.json` là mảng object lấy từ bảng HTML FIFACM. `id` giữ ID của website; `sourceUrl` và `sourcePage` truy lại từng bản ghi. `clubId` tham chiếu `clubs[].id`; cầu thủ tự do có `clubId: null`. Quy ước đội nguồn NG - FA (ID 111592) được lưu một lần trong `manifest.sourceConventions.freeAgentTeam`.

`valueEur`, `wageEur`, `releaseClauseEur` quy đổi từ chuỗi EUR hiển thị; lương theo tuần. Các số K/M trên website có thể đã làm tròn; `financialDisplay` giữ chuỗi nguồn. `contractText` giữ cách hiển thị hợp đồng gốc; website vẫn có thể hiển thị năm hợp đồng cho NG - FA. `isOnLoan: null` nghĩa bảng thường không xác nhận tình trạng cho mượn. Trường không đọc được để null, không bổ sung hoặc ước lượng từ FC26/EA.

Nguồn: https://www.fifacm.com/players. Đây là dữ liệu Career Mode được website công bố, không xác minh lương/giá ngoài đời. Không tải ảnh, chỉ lưu URL. Chưa thu thập thuộc tính ẩn của hồ sơ. Giải đấu được tra qua `clubId` → `clubs[].leagueIds` → `leagues[].id`.

Tải lại bằng `python3 -B scripts/crawl_fifacm.py --page-id <orca-page-id> --output <thư-mục-trống>`. Tab cần mở `/players`, chọn Male trước khi chạy.

## Kiểm tra khi hoàn tất

- Đủ 626 trang, 18.763 ID khác nhau; trang cuối có 13 dòng, trang tiếp theo rỗng.
- Trang đầu và ngày snapshot không đổi trong thời gian tải.
- Đủ 219 cầu thủ tự do, khớp cả 8 trang danh sách Free Agents của FIFACM; `clubId = null`; quy ước NG - FA nằm trong manifest.
- Đã kiểm tra lại 626 trang ngày 22/10/2026, khôi phục 12.060 URL thiếu: đủ 18.763/18.763 `avatarUrl`, không còn null. URL ảnh cầu thủ được đọc từ `data-lazy-src` hoặc `src` của `.player-img-info` trên HTML nguồn và đối chiếu theo ID. Dùng `scripts/recheck_fifacm_avatars.py --page-id <orca-page-id> --cache <thư-mục-cache-mới>` để kiểm tra lại toàn bộ 626 trang nam FC27, snapshot 06/10/2026. Script chỉ cập nhật `avatarUrl`, giữ nguyên thứ tự và các thuộc tính còn lại; kết quả nằm trong `manifest.avatarRecheck`. URL do nguồn khai báo không đảm bảo CDN luôn truy cập được hoặc mọi cầu thủ đều có ảnh chân dung riêng.
- Trạng thái cho mượn chưa được thu thập từ danh sách Loans riêng, nên `isOnLoan` để null.

## Câu lạc bộ

`clubs.json` có **663 CLB** được tham chiếu bởi cầu thủ nam trong `players.json`. `players[].clubId` liên kết `clubs[].id`; `clubs[].playerIds` liên kết ngược về `players[].id`. Cầu thủ tự do giữ `clubId: null` và không được gán vào CLB giả.

Nguồn: https://www.fifacm.com/teams, FC27. Danh mục không hiển thị ngày snapshot; thời điểm tải và phạm vi chọn nằm trong `manifest.datasets.clubs`. Đây là danh mục CLB có cầu thủ trong bộ nam hiện tại, không phải toàn bộ mọi đội trên website.

Các trường: ID, tên, URL logo, overall/attack/midfield/defense, worthEur, budgetEur, foundationYear, stadiumCapacity, averageAge, youthDevelopment, profitability, internationalPrestige, màu hiển thị, sourceUrl và sourceAttributes. Số tiền lấy trực tiếp từ data attribute của HTML, có thể chính xác hơn nhãn K/M/B đã làm tròn. Ngân sách 0 được giữ theo nguồn và chưa xác minh; không coi đó là ngân sách sử dụng đã được xác nhận. Mã giải được liên kết từ trang giải; đội hình CLB nằm trong startingXI. Chưa thu thập HLV hoặc tên sân.

Tải lại: `python3 -B scripts/crawl_fifacm_clubs.py --page-id <orca-page-id>`.

## Giải đấu

`leagues.json` có **36 nhóm giải/đấu trường**, liên kết đủ **663 CLB** hiện tại. `leagues[].teamIds` tham chiếu `clubs[].id`; `clubs[].leagueIds` tham chiếu ngược `leagues[].id`. ID giải là số. Quan hệ có thể nhiều–nhiều.

Nguồn danh mục https://www.fifacm.com/leagues và trang chi tiết từng giải; CLB chưa có trong các trang đó được kiểm tra thêm qua liên kết giải ở hồ sơ CLB. Chỉ lưu các nhóm có CLB trong bộ nam hiện tại. Không tạo giải hoặc CLB giả cho cầu thủ tự do. `sourceTeamCount` là số đội trên trang nguồn, có thể lớn hơn số đội được chọn trong `teamIds`. Tên và cách phân nhóm giữ theo FIFACM; các trang danh mục không công bố ngày snapshot.

Tải lại: `python3 -B scripts/crawl_fifacm_leagues.py --page-id <orca-page-id>`.

## Chuẩn hóa cầu thủ

Schema phiên bản 2 dùng `clubId: number | null` thay hai object `team` và `sourceTeam` lặp lại. Tên, logo và các thuộc tính CLB được tra trong `clubs.json`. Cầu thủ tự do có `clubId: null`, không tạo CLB giả. Các thuộc tính còn lại, số lượng, ID và thứ tự cầu thủ được giữ nguyên.

`players.json` vẫn là một mảng JSON hợp lệ, mỗi cầu thủ một dòng để giảm khoảng trắng; không phải JSONL. Lưu ý consumer cũ cần đổi `player.team.id` thành `player.clubId`, rồi tra CLB bằng ID.

Dung lượng: 24,888,299 → 15,205,318 byte, giảm 38.91%. Các script crawler xuất và đọc cấu trúc mới; cache HTML cũ vẫn được hỗ trợ.

## Đội tuyển và quốc tịch

`national-teams.json` có **51 đội tuyển nam**, lấy toàn bộ nhóm International FC27: https://www.fifacm.com/27/league/78/international. `playerIds` là danh sách được nguồn triệu tập, tham chiếu `players[].id`; không phải mọi cầu thủ cùng quốc tịch. Đội tuyển được lưu riêng, không thay `clubId` hoặc quan hệ CLB–giải.

`nations.json` có **169 quốc tịch** xuất hiện trong bộ cầu thủ. Mỗi quốc tịch chỉ có `id`, `label`, `imageUrl`; không lưu danh sách liên kết ngược. `players[].nationality.id` → `nations[].id`; `national-teams[].nationId` → `nations[].id`. Mã quốc gia và mã đội tuyển khác nhau; liên kết được xác nhận bằng việc toàn bộ tuyển thủ có cùng nationality.id. Danh mục quốc tịch được nhóm từ dữ liệu cầu thủ, không phải danh sách mọi quốc gia trên thế giới.

## Đội hình mặc định

Phần dưới chỉ mô tả `national-teams[].squadBuilder`; CLB dùng các trường trực tiếp được mô tả ở phần sau:

- `startingXI`: các cầu thủ hiển thị trên sân, vị trí, rating và mã vị trí nguồn. Toàn bộ CLB đủ 11 người; một số đội tuyển thiếu người ngay trên trang nguồn. `startingXIComplete` và `missingStartingPlayerCount` ghi rõ tình trạng; không tự điền người thiếu.
- `rating`: Rating trên hồ sơ đội FIFACM, giống `overallRating` của đội.
- `valueEur`, `wageEur`: tổng các trường tương ứng trong `players.json` của toàn bộ `playerIds`, gồm đá chính, dự bị và dự trữ được nguồn hiển thị; không gồm cầu thủ đã cho mượn đi. Lương theo tuần. Danh sách đội tuyển có thể thiếu người, nên không coi tổng đó là giá trị/lương của đội tuyển đầy đủ đã được xác minh. Đây là số tổng hợp; các số cầu thủ nguồn có thể đã được làm tròn. Không dùng `worthEur` thay tổng giá trị cầu thủ.
- `formation`: mã Squad Builder khi tập hợp vị trí của XI khớp duy nhất một định nghĩa. `formationCandidates` giữ các mã khớp; `formationShape` giữ dạng cơ bản khi các mã cùng sơ đồ. Nếu không khớp hoặc không xác định duy nhất, giữ null; không tự gán biến thể.

`formations.json` là danh mục dùng chung gồm **22 sơ đồ cơ bản**, mỗi mục có `id`, `label`, `lines` và `variants`. `clubs[].formation` tham chiếu `formations[].id`, ví dụ `4-2-3-1`. **33 định nghĩa gốc** từ Squad Builder được giữ trong `variants` với `code`, `label`, `positions`; mã `national-teams[].squadBuilder.formation` thuộc `variants[].code`. Vị trí mẫu có thể khác hồ sơ đội; các trường null của đội tuyển được liệt kê trong `manifest.datasets.teamProfiles.unresolvedFormations`. Không nhập đội hình cộng đồng từ `/squads`. Snapshot hồ sơ đội và cầu thủ đều **6/10/2026**.

Tải lại: `python3 -B scripts/crawl_fifacm_team_profiles.py --page-id <orca-page-id> --formations data/fifacm/formations.json --cache <thư-mục-cache>`. Dùng cache mới khi tải snapshot mới. Các tham chiếu cầu thủ, danh sách CLB và ngày snapshot được kiểm tra trước khi xuất.

## Giá trị, lương và sơ đồ CLB

`clubs.json` bỏ nhóm `squadBuilder`. Các trường trực tiếp:

- `squadValueEur`: tổng giá trị cầu thủ trong `playerIds`, gồm đá chính, dự bị và dự trữ.
- `weeklyWageEur`: tổng lương tuần của cùng danh sách. Đây là lương cầu thủ được niêm yết, chưa phải toàn bộ quỹ lương kế toán hoặc hạn mức chi lương của CLB. Chưa có dữ liệu chia sẻ lương cho mượn, thưởng, phí mượn hoặc lương nhân viên.
- `worthEur`: giữ nguyên Worth từ data-worth của nguồn, tách biệt với tổng giá trị cầu thủ.
- `formation`: sơ đồ cơ bản suy ra từ 11 vị trí trong startingXI, ví dụ 4-2-3-1, 4-3-3, 3-4-2-1. Các vị trí trái/phải được nhóm thành vai trò; hậu vệ biên/wing-back tính trong hàng thủ, LW/RW trong hàng công, LM/RM trong hàng tiền vệ. Chỉ dùng các mẫu vai trò được nhận diện; thiếu người, trùng cầu thủ, thiếu thủ môn hoặc vị trí/mẫu chưa nhận diện thì null. Không gán mã biến thể Squad Builder; đây là sơ đồ suy luận, không phải sơ đồ chiến thuật được nguồn xác nhận. `clubs[].formation` tham chiếu `formations[].id`.
- `startingXI`: giữ nguyên 11 cầu thủ và vị trí gốc trên hồ sơ CLB.

Đã đối chiếu toàn bộ 663 danh sách CLB với hồ sơ cùng snapshot 6/10/2026 và tính lại các tổng từ players.json. Cầu thủ cho mượn đến được tính ở CLB đang thi đấu; cầu thủ cho mượn đi không thuộc playerIds hiện tại. Các số nguồn K/M có thể đã được làm tròn. Các file đội tuyển/quốc tịch, cầu thủ và giải đấu được giữ nguyên. Chi tiết xác minh: `manifest.datasets.clubMetrics`.

Kiểm tra lại bằng `python3 -B scripts/verify_fifacm_clubs.py --cache <thư-mục-cache-hồ-sơ>`.
