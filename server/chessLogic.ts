import { Chess, Square, PieceSymbol } from 'chess.js';
import { ChessState, ChessMoveRecord, ChessSide } from './types';

export const INITIAL_CHESS_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function createInitialChessState(
  whitePlayerId: string | null,
  blackPlayerId: string | null,
  spectatorIds: string[] = []
): ChessState {
  return {
    fen: INITIAL_CHESS_FEN,
    pgn: '',
    turn: 'WHITE',
    whitePlayerId,
    blackPlayerId,
    spectatorIds,
    whiteTimeRemaining: 600, // 10 phút tiêu chuẩn (600 giây)
    blackTimeRemaining: 600,
    initialTime: 600,
    lastMove: null,
    moveHistory: [],
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    winnerSide: null,
    winReason: undefined,
    drawOfferFrom: null,
    lastAiAnalysis: null,
  };
}

export function getLegalMovesForSquare(fen: string, square: string): string[] {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ square: square as Square, verbose: true });
    return moves.map((m) => m.to);
  } catch (err) {
    return [];
  }
}

export function executeChessMove(
  currentState: ChessState,
  from: string,
  to: string,
  promotion?: string
): {
  success: boolean;
  message?: string;
  newState?: ChessState;
  moveRecord?: ChessMoveRecord;
  triggerAiAnalysis?: boolean;
} {
  try {
    const chess = new Chess(currentState.fen);

    // Verify current turn matches side
    const currentChessTurn = chess.turn(); // 'w' or 'b'
    const expectedTurn: ChessSide = currentChessTurn === 'w' ? 'WHITE' : 'BLACK';

    if (expectedTurn !== currentState.turn) {
      return { success: false, message: 'Chưa tới lượt của bạn' };
    }

    // Attempt to make move in chess.js
    const moveResult = chess.move({
      from: from as Square,
      to: to as Square,
      promotion: (promotion || 'q') as PieceSymbol,
    });

    if (!moveResult) {
      return { success: false, message: 'Nước đi không hợp lệ theo luật cờ vua' };
    }

    const nextFen = chess.fen();
    const nextPgn = chess.pgn();
    const isCheck = chess.isCheck();
    const isCheckmate = chess.isCheckmate();
    const isStalemate = chess.isStalemate();
    const isThreefold = chess.isThreefoldRepetition();
    const isInsufficient = chess.isInsufficientMaterial();
    const isDraw = chess.isDraw();

    const moveIndex = currentState.moveHistory.length + 1;
    const moveNumber = Math.ceil(moveIndex / 2);

    const record: ChessMoveRecord = {
      moveNumber,
      turn: currentState.turn,
      from: moveResult.from,
      to: moveResult.to,
      piece: moveResult.piece,
      captured: moveResult.captured,
      promotion: moveResult.promotion,
      san: moveResult.san,
      fenAfter: nextFen,
      isCheck,
      isCheckmate,
      timestamp: Date.now(),
    };

    const newHistory = [...currentState.moveHistory, record];
    const nextTurn: ChessSide = chess.turn() === 'w' ? 'WHITE' : 'BLACK';

    let winnerSide: 'WHITE' | 'BLACK' | 'DRAW' | null = null;
    let winReason: ChessState['winReason'] = undefined;

    if (isCheckmate) {
      // Bên vừa đi đã chiếu bí đối phương -> bên vừa đi thắng
      winnerSide = currentState.turn;
      winReason = 'CHECKMATE';
    } else if (isStalemate) {
      winnerSide = 'DRAW';
      winReason = 'STALEMATE';
    } else if (isThreefold) {
      winnerSide = 'DRAW';
      winReason = 'THREEFOLD';
    } else if (isInsufficient) {
      winnerSide = 'DRAW';
      winReason = 'INSUFFICIENT_MATERIAL';
    } else if (isDraw) {
      winnerSide = 'DRAW';
      winReason = 'FIFTY_MOVES';
    }

    // Trigger Gemini analysis every 10 moves (e.g. at move 10, 20, 30...)
    const triggerAiAnalysis = newHistory.length > 0 && newHistory.length % 10 === 0;

    const newState: ChessState = {
      ...currentState,
      fen: nextFen,
      pgn: nextPgn,
      turn: nextTurn,
      lastMove: record,
      moveHistory: newHistory,
      isCheck,
      isCheckmate,
      isStalemate,
      isDraw: isDraw || isStalemate,
      winnerSide,
      winReason,
      drawOfferFrom: null, // Clear any pending draw offer on move
    };

    return {
      success: true,
      newState,
      moveRecord: record,
      triggerAiAnalysis,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Lỗi khi thực hiện nước đi' };
  }
}
