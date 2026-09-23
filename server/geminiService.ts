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
 * Phân tích chuyên nghiệp như một Grandmaster Cờ Vua Quốc Tế dành riêng cho khán giả.
 * Nhận diện khai cuộc, đánh giá bên nào đang nắm lợi thế, bên nào vừa có nước đi thiên tài hoặc mắc sai lầm.
 */
export async function analyzeChessPosition(
  pgn: string,
  fen: string,
  moveCount: number,
  whitePlayerName: string = 'Trắng',
  blackPlayerName: string = 'Đen',
  evaluation?: PositionEvaluation
): Promise<string> {
  const fallbackCommentary =
    evaluation?.fullGrandmasterCommentary ||
    `⚖️ [Đánh giá nước ${Math.ceil(moveCount / 2)}]: Thế trận giữa ${whitePlayerName} (Trắng) và ${blackPlayerName} (Đen) đang diễn biến giằng co quyết liệt ở các ô trung tâm.`;

  const ai = getAIClient();
  if (!ai) {
    return fallbackCommentary;
  }

  try {
    const fullMoveNum = Math.ceil(moveCount / 2);
    const openingInfo = evaluation?.openingName
      ? `- Khai cuộc nhận diện: ${evaluation.openingName} (${evaluation.openingSummary || ''})`
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

    const prompt = `Bạn là một Đại kiện tướng Cờ Vua Quốc tế (Chess Grandmaster) kiêm Bình luận viên chuyên môn cao cấp đang bình luận trực tiếp cho KHÁN GIẢ theo dõi trận đấu.
Dữ liệu ván đấu sau nước thứ ${fullMoveNum} (tổng ${moveCount} nửa nước):
- Kỳ thủ Trắng: ${whitePlayerName}
- Kỳ thủ Đen: ${blackPlayerName}
${openingInfo}
${materialInfo}
${tacticalInfo}
- Nhật ký nước đi PGN:
${pgn || '(Chưa có PGN)'}
- Vị trí bàn cờ FEN:
${fen}

YÊU CẦU BÌNH LUẬN (CHỈ DÀNH CHO KHÁN GIẢ):
1. Khai cuộc: Nêu tên khai cuộc (nếu ở giai đoạn đầu dưới 10 nước) và ý đồ chiến lược của 2 bên.
2. Cục diện & Lợi thế: Chỉ rõ bên nào đang chiếm ưu thế (Trắng hay Đen), kiểm soát trung tâm và cấu trúc tốt ra sao.
3. Phân tích nước đi then chốt: Bên nào vừa có nước đi thiên tài (phế quân, đột phá sắc bén) hoặc bên nào vừa mắc sai lầm/sơ hở (treo quân, mất tốt, Vua hở sườn).
4. Giọng văn: Ngắn gọn (3-4 câu, khoảng 60-80 từ), phong cách Grandmaster quốc tế sắc sảo, kịch tính và cuốn hút khán giả, sử dụng thuật ngữ cờ vua chuẩn xác bằng tiếng Việt.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
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
