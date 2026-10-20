// Gợi ý câu trả lời khi đàm phán. Mỗi câu mang một giọng điệu (Tone) quyết định rủi ro/lợi ích, xem toneEffect trong transfers.ts.
import { C, me, P } from "./state";
import type { Negotiation, Tone } from "./types";

export interface Reply {
  tone: Tone;
  text: string;
}
type Pool = Record<Tone, ((x: Ctx) => string)[]>;
interface Ctx {
  p: string; // tên cầu thủ
  c: string; // tên CLB bán (hoặc "họ")
  me: string; // tên CLB của bạn
}

const CLUB: Pool = {
  calm: [
    (x) => `"Đây là đề nghị chính thức của ${x.me} dành cho ${x.p}. Mong quý CLB xem xét."`,
    (x) => `"Chúng tôi đã tính toán kỹ. Con số này phản ánh đúng giá trị của ${x.p}."`,
    () => `"Tôi gửi đề nghị mới, hy vọng chúng ta sớm gặp nhau ở giữa."`,
  ],
  warm: [
    (x) => `"${x.c} và ${x.me} đều muốn một thương vụ tốt cho cả hai phía. Tôi tin chúng ta làm được."`,
    (x) => `"Chúng tôi rất tôn trọng ${x.c}. ${x.p} sẽ có chỗ đứng xứng đáng ở đội bóng của chúng tôi."`,
    (x) => `"Tôi biết ${x.p} quan trọng với các anh. Hãy để chúng tôi làm cho thương vụ này thật công bằng."`,
  ],
  bluff: [
    (x) => `"Đây là đề nghị của tôi. Thị trường còn nhiều cái tên khác ngoài ${x.p}."`,
    () => `"Tôi sẽ không đứng chờ mãi. Hoặc ta chốt ở mức này, hoặc tôi quay sang phương án khác."`,
    (x) => `"Các anh có thể từ chối, nhưng đừng quên ${x.p} không còn nhiều thời gian ở đó."`,
  ],
};
const CLUB_COOL: Pool["warm"] = [
  () => `"Tôi xin lỗi nếu lời lẽ vừa rồi làm các anh khó chịu. Tôi chỉ muốn tìm tiếng nói chung."`,
  (x) => `"Hãy hạ nhiệt một chút. ${x.me} vẫn rất thiện chí với ${x.c}."`,
];

const CONTRACT: Pool = {
  calm: [
    (x) => `"Đây là đề nghị cá nhân của chúng tôi dành cho ${x.p}. Mong anh cân nhắc."`,
    () => `"Tôi tin các điều khoản này là hợp lý với cả hai phía."`,
    (x) => `"Chúng tôi đã cố gắng đáp ứng những gì ${x.p} mong muốn."`,
  ],
  warm: [
    (x) => `"${x.me} thực lòng muốn ${x.p} là một phần của dự án dài hạn."`,
    (x) => `"Chúng tôi coi ${x.p} là người của gia đình. Hãy cùng nhau tìm một giải pháp đẹp."`,
    (x) => `"Tôi không chỉ trả lương, tôi muốn xây dựng sự nghiệp cho ${x.p} ở ${x.me}."`,
  ],
  bluff: [
    (x) => `"Tôi còn vài cầu thủ khác trong danh sách. ${x.p} không phải lựa chọn duy nhất."`,
    () => `"Đây là mức cao nhất tôi có thể đưa. Phần còn lại tùy các anh."`,
    () => `"Hết hôm nay, đề nghị này sẽ không còn nữa."`,
  ],
};
const CONTRACT_COOL: Pool["warm"] = [
  () => `"Có lẽ tôi đã đi hơi nhanh. Chúng ta hãy cùng ngồi lại và nói chuyện thẳng thắn."`,
  (x) => `"Tôi tôn trọng giá trị của ${x.p}. Hãy cho tôi cơ hội để làm hài lòng các anh."`,
];

