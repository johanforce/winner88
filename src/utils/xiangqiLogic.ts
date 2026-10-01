import { XiangqiPiece, XiangqiPieceType, XiangqiSide, XiangqiMove } from '../types';

export function createInitialXiangqiPieces(): XiangqiPiece[] {
  const pieces: XiangqiPiece[] = [];

  // BLACK PIECES (top, y = 0..3)
  pieces.push(
    { id: 'B_CH_0', type: 'CHARIOT', color: 'BLACK', x: 0, y: 0 },
    { id: 'B_HO_0', type: 'HORSE', color: 'BLACK', x: 1, y: 0 },
    { id: 'B_EL_0', type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
    { id: 'B_AD_0', type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
    { id: 'B_GE', type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
    { id: 'B_AD_1', type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
    { id: 'B_EL_1', type: 'ELEPHANT', color: 'BLACK', x: 6, y: 0 },
    { id: 'B_HO_1', type: 'HORSE', color: 'BLACK', x: 7, y: 0 },
    { id: 'B_CH_1', type: 'CHARIOT', color: 'BLACK', x: 8, y: 0 },

    // Cannons
    { id: 'B_CA_0', type: 'CANNON', color: 'BLACK', x: 1, y: 2 },
    { id: 'B_CA_1', type: 'CANNON', color: 'BLACK', x: 7, y: 2 },

    // Soldiers
    { id: 'B_SO_0', type: 'SOLDIER', color: 'BLACK', x: 0, y: 3 },
    { id: 'B_SO_1', type: 'SOLDIER', color: 'BLACK', x: 2, y: 3 },
    { id: 'B_SO_2', type: 'SOLDIER', color: 'BLACK', x: 4, y: 3 },
    { id: 'B_SO_3', type: 'SOLDIER', color: 'BLACK', x: 6, y: 3 },
    { id: 'B_SO_4', type: 'SOLDIER', color: 'BLACK', x: 8, y: 3 }
  );

  // RED PIECES (bottom, y = 6..9)
  pieces.push(
    // Soldiers
    { id: 'R_SO_0', type: 'SOLDIER', color: 'RED', x: 0, y: 6 },
    { id: 'R_SO_1', type: 'SOLDIER', color: 'RED', x: 2, y: 6 },
    { id: 'R_SO_2', type: 'SOLDIER', color: 'RED', x: 4, y: 6 },
    { id: 'R_SO_3', type: 'SOLDIER', color: 'RED', x: 6, y: 6 },
    { id: 'R_SO_4', type: 'SOLDIER', color: 'RED', x: 8, y: 6 },

    // Cannons
    { id: 'R_CA_0', type: 'CANNON', color: 'RED', x: 1, y: 7 },
    { id: 'R_CA_1', type: 'CANNON', color: 'RED', x: 7, y: 7 },

    // Baseline pieces
    { id: 'R_CH_0', type: 'CHARIOT', color: 'RED', x: 0, y: 9 },
    { id: 'R_HO_0', type: 'HORSE', color: 'RED', x: 1, y: 9 },
    { id: 'R_EL_0', type: 'ELEPHANT', color: 'RED', x: 2, y: 9 },
    { id: 'R_AD_0', type: 'ADVISOR', color: 'RED', x: 3, y: 9 },
    { id: 'R_GE', type: 'GENERAL', color: 'RED', x: 4, y: 9 },
    { id: 'R_AD_1', type: 'ADVISOR', color: 'RED', x: 5, y: 9 },
    { id: 'R_EL_1', type: 'ELEPHANT', color: 'RED', x: 6, y: 9 },
    { id: 'R_HO_1', type: 'HORSE', color: 'RED', x: 7, y: 9 },
    { id: 'R_CH_1', type: 'CHARIOT', color: 'RED', x: 8, y: 9 }
  );

  return pieces;
}

export function getPieceAt(pieces: XiangqiPiece[], x: number, y: number): XiangqiPiece | undefined {
  return pieces.find((p) => p.x === x && p.y === y);
}

export function isInsidePalace(x: number, y: number, color: XiangqiSide): boolean {
  if (x < 3 || x > 5) return false;
  if (color === 'BLACK') {
    return y >= 0 && y <= 2;
  } else {
    return y >= 7 && y <= 9;
  }
}

// Generate raw candidate moves for a piece (without check validation)
export function getRawMoves(
  piece: XiangqiPiece,
  pieces: XiangqiPiece[]
): { x: number; y: number }[] {
  const moves: { x: number; y: number }[] = [];
  const { x, y, color, type } = piece;

  const isFriendly = (targetX: number, targetY: number) => {
    const p = getPieceAt(pieces, targetX, targetY);
    return p && p.color === color;
  };

  const isInsideBoard = (tx: number, ty: number) => tx >= 0 && tx <= 8 && ty >= 0 && ty <= 9;

  switch (type) {
    case 'GENERAL': {
      const directions = [
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
      ];
      for (const d of directions) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (isInsidePalace(nx, ny, color) && !isFriendly(nx, ny)) {
          moves.push({ x: nx, y: ny });
        }
      }
      break;
    }

    case 'ADVISOR': {
      const directions = [
        { dx: 1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: -1, dy: -1 },
      ];
      for (const d of directions) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (isInsidePalace(nx, ny, color) && !isFriendly(nx, ny)) {
          moves.push({ x: nx, y: ny });
        }
      }
      break;
    }

    case 'ELEPHANT': {
      const directions = [
        { dx: 2, dy: 2, eyeX: x + 1, eyeY: y + 1 },
        { dx: 2, dy: -2, eyeX: x + 1, eyeY: y - 1 },
        { dx: -2, dy: 2, eyeX: x - 1, eyeY: y + 1 },
        { dx: -2, dy: -2, eyeX: x - 1, eyeY: y - 1 },
      ];
      for (const d of directions) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (!isInsideBoard(nx, ny)) continue;
        // Cannot cross river
        if (color === 'BLACK' && ny > 4) continue;
        if (color === 'RED' && ny < 5) continue;
        // Check eye of elephant (cản mắt tượng)
        if (getPieceAt(pieces, d.eyeX, d.eyeY)) continue;
        if (!isFriendly(nx, ny)) {
          moves.push({ x: nx, y: ny });
        }
      }
      break;
    }

    case 'HORSE': {
      const horseMoves = [
        // Horizontal jump 2, vertical 1
        { dx: 2, dy: 1, legX: x + 1, legY: y },
        { dx: 2, dy: -1, legX: x + 1, legY: y },
        { dx: -2, dy: 1, legX: x - 1, legY: y },
        { dx: -2, dy: -1, legX: x - 1, legY: y },
        // Vertical jump 2, horizontal 1
        { dx: 1, dy: 2, legX: x, legY: y + 1 },
        { dx: -1, dy: 2, legX: x, legY: y + 1 },
        { dx: 1, dy: -2, legX: x, legY: y - 1 },
        { dx: -1, dy: -2, legX: x, legY: y - 1 },
      ];
      for (const hm of horseMoves) {
        const nx = x + hm.dx;
        const ny = y + hm.dy;
        if (!isInsideBoard(nx, ny)) continue;
        // Check horse leg (cản chân mã)
        if (getPieceAt(pieces, hm.legX, hm.legY)) continue;
        if (!isFriendly(nx, ny)) {
          moves.push({ x: nx, y: ny });
        }
      }
      break;
    }

    case 'CHARIOT': {
      const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];
      for (const d of directions) {
        let step = 1;
        while (true) {
          const nx = x + d.dx * step;
          const ny = y + d.dy * step;
          if (!isInsideBoard(nx, ny)) break;
          const p = getPieceAt(pieces, nx, ny);
          if (!p) {
            moves.push({ x: nx, y: ny });
          } else {
            if (p.color !== color) {
              moves.push({ x: nx, y: ny }); // capture enemy
            }
            break; // stopped by piece
          }
          step++;
        }
      }
      break;
    }

    case 'CANNON': {
      const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];
      for (const d of directions) {
        let step = 1;
        let screenFound = false;
        while (true) {
          const nx = x + d.dx * step;
          const ny = y + d.dy * step;
          if (!isInsideBoard(nx, ny)) break;
          const p = getPieceAt(pieces, nx, ny);
          if (!screenFound) {
            if (!p) {
              moves.push({ x: nx, y: ny });
            } else {
              screenFound = true; // First piece is the screen (ngòi pháo)
            }
          } else {
            if (p) {
              if (p.color !== color) {
                moves.push({ x: nx, y: ny }); // Capture enemy over screen!
              }
              break; // Cannot jump over second piece
            }
          }
          step++;
        }
      }
      break;
    }

    case 'SOLDIER': {
      const isCrossedRiver = color === 'BLACK' ? y >= 5 : y <= 4;
      const forwardDy = color === 'BLACK' ? 1 : -1;
      // Always can move forward
      const forwardY = y + forwardDy;
      if (isInsideBoard(x, forwardY) && !isFriendly(x, forwardY)) {
        moves.push({ x, y: forwardY });
      }
      // Can move sideways after crossing river
      if (isCrossedRiver) {
        if (isInsideBoard(x - 1, y) && !isFriendly(x - 1, y)) {
          moves.push({ x: x - 1, y });
        }
        if (isInsideBoard(x + 1, y) && !isFriendly(x + 1, y)) {
          moves.push({ x: x + 1, y });
        }
      }
      break;
    }
  }

  return moves;
}

