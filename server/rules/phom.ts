import { Card, Suit } from '../types';

export interface PhomAnalysis {
  isValid: boolean;
  type?: 'SAME_RANK' | 'STRAIGHT';
  description: string;
}

/**
 * Returns point value according to Phỏm rules:
 * A = 1
 * 2 = 2
 * 3..10 = 3..10
 * J, Q, K = 10
 */
export function getPhomCardPoints(card: Card): number {
  if (card.rank === 14) return 1; // A (Át)
  if (card.rank === 15) return 2; // 2 (Heo)
  if (card.rank >= 3 && card.rank <= 10) return card.rank;
  if (card.rank >= 11 && card.rank <= 13) return 10; // J, Q, K
  return 10;
}

/**
 * Map a Card rank to value representation for straights:
 * 2 -> 2
 * 3..10 -> 3..10
 * 11 (J) -> 11
 * 12 (Q) -> 12
 * 13 (K) -> 13
 * 14 (A) -> can be 1 (for A-2-3) or 14 (for Q-K-A)
 */
export function getPhomRankValues(card: Card): number[] {
  if (card.rank === 14) return [1, 14]; // A can be 1 or 14
  if (card.rank === 15) return [2];
  return [card.rank];
}

/**
 * Validate if 3 cards form a legal Phỏm
 * Phỏm là bộ 3 lá bài hợp lệ, gồm 2 loại duy nhất:
 * 1. Phỏm ngang: 3 lá cùng rank (khác chất)
 * 2. Phỏm dọc (sảnh): 3 lá liên tiếp cùng chất.
 *    A chỉ đứng đầu sảnh (A-2-3) hoặc cuối (Q-K-A). K-A-2 KHÔNG hợp lệ.
 */
export function isValidPhom(cards: Card[]): PhomAnalysis {
  if (cards.length !== 3) {
    return { isValid: false, description: 'Phỏm phải gồm đúng 3 lá bài' };
  }

  const [c1, c2, c3] = cards;

  // 1. Phỏm ngang (bộ 3 số cùng rank)
  if (c1.rank === c2.rank && c2.rank === c3.rank) {
    const suits = new Set([c1.suit, c2.suit, c3.suit]);
    if (suits.size === 3) {
      return {
        isValid: true,
        type: 'SAME_RANK',
        description: `Phỏm ngang 3 lá cùng rank`,
      };
    }
  }

  // 2. Phỏm dọc (sảnh 3 lá liên tiếp cùng chất)
  if (c1.suit === c2.suit && c2.suit === c3.suit) {
    const v1List = getPhomRankValues(c1);
    const v2List = getPhomRankValues(c2);
    const v3List = getPhomRankValues(c3);

    for (const v1 of v1List) {
      for (const v2 of v2List) {
        for (const v3 of v3List) {
          const sorted = [v1, v2, v3].sort((a, b) => a - b);
          // Check consecutive: sorted[0] + 1 === sorted[1] && sorted[1] + 1 === sorted[2]
          if (sorted[0] + 1 === sorted[1] && sorted[1] + 1 === sorted[2]) {
            // Must be within legal range [1..14]
            // A-2-3 is [1, 2, 3] -> valid
            // Q-K-A is [12, 13, 14] -> valid
            // K-A-2 would be [2, 13, 14] or [1, 2, 13] -> not consecutive -> invalid!
            return {
              isValid: true,
              type: 'STRAIGHT',
              description: `Phỏm dọc (sảnh 3 lá cùng chất)`,
            };
          }
        }
      }
    }
  }

  return { isValid: false, description: 'Không phải phỏm hợp lệ' };
}

/**
 * Find all pairs in hand that form a valid Phỏm with targetCard
 */
export function findPossiblePhomPairsWithCard(handCards: Card[], targetCard: Card): Card[][] {
  const result: Card[][] = [];
  const n = handCards.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const candidate = [handCards[i], handCards[j], targetCard];
      const check = isValidPhom(candidate);
      if (check.isValid) {
        result.push([handCards[i], handCards[j]]);
      }
    }
  }

  return result;
}

