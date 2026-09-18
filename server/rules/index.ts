import { GameRule, Card, AnalyzedHand, PlayedHand } from '../types';
import { analyzeTienLenHand, canBeatTienLen } from './tienlen';
import { analyzeSamLocHand, canBeatSamLoc } from './samloc';

export function analyzeHandByRule(rule: GameRule, cards: Card[]): AnalyzedHand {
  if (rule === 'SAM_LOC') {
    return analyzeSamLocHand(cards);
  }
  return analyzeTienLenHand(cards);
}

export function canBeatByRule(
  rule: GameRule,
  candidate: AnalyzedHand,
  current: PlayedHand
): { canBeat: boolean; reason?: string } {
  if (rule === 'SAM_LOC') {
    return canBeatSamLoc(candidate, current);
  }
  return canBeatTienLen(candidate, current);
}

export * from './phom';
