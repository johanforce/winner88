import { XiangqiPiece, XiangqiPieceType, XiangqiSide } from '../types';
import {
  getLegalMoves,
  getPieceAt,
  isSideInCheck,
  generateMoveNotation,
} from './xiangqiLogic';

export interface XiangqiAiHint {
  from: { x: number; y: number };
  to: { x: number; y: number };
  piece: XiangqiPiece;
  capturedPiece?: XiangqiPiece;
  notation: string;
  score: number;
}

// Base piece values (centi-pawns style)
const PIECE_VALUES: Record<XiangqiPieceType, number> = {
  GENERAL: 10000,
  CHARIOT: 950,
  CANNON: 480,
  HORSE: 430,
  ELEPHANT: 230,
  ADVISOR: 230,
  SOLDIER: 120,
};

// 9 columns x 10 rows Positional Weights for RED (origin at top-left 0,0 from Red perspective, mirrored for Black)
// High values encourage active, dominant positions (e.g. Chariot on open files, Cannon on center/ribs, Horse in forward outposts).
const CHARIOT_PST: number[][] = [
  // y = 0..9 (from black side to red home)
  [10, 15, 15, 20, 25, 20, 15, 15, 10], // bottom of enemy board (y=0)
  [15, 20, 20, 25, 30, 25, 20, 20, 15],
  [10, 15, 15, 20, 25, 20, 15, 15, 10],
  [10, 15, 15, 20, 20, 20, 15, 15, 10],
  [10, 15, 15, 20, 25, 20, 15, 15, 10], // River (y=4, 5)
  [10, 15, 15, 20, 25, 20, 15, 15, 10],
  [5, 10, 10, 15, 20, 15, 10, 10, 5],
  [0, 5, 5, 10, 15, 10, 5, 5, 0],
  [-5, 5, 5, 10, 15, 10, 5, 5, -5],
  [-5, 0, 0, 5, 10, 5, 0, 0, -5], // home base (y=9)
];

const HORSE_PST: number[][] = [
  [0, 5, 10, 15, 15, 15, 10, 5, 0],
  [5, 15, 25, 30, 30, 30, 25, 15, 5],
  [5, 20, 30, 35, 35, 35, 30, 20, 5],
  [5, 20, 25, 30, 30, 30, 25, 20, 5],
  [0, 15, 20, 25, 25, 25, 20, 15, 0], // river
  [0, 10, 15, 20, 20, 20, 15, 10, 0],
  [-5, 5, 10, 15, 15, 15, 10, 5, -5],
  [-5, 0, 5, 10, 10, 10, 5, 0, -5],
  [-10, -5, 0, 5, 5, 5, 0, -5, -10],
  [-15, -10, -5, 0, 0, 0, -5, -10, -15],
];

const CANNON_PST: number[][] = [
  [5, 10, 15, 20, 25, 20, 15, 10, 5],
  [5, 10, 15, 20, 25, 20, 15, 10, 5],
  [0, 5, 10, 25, 35, 25, 10, 5, 0], // Great cannon post (central cannon)
  [0, 5, 10, 15, 25, 15, 10, 5, 0],
  [0, 5, 10, 15, 20, 15, 10, 5, 0], // river
  [0, 5, 10, 15, 20, 15, 10, 5, 0],
  [-5, 0, 5, 10, 15, 10, 5, 0, -5],
  [0, 5, 10, 15, 20, 15, 10, 5, 0], // home cannon row
  [-5, 0, 5, 5, 10, 5, 5, 0, -5],
  [-10, -5, 0, 5, 5, 5, 0, -5, -10],
];