// Check if two generals are facing each other with no intervening pieces (Lộ mặt tướng)
export function areGeneralsFacingEachOther(pieces: XiangqiPiece[]): boolean {
  const redGen = pieces.find((p) => p.type === 'GENERAL' && p.color === 'RED');
  const blackGen = pieces.find((p) => p.type === 'GENERAL' && p.color === 'BLACK');

  if (!redGen || !blackGen) return false;
  if (redGen.x !== blackGen.x) return false;

  const minY = Math.min(redGen.y, blackGen.y);
  const maxY = Math.max(redGen.y, blackGen.y);

  for (let y = minY + 1; y < maxY; y++) {
    if (getPieceAt(pieces, redGen.x, y)) {
      return false; // Intervening piece found
    }
  }

  return true; // Flying generals face each other!
}

// Check if a specific side's General is attacked (In Check / Bị chiếu)
export function isSideInCheck(color: XiangqiSide, pieces: XiangqiPiece[]): boolean {
  // 1. Generals cannot face each other
  if (areGeneralsFacingEachOther(pieces)) {
    return true;
  }

  const myGen = pieces.find((p) => p.type === 'GENERAL' && p.color === color);
  if (!myGen) return true; // General missing means defeated

  const enemyColor: XiangqiSide = color === 'RED' ? 'BLACK' : 'RED';
  const enemyPieces = pieces.filter((p) => p.color === enemyColor);

  for (const ep of enemyPieces) {
    const rawMoves = getRawMoves(ep, pieces);
    if (rawMoves.some((m) => m.x === myGen.x && m.y === myGen.y)) {
      return true;
    }
  }

  return false;
}

