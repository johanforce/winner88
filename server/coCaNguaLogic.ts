import { CaNguaColor, CaNguaHorse, CaNguaPlayerState, CoCaNguaState } from './types';

export const COLOR_ORDER: CaNguaColor[] = ['RED', 'BLUE', 'YELLOW', 'GREEN'];

export const COLOR_CONFIG: Record<
  CaNguaColor,
  { name: string; hex: string; bgClass: string; startPos: number; finishPos: number; barnEntrance: number }
> = {
  RED: { name: 'Đỏ', hex: '#ef4444', bgClass: 'bg-red-600', startPos: 0, finishPos: 54, barnEntrance: 54 },
  BLUE: { name: 'Xanh Dương', hex: '#3b82f6', bgClass: 'bg-blue-600', startPos: 14, finishPos: 12, barnEntrance: 12 },
  YELLOW: { name: 'Vàng', hex: '#eab308', bgClass: 'bg-amber-500', startPos: 28, finishPos: 26, barnEntrance: 26 },
  GREEN: { name: 'Xanh Lá', hex: '#22c55e', bgClass: 'bg-emerald-600', startPos: 42, finishPos: 40, barnEntrance: 40 },
};

export const TRACK_CELL_COUNT = 56;

// 4 ô chốt ngay dưới chân thang về đích của 4 màu cờ
export const APEX_CELLS = [12, 26, 40, 54] as const;

// Bản đồ góc bay 90 độ theo chiều kim đồng hồ giữa 4 ô chốt
export const NEXT_APEX_MAP: Record<number, number> = {
  12: 26,
  26: 40,
  40: 54,
  54: 12,
};

