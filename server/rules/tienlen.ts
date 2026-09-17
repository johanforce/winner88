import { Card, AnalyzedHand, PlayedHand } from '../types';
import { sortCards, compareCards, getRankLabel, isThreeOfSpades } from '../cardUtils';

/**
 * Phân tích và kiểm tra tính hợp lệ của bộ bài theo luật Tiến Lên Miền Nam
 */
export function analyzeTienLenHand(cards: Card[]): AnalyzedHand {
  if (!cards || cards.length === 0) {
    return { isValid: false, type: 'INVALID', cards: [], highestCard: {} as Card, description: 'Không có bài' };
  }

  const sorted = sortCards(cards);
  const len = sorted.length;

  // 1. Lá đơn (Rác)
  if (len === 1) {
    const card = sorted[0];
    const desc = card.rank === 15 ? `Heo (${getRankLabel(card.rank)})` : `Rác ${getRankLabel(card.rank)}`;
    return {
      isValid: true,
      type: 'SINGLE',
      cards: sorted,
      highestCard: card,
      description: desc,
    };
  }

  // 2. Đôi
  if (len === 2) {
    if (sorted[0].rank === sorted[1].rank) {
      const desc = sorted[0].rank === 15 ? 'Đôi Heo' : `Đôi ${getRankLabel(sorted[0].rank)}`;
      return {
        isValid: true,
        type: 'PAIR',
        cards: sorted,
        highestCard: sorted[1], // quân có chất lớn hơn
        description: desc,
      };
    }
    return { isValid: false, type: 'INVALID', cards: sorted, highestCard: sorted[1], description: 'Không phải đôi hợp lệ' };
  }

  // 3. Sám cô (3 lá cùng số)
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
    // Hoặc sảnh 3 lá (kiểm tra bên dưới)
  }

  // 4. Tứ quý (4 lá cùng số)
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

  // 5. Ba đôi thông (6 lá, 3 đôi liên tiếp)
  if (len === 6) {
    const isThreePairs =
      sorted[0].rank === sorted[1].rank &&
      sorted[2].rank === sorted[3].rank &&
      sorted[4].rank === sorted[5].rank;
    const isConsecutive =
      sorted[2].rank === sorted[0].rank + 1 &&
      sorted[4].rank === sorted[2].rank + 1;
    // Heo (rank 15) không được nằm trong đôi thông
    const noTwos = sorted[4].rank < 15;

    if (isThreePairs && isConsecutive && noTwos) {
      return {
        isValid: true,
        type: 'THREE_PAIRS_SEQUENCE',
        cards: sorted,
        highestCard: sorted[5], // lá lớn nhất của đôi cao nhất
        description: `3 đôi thông (${getRankLabel(sorted[0].rank)} đến ${getRankLabel(sorted[4].rank)})`,
      };
    }
  }

  // 6. Bốn đôi thông (8 lá, 4 đôi liên tiếp)
  if (len === 8) {
    const isFourPairs =
      sorted[0].rank === sorted[1].rank &&
      sorted[2].rank === sorted[3].rank &&
      sorted[4].rank === sorted[5].rank &&
      sorted[6].rank === sorted[7].rank;
    const isConsecutive =
      sorted[2].rank === sorted[0].rank + 1 &&
      sorted[4].rank === sorted[2].rank + 1 &&
      sorted[6].rank === sorted[4].rank + 1;
    const noTwos = sorted[6].rank < 15;

    if (isFourPairs && isConsecutive && noTwos) {
      return {
        isValid: true,
        type: 'FOUR_PAIRS_SEQUENCE',
        cards: sorted,
        highestCard: sorted[7],
        description: `4 đôi thông (${getRankLabel(sorted[0].rank)} đến ${getRankLabel(sorted[6].rank)})`,
      };
    }
  }

  // 7. Sảnh (dãy từ 3 lá trở lên, liên tiếp không chứa Heo)
  if (len >= 3 && len <= 12) {
    let isStraight = true;
    for (let i = 0; i < len - 1; i++) {
      if (sorted[i + 1].rank !== sorted[i].rank + 1) {
        isStraight = false;
        break;
      }
    }
    // Heo (rank 15) không được nằm trong sảnh theo luật TLMN
    if (sorted[len - 1].rank === 15) {
      isStraight = false;
    }

    if (isStraight) {
      return {
        isValid: true,
        type: 'STRAIGHT',
        cards: sorted,
        highestCard: sorted[len - 1],
        description: `Sảnh ${len} lá (${getRankLabel(sorted[0].rank)} đến ${getRankLabel(sorted[len - 1].rank)})`,
      };
    }
  }

  return {
    isValid: false,
    type: 'INVALID',
    cards: sorted,
    highestCard: sorted[len - 1],
    description: 'Bộ bài không hợp lệ theo luật Tiến Lên',
  };
}

