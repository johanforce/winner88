import {
  GameRule,
  Card,
  Player,
  PlayerPublicInfo,
  PlayedHand,
  RoomPublicState,
  ChatMessage,
  GameResultRecord,
  SamLocState,
} from './types';
import {
  createDeck,
  shuffleDeck,
  sortCards,
  hasThreeOfSpades,
  isThreeOfSpades,
  getRankLabel,
} from './cardUtils';
import { analyzeHandByRule, canBeatByRule } from './rules';

export class GameRoom {
  public code: string;
  public rule: GameRule;
  public status: 'WAITING' | 'PLAYING' | 'FINISHED' = 'WAITING';
  public players: Player[] = [];
  public currentTurnPlayerId: string | null = null;
  public turnTimeRemaining: number = 25;
  public turnDuration: number = 25;
  public lastPlayedHand: PlayedHand | null = null;
  public roundHistory: PlayedHand[] = [];
  public firstTurnPlayerId: string | null = null;
  public gameNumber: number = 0;
  public lastRoundWinnerId: string | null = null;
  public isFirstTurnOfGame: boolean = false;
  public roundWinners: string[] = []; // player IDs in finish order
  public chatMessages: ChatMessage[] = [];
  public results?: GameResultRecord[];
  public samLocState?: SamLocState;

  private timerInterval: NodeJS.Timeout | null = null;
  private onStateChange: () => void;

  constructor(code: string, rule: GameRule, onStateChange: () => void) {
    this.code = code;
    this.rule = rule;
    this.onStateChange = onStateChange;
  }

  // --- QUẢN LÝ NGƯỜI CHƠI ---

  public addPlayer(
    id: string,
    socketId: string,
    name: string,
    avatar: string,
    reconnectToken: string
  ): { success: boolean; message?: string } {
    // Check if player is reconnecting
    const existingIndex = this.players.findIndex((p) => p.id === id);
    if (existingIndex !== -1) {
      const existing = this.players[existingIndex];
      existing.socketId = socketId;
      existing.status = this.status === 'PLAYING' ? 'PLAYING' : 'WAITING';
      existing.disconnectedAt = null;
      this.addSystemChat(`${existing.name} đã kết nối lại.`);
      this.onStateChange();
      return { success: true };
    }

    if (this.players.length >= 4) {
      return { success: false, message: 'Phòng đã đầy (tối đa 4 người)' };
    }

    if (this.status === 'PLAYING') {
      return { success: false, message: 'Ván đấu đang diễn ra, vui lòng đợi ván kết thúc' };
    }

    const isHost = this.players.length === 0;
    const seatIndex = this.findAvailableSeat();

    const newPlayer: Player = {
      id,
      socketId,
      name,
      avatar,
      isHost,
      status: 'WAITING',
      cards: [],
      seatIndex,
      hasPassedCurrentRound: false,
      disconnectedAt: null,
      reconnectToken,
      score: 1000,
    };

    this.players.push(newPlayer);
    this.addSystemChat(`${name} đã vào phòng.`);
    this.onStateChange();
    return { success: true };
  }

  public handleDisconnect(socketId: string) {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return;

    player.socketId = null;
    player.disconnectedAt = Date.now();
    player.status = 'DISCONNECTED';
    this.addSystemChat(`${player.name} bị mất kết nối (giữ chỗ 60s).`);

    // If waiting in lobby and host disconnects, transfer host immediately
    if (this.status === 'WAITING' && player.isHost) {
      this.autoTransferHost();
    }

    this.onStateChange();
  }

  public removePlayer(playerId: string): boolean {
    const index = this.players.findIndex((p) => p.id === playerId);
    if (index === -1) return false;

    const player = this.players[index];
    const wasHost = player.isHost;
    this.players.splice(index, 1);
    this.addSystemChat(`${player.name} đã rời phòng.`);

    if (this.players.length === 0) {
      this.stopTimer();
      return true; // Room empty
    }

    if (wasHost) {
      this.autoTransferHost();
    }

    // If playing and players < 2, end game
    if (this.status === 'PLAYING') {
      if (this.players.length < 2) {
        this.status = 'WAITING';
        this.stopTimer();
        this.addSystemChat('Không đủ người chơi tiếp, ván đấu kết thúc.');
      } else if (this.currentTurnPlayerId === playerId) {
        this.advanceToNextTurn();
      }
    }

    this.onStateChange();
    return false;
  }