// Get all legal moves for a piece (filters out moves that leave own general in check)
export function getLegalMoves(
  piece: XiangqiPiece,
  pieces: XiangqiPiece[]
): { x: number; y: number }[] {
  const rawMoves = getRawMoves(piece, pieces);
  const legalMoves: { x: number; y: number }[] = [];

  for (const m of rawMoves) {
    // Simulate move
    const simulatedPieces = pieces
      .filter((p) => !(p.x === m.x && p.y === m.y)) // Remove captured piece
      .map((p) => {
        if (p.id === piece.id) {
          return { ...p, x: m.x, y: m.y };
        }
        return p;
      });

    // Check if own side is in check after move
    if (!isSideInCheck(piece.color, simulatedPieces)) {
      legalMoves.push(m);
    }
  }

  return legalMoves;
}

// Check if a side has any legal moves left
export function hasAnyLegalMoves(color: XiangqiSide, pieces: XiangqiPiece[]): boolean {
  const myPieces = pieces.filter((p) => p.color === color);
  for (const p of myPieces) {
    const moves = getLegalMoves(p, pieces);
    if (moves.length > 0) return true;
  }
  return false;
}

// Translate piece type to Vietnamese name and Chinese character
export function getPieceNameVN(type: XiangqiPieceType, _color?: XiangqiSide): string {
  switch (type) {
    case 'GENERAL':
      return 'Tướng';
    case 'ADVISOR':
      return 'Sĩ';
    case 'ELEPHANT':
      return 'Tượng';
    case 'HORSE':
      return 'Mã';
    case 'CHARIOT':
      return 'Xe';
    case 'CANNON':
      return 'Pháo';
    case 'SOLDIER':
      return 'Tốt';
  }
}

