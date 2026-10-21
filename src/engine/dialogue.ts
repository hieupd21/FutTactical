// Gợi ý câu trả lời khi đàm phán. Mỗi câu mang một giọng điệu (Tone) quyết định rủi ro/lợi ích, xem toneEffect trong transfers.ts.
import { getClub, myClub, getPlayer } from "./state";
import type { Negotiation, Tone } from "./types";

export interface Reply {
  tone: Tone;
  text: string;
}
type Pool = Record<Tone, ((context: Ctx) => string)[]>;
interface Ctx {
  playerName: string; // tên cầu thủ
  sellerName: string; // tên CLB bán (hoặc "họ")
  myClubName: string; // tên CLB của bạn
}

const CLUB: Pool = {
  calm: [
    (context) =>
      `"Đây là đề nghị chính thức của ${context.myClubName} dành cho ${context.playerName}. Mong quý CLB xem xét."`,
    (context) =>
      `"Chúng tôi đã tính toán kỹ. Con số này phản ánh đúng giá trị của ${context.playerName}."`,
    () => `"Tôi gửi đề nghị mới, hy vọng chúng ta sớm gặp nhau ở giữa."`,
  ],
  warm: [
    (context) =>
      `"${context.sellerName} và ${context.myClubName} đều muốn một thương vụ tốt cho cả hai phía. Tôi tin chúng ta làm được."`,
    (context) =>
      `"Chúng tôi rất tôn trọng ${context.sellerName}. ${context.playerName} sẽ có chỗ đứng xứng đáng ở đội bóng của chúng tôi."`,
    (context) =>
      `"Tôi biết ${context.playerName} quan trọng với các anh. Hãy để chúng tôi làm cho thương vụ này thật công bằng."`,
  ],
  bluff: [
    (context) =>
      `"Đây là đề nghị của tôi. Thị trường còn nhiều cái tên khác ngoài ${context.playerName}."`,
    () => `"Tôi sẽ không đứng chờ mãi. Hoặc ta chốt ở mức này, hoặc tôi quay sang phương án khác."`,
    (context) =>
      `"Các anh có thể từ chối, nhưng đừng quên ${context.playerName} không còn nhiều thời gian ở đó."`,
  ],
};
const CLUB_COOLDOWN: Pool["warm"] = [
  () => `"Tôi xin lỗi nếu lời lẽ vừa rồi làm các anh khó chịu. Tôi chỉ muốn tìm tiếng nói chung."`,
  (context) =>
    `"Hãy hạ nhiệt một chút. ${context.myClubName} vẫn rất thiện chí với ${context.sellerName}."`,
];

const CONTRACT: Pool = {
  calm: [
    (context) =>
      `"Đây là đề nghị cá nhân của chúng tôi dành cho ${context.playerName}. Mong anh cân nhắc."`,
    () => `"Tôi tin các điều khoản này là hợp lý với cả hai phía."`,
    (context) => `"Chúng tôi đã cố gắng đáp ứng những gì ${context.playerName} mong muốn."`,
  ],
  warm: [
    (context) =>
      `"${context.myClubName} thực lòng muốn ${context.playerName} là một phần của dự án dài hạn."`,
    (context) =>
      `"Chúng tôi coi ${context.playerName} là người của gia đình. Hãy cùng nhau tìm một giải pháp đẹp."`,
    (context) =>
      `"Tôi không chỉ trả lương, tôi muốn xây dựng sự nghiệp cho ${context.playerName} ở ${context.myClubName}."`,
  ],
  bluff: [
    (context) =>
      `"Tôi còn vài cầu thủ khác trong danh sách. ${context.playerName} không phải lựa chọn duy nhất."`,
    () => `"Đây là mức cao nhất tôi có thể đưa. Phần còn lại tùy các anh."`,
    () => `"Hết hôm nay, đề nghị này sẽ không còn nữa."`,
  ],
};
const CONTRACT_COOLDOWN: Pool["warm"] = [
  () => `"Có lẽ tôi đã đi hơi nhanh. Chúng ta hãy cùng ngồi lại và nói chuyện thẳng thắn."`,
  (context) =>
    `"Tôi tôn trọng giá trị của ${context.playerName}. Hãy cho tôi cơ hội để làm hài lòng các anh."`,
];

