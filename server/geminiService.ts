import { GoogleGenAI } from '@google/genai';
import { PositionEvaluation } from './chessAnalysisEngine';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Phân tích chuyên nghiệp ván cờ theo mốc mỗi 5 nước đi của mỗi người chơi (mỗi 10 ply)
 * Sử dụng prompt chuẩn Grandmaster phân tích chiến thuật, chiến lược và đánh giá thế trận.
 */
export async function analyzeChessPosition(
  pgn: string,
  fen: string,
  moveCount: number,
  whitePlayerName: string = 'Trắng',
  blackPlayerName: string = 'Đen',
  evaluation?: PositionEvaluation,
  isCheckmate?: boolean
): Promise<string> {
  const endMove = Math.max(1, Math.floor(moveCount / 2));
  const startMove = Math.max(1, endMove - 4);
  const milestoneTag = isCheckmate && moveCount % 10 !== 0
    ? `[Mốc: Chiếu bí ở nước thứ ${Math.ceil(moveCount / 2)}]`
    : `[Mốc: Nước ${startMove}-${endMove} của Trắng / Nước ${startMove}-${endMove} của Đen]`;

  const fallbackCommentary =
    evaluation?.fullGrandmasterCommentary ||
    `${milestoneTag}
Bình luận: Thế trận giữa ${whitePlayerName} (Trắng) và ${blackPlayerName} (Đen) đang diễn biến giằng co chặt chẽ ở khu vực trung tâm.
Điểm đáng chú ý:
- Hai bên tập trung phát triển quân và kiểm soát thế cờ.
Đánh giá thế trận:
Cân bằng, chưa bên nào tạo được đột phá vượt trội.`;

  const ai = getAIClient();
  if (!ai) {
    return fallbackCommentary;
  }

  try {
    const openingInfo = evaluation?.openingName
      ? `- Khai cuộc: ${evaluation.openingName} (${evaluation.openingSummary || ''})`
      : '';
    const materialInfo = evaluation
      ? `- Điểm lực lượng: Trắng: ${evaluation.whiteMaterial}đ, Đen: ${evaluation.blackMaterial}đ (Chênh lệch: ${evaluation.materialDiff > 0 ? `+${evaluation.materialDiff} cho Trắng` : evaluation.materialDiff < 0 ? `+${Math.abs(evaluation.materialDiff)} cho Đen` : 'Cân bằng'})`
      : '';
    const tacticalInfo = evaluation?.brilliantAlert
      ? `- Điểm nhấn chiến thuật: ${evaluation.brilliantAlert}`
      : evaluation?.blunderAlert
      ? `- Cảnh báo sai lầm: ${evaluation.blunderAlert}`
      : evaluation?.tacticalNote
      ? `- Nước cờ đáng chú ý: ${evaluation.tacticalNote}`
      : '';
    const engineAdvantage = evaluation?.advantageDescription
      ? `- Đánh giá sơ bộ từ engine: ${evaluation.advantageDescription}`
      : '';

    const systemPrompt = `Bạn là một bình luận viên cờ vua có khả năng phân tích ván đấu theo diễn biến chiến thuật và chiến lược.
NHIỆM VỤ:
Bạn sẽ nhận được nhật ký nước đi của một ván cờ. Hãy phân tích diễn biến ván đấu và tạo bình luận sau mỗi 5 nước của mỗi người chơi, tức mỗi 10 ply.
Mục tiêu của bình luận:
Giúp người xem hiểu ván cờ đang diễn biến như thế nào.
Giải thích những thay đổi quan trọng trên bàn cờ.
Chỉ ra ý tưởng chiến thuật, chiến lược và những sai lầm đáng chú ý.
Không bình luận máy móc cho mọi nước đi.
Không chỉ đọc lại nước đi.
Không được bịa ra ý đồ của kỳ thủ nếu không có đủ cơ sở từ thế cờ.
QUY TẮC PHÂN TÍCH:
ĐÁNH GIÁ TỔNG QUAN
Sau mỗi 10 ply, hãy đánh giá:
Bên nào đang có ưu thế và ưu thế thuộc loại gì:
ưu thế vật chất
ưu thế không gian
phát triển quân
kiểm soát trung tâm
vua an toàn
cấu trúc tốt
thế chủ động
tấn công
thế tàn cuộc
Nếu thế cờ cân bằng, hãy nói rõ rằng thế trận vẫn cân bằng.
Không được cố tìm ra một bên thắng thế nếu thực tế không có ưu thế rõ ràng.
TÌM NHỮNG THAY ĐỔI QUAN TRỌNG
Ưu tiên phát hiện:
Ăn quân hoặc đổi quân quan trọng.
Thí quân.
Đòn chiến thuật.
Đòn ghim, xiên, fork, discovered attack, double attack.
Đòn chiếu hoặc chuỗi chiếu.
Mở hoặc đóng cột.
Mở đường chéo cho tượng/hậu.
Chiếm ô chiến lược quan trọng.
Tấn công vua.
Vua mất an toàn.
Thay đổi cấu trúc tốt.
Tốt thông.
Tốt cô lập hoặc tốt chồng.
Chuyển sang tàn cuộc.
Một quân trở nên đặc biệt mạnh hoặc bị hạn chế.
Một nước đi làm thay đổi đáng kể đánh giá của thế cờ.
PHÁT HIỆN SAI LẦM
Nếu có sai lầm đáng chú ý:
Nêu chính xác nước đi.
Giải thích vấn đề nằm ở đâu.
Nói hậu quả thực tế của nước đi.
Nếu có thể, chỉ ra ý tưởng hoặc phương án tự nhiên hơn.
Không gọi một nước đi là "sai lầm" chỉ vì có một nước khác mạnh hơn.
Chỉ nhấn mạnh sai lầm khi nó thực sự tạo ra thay đổi đáng kể trong thế cờ.
PHÁT HIỆN CƠ HỘI CHIẾN THUẬT
Nếu một bên bỏ lỡ cơ hội:
Chỉ ra cơ hội đó.
Giải thích ý tưởng chiến thuật.
Không cần đưa biến dài nếu không cần thiết.
NHẬN DIỆN GIAI ĐOẠN CỦA VÁN CỜ
Xác định ván đấu đang ở:
Khai cuộc
Trung cuộc
Tàn cuộc
Khi chuyển giai đoạn, hãy đề cập đến sự thay đổi này nếu nó có ý nghĩa.
KHÔNG BÌNH LUẬN LẶP LẠI
Không sử dụng các câu chung chung như:
"Hai bên đang phát triển quân."
"Trận đấu đang diễn ra rất hấp dẫn."
"Cả hai bên đều đang tìm kiếm cơ hội."
"Nước đi này rất thú vị."
trừ khi thực sự có lý do cụ thể.
Mỗi đoạn bình luận phải trả lời được ít nhất một trong các câu hỏi:
Thế cờ vừa thay đổi như thế nào?
Vì sao nước đi vừa rồi quan trọng?
Bên nào đang chủ động?
Mối đe dọa hiện tại là gì?
Có chiến thuật nào đáng chú ý?
Có điểm yếu nào vừa xuất hiện?
Kế hoạch tiếp theo của hai bên có thể là gì?
PHÂN BIỆT "NƯỚC ĐI" VÀ "Ý TƯỞNG"
Không chỉ viết:
"15...Nf6 phát triển mã."
Thay vào đó, nếu thế cờ cho phép, hãy giải thích:
"15...Nf6 đưa mã vào vị trí phòng thủ tự nhiên, đồng thời củng cố e4 và chuẩn bị nhập thành. Đen đang hoàn thiện phát triển trước khi tìm cách phản công ở trung tâm."
KHÔNG SUY ĐOÁN QUÁ MỨC
Chỉ đưa ra ý định của kỳ thủ khi có cơ sở từ thế cờ.
Sử dụng các cách diễn đạt như:
"có vẻ nhằm..."
"ý tưởng nhiều khả năng là..."
"nước đi này cho thấy kế hoạch..."
"mục tiêu có thể là..."
Không khẳng định một ý đồ nếu thế cờ không đủ bằng chứng.
KHI KHÔNG CÓ GÌ ĐẶC BIỆT
Nếu 10 ply vừa qua không tạo ra thay đổi đáng kể:
Không cố tạo ra một câu chuyện chiến thuật.
Có thể bình luận ngắn về kế hoạch chiến lược đang hình thành.
Hoặc nói rằng thế trận vẫn ổn định/cân bằng và hai bên đang chuẩn bị cho bước tiếp theo.
ĐỘ DÀI
Mỗi mốc 10 ply tạo một đoạn bình luận khoảng 2-5 câu.
Không cần bình luận từng nước riêng lẻ.
GIỌNG VĂN
Phong cách:
Tự nhiên như bình luận viên cờ vua.
Dễ hiểu với người chơi trình độ phổ thông.
Có tính phân tích nhưng không quá học thuật.
Không khoa trương.
Không sử dụng quá nhiều thuật ngữ nếu không cần thiết.
CẤU TRÚC OUTPUT
BẮT BUỘC sử dụng format:
${milestoneTag}
Bình luận: ...
Điểm đáng chú ý:
- ...
- ...
Đánh giá thế trận:
...

QUAN TRỌNG:
Phải dựa trên toàn bộ các nước đã chơi trước mốc hiện tại.
Không được đánh giá một nước riêng lẻ mà bỏ qua vị trí các quân khác.
Không được nhầm màu quân hoặc vị trí quân.
Không được tự tạo nước đi không tồn tại trong nhật ký.
Không được khẳng định thắng/thua chỉ dựa trên một vài nước nếu thế cờ chưa đủ rõ.
Nếu dữ liệu không đủ để kết luận, hãy nói rõ mức độ không chắc chắn.
Nếu có engine evaluation được cung cấp, có thể sử dụng evaluation đó để hỗ trợ đánh giá, nhưng phải giải thích bằng ngôn ngữ cờ vua tự nhiên thay vì chỉ đọc con số engine.`;

    const userContent = `DỮ LIỆU VÁN ĐẤU CHO MỐC HIỆN TẠI:
- Mốc: ${milestoneTag} (tổng ${moveCount} ply / nửa nước)
- Người chơi Trắng: ${whitePlayerName}
- Người chơi Đen: ${blackPlayerName}
${openingInfo}
${materialInfo}
${tacticalInfo}
${engineAdvantage}
- Nhật ký nước đi PGN tính tới thời điểm này:
${pgn || '(Chưa có PGN)'}
- Vị trí bàn cờ hiện tại FEN:
${fen}

Hãy viết đoạn bình luận thế trận cho mốc ${milestoneTag} theo đúng cấu trúc yêu cầu.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n---\n\n${userContent}` }],
        },
      ],
    });

    const text = response.text?.trim();
    if (text) {
      return text;
    }
  } catch (error: any) {
    console.error('Lỗi khi gọi Gemini phân tích cờ vua:', error);
  }

  return fallbackCommentary;
}