export function getPieceCharacter(type: XiangqiPieceType, color: XiangqiSide): string {
  switch (type) {
    case 'GENERAL':
      return color === 'RED' ? '帥' : '將';
    case 'ADVISOR':
      return color === 'RED' ? '仕' : '士';
    case 'ELEPHANT':
      return color === 'RED' ? '相' : '象';
    case 'HORSE':
      return color === 'RED' ? '傌' : '馬';
    case 'CHARIOT':
      return color === 'RED' ? '俥' : '車';
    case 'CANNON':
      return color === 'RED' ? '炮' : '砲';
    case 'SOLDIER':
      return color === 'RED' ? '兵' : '卒';
  }
}

// Tính số lộ (1..9 từ phải sang trái theo góc nhìn của mỗi bên)
export function getPieceFileNumber(x: number, color: XiangqiSide): number {
  return color === 'RED' ? 9 - x : x + 1;
}

// Generate standard Vietnamese Xiangqi notation (Kỳ phổ Cờ Tướng chuẩn)
export function generateMoveNotation(
  piece: XiangqiPiece,
  to: { x: number; y: number },
  capturedPiece?: XiangqiPiece,
  allPieces?: XiangqiPiece[]
): string {
  const name = getPieceNameVN(piece.type, piece.color);
  const fromCol = getPieceFileNumber(piece.x, piece.color);
  const toCol = getPieceFileNumber(to.x, piece.color);

  // Kiểm tra nếu có >= 2 quân cùng loại, cùng màu nằm trên cùng 1 cột dọc (lộ)
  let prefixPos = '';
  if (allPieces) {
    const sameFilePieces = allPieces.filter(
      (p) => p.color === piece.color && p.type === piece.type && p.x === piece.x
    );
    if (sameFilePieces.length >= 2) {
      const sorted = [...sameFilePieces].sort((a, b) =>
        piece.color === 'RED' ? a.y - b.y : b.y - a.y
      );
      const idx = sorted.findIndex((p) => p.id === piece.id || (p.x === piece.x && p.y === piece.y));
      if (idx === 0) {
        prefixPos = ' trước';
      } else if (idx === sorted.length - 1) {
        prefixPos = ' sau';
      } else {
        prefixPos = ' giữa';
      }
    }
  }

  const isDiagonalPiece =
    piece.type === 'HORSE' || piece.type === 'ELEPHANT' || piece.type === 'ADVISOR';
  const dy = Math.abs(piece.y - to.y);

  let action = '';
  if (piece.y === to.y) {
    action = `bình ${toCol}`;
  } else {
    const isForward = piece.color === 'RED' ? to.y < piece.y : to.y > piece.y;
    const dirWord = isForward ? 'tiến' : 'thoái';
    // Quân đi chéo (Mã, Tượng, Sĩ): ghi lộ đích; Quân đi thẳng (Tướng, Xe, Pháo, Tốt): ghi số bước dọc
    const targetVal = isDiagonalPiece ? toCol : dy;
    action = `${dirWord} ${targetVal}`;
  }

  let text = `${name}${prefixPos} ${fromCol} ${action}`;
  if (capturedPiece) {
    text += ` (ăn ${getPieceNameVN(capturedPiece.type, capturedPiece.color)})`;
  }
  return text;
}