// Phản giá khi CLB khác hỏi mua cầu thủ của bạn: bạn nói với CLB mua (x.c)
const SELL: Pool = {
  calm: [
    (x) => `"Chúng tôi đánh giá ${x.p} cao hơn mức ${x.c} đưa ra. Đây là con số chúng tôi cho là hợp lý."`,
    (x) => `"Tôi đề nghị điều chỉnh lại giá. Đó là mức phản ánh đúng giá trị của ${x.p}."`,
    () => `"Hãy xem lại con số này. Tôi tin chúng ta có thể gặp nhau ở giữa."`,
  ],
  warm: [
    (x) => `"${x.me} và ${x.c} có quan hệ tốt. Tôi muốn thương vụ này công bằng cho cả hai."`,
    (x) => `"${x.p} sẽ là một bản hợp đồng đáng giá cho ${x.c}. Chúng ta chỉ cần chỉnh nhẹ con số."`,
    (x) => `"Chúng tôi sẵn lòng tạo điều kiện nếu ${x.c} thể hiện thêm thiện chí về giá."`,
  ],
  bluff: [
    (x) => `"${x.p} không nằm trong danh sách bán. Muốn có cậu ấy, ${x.c} phải trả đúng giá."`,
    (x) => `"Tôi đã có những lời hỏi mua khác cho ${x.p}. Đây là con số duy nhất tôi sẽ nói."`,
    () => `"Hoặc ở mức này, hoặc không có thương vụ nào cả."`,
  ],
};
const SELL_COOL: Pool["warm"] = [
  (x) => `"Tôi xin lỗi nếu lời vừa rồi nặng nề. ${x.me} vẫn muốn làm ăn với ${x.c}."`,
  () => `"Chúng ta đều là người làm bóng đá. Hãy bình tĩnh và tìm điểm chung."`,
];

// Gia hạn với cầu thủ đang thuộc CLB của bạn: bạn nói với người đại diện của chính cầu thủ mình
const RENEW: Pool = {
  calm: [
    (x) => `"Đây là bản gia hạn ${x.me} đề xuất cho ${x.p}. Mong anh xem xét."`,
    (x) => `"Chúng tôi muốn giữ ${x.p} và đã chuẩn bị một đề nghị nghiêm túc."`,
    () => `"Các điều khoản này phản ánh đóng góp của cậu ấy cho đội bóng."`,
  ],
  warm: [
    (x) => `"${x.p} là một phần của ${x.me}. Chúng tôi muốn cậu ấy gắn bó lâu dài."`,
    (x) => `"Nơi này là nhà của ${x.p}. Hãy cùng nhau viết tiếp câu chuyện."`,
    (x) => `"Chúng tôi trân trọng những gì ${x.p} đã cống hiến và muốn đáp lại xứng đáng."`,
  ],
  bluff: [
    (x) => `"Hợp đồng của ${x.p} đang ngắn dần. Nếu không đạt thỏa thuận, tôi buộc phải tính phương án khác."`,
    () => `"Đây là mức tối đa chúng tôi có thể đưa. Tôi không thể hứa sẽ còn cơ hội sau."`,
    (x) => `"Có CLB hỏi mua ${x.p}. Tôi muốn ưu tiên giữ cậu ấy, nhưng không thể chờ mãi."`,
  ],
};
const RENEW_COOL: Pool["warm"] = [
  (x) => `"Tôi xin lỗi nếu vừa rồi nói hơi nặng lời. ${x.p} vẫn là người chúng tôi tin tưởng."`,
  () => `"Hãy hạ nhiệt và nói chuyện thẳng thắn. Tôi muốn một kết thúc tốt đẹp cho cả hai."`,
];

/** Chọn ổn định theo thương vụ và vòng, để cùng một vòng luôn hiện cùng một câu */
function pick<T>(a: T[], n: Negotiation, salt: number): T {
  let h = salt + n.round * 7;
  for (let i = 0; i < n.id.length; i++) h = (h * 31 + n.id.charCodeAt(i)) >>> 0;
  return a[h % a.length];
}

/** Ba câu trả lời gợi ý cho bước hiện tại: điềm đạm, chân thành (hoặc hạ nhiệt khi căng thẳng cao), cứng rắn */
export function suggestReplies(n: Negotiation, stage: "club" | "contract" | "sell"): Reply[] {
  const renew = stage === "contract" && n.type === "renew";
  const sell = stage === "sell";
  const pool = sell ? SELL : renew ? RENEW : stage === "club" ? CLUB : CONTRACT;
  const cool = sell ? SELL_COOL : renew ? RENEW_COOL : stage === "club" ? CLUB_COOL : CONTRACT_COOL;
  const other = sell ? n.buyer : n.seller;
  const x: Ctx = { p: P(n.pid).n, c: other != null ? C(other).n : "quý CLB", me: me().n };
  const warm = n.tension >= 65 ? cool : pool.warm;
  return [
    { tone: "calm", text: pick(pool.calm, n, 1)(x) },
    { tone: "warm", text: pick(warm, n, 2)(x) },
    { tone: "bluff", text: pick(pool.bluff, n, 3)(x) },
  ];
}
