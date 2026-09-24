import { CaNguaColor, CaNguaHorse, CaNguaPlayerState, CoCaNguaState } from './types';

export const COLOR_ORDER: CaNguaColor[] = ['RED', 'BLUE', 'YELLOW', 'GREEN'];

export const COLOR_CONFIG: Record<
  CaNguaColor,
  { name: string; hex: string; bgClass: string; startPos: number; finishPos: number; barnEntrance: number }
> = {
  RED: { name: 'Đỏ', hex: '#ef4444', bgClass: 'bg-red-600', startPos: 55, finishPos: 54, barnEntrance: 54 },
  BLUE: { name: 'Xanh Dương', hex: '#3b82f6', bgClass: 'bg-blue-600', startPos: 13, finishPos: 12, barnEntrance: 12 },
  YELLOW: { name: 'Vàng', hex: '#eab308', bgClass: 'bg-amber-500', startPos: 27, finishPos: 26, barnEntrance: 26 },
  GREEN: { name: 'Xanh Lá', hex: '#22c55e', bgClass: 'bg-emerald-600', startPos: 41, finishPos: 40, barnEntrance: 40 },
};

export const TRACK_CELL_COUNT = 56;

// 4 ô cửa chuồng của 4 màu cờ
export const APEX_CELLS = [12, 26, 40, 54] as const;

// Bản đồ nhảy cóc theo chiều kim đồng hồ giữa các ô cửa chuồng
export const NEXT_APEX_MAP: Record<number, number> = {
  12: 26,
  26: 40,
  40: 54,
  54: 12,
};

// Ô cửa chuồng sau đúng 1 vòng quanh bàn cờ (55 bước từ ô xuất phát)
export const FINISH_TRACK_STEP = 55;

export function getAbsoluteTrackPos(color: CaNguaColor, relativeStep: number): number | null {
  if (relativeStep < 0 || relativeStep > FINISH_TRACK_STEP) return null;
  const start = COLOR_CONFIG[color].startPos;
  return (start + relativeStep) % TRACK_CELL_COUNT;
}

export function updateHorseDerivedFields(horse: CaNguaHorse): void {
  if (horse.step === -1) {
    horse.state = 'STABLE';
    horse.trackPosition = -1;
    horse.barnStep = -1;
    horse.isFinished = false;
  } else if (horse.step >= 0 && horse.step <= FINISH_TRACK_STEP) {
    horse.state = 'ON_TRACK';
    horse.trackPosition = getAbsoluteTrackPos(horse.color, horse.step) ?? -1;
    horse.barnStep = -1;
    horse.isFinished = false;
  } else if (horse.step >= 56 && horse.step <= 61) {
    horse.state = 'IN_BARN';
    horse.trackPosition = -1;
    horse.barnStep = horse.step - 55; // Bậc thang 1..6
    horse.isFinished = horse.barnStep === 6;
  }
}

export function initCoCaNguaState(
  seatedPlayers: { id: string; name: string; seatIndex: number; score: number }[],
  spectatorIds: string[]
): CoCaNguaState {
  const players: CaNguaPlayerState[] = seatedPlayers.map((p, idx) => {
    const color = COLOR_ORDER[p.seatIndex % 4] || COLOR_ORDER[idx % 4];
    const horses: CaNguaHorse[] = [
      { id: 0, horseIndex: 0, playerId: p.id, color, step: -1, state: 'STABLE', trackPosition: -1, barnStep: -1, isFinished: false },
      { id: 1, horseIndex: 1, playerId: p.id, color, step: -1, state: 'STABLE', trackPosition: -1, barnStep: -1, isFinished: false },
      { id: 2, horseIndex: 2, playerId: p.id, color, step: -1, state: 'STABLE', trackPosition: -1, barnStep: -1, isFinished: false },
      { id: 3, horseIndex: 3, playerId: p.id, color, step: -1, state: 'STABLE', trackPosition: -1, barnStep: -1, isFinished: false },
    ];
    horses.forEach(updateHorseDerivedFields);
    return {
      playerId: p.id,
      playerName: p.name,
      seatIndex: p.seatIndex,
      color,
      horses,
      score: p.score,
    };
  });

  const firstColor = players[0]?.color || 'RED';
  const firstPlayerId = players[0]?.playerId || '';
  const allHorses = players.flatMap((p) => p.horses);

  return {
    players,
    currentTurnColor: firstColor,
    currentTurnPlayerId: firstPlayerId,
    turnTimeRemaining: 30,
    phase: 'ROLLING',
    diceValue: null,
    lastDiceValue: null,
    diceRollHistory: [],
    isRolling: false,
    consecutiveSixes: 0,
    canRoll: true,
    canSelectHorse: false,
    movableHorseIds: [],
    spectatorIds,
    winnerColor: null,
    winnerPlayerId: null,
    ranks: [],
    lastActionText: 'Ván đấu Cờ Cá Ngựa bắt đầu! Đến lượt gieo xúc xắc.',
    lastActionMessage: 'Ván đấu Cờ Cá Ngựa bắt đầu! Đến lượt gieo xúc xắc.',
    lastKickedHorse: null,
    horses: allHorses,
  };
}