/**
 * Find all valid 3-card phỏms that can be formed from a list of cards
 */
export function findAllPossiblePhoms(cards: Card[]): Card[][] {
  const phoms: Card[][] = [];
  const n = cards.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const candidate = [cards[i], cards[j], cards[k]];
        if (isValidPhom(candidate).isValid) {
          phoms.push(candidate);
        }
      }
    }
  }
  return phoms;
}

/**
 * Partition a set of cards into non-overlapping phỏms to minimize leftover card points.
 */
export function findBestPhomPartition(cards: Card[]): {
  melds: Card[][];
  unmelded: Card[];
  unmeldedPoints: number;
} {
  const allPhoms = findAllPossiblePhoms(cards);

  let bestMelds: Card[][] = [];
  let minPoints = cards.reduce((sum, c) => sum + getPhomCardPoints(c), 0);
  let bestUnmelded: Card[] = [...cards];

  function search(currentPhomIndex: number, usedCardIds: Set<string>, currentMelds: Card[][]) {
    // Calculate unmelded
    const unmelded = cards.filter((c) => !usedCardIds.has(c.id));
    const points = unmelded.reduce((sum, c) => sum + getPhomCardPoints(c), 0);

    if (
      currentMelds.length > bestMelds.length ||
      (currentMelds.length === bestMelds.length && points < minPoints)
    ) {
      bestMelds = [...currentMelds];
      minPoints = points;
      bestUnmelded = unmelded;
    }

    for (let i = currentPhomIndex; i < allPhoms.length; i++) {
      const p = allPhoms[i];
      // Check if p overlaps with usedCardIds
      const overlaps = p.some((c) => usedCardIds.has(c.id));
      if (!overlaps) {
        const nextUsed = new Set(usedCardIds);
        p.forEach((c) => nextUsed.add(c.id));
        currentMelds.push(p);
        search(i + 1, nextUsed, currentMelds);
        currentMelds.pop();
      }
    }
  }

  search(0, new Set(), []);

  return {
    melds: bestMelds,
    unmelded: bestUnmelded,
    unmeldedPoints: minPoints,
  };
}

/**
 * Check if a player with 9 cards has Ù Trắng (tự nhiên)
 * Immediately from initial 9 cards: 3 phỏms of 3 cards = 9 cards (0 unmelded)
 */
export function checkUTrang(cards: Card[]): { isUTrang: boolean; phoms: Card[][] } {
  if (cards.length !== 9) return { isUTrang: false, phoms: [] };
  const partition = findBestPhomPartition(cards);
  if (partition.melds.length === 3 && partition.unmelded.length === 0) {
    return { isUTrang: true, phoms: partition.melds };
  }
  return { isUTrang: false, phoms: [] };
}

/**
 * Check if player is Ù during their turn:
 * Player has 10 cards total (cards in hand + cards in already downed phỏms):
 * If 9 cards form 3 valid phỏms, leaving exactly 1 card to discard -> Ù!
 */
export function checkCanU(
  handCards: Card[],
  downedMelds: Card[][]
): {
  canU: boolean;
  melds: Card[][];
  discardCandidate?: Card;
} {
  // Downed melds already count towards total
  const allCards = [...handCards];
  downedMelds.forEach((m) => allCards.push(...m));

  // If total cards is 10 (or 9 if hand is 9 and no melds yet)
  if (allCards.length === 10) {
    // Try each card in hand as the discard
    for (let i = 0; i < handCards.length; i++) {
      const discard = handCards[i];
      const remaining = allCards.filter((c) => c.id !== discard.id);
      const partition = findBestPhomPartition(remaining);
      if (partition.melds.length === 3 && partition.unmelded.length === 0) {
        return {
          canU: true,
          melds: partition.melds,
          discardCandidate: discard,
        };
      }
    }
  }

  return { canU: false, melds: [] };
}