// Phản giá khi CLB khác hỏi mua cầu thủ của bạn: bạn nói với CLB mua (x.c)
const SELL: Pool = {
  calm: [
    (context) =>
      `"Chúng tôi đánh giá ${context.playerName} cao hơn mức ${context.sellerName} đưa ra. Đây là con số chúng tôi cho là hợp lý."`,
    (context) =>
      `"Tôi đề nghị điều chỉnh lại giá. Đó là mức phản ánh đúng giá trị của ${context.playerName}."`,
    () => `"Hãy xem lại con số này. Tôi tin chúng ta có thể gặp nhau ở giữa."`,
  ],
  warm: [
    (context) =>
      `"${context.myClubName} và ${context.sellerName} có quan hệ tốt. Tôi muốn thương vụ này công bằng cho cả hai."`,
    (context) =>
      `"${context.playerName} sẽ là một bản hợp đồng đáng giá cho ${context.sellerName}. Chúng ta chỉ cần chỉnh nhẹ con số."`,
    (context) =>
      `"Chúng tôi sẵn lòng tạo điều kiện nếu ${context.sellerName} thể hiện thêm thiện chí về giá."`,
  ],
  bluff: [
    (context) =>
      `"${context.playerName} không nằm trong danh sách bán. Muốn có cậu ấy, ${context.sellerName} phải trả đúng giá."`,
    (context) =>
      `"Tôi đã có những lời hỏi mua khác cho ${context.playerName}. Đây là con số duy nhất tôi sẽ nói."`,
    () => `"Hoặc ở mức này, hoặc không có thương vụ nào cả."`,
  ],
};
const SELL_COOLDOWN: Pool["warm"] = [
  (context) =>
    `"Tôi xin lỗi nếu lời vừa rồi nặng nề. ${context.myClubName} vẫn muốn làm ăn với ${context.sellerName}."`,
  () => `"Chúng ta đều là người làm bóng đá. Hãy bình tĩnh và tìm điểm chung."`,
];

// Gia hạn với cầu thủ đang thuộc CLB của bạn: bạn nói với người đại diện của chính cầu thủ mình
const RENEW: Pool = {
  calm: [
    (context) =>
      `"Đây là bản gia hạn ${context.myClubName} đề xuất cho ${context.playerName}. Mong anh xem xét."`,
    (context) =>
      `"Chúng tôi muốn giữ ${context.playerName} và đã chuẩn bị một đề nghị nghiêm túc."`,
    () => `"Các điều khoản này phản ánh đóng góp của cậu ấy cho đội bóng."`,
  ],
  warm: [
    (context) =>
      `"${context.playerName} là một phần của ${context.myClubName}. Chúng tôi muốn cậu ấy gắn bó lâu dài."`,
    (context) => `"Nơi này là nhà của ${context.playerName}. Hãy cùng nhau viết tiếp câu chuyện."`,
    (context) =>
      `"Chúng tôi trân trọng những gì ${context.playerName} đã cống hiến và muốn đáp lại xứng đáng."`,
  ],
  bluff: [
    (context) =>
      `"Hợp đồng của ${context.playerName} đang ngắn dần. Nếu không đạt thỏa thuận, tôi buộc phải tính phương án khác."`,
    () => `"Đây là mức tối đa chúng tôi có thể đưa. Tôi không thể hứa sẽ còn cơ hội sau."`,
    (context) =>
      `"Có CLB hỏi mua ${context.playerName}. Tôi muốn ưu tiên giữ cậu ấy, nhưng không thể chờ mãi."`,
  ],
};
const RENEW_COOLDOWN: Pool["warm"] = [
  (context) =>
    `"Tôi xin lỗi nếu vừa rồi nói hơi nặng lời. ${context.playerName} vẫn là người chúng tôi tin tưởng."`,
  () => `"Hãy hạ nhiệt và nói chuyện thẳng thắn. Tôi muốn một kết thúc tốt đẹp cho cả hai."`,
];

/** Chọn ổn định theo thương vụ và vòng, để cùng một vòng luôn hiện cùng một câu */
function pick<T>(options: T[], negotiation: Negotiation, salt: number): T {
  let hash = salt + negotiation.round * 7;
  for (let i = 0; i < negotiation.id.length; i++)
    hash = (hash * 31 + negotiation.id.charCodeAt(i)) >>> 0;
  return options[hash % options.length];
}

/** Ba câu trả lời gợi ý cho bước hiện tại: điềm đạm, chân thành (hoặc hạ nhiệt khi căng thẳng cao), cứng rắn */
export function suggestReplies(
  negotiation: Negotiation,
  stage: "club" | "contract" | "sell",
): Reply[] {
  const renew = stage === "contract" && negotiation.type === "renew";
  const sell = stage === "sell";
  const pool = sell ? SELL : renew ? RENEW : stage === "club" ? CLUB : CONTRACT;
  const cool = sell
    ? SELL_COOLDOWN
    : renew
      ? RENEW_COOLDOWN
      : stage === "club"
        ? CLUB_COOLDOWN
        : CONTRACT_COOLDOWN;
  const other = sell ? negotiation.buyer : negotiation.seller;
  const context: Ctx = {
    playerName: getPlayer(negotiation.playerId).name,
    sellerName: other != null ? getClub(other).name : "quý CLB",
    myClubName: myClub().name,
  };
  const warm = negotiation.tension >= 65 ? cool : pool.warm;
  return [
    { tone: "calm", text: pick(pool.calm, negotiation, 1)(context) },
    { tone: "warm", text: pick(warm, negotiation, 2)(context) },
    { tone: "bluff", text: pick(pool.bluff, negotiation, 3)(context) },
  ];
}