/**
 * Kiểm tra xem đường đi trên track có bị cờ đối phương chặn không.
 * Quy tắc người dùng: "Khi có quân cờ chặn đường thì trừ khi là cờ quân mình, còn lại sẽ ko được vượt"
 */
export function isTrackPathBlockedByOpponent(
  state: CoCaNguaState,
  color: CaNguaColor,
  currentStep: number,
  dice: number
): boolean {
  const startPos = COLOR_CONFIG[color].startPos;
  for (let s = 1; s < dice; s++) {
    const interTrackPos = (startPos + currentStep + s) % TRACK_CELL_COUNT;
    for (const player of state.players) {
      if (player.color === color) continue; // Trừ khi là cờ quân mình, được phép vượt
      for (const h of player.horses) {
        if (h.state === 'ON_TRACK' && h.trackPosition === interTrackPos) {
          return true; // Bị quân cờ đối phương chặn đường!
        }
      }
    }
  }
  return false;
}

/**
 * Nhảy cóc đến cửa chuồng tiếp theo:
 * Quy tắc: "Khi các quân đứng trên 1 ô cửa chuồng, nếu lắc ra 1 thì được phép nhảy cóc đến ô cửa chuồng tiếp (miễn không quá 1 vòng theo quy định là được)"
 */
export function canHorseJumpGate(
  state: CoCaNguaState,
  color: CaNguaColor,
  horse: CaNguaHorse,
  dice: number
): boolean {
  if (dice !== 1) return false;
  if (horse.state !== 'ON_TRACK' || horse.trackPosition < 0) return false;
  if (!APEX_CELLS.includes(horse.trackPosition as (typeof APEX_CELLS)[number])) return false;

  // Quy tắc: Miễn không quá 1 vòng theo quy định là được (step + 14 <= FINISH_TRACK_STEP = 55)
  if (horse.step + 14 > FINISH_TRACK_STEP) return false;

  const targetTrackPos = NEXT_APEX_MAP[horse.trackPosition];
  if (targetTrackPos === undefined) return false;

  const player = state.players.find((p) => p.color === color);
  if (!player) return false;

  // Không được nhảy nếu ô cửa chuồng tiếp theo đã có quân mình
  const ownHorseAtTarget = player.horses.some(
    (h) => h.id !== horse.id && h.state === 'ON_TRACK' && h.trackPosition === targetTrackPos
  );
  if (ownHorseAtTarget) return false;

  return true;
}

