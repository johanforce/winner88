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
  XiangqiState,
  XiangqiSide,
  XiangqiMove,
  XiangqiTimeMode,
  VoiceParticipant,
  CaroPiece,
  CaroMove,
  CaroState,
} from './types';
import {
  createDeck,
  shuffleDeck,
  sortCards,
  hasThreeOfSpades,
  isThreeOfSpades,
  getRankLabel,
  SUIT_SYMBOLS,
  findPlayerWithThreeOfSpades,
  findLowestCardPlayer,
} from './cardUtils';
import { analyzeHandByRule, canBeatByRule } from './rules';
import {
  createInitialXiangqiPieces,
  getPieceAt,
  getLegalMoves,
  hasAnyLegalMoves,
  isSideInCheck,
  generateMoveNotation,
} from './xiangqiLogic';
import {
  createEmptyCaroBoard,
  isInsideBoard,
  checkCaroWin,
  isCaroBoardFull,
} from './caroLogic';

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
  public mustPlayThreeOfSpades: boolean = false;
  public roundWinners: string[] = []; // player IDs in finish order
  public chatMessages: ChatMessage[] = [];
  public results?: GameResultRecord[];
  public samLocState?: SamLocState;
  public xiangqiState?: XiangqiState;
  public caroState?: CaroState;
  public xiangqiTimeMode: XiangqiTimeMode = 'STANDARD';
  public voiceParticipants: Map<string, VoiceParticipant> = new Map(); // socketId -> VoiceParticipant

  private timerInterval: NodeJS.Timeout | null = null;
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private onStateChange: () => void;
  private onPlayerRemoved?: (playerId: string, isEmpty: boolean) => void;

  constructor(
    code: string,
    rule: GameRule,
    onStateChange: () => void,
    xiangqiTimeMode: XiangqiTimeMode = 'STANDARD',
    onPlayerRemoved?: (playerId: string, isEmpty: boolean) => void
  ) {
    this.code = code;
    this.rule = rule;
    this.onStateChange = onStateChange;
    this.xiangqiTimeMode = xiangqiTimeMode;
    this.onPlayerRemoved = onPlayerRemoved;
  }

  public setXiangqiTimeMode(
    playerId: string,
    timeMode: XiangqiTimeMode
  ): { success: boolean; message?: string } {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.isHost) {
      return { success: false, message: 'Chỉ chủ phòng mới có quyền đổi chế độ thời gian' };
    }
    if (this.status === 'PLAYING') {
      return { success: false, message: 'Không thể đổi chế độ thời gian khi trận đấu đang diễn ra' };
    }
    this.xiangqiTimeMode = timeMode;
    const desc =
      timeMode === 'STANDARD'
        ? 'Cờ Tiêu Chuẩn Quốc Tế (60 phút + 30 giây tích lũy/nước WXF)'
        : 'Cờ Chớp 5 phút (+ 3 giây tích lũy/nước)';
    this.addSystemChat(`⚙️ Chủ phòng đã chuyển chế độ Cờ Tướng sang: ${desc}.`);
    this.onStateChange();
    return { success: true };
  }

  // --- QUẢN LÝ VOICE CHAT ---

  public joinVoice(
    socketId: string,
    playerId: string,
    playerName: string,
    playerAvatar: string,
    isMuted: boolean,
    hasMic: boolean = false
  ): VoiceParticipant {
    const existing = this.voiceParticipants.get(socketId);
    if (existing) {
      existing.playerId = playerId;
      existing.playerName = playerName;
      existing.playerAvatar = playerAvatar;
      existing.isMuted = isMuted;
      existing.hasMic = hasMic;
      return existing;
    }
    const participant: VoiceParticipant = {
      socketId,
      playerId,
      playerName,
      playerAvatar,
      isMuted,
      hasMic,
      isSpeaking: false,
      joinedAt: Date.now(),
    };
    this.voiceParticipants.set(socketId, participant);
    return participant;
  }

  public updateVoiceStatus(
    socketId: string,
    isMuted?: boolean,
    isSpeaking?: boolean,
    hasMic?: boolean
  ): VoiceParticipant | null {
    const p = this.voiceParticipants.get(socketId);
    if (!p) return null;
    if (typeof isMuted === 'boolean') {
      p.isMuted = isMuted;
    }
    if (typeof isSpeaking === 'boolean') {
      p.isSpeaking = isSpeaking;
    }
    if (typeof hasMic === 'boolean') {
      p.hasMic = hasMic;
    }
    return p;
  }

  public leaveVoice(socketId: string): VoiceParticipant | null {
    const p = this.voiceParticipants.get(socketId);
    if (p) {
      this.voiceParticipants.delete(socketId);
      return p;
    }
    return null;
  }

  public leaveVoiceByPlayerId(playerId: string): VoiceParticipant | null {
    for (const [sId, p] of this.voiceParticipants.entries()) {
      if (p.playerId === playerId) {
        this.voiceParticipants.delete(sId);
        return p;
      }
    }
    return null;
  }

  public getVoiceParticipants(): VoiceParticipant[] {
    return Array.from(this.voiceParticipants.values());
  }

  // --- QUẢN LÝ NGƯỜI CHƠI ---

  public addPlayer(
    id: string,
    socketId: string,
    name: string,
    avatar: string,
    reconnectToken: string,
    initialScore?: number
  ): { success: boolean; message?: string } {
    // Check if player is reconnecting
    const existingIndex = this.players.findIndex((p) => p.id === id);
    if (existingIndex !== -1) {
      const existing = this.players[existingIndex];
      const wasDisconnected =
        existing.status === 'DISCONNECTED' ||
        existing.disconnectedAt !== null ||
        !existing.socketId;

      // Hủy timer ngắt kết nối hoàn toàn nếu người chơi đã kết nối lại kịp thời
      const pendingDisconnectTimer = this.disconnectTimers.get(id);
      if (pendingDisconnectTimer) {
        clearTimeout(pendingDisconnectTimer);
        this.disconnectTimers.delete(id);
      }

      existing.socketId = socketId;
      if (existing.status === 'DISCONNECTED') {
        existing.status = this.status === 'PLAYING' ? 'PLAYING' : 'WAITING';
      }
      existing.disconnectedAt = null;
      if (typeof initialScore === 'number' && !isNaN(initialScore)) {
        if (typeof existing.score !== 'number' || (this.status === 'WAITING' && initialScore !== existing.score)) {
          existing.score = initialScore;
        }
      }

      // Đã bỏ thông báo "đã kết nối lại" ở khung chat theo yêu cầu
      this.onStateChange();
      return { success: true };
    }

    const maxPlayers = this.rule === 'CO_TUONG' || this.rule === 'CARO' ? 8 : 4;
    if (this.players.length >= maxPlayers) {
      return { success: false, message: `Phòng đã đầy (tối đa ${maxPlayers} người)` };
    }

    const startScore =
      typeof initialScore === 'number' && !isNaN(initialScore) && initialScore >= 0
        ? initialScore
        : 1000;

    // Nếu là Cờ Tướng hoặc Cờ Caro và phòng đang trong trận đấu: cho phép vào theo dõi trực tiếp (Spectator)
    if (this.status === 'PLAYING') {
      if (this.rule === 'CO_TUONG' || this.rule === 'CARO') {
        const takenSeats = new Set(this.players.map((p) => p.seatIndex));
        const spectatorSlots = [2, 3, 4, 5, 6, 7];
        const spectatorSeat = spectatorSlots.find((s) => !takenSeats.has(s)) ?? this.players.length;

        const newSpectator: Player = {
          id,
          socketId,
          name,
          avatar,
          isHost: false,
          status: 'PLAYING',
          cards: [],
          seatIndex: spectatorSeat,
          hasPassedCurrentRound: false,
          disconnectedAt: null,
          reconnectToken,
          score: startScore,
          isSpectator: true,
        };

        this.players.push(newSpectator);
        if (this.rule === 'CO_TUONG' && this.xiangqiState && !this.xiangqiState.spectatorIds.includes(id)) {
          this.xiangqiState.spectatorIds.push(id);
        } else if (this.rule === 'CARO' && this.caroState && !this.caroState.spectatorIds.includes(id)) {
          this.caroState.spectatorIds.push(id);
        }
        this.addSystemChat(`👁️ ${name} đã vào phòng theo dõi trận đấu.`);
        this.onStateChange();
        return { success: true };
      }
      return { success: false, message: 'Ván đấu đang diễn ra, vui lòng đợi ván kết thúc' };
    }

    const isHost = this.players.length === 0;
    let seatIndex = this.findAvailableSeat();
    let isSpectator = false;
    let xiangqiSide: XiangqiSide | undefined = undefined;
    let caroPiece: CaroPiece | undefined = undefined;

    if (this.rule === 'CO_TUONG') {
      const takenSeats = new Set(this.players.map((p) => p.seatIndex));
      if (!takenSeats.has(0)) {
        seatIndex = 0;
        xiangqiSide = 'RED';
      } else if (!takenSeats.has(1)) {
        seatIndex = 1;
        xiangqiSide = 'BLACK';
      } else {
        const spectatorSlots = [2, 3, 4, 5, 6, 7];
        const freeSpectator = spectatorSlots.find((s) => !takenSeats.has(s)) ?? this.players.length;
        seatIndex = freeSpectator;
        isSpectator = true;
      }
    } else if (this.rule === 'CARO') {
      const takenSeats = new Set(this.players.map((p) => p.seatIndex));
      if (!takenSeats.has(0)) {
        seatIndex = 0;
        caroPiece = 'X';
      } else if (!takenSeats.has(1)) {
        seatIndex = 1;
        caroPiece = 'O';
      } else {
        const spectatorSlots = [2, 3, 4, 5, 6, 7];
        const freeSpectator = spectatorSlots.find((s) => !takenSeats.has(s)) ?? this.players.length;
        seatIndex = freeSpectator;
        isSpectator = true;
      }
    }

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
      score: startScore,
      isSpectator,
      xiangqiSide,
      caroPiece,
    };

    this.players.push(newPlayer);
    if (this.rule === 'CO_TUONG') {
      if (seatIndex === 0) {
        this.addSystemChat(`${name} đã vào phòng (Kỳ thủ Đỏ).`);
      } else if (seatIndex === 1) {
        this.addSystemChat(`${name} đã vào phòng (Kỳ thủ Đen).`);
      } else {
        this.addSystemChat(`👁️ ${name} đã vào phòng (Khán giả theo dõi).`);
      }
    } else if (this.rule === 'CARO') {
      if (seatIndex === 0) {
        this.addSystemChat(`${name} đã vào phòng (Kỳ thủ X).`);
      } else if (seatIndex === 1) {
        this.addSystemChat(`${name} đã vào phòng (Kỳ thủ O).`);
      } else {
        this.addSystemChat(`👁️ ${name} đã vào phòng (Khán giả theo dõi).`);
      }
    } else {
      this.addSystemChat(`${name} đã vào phòng.`);
    }
    this.onStateChange();
    return { success: true };
  }

  public switchSeat(playerId: string, targetSeatIndex: number): { success: boolean; message?: string } {
    if (this.status === 'PLAYING') {
      return { success: false, message: 'Không thể đổi vị trí khi trận đấu đang diễn ra' };
    }
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Không tìm thấy người chơi' };

    const maxSeatIndex = this.rule === 'CO_TUONG' || this.rule === 'CARO' ? 7 : 3;
    if (targetSeatIndex < 0 || targetSeatIndex > maxSeatIndex) {
      return { success: false, message: 'Vị trí không hợp lệ' };
    }

    const isSeatOccupied = this.players.some((p) => p.seatIndex === targetSeatIndex && p.id !== playerId);
    if (isSeatOccupied) {
      return { success: false, message: 'Vị trí này đã có người ngồi' };
    }

    player.seatIndex = targetSeatIndex;
    if (this.rule === 'CO_TUONG') {
      if (targetSeatIndex === 0) {
        player.isSpectator = false;
        player.xiangqiSide = 'RED';
        this.addSystemChat(`${player.name} đã chọn vị trí Kỳ thủ Đỏ (Đi trước).`);
      } else if (targetSeatIndex === 1) {
        player.isSpectator = false;
        player.xiangqiSide = 'BLACK';
        this.addSystemChat(`${player.name} đã chọn vị trí Kỳ thủ Đen (Đi sau).`);
      } else {
        player.isSpectator = true;
        player.xiangqiSide = undefined;
        this.addSystemChat(`👁️ ${player.name} đã chuyển sang vị trí Khán giả theo dõi.`);
      }
    } else if (this.rule === 'CARO') {
      if (targetSeatIndex === 0) {
        player.isSpectator = false;
        player.caroPiece = 'X';
        this.addSystemChat(`${player.name} đã chọn vị trí Kỳ thủ X (Đi trước).`);
      } else if (targetSeatIndex === 1) {
        player.isSpectator = false;
        player.caroPiece = 'O';
        this.addSystemChat(`${player.name} đã chọn vị trí Kỳ thủ O (Đi sau).`);
      } else {
        player.isSpectator = true;
        player.caroPiece = undefined;
        this.addSystemChat(`👁️ ${player.name} đã chuyển sang vị trí Khán giả theo dõi.`);
      }
    }

    this.onStateChange();
    return { success: true };
  }

  public handleDisconnect(socketId: string) {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return;

    player.socketId = null;
    player.disconnectedAt = Date.now();
    player.status = 'DISCONNECTED';

    // Xóa voice chat của socket này nếu đang tham gia
    this.leaveVoice(socketId);

    // Hủy timer ngắt kết nối cũ nếu có
    const prevTimer = this.disconnectTimers.get(player.id);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }

    // Thiết lập bộ đếm 60 giây: nếu quá 60s không kết nối lại -> coi như disconnect hẳn và loại khỏi phòng
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(player.id);
      const target = this.players.find((p) => p.id === player.id);
      if (target && target.status === 'DISCONNECTED') {
        this.removePlayer(target.id, 'DISCONNECTED');
      }
    }, 60000);

    this.disconnectTimers.set(player.id, timer);

    // If waiting in lobby and host disconnects, transfer host immediately
    if (this.status === 'WAITING' && player.isHost) {
      this.autoTransferHost();
    }

    this.onStateChange();
  }

  public removePlayer(playerId: string, reason: 'LEAVE' | 'DISCONNECTED' = 'LEAVE'): boolean {
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    const index = this.players.findIndex((p) => p.id === playerId);
    if (index === -1) return false;

    const player = this.players[index];
    const wasHost = player.isHost;
    this.players.splice(index, 1);
    this.leaveVoiceByPlayerId(playerId);

    if (reason === 'DISCONNECTED') {
      this.addSystemChat(`${player.name} đã ngắt kết nối và rời phòng.`);
    } else {
      this.addSystemChat(`${player.name} đã rời phòng.`);
    }

    const isEmpty = this.players.length === 0;
    this.onPlayerRemoved?.(playerId, isEmpty);

    if (isEmpty) {
      this.stopTimer();
      return true; // Room empty
    }

    if (wasHost) {
      this.autoTransferHost();
    }

    // If playing and players < 2, end game
    if (this.status === 'PLAYING') {
      if (this.rule === 'CO_TUONG') {
        if (player.isSpectator) {
          if (this.xiangqiState) {
            this.xiangqiState.spectatorIds = this.xiangqiState.spectatorIds.filter((id) => id !== playerId);
          }
          this.onStateChange();
          return false;
        }

        // Nếu một trong 2 kỳ thủ đang đấu thoát phòng hoặc ngắt kết nối hẳn, kỳ thủ còn lại thắng
        const otherPlayer = this.players.find((p) => !p.isSpectator);
        this.stopTimer();
        this.status = 'FINISHED';
        if (this.xiangqiState) {
          const winnerSide = player.xiangqiSide === 'RED' ? 'BLACK' : 'RED';
          this.xiangqiState.winnerSide = winnerSide;
          this.xiangqiState.winReason = 'RESIGN';
        }
        if (reason === 'DISCONNECTED') {
          this.addSystemChat(`Kỳ thủ ${player.name} đã mất kết nối. ${otherPlayer?.name || 'Đối thủ'} giành chiến thắng!`);
        } else {
          this.addSystemChat(`Kỳ thủ ${player.name} đã rời phòng. ${otherPlayer?.name || 'Đối thủ'} giành chiến thắng!`);
        }
        this.onStateChange();
        return false;
      }

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
    const max = this.rule === 'CO_TUONG' ? 8 : 4;
    for (let i = 0; i < max; i++) {
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

    if (this.rule === 'CARO') {
      const xPlayer = this.players.find((p) => p.seatIndex === 0 && !p.isSpectator);
      const oPlayer = this.players.find((p) => p.seatIndex === 1 && !p.isSpectator);

      if (!xPlayer || !oPlayer) {
        return {
          success: false,
          message: 'Cần đủ 2 kỳ thủ ở vị trí X (ghế 1) và O (ghế 2) để bắt đầu trận cờ Caro!',
        };
      }

      this.gameNumber += 1;
      this.status = 'PLAYING';
      this.results = undefined;

      // 5 phút mỗi bên (300 giây)
      const initialSeconds = 300;

      this.caroState = {
        board: createEmptyCaroBoard(),
        currentTurn: 'X',
        xPlayerId: xPlayer.id,
        oPlayerId: oPlayer.id,
        spectatorIds: this.players.filter((p) => p.isSpectator).map((p) => p.id),
        xTimeRemaining: initialSeconds,
        oTimeRemaining: initialSeconds,
        initialTime: initialSeconds,
        lastMove: null,
        moveHistory: [],
        winningLine: null,
        winnerPiece: null,
        winReason: undefined,
        drawOfferFrom: null,
      };

      this.currentTurnPlayerId = xPlayer.id;

      this.players.forEach((p) => {
        p.status = 'PLAYING';
      });

      this.addSystemChat(
        `⚡ TRẬN ĐẤU CỜ CARO (5 PHÚT/BÊN) CHÍNH THỨC BẮT ĐẦU! Quân X (${xPlayer.name}) vs Quân O (${oPlayer.name}). Luật: Ăn 5 chặn 2 đầu vẫn THẮNG!`
      );

      this.startCaroTimer();
      this.onStateChange();
      return { success: true };
    }

    if (this.rule === 'CO_TUONG') {
      const redPlayer = this.players.find((p) => p.seatIndex === 0 && !p.isSpectator);
      const blackPlayer = this.players.find((p) => p.seatIndex === 1 && !p.isSpectator);

      if (!redPlayer || !blackPlayer) {
        return {
          success: false,
          message: 'Cần đủ 2 kỳ thủ ở vị trí Đỏ (ghế 1) và Đen (ghế 2) để bắt đầu trận cờ chớp!',
        };
      }

      this.gameNumber += 1;
      this.status = 'PLAYING';
      this.results = undefined;

      const isStandard = this.xiangqiTimeMode === 'STANDARD';
      // Cờ Tiêu Chuẩn Quốc Tế WXF: 60 phút (3600s) + 30s tích lũy/nước
      // Cờ Chớp: 5 phút (300s) + 3s tích lũy/nước
      const initialSeconds = isStandard ? 3600 : 300;
      const incrementSeconds = isStandard ? 30 : 3;

      this.xiangqiState = {
        pieces: createInitialXiangqiPieces(),
        currentSide: 'RED',
        redPlayerId: redPlayer.id,
        blackPlayerId: blackPlayer.id,
        spectatorIds: this.players.filter((p) => p.isSpectator).map((p) => p.id),
        redTimeRemaining: initialSeconds,
        blackTimeRemaining: initialSeconds,
        initialBlitzTime: initialSeconds,
        timeMode: this.xiangqiTimeMode,
        incrementSeconds,
        lastMove: null,
        moveHistory: [],
        isCheck: false,
        checkSide: null,
        winnerSide: null,
        winReason: undefined,
        drawOfferFrom: null,
      };

      this.currentTurnPlayerId = redPlayer.id;

      this.players.forEach((p) => {
        p.status = 'PLAYING';
      });

      const modeTitle = isStandard
        ? '🏆 CỜ TIÊU CHUẨN QUỐC TẾ (60 phút + 30s/nước WXF)'
        : '⚡ CỜ CHỚP 5 PHÚT (+ 3s/nước)';

      this.addSystemChat(
        `${modeTitle} chính thức bắt đầu! Đỏ (${redPlayer.name}) vs Đen (${blackPlayer.name}).`
      );

      this.startXiangqiBlitzTimer();
      this.onStateChange();
      return { success: true };
    }

    if (this.players.length < 2) {
      return { success: false, message: 'Cần ít nhất 2 người chơi để bắt đầu' };
    }

    this.gameNumber += 1;
    this.status = 'PLAYING';
    this.lastPlayedHand = null;
    this.roundHistory = [];
    this.roundWinners = [];
    this.results = undefined;
    this.isFirstTurnOfGame = true;

    // Reset player round status and activate all players currently in the room
    this.players.forEach((p) => {
      p.status = 'PLAYING';
      p.hasPassedCurrentRound = false;
      p.cards = [];
      delete p.rank;
    });

    // Tạo & chia bài cho toàn bộ người chơi trong phòng
    const deck = shuffleDeck(createDeck());
    const cardCountPerPlayer = this.rule === 'SAM_LOC' ? 10 : 13;

    this.players.forEach((player, idx) => {
      const playerCards = deck.slice(idx * cardCountPerPlayer, (idx + 1) * cardCountPerPlayer);
      player.cards = sortCards(playerCards);
    });

    // Xác định người đi đầu tiên
    if (this.rule === 'TIEN_LEN_MIEN_NAM') {
      if (this.gameNumber === 1 || !this.lastRoundWinnerId) {
        // Ván đầu: Tìm xem có người chơi nào cầm 3 bích (3♠) không
        const pWith3Spades = findPlayerWithThreeOfSpades(this.players);
        if (pWith3Spades) {
          this.currentTurnPlayerId = pWith3Spades.id;
          this.isFirstTurnOfGame = true;
          this.mustPlayThreeOfSpades = true;
          this.addSystemChat(`♠ Ván đầu: ${pWith3Spades.name} giữ 3 Bích (3♠) được quyền đi đầu (bắt buộc đánh bộ có 3♠).`);
        } else {
          // Bàn chơi 2-3 người: Không ai cầm 3 Bích (nằm trong phần bài thừa chưa chia)
          // Người có lá bài nhỏ nhất trong tất cả người chơi được quyền đi trước và đánh bài tự do
          const lowest = findLowestCardPlayer(this.players);
          if (lowest) {
            this.currentTurnPlayerId = lowest.player.id;
            this.isFirstTurnOfGame = true;
            this.mustPlayThreeOfSpades = false;
            const cardName = `${getRankLabel(lowest.lowestCard.rank)}${SUIT_SYMBOLS[lowest.lowestCard.suit]}`;
            this.addSystemChat(
              `♠ Ván này không ai có 3 Bích. ${lowest.player.name} có lá bài nhỏ nhất (${cardName}) được quyền đi trước tự do!`
            );
          } else {
            this.currentTurnPlayerId = this.players[0].id;
            this.isFirstTurnOfGame = false;
            this.mustPlayThreeOfSpades = false;
          }
        }
      } else {
        // Ván sau: Người thắng ván trước đi đầu
        const winner = this.players.find((p) => p.id === this.lastRoundWinnerId);
        this.currentTurnPlayerId = winner ? winner.id : this.players[0].id;
        this.isFirstTurnOfGame = false;
        this.mustPlayThreeOfSpades = false;
      }
      this.startTurnTimer();
    } else {
      // SÂM LỐC: Bắt đầu giai đoạn Xin Sâm (Báo Sâm)
      this.samLocState = {
        isBaoSamPhase: true,
        baoSamTimeRemaining: 8,
        baoSamPlayerId: null,
        respondedPlayerIds: [],
      };
      this.startBaoSamTimer(this.players);
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

    if (!this.samLocState.respondedPlayerIds) {
      this.samLocState.respondedPlayerIds = [];
    }
    if (!this.samLocState.respondedPlayerIds.includes(playerId)) {
      this.samLocState.respondedPlayerIds.push(playerId);
    }

    if (wantsBaoSam) {
      this.samLocState.baoSamPlayerId = playerId;
      this.addSystemChat(`🔥 ${player.name} ĐÃ BÁO SÂM! Sẽ đánh đầu tiên.`);
      this.finishBaoSamPhase(this.players);
      return;
    }

    // Nếu tất cả người chơi đang thi đấu đều đã phản hồi (đều chọn Không Báo)
    const activePlayers = this.players.filter((p) => !p.isSpectator && p.status === 'PLAYING');
    const allResponded = activePlayers.every((p) =>
      this.samLocState?.respondedPlayerIds?.includes(p.id)
    );

    if (allResponded) {
      this.finishBaoSamPhase(this.players);
      return;
    }

    this.onStateChange();
  }

  private finishBaoSamPhase(players: Player[] = this.players) {
    if (!this.samLocState) return;
    this.stopTimer();
    this.samLocState.isBaoSamPhase = false;

    if (this.samLocState.baoSamPlayerId) {
      this.currentTurnPlayerId = this.samLocState.baoSamPlayerId;
      const p = this.players.find((x) => x.id === this.currentTurnPlayerId);
      this.addSystemChat(`Người chơi ${p?.name} Báo Sâm bắt đầu đánh.`);
    } else {
      // Không ai báo sâm: người thắng ván trước hoặc người có bài nhỏ nhất đi trước
      if (this.lastRoundWinnerId && players.some((p) => p.id === this.lastRoundWinnerId)) {
        this.currentTurnPlayerId = this.lastRoundWinnerId;
      } else {
        // Tìm người có lá bài nhỏ nhất
        let minCardPlayer = players[0];
        let minRank = 99;
        for (const p of players) {
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

    // Kiểm tra lượt đầu tiên của ván: CHỈ bắt buộc chứa 3 Bích NẾU có người chơi cầm 3 Bích trong phòng
    if (this.rule === 'TIEN_LEN_MIEN_NAM' && this.isFirstTurnOfGame && this.mustPlayThreeOfSpades) {
      const has3Spade = playedCards.some(isThreeOfSpades);
      if (!has3Spade) {
        return { success: false, message: 'Bạn đang giữ 3 Bích (3♠), lượt đầu bắt buộc phải đánh bộ có chứa 3 Bích!' };
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
    this.mustPlayThreeOfSpades = false;
    player.hasPassedCurrentRound = false;

    this.addSystemChat(`${player.name} đánh: ${analyzed.description}`);

    // Kiểm tra người này đã hết bài chưa (Về Nhất -> Kết thúc ngay ván bài)
    if (player.cards.length === 0) {
      player.status = 'FINISHED';
      this.roundWinners = [player.id];
      player.rank = 1;
      this.addSystemChat(`🎉 ${player.name} đã đánh hết bài và giành chiến thắng Nhất!`);
      this.finishGame();
      return { success: true };
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
    this.stopTimer();
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
        const res = this.playHand(player.id, [lowestCard.id]);
        if (!res.success) {
          // Fallback an toàn nếu playHand không thành công
          this.isFirstTurnOfGame = false;
          this.mustPlayThreeOfSpades = false;
          this.advanceToNextTurn();
        }
      } else {
        this.advanceToNextTurn();
      }
    }
  }

  // --- KẾT THÚC VÁN ĐẤU & TÍNH ĐIỂM ---

  private finishGame() {
    this.stopTimer();
    this.status = 'FINISHED';

    // Xác định người về Nhất
    let winnerId = this.roundWinners[0];
    if (!winnerId) {
      const remaining = this.players.filter((p) => p.status !== 'DISCONNECTED');
      if (remaining.length > 0) {
        remaining.sort((a, b) => a.cards.length - b.cards.length);
        winnerId = remaining[0].id;
        this.roundWinners = [winnerId];
      } else {
        winnerId = this.players[0]?.id;
      }
    }

    this.lastRoundWinnerId = winnerId;
    const winner = this.players.find((p) => p.id === winnerId);
    if (winner) {
      winner.rank = 1;
    }

    // Những người chơi còn lại là người thua (xếp hạng theo số lá bài còn ít hơn)
    const losers = this.players.filter((p) => p.id !== winnerId);
    losers.sort((a, b) => a.cards.length - b.cards.length);
    losers.forEach((p, idx) => {
      p.rank = idx + 2;
    });

    let totalWonByWinner = 0;

    // Tính điểm trừ phạt cho từng người thua
    const loserResults: GameResultRecord[] = losers.map((p) => {
      const initialCardsCount = this.rule === 'SAM_LOC' ? 10 : 13;
      const isCong = p.cards.length === initialCardsCount;
      const blackHeoCount = p.cards.filter(
        (c) => c.rank === 15 && (c.suit === 'SPADE' || c.suit === 'CLUB')
      ).length;
      const redHeoCount = p.cards.filter(
        (c) => c.rank === 15 && (c.suit === 'DIAMOND' || c.suit === 'HEART')
      ).length;
      const has2 = blackHeoCount + redHeoCount > 0;

      // Mỗi lá bài còn lại bị phạt 10 xu (tối thiểu 10 xu cho người thua)
      let penalty = Math.max(10, p.cards.length * 10);

      // Phạt cóng (chưa ra được lá nào)
      if (isCong) {
        penalty += 50;
      }

      // Phạt thối heo (heo đen 30 xu, heo đỏ 60 xu)
      if (blackHeoCount > 0) {
        penalty += blackHeoCount * 30;
      }
      if (redHeoCount > 0) {
        penalty += redHeoCount * 60;
      }

      // Luật Sâm Lốc: Báo Sâm
      if (this.rule === 'SAM_LOC' && this.samLocState?.baoSamPlayerId) {
        if (this.samLocState.baoSamPlayerId === winnerId) {
          // Người báo sâm về nhất -> thắng Sâm: mỗi người đền 200 xu
          penalty = 200;
        } else if (p.id === this.samLocState.baoSamPlayerId) {
          // Báo sâm thất bại (bị đền sâm cho cả phòng)
          penalty = 200 * Math.max(1, this.players.length - 1);
        }
      }

      // Trừ điểm của người thua
      p.score = Math.max(0, p.score - penalty);
      totalWonByWinner += penalty;

      return {
        playerId: p.id,
        playerName: p.name,
        avatar: p.avatar,
        rank: p.rank || 4,
        cardsLeft: p.cards.length,
        cardsLeftList: [...p.cards],
        scoreChange: -penalty,
        isCong,
        isThoiHeo: has2,
      };
    });

    // Cộng toàn bộ tiền phạt từ các người thua cho người về Nhất
    if (winner) {
      winner.score += totalWonByWinner;
    }

    const winnerResult: GameResultRecord = {
      playerId: winner ? winner.id : winnerId,
      playerName: winner ? winner.name : 'Người thắng',
      avatar: winner ? winner.avatar : '👑',
      rank: 1,
      cardsLeft: 0,
      cardsLeftList: [],
      scoreChange: totalWonByWinner,
      isCong: false,
      isThoiHeo: false,
    };

    this.results = [winnerResult, ...loserResults].sort((a, b) => a.rank - b.rank);
    this.addSystemChat(
      `🏆 Ván đấu kết thúc! Chúc mừng ${winner?.name} giành vị trí Nhất (+${totalWonByWinner} xu)!`
    );
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
    const lastMsg = this.chatMessages[this.chatMessages.length - 1];
    if (lastMsg && lastMsg.isSystem && lastMsg.text === text && Date.now() - lastMsg.timestamp < 3000) {
      return;
    }
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

  // --- CỜ TƯỚNG (XIANGQI) BLITZ LOGIC ---

  private startXiangqiBlitzTimer() {
    this.stopTimer();

    this.timerInterval = setInterval(() => {
      if (this.status !== 'PLAYING' || !this.xiangqiState || this.xiangqiState.winnerSide) {
        this.stopTimer();
        return;
      }

      if (this.xiangqiState.currentSide === 'RED') {
        this.xiangqiState.redTimeRemaining -= 1;
        if (this.xiangqiState.redTimeRemaining <= 0) {
          this.xiangqiState.redTimeRemaining = 0;
          this.handleXiangqiTimeout('RED');
          return;
        }
      } else {
        this.xiangqiState.blackTimeRemaining -= 1;
        if (this.xiangqiState.blackTimeRemaining <= 0) {
          this.xiangqiState.blackTimeRemaining = 0;
          this.handleXiangqiTimeout('BLACK');
          return;
        }
      }

      this.onStateChange();
    }, 1000);
  }

  private handleXiangqiTimeout(loserSide: 'RED' | 'BLACK') {
    if (!this.xiangqiState) return;
    this.stopTimer();

    const winnerSide = loserSide === 'RED' ? 'BLACK' : 'RED';
    this.xiangqiState.winnerSide = winnerSide;
    this.xiangqiState.winReason = 'TIMEOUT';
    this.status = 'FINISHED';

    const winnerId = winnerSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;
    const loserId = loserSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;

    const winner = this.players.find((p) => p.id === winnerId);
    const loser = this.players.find((p) => p.id === loserId);

    const stakes = 100;
    if (winner && loser) {
      const penalty = Math.min(loser.score, stakes);
      loser.score -= penalty;
      winner.score += penalty;

      this.results = [
        {
          playerId: winner.id,
          playerName: winner.name,
          avatar: winner.avatar,
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: penalty,
        },
        {
          playerId: loser.id,
          playerName: loser.name,
          avatar: loser.avatar,
          rank: 2,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: -penalty,
        },
      ];
    }

    const loserSideName = loserSide === 'RED' ? 'Đỏ' : 'Đen';
    const winnerSideName = winnerSide === 'RED' ? 'Đỏ' : 'Đen';
    this.addSystemChat(
      `⏱️ HẾT GIỜ! Kỳ thủ ${loserSideName} (${loser?.name}) rụng kim hết thời gian. Kỳ thủ ${winnerSideName} (${winner?.name}) THẮNG cờ chớp!`
    );

    this.onStateChange();
  }

  public playXiangqiMove(
    playerId: string,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.xiangqiState || this.xiangqiState.winnerSide) {
      return { success: false, message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' };
    }

    const currentSide = this.xiangqiState.currentSide;
    const expectedPlayerId =
      currentSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;

    if (playerId !== expectedPlayerId) {
      return { success: false, message: 'Chưa tới lượt đi của bạn' };
    }

    const piece = getPieceAt(this.xiangqiState.pieces, from.x, from.y);
    if (!piece || piece.color !== currentSide) {
      return { success: false, message: 'Quân cờ không hợp lệ' };
    }

    const legalMoves = getLegalMoves(piece, this.xiangqiState.pieces);
    const isLegal = legalMoves.some((m) => m.x === to.x && m.y === to.y);
    if (!isLegal) {
      return { success: false, message: 'Nước đi không hợp lệ theo luật cờ tướng' };
    }

    // Thực hiện nước đi
    const capturedPiece = getPieceAt(this.xiangqiState.pieces, to.x, to.y);
    const newPieces = this.xiangqiState.pieces
      .filter((p) => !(p.x === to.x && p.y === to.y))
      .map((p) => (p.id === piece.id ? { ...p, x: to.x, y: to.y } : p));

    const notation = generateMoveNotation(piece, to, capturedPiece);
    const opponentSide = currentSide === 'RED' ? 'BLACK' : 'RED';
    const opponentInCheck = isSideInCheck(opponentSide, newPieces);

    const moveRecord: XiangqiMove = {
      from,
      to,
      piece: { ...piece, x: to.x, y: to.y },
      capturedPiece,
      notation,
      isCheck: opponentInCheck,
      timestamp: Date.now(),
    };

    this.xiangqiState.pieces = newPieces;
    this.xiangqiState.lastMove = moveRecord;
    this.xiangqiState.moveHistory.push(moveRecord);
    this.xiangqiState.isCheck = opponentInCheck;
    this.xiangqiState.checkSide = opponentInCheck ? opponentSide : null;
    this.xiangqiState.drawOfferFrom = null; // Huỷ đề nghị hòa cũ

    if (opponentInCheck) {
      this.addSystemChat(`⚡ CHIẾU TƯỚNG! (${notation})`);
    }

    // Kiểm tra Chiếu Bí hoặc Hết Nước Đi (Stalemate)
    const opponentHasMoves = hasAnyLegalMoves(opponentSide, newPieces);
    if (!opponentHasMoves) {
      this.stopTimer();
      this.xiangqiState.winnerSide = currentSide;
      this.xiangqiState.winReason = opponentInCheck ? 'CHECKMATE' : 'STALEMATE';
      this.status = 'FINISHED';

      const winnerId = expectedPlayerId;
      const loserId = opponentSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;
      const winner = this.players.find((p) => p.id === winnerId);
      const loser = this.players.find((p) => p.id === loserId);

      const stakes = 100;
      if (winner && loser) {
        const penalty = Math.min(loser.score, stakes);
        loser.score -= penalty;
        winner.score += penalty;

        this.results = [
          {
            playerId: winner.id,
            playerName: winner.name,
            avatar: winner.avatar,
            rank: 1,
            cardsLeft: 0,
            cardsLeftList: [],
            scoreChange: penalty,
          },
          {
            playerId: loser.id,
            playerName: loser.name,
            avatar: loser.avatar,
            rank: 2,
            cardsLeft: 0,
            cardsLeftList: [],
            scoreChange: -penalty,
          },
        ];
      }

      const reasonVN = opponentInCheck ? 'CHIẾU BÍ (Checkmate)' : 'HẾT NƯỚC ĐI (Stalemate)';
      this.addSystemChat(
        `🏆 TRẬN ĐẤU KẾT THÚC! ${winner?.name} (${currentSide === 'RED' ? 'Đỏ' : 'Đen'}) THẮNG do ${reasonVN}!`
      );
    } else {
      // Cộng thời gian tích lũy theo Luật Quốc tế (Fischer increment: +30s standard, +3s blitz)
      if (this.xiangqiState.incrementSeconds > 0) {
        if (currentSide === 'RED') {
          this.xiangqiState.redTimeRemaining += this.xiangqiState.incrementSeconds;
        } else {
          this.xiangqiState.blackTimeRemaining += this.xiangqiState.incrementSeconds;
        }
      }

      // Chuyển lượt
      this.xiangqiState.currentSide = opponentSide;
      this.currentTurnPlayerId =
        opponentSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;
    }

    this.onStateChange();
    return { success: true };
  }

  public resignXiangqi(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.xiangqiState || this.xiangqiState.winnerSide) {
      return { success: false, message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' };
    }

    const isRed = playerId === this.xiangqiState.redPlayerId;
    const isBlack = playerId === this.xiangqiState.blackPlayerId;

    if (!isRed && !isBlack) {
      return { success: false, message: 'Khán giả không thể đầu hàng' };
    }

    this.stopTimer();
    const loserSide: XiangqiSide = isRed ? 'RED' : 'BLACK';
    const winnerSide: XiangqiSide = isRed ? 'BLACK' : 'RED';

    this.xiangqiState.winnerSide = winnerSide;
    this.xiangqiState.winReason = 'RESIGN';
    this.status = 'FINISHED';

    const winnerId = winnerSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;
    const loser = this.players.find((p) => p.id === playerId);
    const winner = this.players.find((p) => p.id === winnerId);

    const stakes = 100;
    if (winner && loser) {
      const penalty = Math.min(loser.score, stakes);
      loser.score -= penalty;
      winner.score += penalty;

      this.results = [
        {
          playerId: winner.id,
          playerName: winner.name,
          avatar: winner.avatar,
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: penalty,
        },
        {
          playerId: loser.id,
          playerName: loser.name,
          avatar: loser.avatar,
          rank: 2,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: -penalty,
        },
      ];
    }

    this.addSystemChat(
      `🏳️ ${loser?.name} (${loserSide === 'RED' ? 'Đỏ' : 'Đen'}) đã xin đầu hàng. ${winner?.name} giành chiến thắng!`
    );
    this.onStateChange();
    return { success: true };
  }

  public offerXiangqiDraw(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.xiangqiState || this.xiangqiState.winnerSide) {
      return { success: false, message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' };
    }

    const isRed = playerId === this.xiangqiState.redPlayerId;
    const isBlack = playerId === this.xiangqiState.blackPlayerId;

    if (!isRed && !isBlack) {
      return { success: false, message: 'Khán giả không thể xin hòa' };
    }

    const side: XiangqiSide = isRed ? 'RED' : 'BLACK';
    this.xiangqiState.drawOfferFrom = side;

    const player = this.players.find((p) => p.id === playerId);
    this.addSystemChat(`🤝 ${player?.name} (${side === 'RED' ? 'Đỏ' : 'Đen'}) đề nghị hòa cờ.`);
    this.onStateChange();
    return { success: true };
  }

  public respondXiangqiDraw(playerId: string, accept: boolean): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.xiangqiState || !this.xiangqiState.drawOfferFrom) {
      return { success: false, message: 'Không có lời cầu hòa nào cần phản hồi' };
    }

    const isRed = playerId === this.xiangqiState.redPlayerId;
    const isBlack = playerId === this.xiangqiState.blackPlayerId;
    const mySide: XiangqiSide = isRed ? 'RED' : 'BLACK';

    if (mySide === this.xiangqiState.drawOfferFrom) {
      return { success: false, message: 'Bạn không thể tự chấp nhận lời cầu hòa của chính mình' };
    }

    const responder = this.players.find((p) => p.id === playerId);

    if (accept) {
      this.stopTimer();
      this.xiangqiState.winnerSide = 'DRAW';
      this.xiangqiState.winReason = 'AGREED_DRAW';
      this.status = 'FINISHED';

      const redP = this.players.find((p) => p.id === this.xiangqiState?.redPlayerId);
      const blackP = this.players.find((p) => p.id === this.xiangqiState?.blackPlayerId);

      this.results = [
        {
          playerId: redP ? redP.id : '',
          playerName: redP ? redP.name : 'Đỏ',
          avatar: redP ? redP.avatar : '🔴',
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: 0,
        },
        {
          playerId: blackP ? blackP.id : '',
          playerName: blackP ? blackP.name : 'Đen',
          avatar: blackP ? blackP.avatar : '⚫',
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: 0,
        },
      ];

      this.addSystemChat(`🤝 Hai kỳ thủ đã đồng ý HÒA CỜ! Trận đấu kết thúc với kết quả hòa.`);
    } else {
      this.xiangqiState.drawOfferFrom = null;
      this.addSystemChat(`${responder?.name} đã từ chối lời đề nghị hòa cờ. Trận đấu tiếp tục.`);
    }

    this.onStateChange();
    return { success: true };
  }

  // --- CỜ CARO LOGIC (5 PHÚT/BÊN - LUẬT ĂN 5 CHẶN 2 ĐẦU VẪN THẮNG) ---

  private startCaroTimer() {
    this.stopTimer();

    this.timerInterval = setInterval(() => {
      if (this.status !== 'PLAYING' || !this.caroState || this.caroState.winnerPiece) {
        this.stopTimer();
        return;
      }

      if (this.caroState.currentTurn === 'X') {
        this.caroState.xTimeRemaining -= 1;
        if (this.caroState.xTimeRemaining <= 0) {
          this.caroState.xTimeRemaining = 0;
          this.handleCaroTimeout('X');
          return;
        }
      } else {
        this.caroState.oTimeRemaining -= 1;
        if (this.caroState.oTimeRemaining <= 0) {
          this.caroState.oTimeRemaining = 0;
          this.handleCaroTimeout('O');
          return;
        }
      }

      this.onStateChange();
    }, 1000);
  }

  private handleCaroTimeout(loserPiece: 'X' | 'O') {
    if (!this.caroState) return;
    this.stopTimer();

    const winnerPiece = loserPiece === 'X' ? 'O' : 'X';
    this.caroState.winnerPiece = winnerPiece;
    this.caroState.winReason = 'TIMEOUT';
    this.status = 'FINISHED';

    const winnerId = winnerPiece === 'X' ? this.caroState.xPlayerId : this.caroState.oPlayerId;
    const loserId = loserPiece === 'X' ? this.caroState.xPlayerId : this.caroState.oPlayerId;

    const winner = this.players.find((p) => p.id === winnerId);
    const loser = this.players.find((p) => p.id === loserId);

    const stakes = 100;
    if (winner && loser) {
      const penalty = Math.min(loser.score, stakes);
      loser.score -= penalty;
      winner.score += penalty;

      this.results = [
        {
          playerId: winner.id,
          playerName: winner.name,
          avatar: winner.avatar,
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: penalty,
        },
        {
          playerId: loser.id,
          playerName: loser.name,
          avatar: loser.avatar,
          rank: 2,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: -penalty,
        },
      ];
    }

    this.addSystemChat(
      `⏰ HẾT GIỜ! Kỳ thủ ${loser?.name} (${loserPiece}) đã hết 5 phút thời gian suy nghĩ. ${winner?.name} (${winnerPiece}) THẮNG!`
    );
    this.onStateChange();
  }

  public playCaroMove(
    playerId: string,
    x: number,
    y: number
  ): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.caroState || this.caroState.winnerPiece) {
      return { success: false, message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' };
    }

    const currentPiece = this.caroState.currentTurn;
    const expectedPlayerId =
      currentPiece === 'X' ? this.caroState.xPlayerId : this.caroState.oPlayerId;

    if (playerId !== expectedPlayerId) {
      return { success: false, message: 'Chưa đến lượt đi của bạn' };
    }

    if (!isInsideBoard(x, y)) {
      return { success: false, message: 'Nước đi ra ngoài bàn cờ' };
    }

    if (this.caroState.board[y][x] !== null) {
      return { success: false, message: 'Ô này đã có quân cờ' };
    }

    // Đánh quân cờ vào ô (x, y)
    this.caroState.board[y][x] = currentPiece;

    const moveRecord: CaroMove = {
      x,
      y,
      piece: currentPiece,
      playerId,
      moveNumber: this.caroState.moveHistory.length + 1,
      timestamp: Date.now(),
    };

    this.caroState.lastMove = moveRecord;
    this.caroState.moveHistory.push(moveRecord);
    this.caroState.drawOfferFrom = null; // Hủy lời mời hòa cũ nếu có

    // Kiểm tra chiến thắng: Ăn 5 chặn 2 đầu vẫn win
    const winResult = checkCaroWin(this.caroState.board, x, y, currentPiece);

    if (winResult.isWin) {
      this.stopTimer();
      this.caroState.winnerPiece = currentPiece;
      this.caroState.winReason = 'FIVE_IN_A_ROW';
      this.caroState.winningLine = winResult.winningLine;
      this.status = 'FINISHED';

      const winnerId = expectedPlayerId;
      const loserId = currentPiece === 'X' ? this.caroState.oPlayerId : this.caroState.xPlayerId;
      const winner = this.players.find((p) => p.id === winnerId);
      const loser = this.players.find((p) => p.id === loserId);

      const stakes = 100;
      if (winner && loser) {
        const penalty = Math.min(loser.score, stakes);
        loser.score -= penalty;
        winner.score += penalty;

        this.results = [
          {
            playerId: winner.id,
            playerName: winner.name,
            avatar: winner.avatar,
            rank: 1,
            cardsLeft: 0,
            cardsLeftList: [],
            scoreChange: penalty,
          },
          {
            playerId: loser.id,
            playerName: loser.name,
            avatar: loser.avatar,
            rank: 2,
            cardsLeft: 0,
            cardsLeftList: [],
            scoreChange: -penalty,
          },
        ];
      }

      this.addSystemChat(
        `🏆 TRẬN ĐẤU KẾT THÚC! ${winner?.name} (${currentPiece}) THẮNG do xếp đủ chuỗi 5 quân liên tiếp!`
      );
    } else if (isCaroBoardFull(this.caroState.board)) {
      // Hòa cờ do kín bàn cờ
      this.stopTimer();
      this.caroState.winnerPiece = 'DRAW';
      this.status = 'FINISHED';

      const xP = this.players.find((p) => p.id === this.caroState?.xPlayerId);
      const oP = this.players.find((p) => p.id === this.caroState?.oPlayerId);

      this.results = [
        {
          playerId: xP ? xP.id : '',
          playerName: xP ? xP.name : 'X',
          avatar: xP ? xP.avatar : '❌',
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: 0,
        },
        {
          playerId: oP ? oP.id : '',
          playerName: oP ? oP.name : 'O',
          avatar: oP ? oP.avatar : '⭕',
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: 0,
        },
      ];

      this.addSystemChat('🤝 Bàn cờ đã đầy! Trận đấu kết thúc với kết quả HÒA.');
    } else {
      // Đổi lượt
      const nextPiece: CaroPiece = currentPiece === 'X' ? 'O' : 'X';
      this.caroState.currentTurn = nextPiece;
      this.currentTurnPlayerId =
        nextPiece === 'X' ? this.caroState.xPlayerId : this.caroState.oPlayerId;
    }

    this.onStateChange();
    return { success: true };
  }

  public resignCaro(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.caroState || this.caroState.winnerPiece) {
      return { success: false, message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' };
    }

    const isX = playerId === this.caroState.xPlayerId;
    const isO = playerId === this.caroState.oPlayerId;

    if (!isX && !isO) {
      return { success: false, message: 'Khán giả không thể đầu hàng' };
    }

    this.stopTimer();
    const loserPiece: CaroPiece = isX ? 'X' : 'O';
    const winnerPiece: CaroPiece = isX ? 'O' : 'X';

    this.caroState.winnerPiece = winnerPiece;
    this.caroState.winReason = 'RESIGN';
    this.status = 'FINISHED';

    const winnerId = winnerPiece === 'X' ? this.caroState.xPlayerId : this.caroState.oPlayerId;
    const loser = this.players.find((p) => p.id === playerId);
    const winner = this.players.find((p) => p.id === winnerId);

    const stakes = 100;
    if (winner && loser) {
      const penalty = Math.min(loser.score, stakes);
      loser.score -= penalty;
      winner.score += penalty;

      this.results = [
        {
          playerId: winner.id,
          playerName: winner.name,
          avatar: winner.avatar,
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: penalty,
        },
        {
          playerId: loser.id,
          playerName: loser.name,
          avatar: loser.avatar,
          rank: 2,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: -penalty,
        },
      ];
    }

    this.addSystemChat(
      `🏳️ ${loser?.name} (${loserPiece}) đã xin đầu hàng. ${winner?.name} (${winnerPiece}) giành chiến thắng!`
    );
    this.onStateChange();
    return { success: true };
  }

  public offerCaroDraw(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.caroState || this.caroState.winnerPiece) {
      return { success: false, message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' };
    }

    const isX = playerId === this.caroState.xPlayerId;
    const isO = playerId === this.caroState.oPlayerId;

    if (!isX && !isO) {
      return { success: false, message: 'Khán giả không thể xin hòa' };
    }

    const piece: CaroPiece = isX ? 'X' : 'O';
    this.caroState.drawOfferFrom = piece;

    const player = this.players.find((p) => p.id === playerId);
    this.addSystemChat(`🤝 ${player?.name} (${piece}) đề nghị hòa ván cờ.`);
    this.onStateChange();
    return { success: true };
  }

  public respondCaroDraw(playerId: string, accept: boolean): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.caroState || !this.caroState.drawOfferFrom) {
      return { success: false, message: 'Không có lời cầu hòa nào cần phản hồi' };
    }

    const isX = playerId === this.caroState.xPlayerId;
    const isO = playerId === this.caroState.oPlayerId;
    const myPiece: CaroPiece = isX ? 'X' : 'O';

    if (myPiece === this.caroState.drawOfferFrom) {
      return { success: false, message: 'Bạn không thể tự chấp nhận lời cầu hòa của chính mình' };
    }

    const responder = this.players.find((p) => p.id === playerId);

    if (accept) {
      this.stopTimer();
      this.caroState.winnerPiece = 'DRAW';
      this.caroState.winReason = 'AGREED_DRAW';
      this.status = 'FINISHED';

      const xP = this.players.find((p) => p.id === this.caroState?.xPlayerId);
      const oP = this.players.find((p) => p.id === this.caroState?.oPlayerId);

      this.results = [
        {
          playerId: xP ? xP.id : '',
          playerName: xP ? xP.name : 'X',
          avatar: xP ? xP.avatar : '❌',
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: 0,
        },
        {
          playerId: oP ? oP.id : '',
          playerName: oP ? oP.name : 'O',
          avatar: oP ? oP.avatar : '⭕',
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: 0,
        },
      ];

      this.addSystemChat(`🤝 Hai bên đã đồng ý HÒA ván cờ theo thỏa thuận.`);
    } else {
      this.caroState.drawOfferFrom = null;
      this.addSystemChat(`❌ ${responder?.name} đã từ chối lời mời hòa cờ.`);
    }

    this.onStateChange();
    return { success: true };
  }

  // Đưa phòng chơi về trạng thái phòng chờ (WAITING)
  public resetToWaitingRoom(requestedByPlayerId: string): { success: boolean; message?: string } {
    const requester = this.players.find((p) => p.id === requestedByPlayerId);
    if (!requester || !requester.isHost) {
      return { success: false, message: 'Chỉ chủ phòng mới có quyền đưa phòng về trạng thái chờ' };
    }

    this.stopTimer();
    this.status = 'WAITING';
    this.results = undefined;
    this.currentTurnPlayerId = null;
    this.lastPlayedHand = null;
    this.roundHistory = [];
    this.roundWinners = [];
    this.isFirstTurnOfGame = true;

    this.players.forEach((p) => {
      p.status = 'WAITING';
      p.hasPassedCurrentRound = false;
      p.cards = [];
    });

    if (this.xiangqiState) {
      this.xiangqiState.winnerSide = null;
      this.xiangqiState.winReason = undefined;
      this.xiangqiState.drawOfferFrom = null;
      this.xiangqiState.isCheck = false;
      this.xiangqiState.checkSide = null;
      this.xiangqiState.lastMove = null;
      this.xiangqiState.moveHistory = [];
      this.xiangqiState.redTimeRemaining = this.xiangqiState.initialBlitzTime;
      this.xiangqiState.blackTimeRemaining = this.xiangqiState.initialBlitzTime;
    }

    if (this.caroState) {
      this.caroState.winnerPiece = null;
      this.caroState.winReason = undefined;
      this.caroState.drawOfferFrom = null;
      this.caroState.lastMove = null;
      this.caroState.moveHistory = [];
      this.caroState.winningLine = null;
      this.caroState.board = createEmptyCaroBoard();
      this.caroState.xTimeRemaining = 300;
      this.caroState.oTimeRemaining = 300;
    }

    this.addSystemChat('Chủ phòng đã đưa phòng về trạng thái phòng chờ.');
    this.onStateChange();
    return { success: true };
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
      isSpectator: p.isSpectator,
      xiangqiSide: p.xiangqiSide,
      caroPiece: p.caroPiece,
    }));

    return {
      code: this.code,
      rule: this.rule,
      xiangqiTimeMode: this.xiangqiTimeMode,
      status: this.status,
      players: playersInfo,
      currentTurnPlayerId: this.currentTurnPlayerId,
      turnTimeRemaining: Math.max(0, this.turnTimeRemaining),
      turnDuration: this.turnDuration,
      lastPlayedHand: this.lastPlayedHand,
      lastRoundWinnerId: this.lastRoundWinnerId,
      gameNumber: this.gameNumber,
      isFirstTurnOfGame: this.isFirstTurnOfGame,
      mustPlayThreeOfSpades: this.mustPlayThreeOfSpades,
      samLocState: this.samLocState,
      xiangqiState: this.xiangqiState,
      caroState: this.caroState,
      results: this.results,
      voiceParticipants: this.getVoiceParticipants(),
    };
  }

  public getPlayerCards(playerId: string): Card[] {
    const p = this.players.find((x) => x.id === playerId);
    return p ? p.cards : [];
  }

  public cleanup() {
    this.stopTimer();
    this.disconnectTimers.forEach((timer) => clearTimeout(timer));
    this.disconnectTimers.clear();
    this.voiceParticipants.clear();
  }
}