// Tạo mã hash duy nhất cho thế cờ hiện tại
export function getBoardPositionKey(pieces: XiangqiPiece[], turnSide: XiangqiSide): string {
  const piecesKey = pieces
    .map((p) => `${p.color[0]}${p.type.slice(0, 2)}${p.x}${p.y}`)
    .sort()
    .join('');
  return `${piecesKey}_${turnSide}`;
}

/**
 * Kiểm tra luật: 2 bên đi lại nước đi quá 3 lần liên tục là hòa
 * (Lặp lại thế cờ quá 3 lần liên tục hoặc lặp lại chu kỳ nước đi qua lại quá 3 lần liên tục)
 */
export function checkRepetitiveMovesDraw(
  moves: XiangqiMove[],
  positionHistory: string[]
): { isDraw: boolean; reason?: string } {
  // 1. Kiểm tra thế cờ lặp lại quá 3 lần (xuất hiện lần thứ 4 trở lên)
  if (positionHistory.length > 0) {
    const latestPos = positionHistory[positionHistory.length - 1];
    let occurrences = 0;
    for (const pos of positionHistory) {
      if (pos === latestPos) occurrences++;
    }
    if (occurrences >= 4) {
      return {
        isDraw: true,
        reason: 'Thế cờ đã lặp lại quá 3 lần liên tục (Hòa theo luật lặp thế cờ).',
      };
    }
  }

  // 2. Kiểm tra chuỗi nước đi lặp lại tuần hoàn qua lại giữa 2 bên (chu kỳ K = 2, 4, 6 nước)
  // Quá 3 lần liên tục = 4 chu kỳ lặp lại liên tiếp
  const candidatePeriods = [2, 4, 6];
  for (const K of candidatePeriods) {
    if (moves.length >= 4 * K) {
      let isRepeating = true;
      for (let i = 0; i < 3 * K; i++) {
        const curMove = moves[moves.length - 1 - i];
        const prevCycleMove = moves[moves.length - 1 - i - K];
        if (
          curMove.from.x !== prevCycleMove.from.x ||
          curMove.from.y !== prevCycleMove.from.y ||
          curMove.to.x !== prevCycleMove.to.x ||
          curMove.to.y !== prevCycleMove.to.y ||
          curMove.piece.type !== prevCycleMove.piece.type ||
          curMove.piece.color !== prevCycleMove.piece.color
        ) {
          isRepeating = false;
          break;
        }
      }
      if (isRepeating) {
        return {
          isDraw: true,
          reason: 'Hai bên đi lại nước đi lặp lại quá 3 lần liên tục.',
        };
      }
    }
  }

  return { isDraw: false };
}

/**
 * Tái hiện trạng thái bàn cờ tại một bước bất kỳ trong lịch sử nước đi
 * stepCount = 0: Bàn cờ ban đầu (trước nước đi đầu tiên)
 * stepCount = k (1..moveHistory.length): Bàn cờ sau khi đi nước thứ k (moveHistory[k - 1])
 */
export function reconstructBoardAtStep(
  moveHistory: XiangqiMove[],
  stepCount: number,
  initialPieces?: XiangqiPiece[]
): {
  pieces: XiangqiPiece[];
  turnSide: XiangqiSide;
  lastMove: XiangqiMove | null;
  isCheck: boolean;
} {
  let currentPieces: XiangqiPiece[] = initialPieces
    ? initialPieces.map((p) => ({ ...p }))
    : createInitialXiangqiPieces();
  let turnSide: XiangqiSide = 'RED';
  const clampedStep = Math.max(0, Math.min(moveHistory.length, stepCount));

  for (let i = 0; i < clampedStep; i++) {
    const mv = moveHistory[i];
    currentPieces = currentPieces
      .filter((p) => !(p.x === mv.to.x && p.y === mv.to.y))
      .map((p) => {
        if (p.x === mv.from.x && p.y === mv.from.y) {
          return { ...p, x: mv.to.x, y: mv.to.y };
        }
        return p;
      });
    turnSide = mv.piece.color === 'RED' ? 'BLACK' : 'RED';
  }

  const lastMove = clampedStep > 0 ? moveHistory[clampedStep - 1] : null;
  const isCheck = isSideInCheck(turnSide, currentPieces);

  return {
    pieces: currentPieces,
    turnSide,
    lastMove,
    isCheck,
  };
}