export function getValidMovesForHorse(
  state: CoCaNguaState,
  color: CaNguaColor,
  horseId: number,
  dice: number
): boolean {
  const player = state.players.find((p) => p.color === color);
  if (!player) return false;

  const horse = player.horses.find((h) => h.id === horseId);
  if (!horse || horse.isFinished) return false;

  // 1. Ngựa trong chuồng (step === -1): Cần 1 hoặc 6 để xuất chuồng vào ô xuất phát (13, 27, 41, 55)
  if (horse.step === -1) {
    if (dice !== 1 && dice !== 6) return false;
    const ownHorseAtStart = player.horses.some(
      (h) => h.id !== horse.id && h.state === 'ON_TRACK' && h.step === 0
    );
    return !ownHorseAtStart;
  }

  // 2. Ngựa trên đường đua trước ô cửa chuồng của mình (0 <= step < FINISH_TRACK_STEP = 55)
  if (horse.step >= 0 && horse.step < FINISH_TRACK_STEP) {
    // Ưu tiên kiểm tra nhảy cóc nếu đứng trên ô cửa chuồng và lắc ra 1
    if (canHorseJumpGate(state, color, horse, dice)) {
      return true;
    }

    const nextStep = horse.step + dice;
    // QUY TẮC: Quân cờ phải đi đúng 1 vòng quanh bàn cờ mới tới ô cửa chuồng cùng màu (nextStep <= 55)
    if (nextStep > FINISH_TRACK_STEP) {
      return false;
    }

    // QUY TẮC: Khi có quân cờ chặn đường thì trừ khi là cờ quân mình, còn lại sẽ ko được vượt
    if (isTrackPathBlockedByOpponent(state, color, horse.step, dice)) {
      return false;
    }

    // Ô đích đến không được là cờ quân mình
    const ownHorseAtDest = player.horses.some((h) => h.id !== horse.id && h.step === nextStep);
    return !ownHorseAtDest;
  }

  // 3. Ngựa đang đứng tại ô cửa chuồng của mình (step === FINISH_TRACK_STEP = 55):
  // "Dựa vào kết quả tung xúc xắc, bạn đưa quân vào các ô trong chuồng theo thứ tự tiến dần"
  if (horse.step === FINISH_TRACK_STEP) {
    const targetBarnSlot = dice;
    if (targetBarnSlot >= 1 && targetBarnSlot <= 6) {
      // Ô đích trong chuồng không được có quân cờ của mình
      const horseAtTargetSlot = player.horses.some(
        (h) => h.id !== horse.id && h.state === 'IN_BARN' && h.barnStep === targetBarnSlot
      );
      if (horseAtTargetSlot) return false;

      // Không được vượt qua quân cờ trong chuồng (các ô bậc < targetBarnSlot phải trống)
      const horseBlockingEntrance = player.horses.some(
        (h) => h.id !== horse.id && h.state === 'IN_BARN' && h.barnStep < targetBarnSlot
      );
      if (horseBlockingEntrance) return false;

      return true;
    }
    return false;
  }

  // 4. Ngựa đang trong thang chuồng (state === 'IN_BARN', barnStep >= 1 và < 6):
  // "ví dụ lắc được 3 thì sau đó phải lắc đk 4 thì mới được tiến lên ô chuồng 4"
  if (horse.state === 'IN_BARN' && horse.barnStep >= 1 && horse.barnStep < 6) {
    const nextBarnSlot = horse.barnStep + 1;
    // Phải lắc đúng số ô chuồng tiếp theo
    if (dice !== nextBarnSlot) return false;

    // Ô chuồng tiếp theo không được có quân cờ
    const horseAtNextSlot = player.horses.some(
      (h) => h.id !== horse.id && h.state === 'IN_BARN' && h.barnStep === nextBarnSlot
    );
    return !horseAtNextSlot;
  }

  return false;
}

export function computeMovableHorses(
  state: CoCaNguaState,
  color: CaNguaColor,
  dice: number
): number[] {
  const player = state.players.find((p) => p.color === color);
  if (!player) return [];

  const movable: number[] = [];
  for (const horse of player.horses) {
    if (getValidMovesForHorse(state, color, horse.id, dice)) {
      movable.push(horse.id);
    }
  }
  return movable;
}

export interface MoveResult {
  success: boolean;
  kickedHorse?: { playerName: string; color: CaNguaColor; horseId: number };
  enteredBarn?: boolean;
  isFinished?: boolean;
  extraTurn?: boolean;
  winnerPlayerId?: string | null;
  actionMessage?: string;
  message?: string;
}

