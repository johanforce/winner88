import { Card, Suit } from './types';

export const SUITS: Suit[] = ['SPADE', 'CLUB', 'DIAMOND', 'HEART'];
export const SUIT_ORDER: Record<Suit, number> = {
  SPADE: 0,
  CLUB: 1,
  DIAMOND: 2,
  HEART: 3,
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  SPADE: '♠',
  CLUB: '♣',
  DIAMOND: '♦',
  HEART: '♥',
};

export const SUIT_NAMES: Record<Suit, string> = {
  SPADE: 'Bích',
  CLUB: 'Tép',
  DIAMOND: 'Rô',
  HEART: 'Cơ',
};

export function getRankLabel(rank: number): string {
  if (rank <= 10) return rank.toString();
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  if (rank === 15) return '2';
  return rank.toString();
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  // Ranks 3 to 15 (15 = 2/Heo)
  for (let rank = 3; rank <= 15; rank++) {
    for (const suit of SUITS) {
      deck.push({
        id: `${rank}_${suit}`,
        rank,
        suit,
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Standard sort: primary by Rank (3 -> 15), secondary by Suit (Bích < Tép < Rô < Cơ)
 */
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
}

/**
 * Compare two single cards in Vietnamese card game hierarchy:
 * First compare rank. If rank equal, compare suit (Cơ > Rô > Tép > Bích).
 */
export function compareCards(a: Card, b: Card): number {
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }
  return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
}

/**
 * Check if card is 3 of Spades (3 Bích)
 */
export function isThreeOfSpades(card: Card): boolean {
  return card.rank === 3 && card.suit === 'SPADE';
}

/**
 * Check if a list of cards contains 3 of Spades
 */
export function hasThreeOfSpades(cards: Card[]): boolean {
  return cards.some(isThreeOfSpades);
}

/**
 * Find player who holds 3 of Spades
 */
export function findPlayerWithThreeOfSpades<T extends { id: string; cards: Card[] }>(players: T[]): T | null {
  for (const p of players) {
    if (hasThreeOfSpades(p.cards)) {
      return p;
    }
  }
  return null;
}

/**
 * Find player with the lowest card among all players (for 2-3 player games where 3 Spades was not dealt)
 */
export function findLowestCardPlayer<T extends { id: string; cards: Card[] }>(players: T[]): { player: T; lowestCard: Card } | null {
  let lowestPlayer: T | null = null;
  let lowestCard: Card | null = null;

  for (const p of players) {
    for (const card of p.cards) {
      if (!lowestCard || compareCards(card, lowestCard) < 0) {
        lowestCard = card;
        lowestPlayer = p;
      }
    }
  }

  if (lowestPlayer && lowestCard) {
    return { player: lowestPlayer, lowestCard };
  }
  return null;
}
