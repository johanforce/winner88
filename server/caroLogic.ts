import { CaroPiece, CaroMove } from './types';

export const CARO_BOARD_SIZE = 20;

export function createEmptyCaroBoard(): (CaroPiece | null)[][] {
  const board: (CaroPiece | null)[][] = [];
  for (let y = 0; y < CARO_BOARD_SIZE; y++) {
    const row: (CaroPiece | null)[] = [];
    for (let x = 0; x < CARO_BOARD_SIZE; x++) {
      row.push(null);
    }
    board.push(row);
  }
  return board;
}

export function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < CARO_BOARD_SIZE && y >= 0 && y < CARO_BOARD_SIZE;
}

/**
 * Kiểm tra ô có thể đánh được không:
 * Bàn cờ 20x20 nhưng KHÔNG ĐƯỢC ĐÁNH VÀO VIỀN NGOÀI (x=0, x=19, y=0, y=19)
 */
export function isPlayableCaroCell(x: number, y: number): boolean {
  return x > 0 && x < CARO_BOARD_SIZE - 1 && y > 0 && y < CARO_BOARD_SIZE - 1;
}

/**
 * Kiểm tra chiến thắng theo luật: "Ăn 5 chặn 2 đầu vẫn win".
 * Tức là bất kỳ chuỗi liên tiếp nào từ 5 quân cùng loại trở lên
 * theo hàng ngang, hàng dọc, hoặc 2 đường chéo đều dẫn tới chiến thắng ngay.
 */
export function checkCaroWin(
  board: (CaroPiece | null)[][],
  lastX: number,
  lastY: number,
  piece: CaroPiece
): { isWin: boolean; winningLine?: { x: number; y: number }[] } {
  const directions = [
    { dx: 1, dy: 0 },  // Hàng ngang
    { dx: 0, dy: 1 },  // Hàng dọc
    { dx: 1, dy: 1 },  // Chéo chính (\)
    { dx: 1, dy: -1 }, // Chéo phụ (/)
  ];

  for (const { dx, dy } of directions) {
    const line: { x: number; y: number }[] = [{ x: lastX, y: lastY }];

    // Quét theo chiều tiến (positive)
    let step = 1;
    while (true) {
      const nx = lastX + step * dx;
      const ny = lastY + step * dy;
      if (!isInsideBoard(nx, ny) || board[ny][nx] !== piece) {
        break;
      }
      line.push({ x: nx, y: ny });
      step++;
    }

    // Quét theo chiều lùi (negative)
    step = 1;
    while (true) {
      const nx = lastX - step * dx;
      const ny = lastY - step * dy;
      if (!isInsideBoard(nx, ny) || board[ny][nx] !== piece) {
        break;
      }
      line.unshift({ x: nx, y: ny });
      step++;
    }

    // Luật cờ Caro: Ăn 5 (kể cả bị chặn 2 đầu) là THẮNG
    if (line.length >= 5) {
      return {
        isWin: true,
        winningLine: line,
      };
    }
  }

  return { isWin: false };
}

/**
 * Kiểm tra các ô chơi hợp lệ trên bàn cờ đã đầy chưa (trừ viền ngoài)
 */
export function isCaroBoardFull(board: (CaroPiece | null)[][]): boolean {
  for (let y = 1; y < CARO_BOARD_SIZE - 1; y++) {
    for (let x = 1; x < CARO_BOARD_SIZE - 1; x++) {
      if (board[y][x] === null) {
        return false;
      }
    }
  }
  return true;
}