function checkAndKickOpponents(
  state: CoCaNguaState,
  color: CaNguaColor,
  targetAbsolutePos: number
): MoveResult['kickedHorse'] {
  let kickedHorseInfo: MoveResult['kickedHorse'] = undefined;
  for (const otherPlayer of state.players) {
    if (otherPlayer.color === color) continue;
    for (const otherHorse of otherPlayer.horses) {
      if (otherHorse.state === 'ON_TRACK') {
        const otherAbsPos = otherHorse.trackPosition;
        if (otherAbsPos === targetAbsolutePos) {
          otherHorse.step = -1; // Bị đá văng về chuồng
          updateHorseDerivedFields(otherHorse);
          kickedHorseInfo = {
            playerName: otherPlayer.playerName,
            color: otherPlayer.color,
            horseId: otherHorse.id,
          };
          state.lastKickedHorse = {
            horseIndex: otherHorse.horseIndex,
            color: otherPlayer.color,
            trackPosition: targetAbsolutePos,
            kickerColor: color,
          };
        }
      }
    }
  }
  return kickedHorseInfo;
}

/**
 * Kiểm tra điều kiện thắng:
 * "có 4 quân thì phải xếp lần lượt 6,5,4,3 để dành chiến thắng"
 */
export function checkPlayerWon(player: CaNguaPlayerState): boolean {
  const barnSteps = player.horses
    .filter((h) => h.state === 'IN_BARN')
    .map((h) => h.barnStep);

  return (
    barnSteps.includes(6) &&
    barnSteps.includes(5) &&
    barnSteps.includes(4) &&
    barnSteps.includes(3)
  );
}