  public transferHost(targetPlayerId: string, requestedByPlayerId: string): boolean {
    const requester = this.players.find((p) => p.id === requestedByPlayerId);
    if (!requester || !requester.isHost) return false;

    const target = this.players.find((p) => p.id === targetPlayerId);
    if (!target) return false;

    requester.isHost = false;
    target.isHost = true;
    this.addSystemChat(`Chủ phòng đã được chuyển cho ${target.name}.`);
    this.onStateChange();
    return true;
  }

  private autoTransferHost() {
    const activePlayer = this.players.find((p) => p.socketId !== null) || this.players[0];
    if (activePlayer) {
      this.players.forEach((p) => (p.isHost = false));
      activePlayer.isHost = true;
      this.addSystemChat(`${activePlayer.name} trở thành chủ phòng mới.`);
    }
  }

  private findAvailableSeat(): number {
    const takenSeats = new Set(this.players.map((p) => p.seatIndex));
    for (let i = 0; i < 4; i++) {
      if (!takenSeats.has(i)) return i;
    }
    return this.players.length;
  }

  // --- BẮT ĐẦU VÁN ĐẤU ---

  public startGame(requestedByPlayerId: string): { success: boolean; message?: string } {
    const requester = this.players.find((p) => p.id === requestedByPlayerId);
    if (!requester || !requester.isHost) {
      return { success: false, message: 'Chỉ chủ phòng mới có quyền bắt đầu ván đấu' };
    }

    const activePlayers = this.players.filter((p) => p.status !== 'DISCONNECTED');
    if (activePlayers.length < 2) {
      return { success: false, message: 'Cần ít nhất 2 người chơi để bắt đầu' };
    }

    this.gameNumber += 1;
    this.status = 'PLAYING';
    this.lastPlayedHand = null;
    this.roundHistory = [];
    this.roundWinners = [];
    this.results = undefined;
    this.isFirstTurnOfGame = true;

    // Reset player round status
    this.players.forEach((p) => {
      p.status = 'PLAYING';
      p.hasPassedCurrentRound = false;
      p.cards = [];
      delete p.rank;
    });

    // Tạo & chia bài
    const deck = shuffleDeck(createDeck());
    const cardCountPerPlayer = this.rule === 'SAM_LOC' ? 10 : 13;

    activePlayers.forEach((player, idx) => {
      const playerCards = deck.slice(idx * cardCountPerPlayer, (idx + 1) * cardCountPerPlayer);
      player.cards = sortCards(playerCards);
    });

    // Xác định người đi đầu tiên
    if (this.rule === 'TIEN_LEN_MIEN_NAM') {
      if (this.gameNumber === 1 || !this.lastRoundWinnerId) {
        // Ván đầu: Ai có 3 bích được đi trước
        let foundFirstPlayer: Player | null = null;
        for (const p of activePlayers) {
          if (hasThreeOfSpades(p.cards)) {
            foundFirstPlayer = p;
            break;
          }
        }
        this.currentTurnPlayerId = foundFirstPlayer ? foundFirstPlayer.id : activePlayers[0].id;
      } else {
        // Ván sau: Người thắng ván trước đi đầu
        const winner = activePlayers.find((p) => p.id === this.lastRoundWinnerId);
        this.currentTurnPlayerId = winner ? winner.id : activePlayers[0].id;
        this.isFirstTurnOfGame = false;
      }
      this.startTurnTimer();
    } else {
      // SÂM LỐC: Bắt đầu giai đoạn Xin Sâm (Báo Sâm)
      this.samLocState = {
        isBaoSamPhase: true,
        baoSamTimeRemaining: 8,
        baoSamPlayerId: null,
      };
      this.startBaoSamTimer(activePlayers);
    }

    const firstPlayer = this.players.find((p) => p.id === this.currentTurnPlayerId);
    this.addSystemChat(
      `Ván đấu #${this.gameNumber} (${this.rule === 'TIEN_LEN_MIEN_NAM' ? 'Tiến Lên MN' : 'Sâm Lốc'}) bắt đầu! Lượt đầu: ${firstPlayer?.name || 'Đang chuẩn bị'}.`
    );

    this.onStateChange();
    return { success: true };
  }

