import { Card, AnalyzedHand, PlayedHand } from '../types';
import { sortCards, getRankLabel } from '../cardUtils';

/**
 * ENGINE LUẬT CHƠI SÂM LỐC (XÂM LỐC)
 * 
 * Đặc điểm chính của Sâm Lốc:
 * 1. Mỗi người chơi được chia 10 lá bài.
 * 2. So bài KHÔNG PHÂN BIỆT CHẤT (chỉ so độ lớn của số: 3 < 4 < ... < K < A < 2).
 * 3. Tứ quý chặt được 1 con Heo (2).
 * 4. Sảnh không phân biệt chất, sảnh A-2-3 (sảnh nhỏ nhất) hoặc 3..A.
 * 5. Giai đoạn "Báo Sâm" (Xin Sâm) trước khi bắt đầu đánh bài.
 * 6. Quy tắc thối 2: Không được để 2 về cuối cùng.
 */

export function analyzeSamLocHand(cards: Card[]): AnalyzedHand {
  if (!cards || cards.length === 0) {
    return { isValid: false, type: 'INVALID', cards: [], highestCard: {} as Card, description: 'Không có bài' };
  }

  const sorted = sortCards(cards);
  const len = sorted.length;

  // 1. Rác (Lá đơn)
  if (len === 1) {
    const card = sorted[0];
    const desc = card.rank === 15 ? 'Heo (2)' : `Rác ${getRankLabel(card.rank)}`;
    return {
      isValid: true,
      type: 'SINGLE',
      cards: sorted,
      highestCard: card,
      description: desc,
    };
  }

  // 2. Đôi (2 lá cùng hàng số, không phân biệt chất)
  if (len === 2) {
    if (sorted[0].rank === sorted[1].rank) {
      const desc = sorted[0].rank === 15 ? 'Đôi Heo' : `Đôi ${getRankLabel(sorted[0].rank)}`;
      return {
        isValid: true,
        type: 'PAIR',
        cards: sorted,
        highestCard: sorted[1],
        description: desc,
      };
    }
    return { isValid: false, type: 'INVALID', cards: sorted, highestCard: sorted[1], description: 'Không phải đôi' };
  }

  // 3. Sám cô (3 lá cùng hàng số)
  if (len === 3) {
    if (sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank) {
      return {
        isValid: true,
        type: 'TRIPLE',
        cards: sorted,
        highestCard: sorted[2],
        description: `Sám cô ${getRankLabel(sorted[0].rank)}`,
      };
    }
  }

  // 4. Tứ quý (4 lá cùng hàng số)
  if (len === 4) {
    if (
      sorted[0].rank === sorted[1].rank &&
      sorted[1].rank === sorted[2].rank &&
      sorted[2].rank === sorted[3].rank
    ) {
      return {
        isValid: true,
        type: 'FOUR_OF_A_KIND',
        cards: sorted,
        highestCard: sorted[3],
        description: `Tứ quý ${getRankLabel(sorted[0].rank)}`,
      };
    }
  }

  // 5. Sảnh (dãy liên tiếp từ 3 lá trở lên, không phân biệt chất)
  // Trong Sâm Lốc: Sảnh từ 3 đến A.
  if (len >= 3 && len <= 10) {
    let isStraight = true;
    for (let i = 0; i < len - 1; i++) {
      if (sorted[i + 1].rank !== sorted[i].rank + 1) {
        isStraight = false;
        break;
      }
    }
    // Heo (rank 15) không nằm trong sảnh thông thường
    if (sorted[len - 1].rank === 15) {
      isStraight = false;
    }

    if (isStraight) {
      return {
        isValid: true,
        type: 'STRAIGHT',
        cards: sorted,
        highestCard: sorted[len - 1],
        description: `Sảnh Sâm ${len} lá (${getRankLabel(sorted[0].rank)} đến ${getRankLabel(sorted[len - 1].rank)})`,
      };
    }
  }

  // TODO: Hỗ trợ biến thể Sâm đặc biệt (ví dụ Sảnh A-2-3 hoặc Tới trắng: Sảnh rồng, Đồng màu, 5 đôi)
  return {
    isValid: false,
    type: 'INVALID',
    cards: sorted,
    highestCard: sorted[len - 1],
    description: 'Bộ bài không hợp lệ theo luật Sâm Lốc',
  };
}

/**
 * Kiểm tra chặn bài trong Sâm Lốc
 * Quy tắc: Không phân biệt chất, chỉ so sánh rank!
 */
export function canBeatSamLoc(candidate: AnalyzedHand, current: PlayedHand): { canBeat: boolean; reason?: string } {
  if (!candidate.isValid) {
    return { canBeat: false, reason: 'Bộ bài không hợp lệ' };
  }

  const cHigh = candidate.highestCard;
  const curHigh = current.highestCard;

  // 1. Cùng kiểu bài và số lá: chỉ so sánh rank (hàng số)
  if (candidate.type === current.type && candidate.cards.length === current.cards.length) {
    if (cHigh.rank > curHigh.rank) {
      return { canBeat: true };
    }
    return { canBeat: false, reason: 'Bộ bài của bạn không lớn hơn bài trên bàn (Sâm Lốc chỉ so số, không so chất)' };
  }

  // 2. Chặt Heo bằng Tứ quý: 1 Tứ quý chặt được 1 con Heo (2)
  if (current.type === 'SINGLE' && curHigh.rank === 15 && candidate.type === 'FOUR_OF_A_KIND') {
    return { canBeat: true };
  }

  // 3. Tứ quý đè Tứ quý
  if (current.type === 'FOUR_OF_A_KIND' && candidate.type === 'FOUR_OF_A_KIND') {
    if (cHigh.rank > curHigh.rank) {
      return { canBeat: true };
    }
    return { canBeat: false, reason: 'Tứ quý của bạn nhỏ hơn' };
  }

  // TODO: Bổ sung thêm các luật đặc biệt (ví dụ 2 Tứ quý chặt đôi heo) tùy cấu hình phòng
  return { canBeat: false, reason: 'Không cùng loại bộ bài hoặc không đủ điều kiện chặt trong Sâm Lốc' };
}