export function executeHorseMove(
  state: CoCaNguaState,
  color: CaNguaColor,
  horseId: number,
  dice: number
): MoveResult {
  const player = state.players.find((p) => p.color === color);
  if (!player) return { success: false, message: 'Không tìm thấy người chơi', actionMessage: 'Lỗi người chơi' };

  const horse = player.horses.find((h) => h.id === horseId);
  if (!horse || horse.isFinished) return { success: false, message: 'Ngựa không hợp lệ', actionMessage: 'Ngựa không hợp lệ' };

  if (!getValidMovesForHorse(state, color, horseId, dice)) {
    return { success: false, message: 'Nước đi không hợp lệ', actionMessage: 'Nước đi không hợp lệ' };
  }

  let kickedHorseInfo: MoveResult['kickedHorse'] = undefined;
  let enteredBarn = false;
  let finished = false;
  let isBayO = false;
  let prevPos = horse.trackPosition;
  let targetPos = -1;

  // 1. Xuất chuồng (step === -1)
  if (horse.step === -1) {
    horse.step = 0;
    updateHorseDerivedFields(horse);
    const destAbsolutePos = COLOR_CONFIG[color].startPos;
    kickedHorseInfo = checkAndKickOpponents(state, color, destAbsolutePos);
  }
  // 2. Ngựa trên đường đua (0 <= step < FINISH_TRACK_STEP = 55)
  else if (horse.step >= 0 && horse.step < FINISH_TRACK_STEP) {
    if (canHorseJumpGate(state, color, horse, dice)) {
      // NHẢY CÓC CỬA CHUỒNG (14 ô track)
      isBayO = true;
      prevPos = horse.trackPosition;
      targetPos = NEXT_APEX_MAP[prevPos];
      horse.step = horse.step + 14;
      updateHorseDerivedFields(horse);
      kickedHorseInfo = checkAndKickOpponents(state, color, targetPos);
    } else {
      // Di chuyển bình thường
      const nextStep = horse.step + dice;
      horse.step = nextStep;
      updateHorseDerivedFields(horse);
      const destAbsolutePos = horse.trackPosition;
      if (destAbsolutePos !== null && destAbsolutePos >= 0) {
        kickedHorseInfo = checkAndKickOpponents(state, color, destAbsolutePos);
      }
    }
  }
  // 3. Ngựa đang đứng tại ô cửa chuồng của mình (step === FINISH_TRACK_STEP = 55)
  else if (horse.step === FINISH_TRACK_STEP) {
    const targetBarnSlot = dice;
    enteredBarn = true;
    horse.step = 55 + targetBarnSlot;
    updateHorseDerivedFields(horse);
  }
  // 4. Ngựa đang trong thang chuồng (state === 'IN_BARN')
  else if (horse.state === 'IN_BARN') {
    horse.step = horse.step + 1; // Tiến lên bậc tiếp theo
    updateHorseDerivedFields(horse);
  }

  if (!kickedHorseInfo) {
    state.lastKickedHorse = null;
  }

  // Cập nhật mảng tổng hợp horses trên state
  state.horses = state.players.flatMap((p) => p.horses);

  // Kiểm tra điều kiện thắng: 4 quân xếp lần lượt 6, 5, 4, 3
  const isWinner = checkPlayerWon(player);

  if (isWinner && !state.winnerColor) {
    state.winnerColor = color;
    state.winnerPlayerId = player.playerId;
    state.ranks.push({
      playerId: player.playerId,
      color,
      rank: state.ranks.length + 1,
    });
  }

  // Thêm lượt khi gieo 6, gieo 1 hoặc đá được ngựa đối phương
  const extraTurn = dice === 6 || dice === 1 || !!kickedHorseInfo;

  let actionMessage = '';
  if (isBayO) {
    actionMessage = `${player.playerName} lắc ra 1 - 🐸 NHẢY CÓC CỬA CHUỒNG (từ ô ${prevPos} ➔ ô ${targetPos})!`;
    if (kickedHorseInfo) {
      actionMessage += ` 💥 ĐÁ VĂNG NGỰA của ${kickedHorseInfo.playerName} về chuồng!`;
    } else {
      actionMessage += ` 🎲 Được thêm một lượt gieo xúc xắc!`;
    }
  } else if (kickedHorseInfo) {
    actionMessage = `${player.playerName} di chuyển ngựa #${horse.horseIndex + 1} (${dice} nút). 💥 ĐÁ VĂNG NGỰA của ${kickedHorseInfo.playerName} về chuồng! Được gieo tiếp.`;
  } else if (isWinner) {
    actionMessage = `🏆 ${player.playerName} ĐÃ XẾP ĐỦ 4 QUÂN VÀO CHUỒNG 6, 5, 4, 3 VÀ GIÀNH CHIẾN THẮNG TUYỆT ĐỐI!`;
  } else if (enteredBarn) {
    actionMessage = `${player.playerName} gieo ${dice} nút - Ngựa #${horse.horseIndex + 1} VÀO CHUỒNG Ô ${horse.barnStep}!`;
  } else if (horse.state === 'IN_BARN') {
    actionMessage = `${player.playerName} gieo ${dice} nút - Ngựa #${horse.horseIndex + 1} TIẾN LÊN Ô CHUỒNG ${horse.barnStep}!`;
  } else if (horse.step === FINISH_TRACK_STEP) {
    actionMessage = `${player.playerName} đưa ngựa #${horse.horseIndex + 1} ĐẾN Ô CỬA CHUỒNG (ô ${horse.trackPosition})! Đã hoàn thành 1 vòng.`;
  } else {
    actionMessage = `${player.playerName} di chuyển ngựa #${horse.horseIndex + 1} (${dice} nút).`;
    if (extraTurn) {
      actionMessage += ` 🎲 Được thêm một lượt gieo xúc xắc!`;
    }
  }

  return {
    success: true,
    kickedHorse: kickedHorseInfo,
    enteredBarn,
    isFinished: finished,
    extraTurn,
    winnerPlayerId: state.winnerPlayerId,
    actionMessage,
  };
}

export function getNextPlayerTurn(state: CoCaNguaState): {
  nextColor: CaNguaColor;
  nextPlayerId: string;
} {
  const currentIndex = state.players.findIndex((p) => p.color === state.currentTurnColor);
  const nextIndex = (currentIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextIndex];
  return {
    nextColor: nextPlayer.color,
    nextPlayerId: nextPlayer.playerId,
  };
}