  // --- SÂM LỐC BÁO SÂM PHASE ---

  private startBaoSamTimer(activePlayers: Player[]) {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (!this.samLocState || !this.samLocState.isBaoSamPhase) {
        this.stopTimer();
        return;
      }

      this.samLocState.baoSamTimeRemaining -= 1;
      if (this.samLocState.baoSamTimeRemaining <= 0) {
        this.finishBaoSamPhase(activePlayers);
      } else {
        this.onStateChange();
      }
    }, 1000);
  }

  public reportBaoSam(playerId: string, wantsBaoSam: boolean) {
    if (!this.samLocState || !this.samLocState.isBaoSamPhase) return;
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;

    if (wantsBaoSam) {
      this.samLocState.baoSamPlayerId = playerId;
      this.addSystemChat(`🔥 ${player.name} ĐÃ BÁO SÂM! Sẽ đánh đầu tiên.`);
    }
    this.onStateChange();
  }

  private finishBaoSamPhase(activePlayers: Player[]) {
    if (!this.samLocState) return;
    this.samLocState.isBaoSamPhase = false;

    if (this.samLocState.baoSamPlayerId) {
      this.currentTurnPlayerId = this.samLocState.baoSamPlayerId;
      const p = this.players.find((x) => x.id === this.currentTurnPlayerId);
      this.addSystemChat(`Người chơi ${p?.name} Báo Sâm bắt đầu đánh.`);
    } else {
      // Không ai báo sâm: người thắng ván trước hoặc người có bài nhỏ nhất đi trước
      if (this.lastRoundWinnerId && activePlayers.some((p) => p.id === this.lastRoundWinnerId)) {
        this.currentTurnPlayerId = this.lastRoundWinnerId;
      } else {
        // Tìm người có lá bài nhỏ nhất
        let minCardPlayer = activePlayers[0];
        let minRank = 99;
        for (const p of activePlayers) {
          if (p.cards.length > 0 && p.cards[0].rank < minRank) {
            minRank = p.cards[0].rank;
            minCardPlayer = p;
          }
        }
        this.currentTurnPlayerId = minCardPlayer.id;
      }
      this.addSystemChat(`Không có ai Báo Sâm. Lượt đánh bắt đầu với ${this.players.find((p) => p.id === this.currentTurnPlayerId)?.name}.`);
    }

    this.startTurnTimer();
    this.onStateChange();
  }

  // --- NƯỚC ĐI ĐÁNH BÀI ---

  public playHand(
    playerId: string,
    cardIds: string[]
  ): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING') {
      return { success: false, message: 'Ván chơi chưa bắt đầu hoặc đã kết thúc' };
    }

    if (this.currentTurnPlayerId !== playerId) {
      return { success: false, message: 'Chưa tới lượt của bạn' };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) {
      return { success: false, message: 'Không tìm thấy người chơi' };
    }

    // Kiểm tra xem người chơi có thực sự giữ những lá bài này không
    const playedCards: Card[] = [];
    for (const cid of cardIds) {
      const card = player.cards.find((c) => c.id === cid);
      if (!card) {
        return { success: false, message: 'Bạn không sở hữu lá bài này trên tay' };
      }
      playedCards.push(card);
    }

    // Kiểm tra lượt đầu tiên của ván: có bắt buộc phải chứa 3 Bích không
    if (this.rule === 'TIEN_LEN_MIEN_NAM' && this.isFirstTurnOfGame && this.gameNumber === 1) {
      const has3Spade = playedCards.some(isThreeOfSpades);
      if (!has3Spade) {
        return { success: false, message: 'Ván đầu tiên bắt buộc phải đánh bộ có chứa 3 Bích (3♠)!' };
      }
    }

    // Phân tích tính hợp lệ theo luật chơi
    const analyzed = analyzeHandByRule(this.rule, playedCards);
    if (!analyzed.isValid) {
      return { success: false, message: analyzed.description || 'Bộ bài không hợp lệ' };
    }

    // Nếu trên bàn đã có bài, kiểm tra xem có chặn được không
    if (this.lastPlayedHand) {
      const beatResult = canBeatByRule(this.rule, analyzed, this.lastPlayedHand);
      if (!beatResult.canBeat) {
        return { success: false, message: beatResult.reason || 'Bài của bạn không thể chặn bài trên bàn' };
      }
    }

    // HỢP LỆ! Thực hiện đánh bài
    const playedHand: PlayedHand = {
      playerId,
      playerName: player.name,
      cards: analyzed.cards,
      type: analyzed.type,
      highestCard: analyzed.highestCard,
      description: analyzed.description,
      timestamp: Date.now(),
    };

    // Loại bỏ bài khỏi tay người chơi
    player.cards = player.cards.filter((c) => !cardIds.includes(c.id));
    this.lastPlayedHand = playedHand;
    this.roundHistory.push(playedHand);
    this.isFirstTurnOfGame = false;
    player.hasPassedCurrentRound = false;

    this.addSystemChat(`${player.name} đánh: ${analyzed.description}`);

    // Kiểm tra người này đã hết bài chưa
    if (player.cards.length === 0) {
      player.status = 'FINISHED';
      this.roundWinners.push(player.id);
      player.rank = this.roundWinners.length;
      const rankTitle = player.rank === 1 ? '🥇 Nhất' : player.rank === 2 ? '🥈 Nhì' : '🥉 Ba';
      this.addSystemChat(`🎉 ${player.name} đã hết bài (${rankTitle})!`);

      // Kiểm tra xem ván đấu đã kết thúc chưa
      const remainingWithCards = this.players.filter(
        (p) => p.cards.length > 0 && p.status !== 'DISCONNECTED'
      );

      // Nếu chỉ còn 1 người hoặc luật Sâm Lốc (ai về nhất kết thúc luôn)
      if (remainingWithCards.length <= 1 || this.rule === 'SAM_LOC') {
        this.finishGame();
        return { success: true };
      }
    }

    // Chuyển lượt cho người tiếp theo
    this.advanceToNextTurn();
    this.onStateChange();
    return { success: true };
  }

  // --- BỎ LƯỢT (PASS) ---

  public passTurn(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING') {
      return { success: false, message: 'Ván chơi chưa bắt đầu' };
    }

    if (this.currentTurnPlayerId !== playerId) {
      return { success: false, message: 'Chưa tới lượt của bạn' };
    }

    if (!this.lastPlayedHand) {
      return { success: false, message: 'Bạn đang giữ quyền đánh tự do (vòng mới), không thể bỏ lượt!' };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Không tìm thấy người chơi' };

    player.hasPassedCurrentRound = true;
    player.status = 'PASSED';
    this.addSystemChat(`${player.name} bỏ lượt.`);

    this.advanceToNextTurn();
    this.onStateChange();
    return { success: true };
  }

  // --- CHUYỂN LƯỢT TIẾP THEO ---

  private advanceToNextTurn() {
    // Lấy danh sách người chơi còn đang tham gia vòng hiện tại (còn bài và chưa bỏ lượt)
    const activeInGame = this.players.filter((p) => p.cards.length > 0 && p.status !== 'DISCONNECTED');
    if (activeInGame.length <= 1) {
      this.finishGame();
      return;
    }

    const canPlayThisRound = activeInGame.filter((p) => !p.hasPassedCurrentRound);

    // Nếu tất cả mọi người khác đều đã bỏ lượt (hoặc chỉ còn 1 người)
    // Người duy nhất còn lại thắng vòng đó và được đánh vòng mới
    if (canPlayThisRound.length === 1) {
      const roundWinner = canPlayThisRound[0];
      this.lastPlayedHand = null;
      // Reset trạng thái bỏ lượt cho tất cả mọi người còn bài
      this.players.forEach((p) => {
        p.hasPassedCurrentRound = false;
        if (p.status === 'PASSED') p.status = 'PLAYING';
      });
      this.currentTurnPlayerId = roundWinner.id;
      this.addSystemChat(`👉 ${roundWinner.name} thắng vòng và bắt đầu vòng đánh mới.`);
      this.startTurnTimer();
      return;
    }

    if (canPlayThisRound.length === 0) {
      // Trường hợp người đánh cuối cùng vừa hết bài và mọi người đều pass
      this.lastPlayedHand = null;
      this.players.forEach((p) => {
        p.hasPassedCurrentRound = false;
        if (p.status === 'PASSED') p.status = 'PLAYING';
      });
      // Chọn người kế tiếp còn bài
      const nextP = this.findNextPlayerWithCards(this.currentTurnPlayerId || '');
      this.currentTurnPlayerId = nextP?.id || null;
      this.startTurnTimer();
      return;
    }

    // Tìm người tiếp theo theo thứ tự ghế (vòng tròn 0 -> 1 -> 2 -> 3)
    const currentIndex = this.players.findIndex((p) => p.id === this.currentTurnPlayerId);
    let nextIndex = (currentIndex + 1) % this.players.length;
    let foundId: string | null = null;

    for (let i = 0; i < this.players.length; i++) {
      const candidate = this.players[nextIndex];
      if (candidate.cards.length > 0 && !candidate.hasPassedCurrentRound && candidate.status !== 'DISCONNECTED') {
        foundId = candidate.id;
        break;
      }
      nextIndex = (nextIndex + 1) % this.players.length;
    }

    this.currentTurnPlayerId = foundId;
    this.startTurnTimer();
  }

  private findNextPlayerWithCards(currentId: string): Player | null {
    const currentIndex = this.players.findIndex((p) => p.id === currentId);
    let nextIndex = (currentIndex + 1) % this.players.length;
    for (let i = 0; i < this.players.length; i++) {
      const candidate = this.players[nextIndex];
      if (candidate.cards.length > 0 && candidate.status !== 'DISCONNECTED') {
        return candidate;
      }
      nextIndex = (nextIndex + 1) % this.players.length;
    }
    return null;
  }

  // --- BỘ ĐẾM THỜI GIAN LƯỢT ĐI ---

  private startTurnTimer() {
    this.stopTimer();
    this.turnTimeRemaining = this.turnDuration;

    this.timerInterval = setInterval(() => {
      this.turnTimeRemaining -= 1;
      if (this.turnTimeRemaining <= 0) {
        this.handleTurnTimeout();
      } else {
        this.onStateChange();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private handleTurnTimeout() {
    if (!this.currentTurnPlayerId) return;
    const player = this.players.find((p) => p.id === this.currentTurnPlayerId);
    if (!player) return;

    this.addSystemChat(`⏰ ${player.name} hết giờ lượt đánh.`);

    if (this.lastPlayedHand) {
      // Tự động bỏ lượt
      this.passTurn(player.id);
    } else {
      // Đang có lượt đánh mới tự do, tự động đánh 1 lá nhỏ nhất để không bị kẹt game!
      if (player.cards.length > 0) {
        const lowestCard = player.cards[0];
        this.playHand(player.id, [lowestCard.id]);
      } else {
        this.advanceToNextTurn();
      }
    }
  }

  // --- KẾT THÚC VÁN ĐẤU & TÍNH ĐIỂM ---

  private finishGame() {
    this.stopTimer();
    this.status = 'FINISHED';

    // Xếp hạng những người còn bài
    const losers = this.players.filter((p) => p.cards.length > 0);
    // Sắp xếp người thua theo số lá bài ít hơn
    losers.sort((a, b) => a.cards.length - b.cards.length);
    losers.forEach((p) => {
      this.roundWinners.push(p.id);
      p.rank = this.roundWinners.length;
    });

    const winnerId = this.roundWinners[0];
    this.lastRoundWinnerId = winnerId;
    const winner = this.players.find((p) => p.id === winnerId);

    // Tính điểm và lập bản tổng kết
    const results: GameResultRecord[] = this.players.map((p) => {
      const isWinner = p.id === winnerId;
      const initialCardsCount = this.rule === 'SAM_LOC' ? 10 : 13;
      const isCong = p.cards.length === initialCardsCount;
      const has2 = p.cards.some((c) => c.rank === 15);

      let scoreChange = 0;
      if (isWinner) {
        // Người thắng nhận điểm
        const totalOtherCards = this.players
          .filter((x) => x.id !== p.id)
          .reduce((sum, x) => sum + x.cards.length * 10, 0);
        scoreChange = totalOtherCards;
      } else {
        // Người thua bị trừ điểm theo số lá bài còn lại
        scoreChange = -p.cards.length * 10;
        if (isCong) scoreChange -= 50; // Phạt cóng
        if (has2) scoreChange -= 30; // Thối heo
      }

      p.score = Math.max(0, p.score + scoreChange);

      return {
        playerId: p.id,
        playerName: p.name,
        avatar: p.avatar,
        rank: p.rank || 4,
        cardsLeft: p.cards.length,
        cardsLeftList: [...p.cards],
        scoreChange,
        isCong,
        isThoiHeo: has2,
      };
    });

    this.results = results.sort((a, b) => a.rank - b.rank);
    this.addSystemChat(`🏆 Ván đấu kết thúc! Chúc mừng ${winner?.name} giành vị trí Nhất!`);
    this.onStateChange();
  }

  // --- TRÒ CHUYỆN (CHAT) ---

  public addChat(senderId: string, text: string) {
    const player = this.players.find((p) => p.id === senderId);
    if (!player) return;

    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId,
      senderName: player.name,
      senderAvatar: player.avatar,
      text: text.slice(0, 150),
      timestamp: Date.now(),
    };

    this.chatMessages.push(msg);
    if (this.chatMessages.length > 50) this.chatMessages.shift();
    this.onStateChange();
  }

  public addSystemChat(text: string) {
    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: 'SYSTEM',
      senderName: 'Hệ thống',
      senderAvatar: '🤖',
      text,
      timestamp: Date.now(),
      isSystem: true,
    };
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 50) this.chatMessages.shift();
  }

  // --- DỮ LIỆU ĐỒNG BỘ CLIENT ---

  public getPublicState(): RoomPublicState {
    const playersInfo: PlayerPublicInfo[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      status: p.status,
      cardCount: p.cards.length,
      seatIndex: p.seatIndex,
      rank: p.rank,
      hasPassedCurrentRound: p.hasPassedCurrentRound,
      isCurrentTurn: this.currentTurnPlayerId === p.id,
      isConnected: p.socketId !== null,
      score: p.score,
    }));

    return {
      code: this.code,
      rule: this.rule,
      status: this.status,
      players: playersInfo,
      currentTurnPlayerId: this.currentTurnPlayerId,
      turnTimeRemaining: this.turnTimeRemaining,
      turnDuration: this.turnDuration,
      lastPlayedHand: this.lastPlayedHand,
      lastRoundWinnerId: this.lastRoundWinnerId,
      gameNumber: this.gameNumber,
      isFirstTurnOfGame: this.isFirstTurnOfGame,
      samLocState: this.samLocState,
      results: this.results,
    };
  }

  public getPlayerCards(playerId: string): Card[] {
    const p = this.players.find((x) => x.id === playerId);
    return p ? p.cards : [];
  }

  public cleanup() {
    this.stopTimer();
  }
}
