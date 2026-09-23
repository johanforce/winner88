import assert from 'node:assert/strict';
import {
  initCoCaNguaState,
  getValidMovesForHorse,
  computeMovableHorses,
  executeHorseMove,
  getNextPlayerTurn,
  getAbsoluteTrackPos,
  COLOR_CONFIG,
  TRACK_CELL_COUNT,
} from '../server/coCaNguaLogic';
import { GameRoom } from '../server/gameRoom';
import { CaNguaColor } from '../server/types';

console.log('🧪 BẮT ĐẦU CHẠY BỘ UNIT TEST & KỊCH BẢN 1 LƯỢT GAME CỜ CÁ NGỰA...\n');

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (error: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${error.message}`);
    throw error;
  }
}

// -------------------------------------------------------------
// 1. KIỂM TRA KHỞI TẠO BÀN CỜ VÀ NGƯỜI CHƠI
// -------------------------------------------------------------
test('1. Khởi tạo ván cờ với 4 người chơi & 16 quân cờ trong chuồng', () => {
  const players = [
    { id: 'p1', name: 'Đỏ Player', seatIndex: 0, score: 100 },
    { id: 'p2', name: 'Xanh Player', seatIndex: 1, score: 100 },
    { id: 'p3', name: 'Vàng Player', seatIndex: 2, score: 100 },
    { id: 'p4', name: 'Lục Player', seatIndex: 3, score: 100 },
  ];
  const state = initCoCaNguaState(players, []);

  assert.equal(state.players.length, 4, 'Phải có 4 người chơi');
  assert.equal(state.currentTurnColor, 'RED', 'Lượt đầu tiên phải là màu ĐỎ');
  assert.equal(state.currentTurnPlayerId, 'p1', 'Player đầu tiên là p1');
  assert.equal(state.phase, 'ROLLING', 'Giai đoạn ban đầu là gieo xúc xắc');
  assert.equal(state.horses.length, 16, 'Tổng cộng có 16 quân ngựa');

  // Tất cả 16 quân ngựa phải ở trạng thái STABLE (trong chuồng)
  for (const horse of state.horses) {
    assert.equal(horse.step, -1, 'Ngựa mới tạo phải có step = -1');
    assert.equal(horse.state, 'STABLE', 'Trạng thái ngựa mới phải là STABLE');
    assert.equal(horse.trackPosition, -1, 'Tọa độ đường đua phải là -1');
    assert.equal(horse.barnStep, -1, 'Bậc chuồng phải là -1');
    assert.equal(horse.isFinished, false, 'Chưa về đích');
  }
  assert.equal(state.lastKickedHorse, null, 'Không có ngựa nào bị đá khi bắt đầu');
});

// -------------------------------------------------------------
// 2. KIỂM TRA ĐIỀU KIỆN RA QUÂN (XUẤT CHUỒNG)
// -------------------------------------------------------------
test('2. Quy tắc xuất chuồng: Chỉ được ra quân khi gieo 1 hoặc 6', () => {
  const players = [{ id: 'p1', name: 'Đỏ Player', seatIndex: 0, score: 100 }];
  const state = initCoCaNguaState(players, []);

  // Gieo 2, 3, 4, 5: không được ra quân
  for (const invalidDice of [2, 3, 4, 5]) {
    const movable = computeMovableHorses(state, 'RED', invalidDice);
    assert.equal(movable.length, 0, `Gieo ${invalidDice} nút không thể xuất chuồng`);
  }

  // Gieo 1 hoặc 6: được phép xuất chuồng
  for (const validDice of [1, 6]) {
    const movable = computeMovableHorses(state, 'RED', validDice);
    assert.equal(movable.length, 4, `Gieo ${validDice} nút: cả 4 ngựa trong chuồng đều hợp lệ để chọn`);
  }
});

// -------------------------------------------------------------
// 3. KIỂM TRA DI CHUYỂN BÌNH THƯỜNG (KHÔNG HIỂN THỊ TEXT ĐÁ NGỰA)
// -------------------------------------------------------------
test('3. Di chuyển bình thường: KHÔNG hiển thị text đá ngựa, lastKickedHorse phải là null', () => {
  const players = [
    { id: 'p1', name: 'Đỏ Player', seatIndex: 0, score: 100 },
    { id: 'p2', name: 'Xanh Player', seatIndex: 1, score: 100 },
  ];
  const state = initCoCaNguaState(players, []);

  // Bước 3.1: Xuất chuồng với xúc xắc 6
  const deployRes = executeHorseMove(state, 'RED', 0, 6);
  assert.equal(deployRes.success, true, 'Xuất chuồng thành công');
  assert.equal(deployRes.extraTurn, true, 'Gieo 6 được thêm lượt');
  assert.equal(deployRes.kickedHorse, undefined, 'Xuất chuồng không đá ai');
  assert.equal(state.lastKickedHorse, null, 'lastKickedHorse phải là null khi xuất chuồng');

  const redHorse0 = state.players[0].horses[0];
  assert.equal(redHorse0.step, 0, 'Ngựa #1 đã ở ô xuất phát (step = 0)');
  assert.equal(redHorse0.trackPosition, 0, 'Tọa độ đường đua RED bắt đầu là 0');
  assert.equal(redHorse0.state, 'ON_TRACK', 'Trạng thái ON_TRACK');

  // Bước 3.2: Di chuyển tiếp với xúc xắc 4
  const moveRes = executeHorseMove(state, 'RED', 0, 4);
  assert.equal(moveRes.success, true, 'Di chuyển 4 bước thành công');
  assert.equal(moveRes.kickedHorse, undefined, 'Di chuyển bình thường không đá ai');
  assert.equal(state.lastKickedHorse, null, 'lastKickedHorse TUYỆT ĐỐI là null khi di chuyển bình thường');
  assert.equal(redHorse0.step, 4, 'Ngựa #1 tiến lên ô step = 4');
  assert.equal(redHorse0.trackPosition, 4, 'Vị trí đường đua là 4');
  assert.ok(!moveRes.actionMessage?.includes('Đá'), 'Thông báo di chuyển bình thường không chứa từ Đá');
});

// -------------------------------------------------------------
// 4. KIỂM TRA TÌNH HUỐNG ĐÁ NGỰA ĐỐI PHƯƠNG
// -------------------------------------------------------------
test('4. Đá văng ngựa đối phương: Đúng ô đối thủ -> đối thủ về chuồng, lastKickedHorse ghi nhận chính xác', () => {
  const players = [
    { id: 'p1', name: 'Đỏ Player', seatIndex: 0, score: 100 },
    { id: 'p2', name: 'Xanh Player', seatIndex: 1, score: 100 },
  ];
  const state = initCoCaNguaState(players, []);

  // Thiết lập: Đặt ngựa BLUE #0 tại ô xuất phát của BLUE (trackPosition = 14)
  const blueHorse = state.players[1].horses[0];
  blueHorse.step = 0; // step 0 của BLUE là trackPosition = 14
  blueHorse.state = 'ON_TRACK';
  blueHorse.trackPosition = COLOR_CONFIG.BLUE.startPos; // 14

  // Đặt ngựa RED #0 tại ô 10 (relativeStep 10 của RED = trackPosition 10)
  const redHorse = state.players[0].horses[0];
  redHorse.step = 10;
  redHorse.state = 'ON_TRACK';
  redHorse.trackPosition = 10;

  // Cập nhật mảng đồng bộ
  state.horses = state.players.flatMap((p) => p.horses);

  // RED gieo được 4 nút -> nhảy từ ô 10 đến ô 14 (trùng vị trí ngựa BLUE)
  const kickRes = executeHorseMove(state, 'RED', 0, 4);

  assert.equal(kickRes.success, true, 'Nước đi hợp lệ');
  assert.ok(kickRes.kickedHorse, 'Có đối thủ bị đá');
  assert.equal(kickRes.kickedHorse?.color, 'BLUE', 'Ngựa bị đá là màu Xanh Dương');
  assert.equal(kickRes.kickedHorse?.horseId, blueHorse.id, 'Đúng horseId bị đá');
  assert.equal(kickRes.extraTurn, true, 'Đá ngựa đối phương được thưởng thêm lượt');

  // Kiểm tra trạng thái ngựa BLUE đã bị đá văng về chuồng
  assert.equal(blueHorse.step, -1, 'Ngựa BLUE bị đưa về chuồng (step = -1)');
  assert.equal(blueHorse.state, 'STABLE', 'Trạng thái ngựa BLUE là STABLE');
  assert.equal(blueHorse.trackPosition, -1, 'Tọa độ đường đua của BLUE trở về -1');

  // Kiểm tra state.lastKickedHorse để client hiển thị animation đúng vị trí
  assert.ok(state.lastKickedHorse, 'state.lastKickedHorse phải tồn tại');
  assert.equal(state.lastKickedHorse?.color, 'BLUE');
  assert.equal(state.lastKickedHorse?.trackPosition, 14, 'Vị trí va chạm là ô 14');
  assert.equal(state.lastKickedHorse?.kickerColor, 'RED');

  // Kiểm tra thông điệp
  assert.ok(kickRes.actionMessage?.match(/đá.*ngựa/i), 'Thông điệp có chứa thông báo Đá ngựa');
});

// -------------------------------------------------------------
// 5. KIỂM TRA VÀO CHUỒNG VÀ THANG BẬC (BARN ESCALATION)
// -------------------------------------------------------------
test('5. Thang chuồng: Vào chuồng theo bậc 1 đến 6 và không được vượt quá đỉnh', () => {
  const players = [{ id: 'p1', name: 'Đỏ Player', seatIndex: 0, score: 100 }];
  const state = initCoCaNguaState(players, []);

  const horse = state.players[0].horses[0];
  // Cho ngựa chạy đến ô chốt chân đích (step = 54)
  horse.step = 54;
  horse.state = 'ON_TRACK';
  horse.trackPosition = getAbsoluteTrackPos('RED', 54) ?? -1;
  assert.equal(horse.trackPosition, 54, 'Ô chốt đích của Đỏ là 54');

  // Gieo 1 nút -> bước vào thang chuồng bậc 1 (step = 55, barnStep = 1)
  const enterBarnRes = executeHorseMove(state, 'RED', 0, 1);
  assert.equal(enterBarnRes.success, true);
  assert.equal(enterBarnRes.enteredBarn, true);
  assert.equal(horse.step, 55);
  assert.equal(horse.state, 'IN_BARN');
  assert.equal(horse.barnStep, 1, 'Bậc thang chuồng số 1');

  // Tiếp tục tiến lên bậc 6 (đỉnh chuồng): cần 5 bước (55 + 5 = 60)
  const topBarnRes = executeHorseMove(state, 'RED', 0, 5);
  assert.equal(topBarnRes.success, true);
  assert.equal(horse.step, 60);
  assert.equal(horse.barnStep, 6, 'Bậc thang chuồng số 6 (đỉnh)');
  assert.equal(horse.isFinished, true, 'Ngựa đã về đích đỉnh chuồng');
  assert.equal(horse.state, 'FINISHED');

  // Kiểm tra không được di chuyển vượt quá bậc 6
  const overshoot = getValidMovesForHorse(state, 'RED', 0, 1);
  assert.equal(overshoot, false, 'Ngựa đã về đích không được di chuyển tiếp');
});

// -------------------------------------------------------------
// 7. KIỂM TRA QUY TẮC VỀ ĐÍCH: PHẢI GIEO ĐÚNG SỐ NÚT ĐỂ VỀ Ô CHỐT 54
// -------------------------------------------------------------
test('7. Quy tắc Về Đích: Phải gieo đúng số nút để về ô cuối (54), không được vượt quá để vào chuồng trước', () => {
  const players = [{ id: 'p1', name: 'Đỏ Player', seatIndex: 0, score: 100 }];
  const state = initCoCaNguaState(players, []);

  const horse = state.players[0].horses[0];

  // Trường hợp 1: Ngựa đang ở step 52 (cách ô chốt 54 là 2 bước)
  horse.step = 52;
  horse.state = 'ON_TRACK';
  horse.trackPosition = getAbsoluteTrackPos('RED', 52) ?? -1;

  // Gieo 1 nút: hợp lệ (tiến đến 53)
  assert.equal(getValidMovesForHorse(state, 'RED', 0, 1), true, 'Gieo 1 tiến đến 53');
  // Gieo 2 nút: hợp lệ (đáp đúng ô chốt 54)
  assert.equal(getValidMovesForHorse(state, 'RED', 0, 2), true, 'Gieo 2 đáp đúng ô chốt 54');
  // Gieo 3, 4, 5, 6 nút: KHÔNG HỢP LỆ (vượt quá 54, không được nhảy vào chuồng trước khi đến 54)
  for (const dice of [3, 4, 5, 6]) {
    assert.equal(
      getValidMovesForHorse(state, 'RED', 0, dice),
      false,
      `Gieo ${dice} vượt quá ô chốt 54 nên không hợp lệ`
    );
  }

  // Trường hợp 2: Ngựa đang ở step 53 (cách ô chốt 54 đúng 1 bước)
  horse.step = 53;
  horse.trackPosition = getAbsoluteTrackPos('RED', 53) ?? -1;

  // Chỉ gieo 1 mới được đi (đáp trúng 54)
  assert.equal(getValidMovesForHorse(state, 'RED', 0, 1), true, 'Gieo 1 đáp đúng ô 54');
  for (const dice of [2, 3, 4, 5, 6]) {
    assert.equal(
      getValidMovesForHorse(state, 'RED', 0, dice),
      false,
      `Gieo ${dice} quá số nút cần thiết`
    );
  }

  // Thực hiện di chuyển với dice = 1 để vào ô 54
  const res = executeHorseMove(state, 'RED', 0, 1);
  assert.equal(res.success, true);
  assert.equal(horse.step, 54, 'Ngựa đã đáp đúng vào ô 54');
  assert.equal(horse.trackPosition, 54);
  assert.ok(res.actionMessage?.includes('ĐÁP CHÍNH XÁC VÀO Ô CHỐT VỀ ĐÍCH'));
});

// -------------------------------------------------------------
// 8. KIỂM TRA QUY TẮC BAY Ô 90 ĐỘ TẠI CÁC Ô CHỐT (12 -> 26 -> 40 -> 54)
// -------------------------------------------------------------
test('8. Quy tắc Bay Ô 90 độ: Đứng tại ô chốt (12, 26, 40, 54) gieo được 1 điểm kích hoạt bay ô và đá văng địch', () => {
  const players = [
    { id: 'p1', name: 'Đỏ Player', seatIndex: 0, score: 100 },
    { id: 'p2', name: 'Xanh Player', seatIndex: 1, score: 100 },
  ];
  const state = initCoCaNguaState(players, []);

  const redHorse = state.players[0].horses[0];
  const blueHorse = state.players[1].horses[0];

  // Tình huống 1: Ngựa Đỏ ở ô chốt 12 (relative step 12)
  // Ngựa Xanh đang canh giữ ở ô chốt 26 (BLUE startPos = 14, step = 12 -> trackPos = 26)
  redHorse.step = 12;
  redHorse.state = 'ON_TRACK';
  redHorse.trackPosition = 12;

  blueHorse.step = 12;
  blueHorse.state = 'ON_TRACK';
  blueHorse.trackPosition = 26;

  // Ngựa Đỏ gieo được 1 nút
  const canMove = getValidMovesForHorse(state, 'RED', redHorse.id, 1);
  assert.equal(canMove, true, 'Ngựa Đỏ tại ô 12 gieo 1 có nước đi hợp lệ');

  // Thực hiện Bay Ô: từ 12 -> 26 (tiến 14 ô = 90 độ)
  const jumpRes = executeHorseMove(state, 'RED', redHorse.id, 1);
  assert.equal(jumpRes.success, true);
  assert.equal(redHorse.step, 26, 'Ngựa Đỏ bay tới relative step 26');
  assert.equal(redHorse.trackPosition, 26, 'Ngựa Đỏ đã bay tới ô chốt 26');
  assert.ok(jumpRes.actionMessage?.includes('BAY Ô 90°'), 'Thông điệp kích hoạt Bay Ô 90°');

  // Kiểm tra đá văng ngựa Xanh đang ở ô 26
  assert.equal(blueHorse.step, -1, 'Ngựa Xanh bị đá văng về chuồng');
  assert.equal(blueHorse.state, 'STABLE');
  assert.equal(jumpRes.kickedHorse?.color, 'BLUE', 'Ghi nhận đá ngựa BLUE');
  assert.ok(jumpRes.extraTurn, 'Đá ngựa thành công được thưởng thêm lượt');

  // Tình huống 2: Ngựa Đỏ ở ô chốt 40 (relative step 40) bay về ô 54 (ô chốt chân đích của Đỏ!)
  redHorse.step = 40;
  redHorse.trackPosition = 40;

  const jumpToFinishRes = executeHorseMove(state, 'RED', redHorse.id, 1);
  assert.equal(jumpToFinishRes.success, true);
  assert.equal(redHorse.step, 54, 'Ngựa Đỏ bay thẳng về ô chốt đích 54');
  assert.equal(redHorse.trackPosition, 54, 'Tọa độ ô chốt đích 54');
});

// -------------------------------------------------------------
// 9. KIỂM TRA BAY Ô BỊ CHẶN BỞI QUÂN MÌNH THÌ ĐI BÌNH THƯỜNG
// -------------------------------------------------------------
test('9. Bay Ô bị chặn bởi quân mình: Ngựa rơi lại nước đi bộ 1 bước bình thường', () => {
  const players = [{ id: 'p1', name: 'Đỏ Player', seatIndex: 0, score: 100 }];
  const state = initCoCaNguaState(players, []);

  const redHorse1 = state.players[0].horses[0];
  const redHorse2 = state.players[0].horses[1];

  // Ngựa 1 ở ô chốt 12, Ngựa 2 đang ở ô chốt 26 (chặn đường bay)
  redHorse1.step = 12;
  redHorse1.state = 'ON_TRACK';
  redHorse1.trackPosition = 12;

  redHorse2.step = 26;
  redHorse2.state = 'ON_TRACK';
  redHorse2.trackPosition = 26;

  // Gieo 1: vì ô 26 đã có quân mình nên không bay ô được, nhưng ô 13 trống nên đi bộ bình thường 1 bước
  const canMove = getValidMovesForHorse(state, 'RED', redHorse1.id, 1);
  assert.equal(canMove, true, 'Vẫn có thể đi bộ 1 bước đến ô 13');

  const moveRes = executeHorseMove(state, 'RED', redHorse1.id, 1);
  assert.equal(moveRes.success, true);
  assert.equal(redHorse1.step, 13, 'Ngựa 1 đi bộ tới step 13');
  assert.equal(redHorse1.trackPosition, 13);
  assert.equal(moveRes.actionMessage?.includes('BAY Ô'), false, 'Không kích hoạt bay ô vì bị quân mình chặn');
});

// -------------------------------------------------------------
// 6. KIỂM TRA KỊCH BẢN TOÀN BỘ 1 LƯỢT GAME QUA GAMEROOM (END-TO-END)
// -------------------------------------------------------------
test('6. Kịch bản 1 lượt game hoàn chỉnh trong GameRoom (Roll -> Move -> Next Turn)', () => {
  let stateChanged = false;
  let gameEnded = false;

  const room = new GameRoom(
    'ROOM123',
    'CO_CA_NGUA',
    () => {
      stateChanged = true;
    }
  );

  // Thêm 2 người chơi vào phòng
  const p1 = room.addPlayer('user_1', 'socket_1', 'Nguyễn Văn Đỏ', 'avatar1', 'token1');
  const p2 = room.addPlayer('user_2', 'socket_2', 'Trần Thị Xanh', 'avatar2', 'token2');

  assert.ok(p1.success && p2.success, 'Thêm 2 người chơi thành công');

  // Khởi động ván đấu Cờ Cá Ngựa
  const startResult = room.startGame('user_1');
  assert.equal(startResult.success, true, 'Bắt đầu ván đấu thành công');

  const pubState = room.getPublicState();
  assert.equal(pubState.status, 'PLAYING', 'Trạng thái phòng là PLAYING');
  assert.ok(pubState.coCaNguaState, 'coCaNguaState đã được khởi tạo');

  const coCaNgua = pubState.coCaNguaState!;
  assert.equal(coCaNgua.currentTurnPlayerId, 'user_1', 'Lượt đầu tiên thuộc về user_1 (ĐỎ)');
  assert.equal(coCaNgua.phase, 'ROLLING', 'Giai đoạn đầu là gieo xúc xắc');

  // KỊCH BẢN 1: Gieo 6 xuất chuồng, nhận thêm lượt, sau đó gieo 4 di chuyển bình thường
  const originalRandom = Math.random;
  try {
    // Ép xúc xắc ra 6 (5/6 + 0.01 cho ra 6)
    Math.random = () => 0.99;

    // BƯỚC 1: user_1 gieo xúc xắc 6
    const roll6 = room.coCaNguaRollDice('user_1');
    assert.equal(roll6.success, true, 'Gieo xúc xắc thành công');
    assert.equal(coCaNgua.lastDiceValue, 6, 'Xúc xắc ra 6');
    assert.equal(coCaNgua.phase, 'SELECTING_HORSE', 'Phase là SELECTING_HORSE khi ra 6');
    assert.equal(coCaNgua.movableHorseIds.length, 4, 'Cả 4 ngựa trong chuồng đều được chọn');

    // BƯỚC 2: user_1 chọn ngựa số 0 xuất kích
    const move0 = room.coCaNguaMoveHorse('user_1', '0');
    assert.equal(move0.success, true, 'Xuất chuồng ngựa #0 thành công');
    assert.equal(coCaNgua.horses.find((h) => h.id === 0)?.state, 'ON_TRACK', 'Ngựa #0 đã ra đường đua');
    assert.equal(coCaNgua.horses.find((h) => h.id === 0)?.trackPosition, 0, 'Ngựa #0 tại ô xuất phát 0');

    // Do gieo 6 nên user_1 được thưởng thêm 1 lượt gieo tiếp
    assert.equal(coCaNgua.phase, 'ROLLING', 'Phase trở về ROLLING cho lượt gieo tiếp');
    assert.equal(coCaNgua.currentTurnPlayerId, 'user_1', 'Vẫn là lượt của user_1 vì được thưởng thêm lượt');
    assert.equal(coCaNgua.lastKickedHorse, null, 'lastKickedHorse phải là null khi xuất chuồng');

    // BƯỚC 3: user_1 gieo tiếp ra 4
    Math.random = () => 0.55; // 0.55 * 6 = 3.3 -> floor + 1 = 4
    const roll4 = room.coCaNguaRollDice('user_1');
    assert.equal(roll4.success, true);
    assert.equal(coCaNgua.lastDiceValue, 4, 'Xúc xắc ra 4');

    // Do chỉ có 1 ngựa trên đường ray (movableHorseIds = [0]), hệ thống tự động di chuyển
    const movedHorse = coCaNgua.horses.find((h) => h.id === 0);
    assert.equal(movedHorse?.step, 4, 'Ngựa #0 tiến lên step = 4');
    assert.equal(movedHorse?.trackPosition, 4, 'Ngựa #0 tại trackPosition = 4');

    // Do gieo 4 không đá ai và không phải 1/6, lượt chơi chuyển sang user_2 (BLUE)
    assert.equal(coCaNgua.currentTurnPlayerId, 'user_2', 'Lượt chơi chuyển sang user_2 (XANH)');
    assert.equal(coCaNgua.currentTurnColor, 'BLUE', 'Màu lượt là BLUE');
    assert.equal(coCaNgua.phase, 'ROLLING', 'Phase tiếp tục là ROLLING');
    assert.equal(coCaNgua.lastKickedHorse, null, 'Di chuyển bình thường TUYỆT ĐỐI không có kick effect');
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(stateChanged, true, 'Trạng thái phòng đã phát tín hiệu cập nhật qua onStateChange');
  (room as any).stopTimer();
});

console.log(`\n======================================================`);
console.log(`🎉 HOÀN THÀNH TẤT CẢ ${passedTests}/${totalTests} BÀI KIỂM TRA CỜ CÁ NGỰA THÀNH CÔNG!`);
console.log(`======================================================\n`);
