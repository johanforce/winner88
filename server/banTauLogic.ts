import {
  ShipDefinition,
  PlacedShip,
  ShipOrientation,
  ShotRecord,
} from './types';

export const BAN_TAU_BOARD_SIZE = 10;

export const BAN_TAU_SHIPS: ShipDefinition[] = [
  { id: 'carrier', name: 'Tàu Sân Bay', size: 5, color: '#38bdf8', icon: '🚢' },
  { id: 'battleship', name: 'Thiết Giáp Hạm', size: 4, color: '#818cf8', icon: '⚓' },
  { id: 'cruiser', name: 'Tàu Tuần Dương', size: 3, color: '#34d399', icon: '🛥️' },
  { id: 'submarine', name: 'Tàu Ngầm', size: 3, color: '#fbbf24', icon: '🌊' },
  { id: 'destroyer', name: 'Tàu Khu Trục', size: 2, color: '#f87171', icon: '🚤' },
];

export const TOTAL_SHIP_CELLS = 17;

export function isInsideBanTauBoard(x: number, y: number): boolean {
  return x >= 0 && x < BAN_TAU_BOARD_SIZE && y >= 0 && y < BAN_TAU_BOARD_SIZE;
}

export function calculateShipCells(
  originX: number,
  originY: number,
  size: number,
  orientation: ShipOrientation
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let i = 0; i < size; i++) {
    if (orientation === 'HORIZONTAL') {
      cells.push({ x: originX + i, y: originY });
    } else {
      cells.push({ x: originX, y: originY + i });
    }
  }
  return cells;
}

export function validateShipPlacement(
  shipId: string,
  originX: number,
  originY: number,
  orientation: ShipOrientation,
  existingShips: PlacedShip[]
): { valid: boolean; reason?: string; cells?: { x: number; y: number }[] } {
  const def = BAN_TAU_SHIPS.find((s) => s.id === shipId);
  if (!def) {
    return { valid: false, reason: 'Loại tàu không hợp lệ' };
  }

  const cells = calculateShipCells(originX, originY, def.size, orientation);

  // Check bounds
  for (const c of cells) {
    if (!isInsideBanTauBoard(c.x, c.y)) {
      return { valid: false, reason: 'Tàu nằm ngoài bàn hải chiến 10x10' };
    }
  }

  // Check collision with other existing ships (excluding same shipId if updating)
  const occupied = new Set<string>();
  for (const s of existingShips) {
    if (s.shipId === shipId) continue;
    for (const c of s.cells) {
      occupied.add(`${c.x},${c.y}`);
    }
  }

  for (const c of cells) {
    if (occupied.has(`${c.x},${c.y}`)) {
      return { valid: false, reason: 'Vị trí này đè lên tàu khác' };
    }
  }

  return { valid: true, cells };
}

export function validateFullFleet(ships: PlacedShip[]): { valid: boolean; reason?: string } {
  if (!Array.isArray(ships) || ships.length !== BAN_TAU_SHIPS.length) {
    return { valid: false, reason: 'Chưa đặt đủ 5 loại tàu chiến' };
  }

  const placedShipIds = new Set(ships.map((s) => s.shipId));
  for (const def of BAN_TAU_SHIPS) {
    if (!placedShipIds.has(def.id)) {
      return { valid: false, reason: `Thiếu ${def.name}` };
    }
  }

  const allCells = new Set<string>();
  for (const ship of ships) {
    const def = BAN_TAU_SHIPS.find((s) => s.id === ship.shipId);
    if (!def) return { valid: false, reason: 'Có tàu không hợp lệ' };
    if (ship.cells.length !== def.size) {
      return { valid: false, reason: `Kích thước của ${def.name} không đúng` };
    }
    for (const c of ship.cells) {
      if (!isInsideBanTauBoard(c.x, c.y)) {
        return { valid: false, reason: `${def.name} nằm ngoài bàn cờ` };
      }
      const key = `${c.x},${c.y}`;
      if (allCells.has(key)) {
        return { valid: false, reason: `Các tàu bị đè lên nhau tại ô (${c.x},${c.y})` };
      }
      allCells.add(key);
    }
  }

  if (allCells.size !== TOTAL_SHIP_CELLS) {
    return { valid: false, reason: 'Tổng số ô tàu không đủ 17 ô' };
  }

  return { valid: true };
}

/**
 * Tự động tạo đội hình 5 tàu ngẫu nhiên hợp lệ trên bàn 10x10
 */
export function generateRandomFleet(): PlacedShip[] {
  const placed: PlacedShip[] = [];

  for (const def of BAN_TAU_SHIPS) {
    let placedSuccess = false;
    let attempts = 0;

    while (!placedSuccess && attempts < 500) {
      attempts++;
      const orientation: ShipOrientation = Math.random() < 0.5 ? 'HORIZONTAL' : 'VERTICAL';
      const maxX = orientation === 'HORIZONTAL' ? BAN_TAU_BOARD_SIZE - def.size : BAN_TAU_BOARD_SIZE - 1;
      const maxY = orientation === 'VERTICAL' ? BAN_TAU_BOARD_SIZE - def.size : BAN_TAU_BOARD_SIZE - 1;

      const originX = Math.floor(Math.random() * (maxX + 1));
      const originY = Math.floor(Math.random() * (maxY + 1));

      const validation = validateShipPlacement(def.id, originX, originY, orientation, placed);
      if (validation.valid && validation.cells) {
        placed.push({
          shipId: def.id,
          name: def.name,
          size: def.size,
          originX,
          originY,
          orientation,
          cells: validation.cells,
          hits: 0,
          isSunk: false,
        });
        placedSuccess = true;
      }
    }
  }

  return placed;
}
