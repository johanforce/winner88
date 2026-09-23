import { GoogleGenAI } from '@google/genai';

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
 * Phân tích tổng quan thế trận Cờ Vua giữa Trắng và Đen sau mỗi 10 nước đi.
 * Gửi nhật ký ván đấu (PGN, FEN, số nước) cho Gemini để AI nhận định ngắn gọn cho khán giả.
 */
export async function analyzeChessPosition(
  pgn: string,
  fen: string,
  moveCount: number,
  whitePlayerName: string = 'Trắng',
  blackPlayerName: string = 'Đen'
): Promise<string> {
  const ai = getAIClient();

  if (!ai) {
    // Trả về nhận định dự phòng khách quan nếu chưa có API key trong môi trường test
    return `♟️ [Phân tích nước ${moveCount}]: Thế trận giữa ${whitePlayerName} (Trắng) và ${blackPlayerName} (Đen) đang giằng co quyết liệt. Cả hai bên đang nỗ lực kiểm soát các ô trung tâm và củng cố vị trí Vua.`;
  }

  try {
    const prompt = `Bạn là một Đại kiện tướng Cờ Vua AI (Chess Grandmaster Bot) kiêm Bình luận viên trận đấu cho khán giả trong phòng xem.
Dưới đây là nhật ký ván cờ vua sau ${moveCount} nước đi:
- Kỳ thủ Trắng: ${whitePlayerName}
- Kỳ thủ Đen: ${blackPlayerName}
- Chuỗi nước đi PGN:
${pgn || '(Chưa có PGN)'}
- Vị trí bàn cờ hiện tại (FEN):
${fen}

YÊU CẦU:
1. Đưa ra một nhận định TỔNG QUAN, NGẮN GỌN (khoảng 2-3 câu, tối đa 50 từ) bằng tiếng Việt.
2. Đánh giá nhanh: Bên nào đang kiểm soát trung tâm tốt hơn, thế cờ cân bằng hay nghiêng về Trắng/Đen, có đòn chiến thuật hay nguy cơ nào đáng chú ý không.
3. Giọng điệu chuyên nghiệp, cuốn hút, khách quan như bình luận viên cờ vua quốc tế.
Không cần phân tích biến thể rườm rà, tập trung vào bức tranh toàn cảnh!`;

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

  return `♟️ [Phân tích nước ${moveCount}]: Cục diện trận đấu sau ${moveCount} nước đang bước vào giai đoạn then chốt. Cả ${whitePlayerName} và ${blackPlayerName} đều đang duy trì sự tập trung cao độ để tìm kiếm cơ hội bứt phá!`;
}
