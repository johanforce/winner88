import { XiangqiPiece, XiangqiPieceType, XiangqiSide, XiangqiMove } from './types';

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

// Translate piece type to Vietnamese name
export function getPieceNameVN(type: XiangqiPieceType, color: XiangqiSide): string {
  switch (type) {
    case 'GENERAL':
      return color === 'RED' ? 'Tướng' : 'Tướng';
    case 'ADVISOR':
      return color === 'RED' ? 'Sĩ' : 'Sĩ';
    case 'ELEPHANT':
      return color === 'RED' ? 'Tượng' : 'Tượng';
    case 'HORSE':
      return 'Mã';
    case 'CHARIOT':
      return 'Xe';
    case 'CANNON':
      return 'Pháo';
    case 'SOLDIER':
      return color === 'RED' ? 'Binh' : 'Tốt';
  }
}

// Generate friendly Vietnamese notation for a move
export function generateMoveNotation(
  piece: XiangqiPiece,
  to: { x: number; y: number },
  capturedPiece?: XiangqiPiece
): string {
  const name = getPieceNameVN(piece.type, piece.color);
  const fromCoord = `${piece.x + 1}`;
  const toCoord = `${to.x + 1}`;
  
  let action = '';
  if (piece.y === to.y) {
    action = `bình ${toCoord}`;
  } else if (piece.color === 'RED') {
    action = to.y < piece.y ? `tiến ${Math.abs(piece.y - to.y)}` : `thoái ${Math.abs(piece.y - to.y)}`;
  } else {
    action = to.y > piece.y ? `tiến ${Math.abs(piece.y - to.y)}` : `thoái ${Math.abs(piece.y - to.y)}`;
  }

  let text = `${name} ${fromCoord} ${action}`;
  if (capturedPiece) {
    text += ` (ăn ${getPieceNameVN(capturedPiece.type, capturedPiece.color)})`;
  }
  return text;
}