/**
 * Tái hiện mảng quân cờ sau nước đi tại chỉ số moveIndex (0..moveHistory.length - 1).
 * Nếu moveIndex < 0, trả về bàn cờ xuất phát 32 quân.
 */
export function reconstructBoardFromMoves(
  moveHistory: XiangqiMove[],
  moveIndex: number,
  initialPieces?: XiangqiPiece[]
): XiangqiPiece[] {
  return reconstructBoardAtStep(moveHistory, moveIndex + 1, initialPieces).pieces;
}

/**
 * Xuất danh sách nước đi thành chuỗi Kỳ Phổ chuẩn để sao chép & dán vào Simulator
 */
export function formatMoveHistoryToKyPho(moveHistory: XiangqiMove[]): string {
  if (!moveHistory || moveHistory.length === 0) return '';
  return moveHistory
    .map((m, idx) => {
      const sideLabel = m.piece.color === 'RED' ? 'Đỏ' : 'Đen';
      const checkSuffix = m.isCheck ? ' [Chiếu]' : '';
      return `${idx + 1}. ${sideLabel}: ${m.notation}${checkSuffix}`;
    })
    .join('\n');
}

function normalizeKyPhoMoveText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // bỏ "(ăn ...)"
    .replace(/\[[^\]]*\]/g, '') // bỏ "[Chiếu]"
    .replace(/⚡\s*chiếu/g, '')
    .replace(/chiếu\s*tướng/g, '')
    .replace(/chiếu/g, '')
    .replace(/ăn\s+(tướng|sĩ|sỹ|tượng|tịnh|mã|xe|pháo|tốt|binh)/g, '')
    .replace(/binh/g, 'tốt')
    .replace(/soái|suất/g, 'tướng')
    .replace(/tịnh/g, 'tượng')
    .replace(/sỹ/g, 'sĩ')
    .replace(/tấn/g, 'tiến')
    .replace(/thối|lùi/g, 'thoái')
    .replace(/sang/g, 'bình')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phân tích văn bản Kỳ Phổ được dán vào Simulator và tái hiện toàn bộ danh sách XiangqiMove + lịch sử bàn cờ
 */
