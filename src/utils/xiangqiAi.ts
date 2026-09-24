import { XiangqiPiece, XiangqiSide } from '../types';
import { getLegalMoves, generateMoveNotation } from '../../server/xiangqiLogic';

export interface XiangqiAiHint {
  piece: XiangqiPiece;
  from: { x: number; y: number };
  to: { x: number; y: number };
  notation: string;
  score: number;
}

const PIECE_VALUES: Record<string, number> = {
  GENERAL: 10000,
  CHARIOT: 1000,
  CANNON: 450,
  HORSE: 400,
  ELEPHANT: 250,
  ADVISOR: 250,
  SOLDIER: 100,
};

export function findBestXiangqiMove(
  pieces: XiangqiPiece[],
  side: XiangqiSide,
  depth: number = 2
): XiangqiAiHint | null {
  const myPieces = pieces.filter((p) => p.color === side);
  const candidates: {
    piece: XiangqiPiece;
    from: { x: number; y: number };
    to: { x: number; y: number };
    notation: string;
    score: number;
  }[] = [];

  for (const piece of myPieces) {
    const legalMoves = getLegalMoves(piece, pieces);
    for (const move of legalMoves) {
      const targetPiece = pieces.find((p) => p.x === move.x && p.y === move.y);
      let score = 0;
      if (targetPiece) {
        score += (PIECE_VALUES[targetPiece.type] || 50) * 10;
      }
      // Prioritize advancing pieces toward center
      score += Math.abs(move.x - 4) * -2;
      const notation = generateMoveNotation(piece, move, targetPiece);
      candidates.push({
        piece,
        from: { x: piece.x, y: piece.y },
        to: move,
        notation,
        score,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}