// Ô cuối cùng của vòng đua (ô chốt chân đích)
export const FINISH_TRACK_STEP = 54;

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
  } else if (horse.step >= 55 && horse.step <= 60) {
    horse.state = horse.step === 60 ? 'FINISHED' : 'IN_BARN';
    horse.trackPosition = -1;
    horse.barnStep = horse.step - 54; // Bậc thang 1..6
    horse.isFinished = horse.step === 60;
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

export function canHorseBayO(
  state: CoCaNguaState,
  color: CaNguaColor,
  horse: CaNguaHorse,
  dice: number
): boolean {
  if (dice !== 1) return false;
  if (horse.state !== 'ON_TRACK' || horse.trackPosition < 0) return false;
  if (!APEX_CELLS.includes(horse.trackPosition as (typeof APEX_CELLS)[number])) return false;

  const targetTrackPos = NEXT_APEX_MAP[horse.trackPosition];
  if (targetTrackPos === undefined) return false;

  const player = state.players.find((p) => p.color === color);
  if (!player) return false;

  // Không được bay nếu ô chốt đích đến đã có quân của phe mình
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

  // 1. Ngựa trong chuồng (step === -1): Cần 1 hoặc 6 để xuất chuồng
  if (horse.step === -1) {
    if (dice !== 1 && dice !== 6) return false;
    const ownHorseAtStart = player.horses.some((h) => h.id !== horse.id && h.step === 0);
    return !ownHorseAtStart;
  }

  // 2. Ngựa trên đường đua trước ô chốt đích (0 <= step < 54)
  if (horse.step >= 0 && horse.step < FINISH_TRACK_STEP) {
    // Kiểm tra tính năng Bay Ô 90 độ khi gieo được 1 nút tại ô chốt
    if (canHorseBayO(state, color, horse, dice)) {
      return true;
    }

    const nextStep = horse.step + dice;
    // QUY TẮC: Phải gieo đúng số nút để về ô cuối (54). Không được gieo vượt quá (> 54)!
    if (nextStep > FINISH_TRACK_STEP) {
      return false;
    }

    const ownHorseAtDest = player.horses.some((h) => h.id !== horse.id && h.step === nextStep);
    return !ownHorseAtDest;
  }

  // 3. Ngựa đang đứng tại ô chốt chân đích (step === 54): "Sau đó mới được gieo nút để về chuồng"
  if (horse.step === FINISH_TRACK_STEP) {
    // Có thể gieo xúc xắc (1..6) để vào thang chuồng bậc tương ứng (54 + dice)
    const targetBarnStep = 54 + dice;
    if (targetBarnStep <= 60) {
      const blockedInBarn = player.horses.some(
        (h) => h.id !== horse.id && h.step > 54 && h.step <= targetBarnStep
      );
      if (!blockedInBarn) return true;
    }

    // Nếu lối vào chuồng bị chặn hoặc muốn bay ô (gieo 1 tại ô chốt)
    if (canHorseBayO(state, color, horse, dice)) {
      return true;
    }

    return false;
  }

  // 4. Ngựa đang trong thang chuồng (55 <= step <= 60)
  if (horse.step >= 55 && horse.step <= 60) {
    const nextStep = horse.step + dice;
    if (nextStep > 60) return false; // Không được vượt quá đỉnh chuồng (bậc 6)
    const blocked = player.horses.some(
      (h) => h.id !== horse.id && h.step > horse.step && h.step <= nextStep
    );
    return !blocked;
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
      if (otherHorse.step >= 0 && otherHorse.step <= FINISH_TRACK_STEP) {
        const otherAbsPos = getAbsoluteTrackPos(otherPlayer.color, otherHorse.step);
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

  // 1. Xuất chuồng
  if (horse.step === -1) {
    horse.step = 0;
    updateHorseDerivedFields(horse);
    const destAbsolutePos = COLOR_CONFIG[color].startPos;
    kickedHorseInfo = checkAndKickOpponents(state, color, destAbsolutePos);
  }
  // 2. Ngựa trên đường đua trước ô chốt đích (0 <= step < 54)
  else if (horse.step >= 0 && horse.step < FINISH_TRACK_STEP) {
    if (canHorseBayO(state, color, horse, dice)) {
      // KÍCH HOẠT BAY Ô 90 ĐỘ
      isBayO = true;
      prevPos = horse.trackPosition;
      targetPos = NEXT_APEX_MAP[prevPos];
      horse.step = horse.step + 14; // Bay 90 độ = tiến 14 ô chốt
      updateHorseDerivedFields(horse);
      kickedHorseInfo = checkAndKickOpponents(state, color, targetPos);
    } else {
      // Di chuyển bình thường trên đường đua
      const nextStep = horse.step + dice;
      horse.step = nextStep;
      updateHorseDerivedFields(horse);
      const destAbsolutePos = horse.trackPosition;
      if (destAbsolutePos !== null && destAbsolutePos >= 0) {
        kickedHorseInfo = checkAndKickOpponents(state, color, destAbsolutePos);
      }
    }
  }
  // 3. Ngựa đang đứng tại ô chốt chân đích (step === 54): Về chuồng hoặc Bay Ô
  else if (horse.step === FINISH_TRACK_STEP) {
    const targetBarnStep = 54 + dice;
    const blockedInBarn = player.horses.some(
      (h) => h.id !== horse.id && h.step > 54 && h.step <= targetBarnStep
    );

    if (!blockedInBarn) {
      enteredBarn = true;
      horse.step = targetBarnStep;
      if (horse.step === 60) {
        horse.isFinished = true;
        finished = true;
      }
      updateHorseDerivedFields(horse);
    } else if (canHorseBayO(state, color, horse, dice)) {
      // Nếu lối vào chuồng bị chặn, có thể kích hoạt Bay Ô
      isBayO = true;
      prevPos = horse.trackPosition;
      targetPos = NEXT_APEX_MAP[prevPos];
      horse.step = 12; // Bắt đầu vòng tiếp theo
      updateHorseDerivedFields(horse);
      kickedHorseInfo = checkAndKickOpponents(state, color, targetPos);
    }
  }
  // 4. Ngựa đang trong thang chuồng (55 <= step < 60)
  else if (horse.step >= 55 && horse.step < 60) {
    const nextStep = horse.step + dice;
    horse.step = nextStep;
    if (horse.step === 60) {
      horse.isFinished = true;
      finished = true;
    }
    updateHorseDerivedFields(horse);
  }

  if (!kickedHorseInfo) {
    state.lastKickedHorse = null;
  }

  // Cập nhật mảng tổng hợp horses trên state
  state.horses = state.players.flatMap((p) => p.horses);

  // Kiểm tra điều kiện thắng
  const isWinner = player.horses.every((h) => h.isFinished || h.step >= 57);

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
    actionMessage = `${player.playerName} gieo 1 - 🚀 KÍCH HOẠT BAY Ô 90° (từ ô ${prevPos} ➔ ô ${targetPos})!`;
    if (kickedHorseInfo) {
      actionMessage += ` 💥 ĐÁ VĂNG NGỰA của ${kickedHorseInfo.playerName} về chuồng!`;
    } else {
      actionMessage += ` 🎲 Được thêm một lượt gieo xúc xắc!`;
    }
  } else if (kickedHorseInfo) {
    actionMessage = `${player.playerName} di chuyển ngựa #${horse.horseIndex + 1} (${dice} nút). 💥 ĐÁ VĂNG NGỰA của ${kickedHorseInfo.playerName} về chuồng! Được gieo tiếp.`;
  } else if (finished) {
    actionMessage = `${player.playerName} đưa ngựa #${horse.horseIndex + 1} lên đỉnh chuồng (Bậc 6) - 🏆 VỀ ĐÍCH THÀNH CÔNG!`;
  } else if (enteredBarn) {
    actionMessage = `${player.playerName} gieo ${dice} nút - Ngựa #${horse.horseIndex + 1} VÀO THANG CHUỒNG BẬC ${horse.barnStep}!`;
  } else if (horse.step === FINISH_TRACK_STEP) {
    actionMessage = `${player.playerName} di chuyển ngựa #${horse.horseIndex + 1} (${dice} nút) ĐÁP CHÍNH XÁC VÀO Ô CHỐT VỀ ĐÍCH #${horse.trackPosition}! Chuẩn bị lên chuồng.`;
  } else if (horse.step > 54) {
    actionMessage = `${player.playerName} đưa ngựa #${horse.horseIndex + 1} lên thang chuồng bậc ${horse.barnStep}!`;
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