export function parseKyPhoToMoveHistory(text: string): {
  success: boolean;
  moves: XiangqiMove[];
  boardHistory: XiangqiPiece[][];
  error?: string;
} {
  const cleanText = text.trim();
  if (!cleanText) {
    return {
      success: false,
      moves: [],
      boardHistory: [],
      error: 'Vui lòng dán nội dung kỳ phổ vào ô trống.',
    };
  }

  const rawLines = cleanText
    .split(/\r?\n|;|\|/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//') && !l.startsWith('==='));

  if (rawLines.length === 0) {
    return {
      success: false,
      moves: [],
      boardHistory: [],
      error: 'Không tìm thấy nước đi nào trong kỳ phổ.',
    };
  }

  let currentPieces = createInitialXiangqiPieces();
  let currentSide: XiangqiSide = 'RED';
  const parsedMoves: XiangqiMove[] = [];
  const boardHistory: XiangqiPiece[][] = [currentPieces.map((p) => ({ ...p }))];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    // Bỏ số thứ tự đầu dòng: "1.", "1)", "#1", "Nước 1:"
    line = line.replace(/^(?:nước\s*)?#?\d+\s*[\.\)\:\-]?\s*/i, '').trim();
    // Bỏ ký hiệu màu đầu dòng: "🔴", "⚫", "Đỏ:", "Đen:", "[Đỏ]", "[Đen]"
    let explicitSide: XiangqiSide | null = null;
    if (/^(?:🔴|\[?đỏ\]?\s*:?\s*)/i.test(line)) {
      explicitSide = 'RED';
      line = line.replace(/^(?:🔴|\s*\[?đỏ\]?\s*:?\s*)+/i, '').trim();
    } else if (/^(?:⚫|\[?đen\]?\s*:?\s*)/i.test(line)) {
      explicitSide = 'BLACK';
      line = line.replace(/^(?:⚫|\s*\[?đen\]?\s*:?\s*)+/i, '').trim();
    }

    if (!line) continue;

    const sideToMove: XiangqiSide = explicitSide || currentSide;
    const normalizedInput = normalizeKyPhoMoveText(line);

    const sidePieces = currentPieces.filter((p) => p.color === sideToMove);
    let matchedMove: {
      piece: XiangqiPiece;
      to: { x: number; y: number };
      capturedPiece?: XiangqiPiece;
      notation: string;
    } | null = null;

    // Tìm trong tất cả nước đi hợp lệ của sideToMove
    for (const piece of sidePieces) {
      const legalTargets = getLegalMoves(piece, currentPieces);
      for (const to of legalTargets) {
        const targetPiece = getPieceAt(currentPieces, to.x, to.y);
        const fullNotation = generateMoveNotation(piece, to, targetPiece, currentPieces);
        const simpleNotation = generateMoveNotation(piece, to, undefined, undefined);

        const normFull = normalizeKyPhoMoveText(fullNotation);
        const normSimple = normalizeKyPhoMoveText(simpleNotation);

        // Hỗ trợ cả định dạng cũ (x + 1) phòng trường hợp người dùng dán kỳ phổ cũ
        const legacyAction =
          piece.y === to.y
            ? `bình ${to.x + 1}`
            : (piece.color === 'RED' ? to.y < piece.y : to.y > piece.y)
            ? `tiến ${Math.abs(piece.y - to.y)}`
            : `thoái ${Math.abs(piece.y - to.y)}`;
        const normLegacy = normalizeKyPhoMoveText(
          `${getPieceNameVN(piece.type, piece.color)} ${piece.x + 1} ${legacyAction}`
        );

        if (
          normalizedInput === normFull ||
          normalizedInput === normSimple ||
          normalizedInput === normLegacy
        ) {
          matchedMove = {
            piece,
            to,
            capturedPiece: targetPiece,
            notation: fullNotation,
          };
          break;
        }
      }
      if (matchedMove) break;
    }

    if (!matchedMove) {
      return {
        success: parsedMoves.length > 0,
        moves: parsedMoves,
        boardHistory,
        error: `Không thể nhận diện hoặc nước đi không hợp lệ ở bước #${parsedMoves.length + 1}: "${rawLines[i]}"`,
      };
    }

    const from = { x: matchedMove.piece.x, y: matchedMove.piece.y };
    const to = matchedMove.to;
    const nextPieces = currentPieces
      .filter((p) => !(p.x === to.x && p.y === to.y))
      .map((p) => (p.id === matchedMove!.piece.id ? { ...p, x: to.x, y: to.y } : p));

    const nextSide: XiangqiSide = sideToMove === 'RED' ? 'BLACK' : 'RED';
    const isCheck = isSideInCheck(nextSide, nextPieces);

    const moveRecord: XiangqiMove = {
      from,
      to,
      piece: { ...matchedMove.piece, x: to.x, y: to.y },
      capturedPiece: matchedMove.capturedPiece,
      notation: matchedMove.notation,
      isCheck,
      timestamp: Date.now() + i,
    };

    parsedMoves.push(moveRecord);
    currentPieces = nextPieces;
    boardHistory.push(currentPieces.map((p) => ({ ...p })));
    currentSide = nextSide;
  }

  if (parsedMoves.length === 0) {
    return {
      success: false,
      moves: [],
      boardHistory: [],
      error: 'Không tìm thấy nước đi hợp lệ nào trong kỳ phổ.',
    };
  }

  return { success: true, moves: parsedMoves, boardHistory };
}