const SOLDIER_RED_PST: number[][] = [
  [0, 20, 30, 50, 60, 50, 30, 20, 0], // Near palace
  [20, 30, 45, 65, 75, 65, 45, 30, 20],
  [20, 30, 40, 55, 65, 55, 40, 30, 20],
  [15, 25, 35, 50, 55, 50, 35, 25, 15],
  [10, 20, 30, 40, 45, 40, 30, 20, 10], // River crossed
  [0, 0, 10, 20, 25, 20, 10, 0, 0], // Home river bank
  [0, 0, 0, 5, 10, 5, 0, 0, 0], // Home row
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

function getPositionalBonus(piece: XiangqiPiece): number {
  const { type, color, x, y } = piece;
  // Normalize y so that index 0 is enemy baseline, index 9 is friendly home
  const normalizedY = color === 'RED' ? y : 9 - y;
  const clampedX = Math.max(0, Math.min(8, x));
  const clampedY = Math.max(0, Math.min(9, normalizedY));

  switch (type) {
    case 'CHARIOT':
      return CHARIOT_PST[clampedY][clampedX];
    case 'HORSE':
      return HORSE_PST[clampedY][clampedX];
    case 'CANNON':
      return CANNON_PST[clampedY][clampedX];
    case 'SOLDIER':
      return SOLDIER_RED_PST[clampedY][clampedX];
    case 'ADVISOR':
    case 'ELEPHANT':
    case 'GENERAL':
      return 10;
    default:
      return 0;
  }
}

// Static Board Evaluation from Red's perspective (+ means Red advantage, - means Black advantage)
export function evaluateXiangqiBoard(pieces: XiangqiPiece[]): number {
  let score = 0;

  for (const p of pieces) {
    const baseVal = PIECE_VALUES[p.type];
    const posBonus = getPositionalBonus(p);
    const totalVal = baseVal + posBonus;

    if (p.color === 'RED') {
      score += totalVal;
    } else {
      score -= totalVal;
    }
  }

  // Bonus/penalty for checks
  if (isSideInCheck('BLACK', pieces)) {
    score += 45;
  }
  if (isSideInCheck('RED', pieces)) {
    score -= 45;
  }

  return score;
}

// Simulate a move and return new pieces array
function applyMove(
  pieces: XiangqiPiece[],
  fromPiece: XiangqiPiece,
  to: { x: number; y: number }
): { newPieces: XiangqiPiece[]; captured?: XiangqiPiece } {
  let captured: XiangqiPiece | undefined = undefined;
  const newPieces = pieces
    .filter((p) => {
      if (p.x === to.x && p.y === to.y) {
        captured = p;
        return false;
      }
      return true;
    })
    .map((p) => {
      if (p.id === fromPiece.id) {
        return { ...p, x: to.x, y: to.y };
      }
      return p;
    });

  return { newPieces, captured };
}

interface CandidateMove {
  piece: XiangqiPiece;
  to: { x: number; y: number };
  capturedPiece?: XiangqiPiece;
  moveScoreEstimate: number;
}

// Generate all legal moves for a side, sorted by estimated aggressiveness (Captures first)
function generateAllSortedMoves(pieces: XiangqiPiece[], side: XiangqiSide): CandidateMove[] {
  const candidateMoves: CandidateMove[] = [];
  const myPieces = pieces.filter((p) => p.color === side);

  for (const piece of myPieces) {
    const legalTargets = getLegalMoves(piece, pieces);
    for (const to of legalTargets) {
      const enemyPiece = getPieceAt(pieces, to.x, to.y);
      let moveScoreEstimate = 0;

      if (enemyPiece) {
        // MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
        moveScoreEstimate = PIECE_VALUES[enemyPiece.type] * 10 - PIECE_VALUES[piece.type];
      }

      candidateMoves.push({
        piece,
        to,
        capturedPiece: enemyPiece,
        moveScoreEstimate,
      });
    }
  }

  // Sort descending by moveScoreEstimate (captures first)
  candidateMoves.sort((a, b) => b.moveScoreEstimate - a.moveScoreEstimate);
  return candidateMoves;
}

// Quiescence Search (tập trung đánh giá các nước ăn quân để tránh horizon effect)
function quiescenceSearch(
  pieces: XiangqiPiece[],
  alpha: number,
  beta: number,
  side: XiangqiSide,
  qDepth: number
): number {
  const standPat = side === 'RED' ? evaluateXiangqiBoard(pieces) : -evaluateXiangqiBoard(pieces);

  if (qDepth <= 0) {
    return standPat;
  }

  if (standPat >= beta) {
    return beta;
  }

  let currentAlpha = Math.max(alpha, standPat);

  // Only consider captures
  const allMoves = generateAllSortedMoves(pieces, side);
  const captureMoves = allMoves.filter((m) => !!m.capturedPiece);

  for (const move of captureMoves) {
    const { newPieces } = applyMove(pieces, move.piece, move.to);
    const enemySide: XiangqiSide = side === 'RED' ? 'BLACK' : 'RED';
    const score = -quiescenceSearch(newPieces, -beta, -currentAlpha, enemySide, qDepth - 1);

    if (score >= beta) {
      return beta;
    }
    if (score > currentAlpha) {
      currentAlpha = score;
    }
  }

  return currentAlpha;
}

// Alpha-Beta Minimax Search
function minimaxAlphaBeta(
  pieces: XiangqiPiece[],
  depth: number,
  alpha: number,
  beta: number,
  side: XiangqiSide
): number {
  if (depth === 0) {
    return quiescenceSearch(pieces, alpha, beta, side, 2);
  }

  const moves = generateAllSortedMoves(pieces, side);
  if (moves.length === 0) {
    // No legal moves left => Checkmate or Stalemate (Loss in Xiangqi)
    return -99999 + (3 - depth) * 10;
  }

  let bestVal = -Infinity;
  let currentAlpha = alpha;

  for (const move of moves) {
    const { newPieces } = applyMove(pieces, move.piece, move.to);
    const enemySide: XiangqiSide = side === 'RED' ? 'BLACK' : 'RED';

    const score = -minimaxAlphaBeta(newPieces, depth - 1, -beta, -currentAlpha, enemySide);

    if (score > bestVal) {
      bestVal = score;
    }
    currentAlpha = Math.max(currentAlpha, bestVal);

    if (currentAlpha >= beta) {
      break; // Alpha-beta pruning cutoff
    }
  }

  return bestVal;
}

/**
 * Find the best Xiangqi move for the active side using Sunfish Alpha-Beta Engine
 */
export function findBestXiangqiMove(
  pieces: XiangqiPiece[],
  side: XiangqiSide,
  searchDepth = 3
): XiangqiAiHint | null {
  const rootMoves = generateAllSortedMoves(pieces, side);
  if (rootMoves.length === 0) return null;

  let bestMove: CandidateMove | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of rootMoves) {
    const { newPieces } = applyMove(pieces, move.piece, move.to);
    const enemySide: XiangqiSide = side === 'RED' ? 'BLACK' : 'RED';

    const score = -minimaxAlphaBeta(newPieces, searchDepth - 1, -beta, -alpha, enemySide);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    if (score > alpha) {
      alpha = score;
    }
  }

  if (!bestMove) {
    bestMove = rootMoves[0];
  }

  const notation = generateMoveNotation(bestMove.piece, bestMove.to, bestMove.capturedPiece);

  return {
    from: { x: bestMove.piece.x, y: bestMove.piece.y },
    to: { x: bestMove.to.x, y: bestMove.to.y },
    piece: bestMove.piece,
    capturedPiece: bestMove.capturedPiece,
    notation,
    score: bestScore,
  };
}