/**
 * Kiểm tra xem candidate có thể chặn/đè được currentHand hay không
 */
export function canBeatTienLen(candidate: AnalyzedHand, current: PlayedHand): { canBeat: boolean; reason?: string } {
  if (!candidate.isValid) {
    return { canBeat: false, reason: 'Bộ bài của bạn không hợp lệ' };
  }

  const cHigh = candidate.highestCard;
  const curHigh = current.highestCard;

  // 1. CÙNG KIỂU BỘ BÀI VÀ CÙNG SỐ LƯỢNG LÁ
  if (candidate.type === current.type && candidate.cards.length === current.cards.length) {
    const cmp = compareCards(cHigh, curHigh);
    if (cmp > 0) {
      return { canBeat: true };
    }
    return { canBeat: false, reason: 'Bộ bài của bạn nhỏ hơn bài trên bàn' };
  }

  // 2. CÁC TRƯỜNG HỢP CHẶT HÀNG ĐẶC BIỆT
  // A. Bài trên bàn là 1 con Heo (SINGLE rank 15)
  if (current.type === 'SINGLE' && curHigh.rank === 15) {
    // 3 đôi thông chặt được 1 Heo
    if (candidate.type === 'THREE_PAIRS_SEQUENCE') {
      return { canBeat: true };
    }
    // Tứ quý chặt được 1 Heo
    if (candidate.type === 'FOUR_OF_A_KIND') {
      return { canBeat: true };
    }
    // 4 đôi thông chặt được 1 Heo
    if (candidate.type === 'FOUR_PAIRS_SEQUENCE') {
      return { canBeat: true };
    }
  }

  // B. Bài trên bàn là Đôi Heo (PAIR rank 15)
  if (current.type === 'PAIR' && curHigh.rank === 15) {
    // Tứ quý chặt được đôi heo (luật phổ biến TLMN)
    if (candidate.type === 'FOUR_OF_A_KIND') {
      return { canBeat: true };
    }
    // 4 đôi thông chặt được đôi heo
    if (candidate.type === 'FOUR_PAIRS_SEQUENCE') {
      return { canBeat: true };
    }
  }

  // C. Bài trên bàn là 3 Đôi Thông
  if (current.type === 'THREE_PAIRS_SEQUENCE') {
    // 3 đôi thông lớn hơn chặt 3 đôi thông nhỏ hơn
    if (candidate.type === 'THREE_PAIRS_SEQUENCE') {
      if (compareCards(cHigh, curHigh) > 0) return { canBeat: true };
    }
    // Tứ quý chặt được 3 đôi thông
    if (candidate.type === 'FOUR_OF_A_KIND') {
      return { canBeat: true };
    }
    // 4 đôi thông chặt được 3 đôi thông
    if (candidate.type === 'FOUR_PAIRS_SEQUENCE') {
      return { canBeat: true };
    }
  }

  // D. Bài trên bàn là Tứ Quý
  if (current.type === 'FOUR_OF_A_KIND') {
    // Tứ quý lớn hơn chặt tứ quý nhỏ hơn
    if (candidate.type === 'FOUR_OF_A_KIND') {
      if (cHigh.rank > curHigh.rank) return { canBeat: true };
    }
    // 4 đôi thông chặt được tứ quý
    if (candidate.type === 'FOUR_PAIRS_SEQUENCE') {
      return { canBeat: true };
    }
  }

  // E. Bài trên bàn là 4 Đôi Thông
  if (current.type === 'FOUR_PAIRS_SEQUENCE') {
    if (candidate.type === 'FOUR_PAIRS_SEQUENCE') {
      if (compareCards(cHigh, curHigh) > 0) return { canBeat: true };
    }
  }

  return { canBeat: false, reason: 'Không cùng kiểu bộ bài hoặc không đủ điều kiện chặt hàng' };
}
