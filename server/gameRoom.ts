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
  CaroPiece,
  CaroMove,
  CaroState,
  BanTauState,
  PlacedShip,
  ShotRecord,
  CoCaNguaState,
  CaNguaColor,
  ChessState,
  ChessSide,
  ChessMoveRecord,
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
  isPlayableCaroCell,
  checkCaroWin,
  isCaroBoardFull,
} from './caroLogic';
import {
  BAN_TAU_BOARD_SIZE,
  TOTAL_SHIP_CELLS,
  validateFullFleet,
  generateRandomFleet,
  isInsideBanTauBoard,
} from './banTauLogic';
import {
  initCoCaNguaState,
  computeMovableHorses,
  executeHorseMove,
  getNextPlayerTurn,
} from './coCaNguaLogic';
import {
  createInitialChessState,
  executeChessMove,
} from './chessLogic';
import { analyzeChessPosition } from './geminiService';
import { generateLocalGrandmasterAnalysis } from './chessAnalysisEngine';

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
  public consecutivePassCount: number = 0;
  public results?: GameResultRecord[];
  public chatMessages: ChatMessage[] = [];
  public samLocState?: SamLocState;
  public xiangqiState?: XiangqiState;
  public caroState?: CaroState;
  public banTauState?: BanTauState;
  public coCaNguaState?: CoCaNguaState;
  public chessState?: ChessState;
  public xiangqiTimeMode: XiangqiTimeMode = 'STANDARD';

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
    const existingPlayer = this.players.find((p) => p.id === id);
    if (existingPlayer) {
      existingPlayer.socketId = socketId;
      existingPlayer.name = name;
      existingPlayer.avatar = avatar;
      existingPlayer.status = 'PLAYING';
      existingPlayer.disconnectedAt = null;

      const timer = this.disconnectTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.disconnectTimers.delete(id);
      }

      this.onStateChange();
      return { success: true };
    }

    const maxPlayers =
      this.rule === 'CO_VUA'
        ? 6
        : this.rule === 'CO_TUONG' || this.rule === 'CARO' || this.rule === 'BAN_TAU' || this.rule === 'CO_CA_NGUA'
        ? 8
        : 4;
    if (this.players.length >= maxPlayers) {
      return { success: false, message: `Phòng đã đầy (tối đa ${maxPlayers} người)` };
    }

    const startScore =
      typeof initialScore === 'number' && !isNaN(initialScore) && initialScore >= 0
        ? initialScore
        : 1000;

    // Nếu đang trong trận đấu: cho phép vào theo dõi trực tiếp (Spectator)
    if (this.status === 'PLAYING') {
      if (
        this.rule === 'CO_TUONG' ||
        this.rule === 'CARO' ||
        this.rule === 'BAN_TAU' ||
        this.rule === 'CO_CA_NGUA' ||
        this.rule === 'CO_VUA'
      ) {
        const takenSeats = new Set(this.players.map((p) => p.seatIndex));
        const spectatorSlots =
          this.rule === 'CO_VUA'
            ? [2, 3, 4, 5]
            : this.rule === 'CO_CA_NGUA'
            ? [4, 5, 6, 7]
            : [2, 3, 4, 5, 6, 7];
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
          returnedToWaiting: false,
        };

        this.players.push(newSpectator);
        if (this.rule === 'CO_TUONG' && this.xiangqiState && !this.xiangqiState.spectatorIds.includes(id)) {
          this.xiangqiState.spectatorIds.push(id);
        } else if (this.rule === 'CARO' && this.caroState && !this.caroState.spectatorIds.includes(id)) {
          this.caroState.spectatorIds.push(id);
        } else if (this.rule === 'BAN_TAU' && this.banTauState && !this.banTauState.spectatorIds.includes(id)) {
          this.banTauState.spectatorIds.push(id);
        } else if (this.rule === 'CO_CA_NGUA' && this.coCaNguaState && !this.coCaNguaState.spectatorIds.includes(id)) {
          this.coCaNguaState.spectatorIds.push(id);
        } else if (this.rule === 'CO_VUA' && this.chessState && !this.chessState.spectatorIds.includes(id)) {
          this.chessState.spectatorIds.push(id);
        }
        this.addSystemChat(`${name} đã vào phòng.`);
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
    let chessSide: ChessSide | undefined = undefined;

    if (this.rule === 'CO_CA_NGUA') {
      const takenSeats = new Set(this.players.map((p) => p.seatIndex));
      const playerSlots = [0, 1, 2, 3];
      const freePlayerSeat = playerSlots.find((s) => !takenSeats.has(s));
      if (freePlayerSeat !== undefined) {
        seatIndex = freePlayerSeat;
        isSpectator = false;
      } else {
        const spectatorSlots = [4, 5, 6, 7];
        const freeSpectator = spectatorSlots.find((s) => !takenSeats.has(s)) ?? this.players.length;
        seatIndex = freeSpectator;
        isSpectator = true;
      }
    } else if (this.rule === 'CO_TUONG') {
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
    } else if (this.rule === 'BAN_TAU') {
      const takenSeats = new Set(this.players.map((p) => p.seatIndex));
      if (!takenSeats.has(0)) {
        seatIndex = 0;
      } else if (!takenSeats.has(1)) {
        seatIndex = 1;
      } else {
        const spectatorSlots = [2, 3, 4, 5, 6, 7];
        const freeSpectator = spectatorSlots.find((s) => !takenSeats.has(s)) ?? this.players.length;
        seatIndex = freeSpectator;
        isSpectator = true;
      }
    } else if (this.rule === 'CO_VUA') {
      const takenSeats = new Set(this.players.map((p) => p.seatIndex));
      if (!takenSeats.has(0)) {
        seatIndex = 0;
        chessSide = 'WHITE';
      } else if (!takenSeats.has(1)) {
        seatIndex = 1;
        chessSide = 'BLACK';
      } else {
        const spectatorSlots = [2, 3, 4, 5];
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
      chessSide,
      returnedToWaiting: false,
    };

    this.players.push(newPlayer);
    this.addSystemChat(`${name} đã vào phòng.`);
    this.onStateChange();
    return { success: true };
  }

  public switchSeat(playerId: string, targetSeatIndex: number): { success: boolean; message?: string } {
    if (this.status === 'PLAYING') {
      return { success: false, message: 'Không thể đổi vị trí khi trận đấu đang diễn ra' };
    }
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Không tìm thấy người chơi' };

    const maxSeatIndex =
      this.rule === 'CO_VUA'
        ? 5
        : this.rule === 'CO_TUONG' || this.rule === 'CARO' || this.rule === 'BAN_TAU' || this.rule === 'CO_CA_NGUA'
        ? 7
        : 3;
    if (targetSeatIndex < 0 || targetSeatIndex > maxSeatIndex) {
      return { success: false, message: 'Vị trí không hợp lệ' };
    }

    const isSeatOccupied = this.players.some((p) => p.seatIndex === targetSeatIndex && p.id !== playerId);
    if (isSeatOccupied) {
      return { success: false, message: 'Vị trí này đã có người ngồi' };
    }

    player.seatIndex = targetSeatIndex;

    if (this.rule === 'CO_CA_NGUA') {
      player.isSpectator = targetSeatIndex >= 4;
    } else if (this.rule === 'CO_TUONG') {
      if (targetSeatIndex === 0) {
        player.isSpectator = false;
        player.xiangqiSide = 'RED';
      } else if (targetSeatIndex === 1) {
        player.isSpectator = false;
        player.xiangqiSide = 'BLACK';
      } else {
        player.isSpectator = true;
        player.xiangqiSide = undefined;
      }
    } else if (this.rule === 'CARO') {
      if (targetSeatIndex === 0) {
        player.isSpectator = false;
        player.caroPiece = 'X';
      } else if (targetSeatIndex === 1) {
        player.isSpectator = false;
        player.caroPiece = 'O';
      } else {
        player.isSpectator = true;
        player.caroPiece = undefined;
      }
    } else if (this.rule === 'BAN_TAU') {
      if (targetSeatIndex === 0) {
        player.isSpectator = false;
      } else if (targetSeatIndex === 1) {
        player.isSpectator = false;
      } else {
        player.isSpectator = true;
      }
    } else if (this.rule === 'CO_VUA') {
      if (targetSeatIndex === 0) {
        player.isSpectator = false;
        player.chessSide = 'WHITE';
      } else if (targetSeatIndex === 1) {
        player.isSpectator = false;
        player.chessSide = 'BLACK';
      } else {
        player.isSpectator = true;
        player.chessSide = undefined;
      }
    }

    this.onStateChange();
    return { success: true };
  }

  public removePlayer(playerId: string, reason: string = 'LEAVE') {
    const playerIndex = this.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return;

    const player = this.players[playerIndex];
    this.players.splice(playerIndex, 1);

    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    this.addSystemChat(`${player.name} đã rời phòng.`);

    if (this.players.length === 0) {
      this.onPlayerRemoved?.(playerId, true);
      return;
    }

    if (player.isHost) {
      this.autoTransferHost();
    }

    // Handle in-game disconnect
    if (this.status === 'PLAYING') {
      const activePlayingPlayers = this.players.filter(
        (p) => p.status === 'PLAYING' && !p.isSpectator && p.socketId !== null
      );
      if (activePlayingPlayers.length <= 1) {
        this.endGamePrematurely();
      }
    }

    this.onPlayerRemoved?.(playerId, false);
    this.onStateChange();
  }

  public handleDisconnect(socketId: string) {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return;

    player.socketId = null;
    player.disconnectedAt = Date.now();
    player.status = 'DISCONNECTED';

    const prevTimer = this.disconnectTimers.get(player.id);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(player.id);
      const target = this.players.find((p) => p.id === player.id);
      if (target && target.status === 'DISCONNECTED') {
        this.removePlayer(target.id, 'DISCONNECTED');
      }
    }, 60000);

    this.disconnectTimers.set(player.id, timer);

    if (this.status === 'WAITING' && player.isHost) {
      this.autoTransferHost();
    }

    this.onStateChange();
  }

  public transferHost(targetPlayerId: string, requestedByPlayerId: string): { success: boolean; message?: string } {
    const requester = this.players.find((p) => p.id === requestedByPlayerId);
    if (!requester || !requester.isHost) {
      return { success: false, message: 'Chỉ chủ phòng mới có quyền chuyển chủ phòng' };
    }

    const target = this.players.find((p) => p.id === targetPlayerId);
    if (!target) {
      return { success: false, message: 'Không tìm thấy người chơi được chỉ định' };
    }

    requester.isHost = false;
    target.isHost = true;
    this.addSystemChat(`👑 ${target.name} đã trở thành chủ phòng mới.`);
    this.onStateChange();
    return { success: true };
  }

  private autoTransferHost() {
    const nextHost = this.players.find((p) => p.socketId !== null);
    if (nextHost) {
      this.players.forEach((p) => (p.isHost = false));
      nextHost.isHost = true;
      this.addSystemChat(`👑 ${nextHost.name} được chỉ định làm chủ phòng.`);
    }
  }

  private findAvailableSeat(): number {
    const takenSeats = new Set(this.players.map((p) => p.seatIndex));
    const max =
      this.rule === 'CO_VUA'
        ? 6
        : this.rule === 'CO_TUONG' || this.rule === 'CARO' || this.rule === 'BAN_TAU' || this.rule === 'CO_CA_NGUA'
        ? 8
        : 4;
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

    const activeParticipants = this.players.filter(
      (p) =>
        !p.isSpectator &&
        p.socketId !== null &&
        (this.rule === 'CO_CA_NGUA'
          ? p.seatIndex >= 0 && p.seatIndex < 4
          : this.rule === 'CO_TUONG' || this.rule === 'CARO' || this.rule === 'BAN_TAU' || this.rule === 'CO_VUA'
          ? p.seatIndex === 0 || p.seatIndex === 1
          : true)
    );
    const stillReviewing = activeParticipants.filter((p) => p.returnedToWaiting === false && this.status === 'FINISHED');
    if (stillReviewing.length > 0) {
      return {
        success: false,
        message: `Vui lòng đợi tất cả người chơi về phòng chờ (còn ${stillReviewing.map((p) => p.name).join(', ')} đang xem lại kết quả)`,
      };
    }

    if (this.rule === 'CO_CA_NGUA') {
      const seatedPlayers = this.players
        .filter((p) => p.seatIndex >= 0 && p.seatIndex < 4 && !p.isSpectator)
        .sort((a, b) => a.seatIndex - b.seatIndex);

      if (seatedPlayers.length < 2) {
        return {
          success: false,
          message: 'Cần ít nhất 2 người chơi ở các ghế 1..4 để bắt đầu Cờ Cá Ngựa!',
        };
      }

      this.gameNumber += 1;
      this.status = 'PLAYING';
      this.results = undefined;

      const spectatorIds = this.players.filter((p) => p.isSpectator).map((p) => p.id);
      this.coCaNguaState = initCoCaNguaState(seatedPlayers, spectatorIds);
      this.currentTurnPlayerId = this.coCaNguaState.currentTurnPlayerId;

      this.players.forEach((p) => {
        p.status = 'PLAYING';
        p.returnedToWaiting = false;
        const caPlayer = this.coCaNguaState?.players.find((cp) => cp.playerId === p.id);
        if (caPlayer) {
          p.caNguaColor = caPlayer.color;
        }
      });

      this.startCoCaNguaTimer();
      this.onStateChange();
      return { success: true };
    }

    if (this.rule === 'BAN_TAU') {
      const p1 = this.players.find((p) => p.seatIndex === 0 && !p.isSpectator);
      const p2 = this.players.find((p) => p.seatIndex === 1 && !p.isSpectator);

      if (!p1 || !p2) {
        return {
          success: false,
          message: 'Cần đủ 2 Thuyền trưởng ở ghế 1 và ghế 2 để bắt đầu trận hải chiến!',
        };
      }

      this.gameNumber += 1;
      this.status = 'PLAYING';
      this.results = undefined;

      p1.ships = [];
      p1.fleetPlaced = false;
      p2.ships = [];
      p2.fleetPlaced = false;

      this.banTauState = {
        phase: 'PLACEMENT',
        player1Id: p1.id,
        player2Id: p2.id,
        currentTurnPlayerId: p1.id,
        turnTimeRemaining: 30,
        placementTimeRemaining: 90,
        player1: {
          playerId: p1.id,
          playerName: p1.name,
          fleetPlaced: false,
          isReady: false,
          totalHitsDealt: 0,
          shotsFired: [],
          shotsReceived: [],
          sunkShips: [],
        },
        player2: {
          playerId: p2.id,
          playerName: p2.name,
          fleetPlaced: false,
          isReady: false,
          totalHitsDealt: 0,
          shotsFired: [],
          shotsReceived: [],
          sunkShips: [],
        },
        shotHistory: [],
        lastShot: null,
        spectatorIds: this.players.filter((p) => p.isSpectator).map((p) => p.id),
        winnerPlayerId: null,
        winReason: undefined,
      };

      this.currentTurnPlayerId = p1.id;
      this.players.forEach((p) => {
        p.status = 'PLAYING';
      });

      this.addSystemChat(
        `⚓ HẢI CHIẾN BẮN TÀU CHÍNH THỨC BẮT ĐẦU! Hai thuyền trưởng (${p1.name} và ${p2.name}) hãy bố trí 5 tàu chiến lên hải đồ 10x10 rồi nhấn "Sẵn Sàng Chiến Đấu"!`
      );

      this.startBanTauPlacementTimer();
      this.onStateChange();
      return { success: true };
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
        `⚡ TRẬN ĐẤU CỜ CARO (20x20 - 5 PHÚT/BÊN) CHÍNH THỨC BẮT ĐẦU! Quân X (${xPlayer.name}) vs Quân O (${oPlayer.name}). Bàn cờ 20x20 trên các giao điểm (không đánh vào viền ngoài). Tổng thời gian 5 phút/kỳ thủ, ăn 5 chặn 2 đầu vẫn THẮNG!`
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

    if (this.rule === 'CO_VUA') {
      const whitePlayer = this.players.find((p) => p.seatIndex === 0 && !p.isSpectator);
      const blackPlayer = this.players.find((p) => p.seatIndex === 1 && !p.isSpectator);

      if (!whitePlayer || !blackPlayer) {
        return {
          success: false,
          message: 'Cần đủ 2 kỳ thủ ở vị trí Trắng (ghế 1) và Đen (ghế 2) để bắt đầu trận Cờ Vua!',
        };
      }

      this.gameNumber += 1;
      this.status = 'PLAYING';
      this.results = undefined;

      const spectatorIds = this.players.filter((p) => p.isSpectator).map((p) => p.id);
      this.chessState = createInitialChessState(whitePlayer.id, blackPlayer.id, spectatorIds);
      this.currentTurnPlayerId = whitePlayer.id;

      whitePlayer.chessSide = 'WHITE';
      blackPlayer.chessSide = 'BLACK';

      this.players.forEach((p) => {
        p.status = 'PLAYING';
        p.returnedToWaiting = false;
      });

      this.addSystemChat(
        `♟️ TRẬN ĐẤU CỜ VUA TIÊU CHUẨN ĐÃ BẮT ĐẦU! Quân Trắng (${whitePlayer.name}) ⚔️ Quân Đen (${blackPlayer.name}). Thời gian: 15 phút/bên (+10s mỗi nước đi). Cứ sau mỗi 5 nước đi của cả 2 người chơi (mỗi 10 ply), Trợ lý AI sẽ gửi nhận định thế cờ cho khán giả!`
      );

      this.startChessTimer();
      this.onStateChange();
      return { success: true };
    }

    // Card games: TIEN_LEN_MIEN_NAM or SAM_LOC
    if (this.players.length < 2) {
      return { success: false, message: 'Cần ít nhất 2 người chơi để bắt đầu' };
    }

    this.gameNumber += 1;
    this.status = 'PLAYING';
    this.results = undefined;
    this.roundWinners = [];
    this.isFirstTurnOfGame = true;

    this.players.forEach((p) => {
      p.status = 'PLAYING';
      p.cards = [];
      delete p.rank;
    });

    const deck = shuffleDeck(createDeck());
    const cardsPerPlayer = this.rule === 'SAM_LOC' ? 10 : 13;

    this.players.forEach((player, i) => {
      player.cards = sortCards(deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer));
      player.hasPassedCurrentRound = false;
    });

    if (this.rule === 'SAM_LOC') {
      this.samLocState = {
        isBaoSamPhase: true,
        baoSamTimeRemaining: 15,
        baoSamPlayerId: null,
        respondedPlayerIds: [],
      };
      this.currentTurnPlayerId = null;
      this.addSystemChat('🔥 Giai đoạn Báo Sâm bắt đầu! Mọi người có 15 giây để quyết định.');
      this.startBaoSamTimer();
    } else {
      // Tiến Lên Miền Nam
      if (this.gameNumber === 1 || !this.lastRoundWinnerId) {
        const starter = findPlayerWithThreeOfSpades(this.players);
        this.currentTurnPlayerId = starter.id;
        this.firstTurnPlayerId = starter.id;
        this.mustPlayThreeOfSpades = true;
        this.addSystemChat(`Ván đầu tiên: ${starter.name} cầm 3 Bích nên được đi trước!`);
      } else {
        const prevWinner = this.players.find((p) => p.id === this.lastRoundWinnerId);
        this.currentTurnPlayerId = prevWinner ? prevWinner.id : this.players[0].id;
        this.firstTurnPlayerId = this.currentTurnPlayerId;
        this.mustPlayThreeOfSpades = false;
        this.addSystemChat(`${prevWinner ? prevWinner.name : this.players[0].name} nhất ván trước nên được đi trước.`);
      }
      this.startTurnTimer();
    }

    this.onStateChange();
    return { success: true };
  }

  // --- SÂM LỐC METHODS ---

  private startBaoSamTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (!this.samLocState || !this.samLocState.isBaoSamPhase) {
        this.stopTimer();
        return;
      }

      this.samLocState.baoSamTimeRemaining -= 1;
      this.turnTimeRemaining = this.samLocState.baoSamTimeRemaining;

      if (this.samLocState.baoSamTimeRemaining <= 0) {
        this.endBaoSamPhase();
      } else {
        this.onStateChange();
      }
    }, 1000);
  }

  public respondBaoSam(playerId: string, doesBaoSam: boolean): { success: boolean; message?: string } {
    if (!this.samLocState || !this.samLocState.isBaoSamPhase) {
      return { success: false, message: 'Không trong giai đoạn báo Sâm' };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Không tìm thấy người chơi' };

    this.samLocState.respondedPlayerIds = this.samLocState.respondedPlayerIds || [];
    if (this.samLocState.respondedPlayerIds.includes(playerId)) {
      return { success: false, message: 'Bạn đã phản hồi rồi' };
    }

    this.samLocState.respondedPlayerIds.push(playerId);

    if (doesBaoSam) {
      this.samLocState.baoSamPlayerId = playerId;
      this.addSystemChat(`⚡ ${player.name} ĐÃ BÁO SÂM! Chuẩn bị bước vào ván đấu khốc liệt!`);
      this.endBaoSamPhase();
      return { success: true };
    } else {
      this.addSystemChat(`${player.name} không báo Sâm.`);
    }

    if (this.samLocState.respondedPlayerIds.length >= this.players.length) {
      this.endBaoSamPhase();
    } else {
      this.onStateChange();
    }

    return { success: true };
  }

  private endBaoSamPhase() {
    this.stopTimer();
    if (!this.samLocState) return;

    this.samLocState.isBaoSamPhase = false;

    if (this.samLocState.baoSamPlayerId) {
      this.currentTurnPlayerId = this.samLocState.baoSamPlayerId;
      this.firstTurnPlayerId = this.samLocState.baoSamPlayerId;
      const baoSamPlayer = this.players.find((p) => p.id === this.samLocState?.baoSamPlayerId);
      this.addSystemChat(`⚡ ${baoSamPlayer?.name} báo Sâm thành công và được quyền đi trước!`);
    } else {
      const starter = findLowestCardPlayer(this.players);
      this.currentTurnPlayerId = starter.player.id;
      this.firstTurnPlayerId = starter.player.id;
      this.addSystemChat(`Không ai báo Sâm. ${starter.player.name} có lá bài nhỏ nhất nên được đi trước.`);
    }

    this.mustPlayThreeOfSpades = false;
    this.startTurnTimer();
    this.onStateChange();
  }

  // --- BẮN TÀU (BATTLESHIP) METHODS ---

  private startBanTauPlacementTimer() {
    this.stopTimer();
    this.turnTimeRemaining = 90;

    this.timerInterval = setInterval(() => {
      if (this.status !== 'PLAYING' || this.rule !== 'BAN_TAU' || !this.banTauState) {
        this.stopTimer();
        return;
      }

      this.banTauState.placementTimeRemaining -= 1;
      this.turnTimeRemaining = this.banTauState.placementTimeRemaining;

      if (this.banTauState.placementTimeRemaining <= 0) {
        this.stopTimer();
        // Auto-place for any player who hasn't placed
        const p1 = this.players.find((p) => p.id === this.banTauState?.player1Id);
        const p2 = this.players.find((p) => p.id === this.banTauState?.player2Id);
        if (p1 && (!p1.ships || p1.ships.length !== 5)) {
          p1.ships = generateRandomFleet();
          p1.fleetPlaced = true;
          this.banTauState.player1.fleetPlaced = true;
          this.banTauState.player1.isReady = true;
        }
        if (p2 && (!p2.ships || p2.ships.length !== 5)) {
          p2.ships = generateRandomFleet();
          p2.fleetPlaced = true;
          this.banTauState.player2.fleetPlaced = true;
          this.banTauState.player2.isReady = true;
        }
        this.checkBanTauBothReady();
      } else {
        this.onStateChange();
      }
    }, 1000);
  }

  private startBanTauBattleTimer() {
    this.stopTimer();
    if (!this.banTauState) return;
    this.banTauState.turnTimeRemaining = 30;
    this.turnTimeRemaining = 30;

    this.timerInterval = setInterval(() => {
      if (
        this.status !== 'PLAYING' ||
        this.rule !== 'BAN_TAU' ||
        !this.banTauState ||
        this.banTauState.phase !== 'BATTLE'
      ) {
        this.stopTimer();
        return;
      }

      this.banTauState.turnTimeRemaining -= 1;
      this.turnTimeRemaining = this.banTauState.turnTimeRemaining;

      if (this.banTauState.turnTimeRemaining <= 0) {
        this.handleBanTauTurnTimeout();
      } else {
        this.onStateChange();
      }
    }, 1000);
  }

  private handleBanTauTurnTimeout() {
    if (!this.banTauState || this.banTauState.phase !== 'BATTLE') return;
    const currentTurnId = this.banTauState.currentTurnPlayerId;
    if (!currentTurnId) return;

    const isP1 = currentTurnId === this.banTauState.player1Id;
    const shooterState = isP1 ? this.banTauState.player1 : this.banTauState.player2;

    const shotCoordinates = new Set(shooterState.shotsFired.map((s) => `${s.x},${s.y}`));
    const availableCells: { x: number; y: number }[] = [];
    for (let y = 0; y < BAN_TAU_BOARD_SIZE; y++) {
      for (let x = 0; x < BAN_TAU_BOARD_SIZE; x++) {
        if (!shotCoordinates.has(`${x},${y}`)) {
          availableCells.push({ x, y });
        }
      }
    }

    if (availableCells.length > 0) {
      const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
      this.addSystemChat(`⏱️ Hết thời gian! Hệ thống tự động khai hỏa giúp Thuyền trưởng.`);
      this.banTauFire(currentTurnId, randomCell.x, randomCell.y);
    } else {
      const nextPlayerId = isP1 ? this.banTauState.player2Id : this.banTauState.player1Id;
      this.banTauState.currentTurnPlayerId = nextPlayerId;
      this.currentTurnPlayerId = nextPlayerId;
      this.startBanTauBattleTimer();
      this.onStateChange();
    }
  }

  public banTauPlaceShips(playerId: string, ships: PlacedShip[]): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || this.rule !== 'BAN_TAU' || !this.banTauState) {
      return { success: false, message: 'Trận đấu chưa bắt đầu hoặc không hợp lệ' };
    }
    if (this.banTauState.phase !== 'PLACEMENT') {
      return { success: false, message: 'Đã qua giai đoạn bố trí hạm đội' };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Không tìm thấy người chơi' };

    const validation = validateFullFleet(ships);
    if (!validation.valid) {
      return { success: false, message: validation.reason || 'Đội hình tàu không hợp lệ' };
    }

    player.ships = ships;
    player.fleetPlaced = true;

    if (playerId === this.banTauState.player1Id) {
      this.banTauState.player1.fleetPlaced = true;
    } else if (playerId === this.banTauState.player2Id) {
      this.banTauState.player2.fleetPlaced = true;
    }

    this.onStateChange();
    return { success: true };
  }

  public banTauAutoPlace(playerId: string): { success: boolean; ships?: PlacedShip[]; message?: string } {
    if (this.status !== 'PLAYING' || this.rule !== 'BAN_TAU' || !this.banTauState) {
      return { success: false, message: 'Trận đấu chưa bắt đầu' };
    }
    if (this.banTauState.phase !== 'PLACEMENT') {
      return { success: false, message: 'Đã qua giai đoạn bố trí' };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Không tìm thấy người chơi' };

    const fleet = generateRandomFleet();
    player.ships = fleet;
    player.fleetPlaced = true;

    if (playerId === this.banTauState.player1Id) {
      this.banTauState.player1.fleetPlaced = true;
    } else if (playerId === this.banTauState.player2Id) {
      this.banTauState.player2.fleetPlaced = true;
    }

    this.onStateChange();
    return { success: true, ships: fleet };
  }

  public banTauReady(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || this.rule !== 'BAN_TAU' || !this.banTauState) {
      return { success: false, message: 'Trận đấu chưa bắt đầu' };
    }
    if (this.banTauState.phase !== 'PLACEMENT') {
      return { success: false, message: 'Đã qua giai đoạn chuẩn bị' };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.ships || player.ships.length !== 5) {
      return { success: false, message: 'Bạn chưa bố trí đủ 5 tàu chiến' };
    }

    if (playerId === this.banTauState.player1Id) {
      this.banTauState.player1.isReady = true;
      this.addSystemChat(`⚓ Thuyền trưởng ${player.name} (Hạm đội 1) đã sẵn sàng chiến đấu!`);
    } else if (playerId === this.banTauState.player2Id) {
      this.banTauState.player2.isReady = true;
      this.addSystemChat(`⚓ Thuyền trưởng ${player.name} (Hạm đội 2) đã sẵn sàng chiến đấu!`);
    }

    this.checkBanTauBothReady();
    this.onStateChange();
    return { success: true };
  }

  private checkBanTauBothReady() {
    if (!this.banTauState || this.banTauState.phase !== 'PLACEMENT') return;
    if (this.banTauState.player1.isReady && this.banTauState.player2.isReady) {
      this.banTauState.phase = 'BATTLE';
      this.banTauState.currentTurnPlayerId = this.banTauState.player1Id;
      this.currentTurnPlayerId = this.banTauState.player1Id;

      const p1 = this.players.find((p) => p.id === this.banTauState?.player1Id);

      this.addSystemChat(
        `🚀 CẢ HAI HẠM ĐỘI ĐÃ BỐ TRÍ XONG! Trận địa hải chiến chính thức bắt đầu! Thuyền trưởng ${p1?.name || 'Hạm đội 1'} khai hỏa phát đạn đầu tiên!`
      );

      this.startBanTauBattleTimer();
      this.onStateChange();
    }
  }

  public banTauFire(playerId: string, x: number, y: number): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || this.rule !== 'BAN_TAU' || !this.banTauState) {
      return { success: false, message: 'Trận hải chiến chưa bắt đầu' };
    }
    if (this.banTauState.phase !== 'BATTLE') {
      return { success: false, message: 'Chưa vào giai đoạn khai hỏa' };
    }
    if (this.banTauState.currentTurnPlayerId !== playerId) {
      return { success: false, message: 'Chưa đến lượt bắn của bạn' };
    }
    if (!isInsideBanTauBoard(x, y)) {
      return { success: false, message: 'Tọa độ ngoài hải đồ 10x10' };
    }

    const isP1 = playerId === this.banTauState.player1Id;
    const targetPlayerId = isP1 ? this.banTauState.player2Id : this.banTauState.player1Id;
    if (!targetPlayerId) {
      return { success: false, message: 'Không tìm thấy đối thủ' };
    }

    const shooter = this.players.find((p) => p.id === playerId);
    const target = this.players.find((p) => p.id === targetPlayerId);
    if (!shooter || !target) {
      return { success: false, message: 'Người chơi không hợp lệ' };
    }

    const shooterState = isP1 ? this.banTauState.player1 : this.banTauState.player2;
    const targetState = isP1 ? this.banTauState.player2 : this.banTauState.player1;

    // Check if cell already shot
    if (shooterState.shotsFired.some((s) => s.x === x && s.y === y)) {
      return { success: false, message: 'Tọa độ này đã bắn rồi, hãy chọn tọa độ khác' };
    }

    // Check hit on target's ships
    const targetShips = target.ships || [];
    let isHit = false;
    let shipSunkName: string | null = null;

    for (const ship of targetShips) {
      if (ship.cells.some((c) => c.x === x && c.y === y)) {
        isHit = true;
        ship.hits += 1;
        if (ship.hits >= ship.size) {
          ship.isSunk = true;
          shipSunkName = ship.name;
          targetState.sunkShips.push({
            shipId: ship.shipId,
            name: ship.name,
            size: ship.size,
            cells: [...ship.cells],
          });
        }
        break;
      }
    }

    const colLabel = String.fromCharCode(65 + x);
    const rowLabel = y + 1;
    const coordStr = `${colLabel}${rowLabel}`;

    const shotRecord: ShotRecord = {
      x,
      y,
      shooterId: playerId,
      targetPlayerId,
      isHit,
      shipSunkName,
      timestamp: Date.now(),
      shotNumber: this.banTauState.shotHistory.length + 1,
    };

    this.banTauState.shotHistory.push(shotRecord);
    this.banTauState.lastShot = shotRecord;

    shooterState.shotsFired.push({ x, y, isHit, shipSunkName });
    targetState.shotsReceived.push({ x, y, isHit });

    if (isHit) {
      shooterState.totalHitsDealt += 1;
    }

    // Check Victory Condition: all 17 ship cells hit
    if (shooterState.totalHitsDealt >= TOTAL_SHIP_CELLS) {
      this.banTauState.phase = 'FINISHED';
      this.banTauState.winnerPlayerId = playerId;
      this.banTauState.winReason = 'ALL_SHIPS_SUNK';
      this.status = 'FINISHED';
      this.stopTimer();

      // Reveal all ships for both players
      this.banTauState.player1.revealedShips = this.players.find((p) => p.id === this.banTauState?.player1Id)?.ships;
      this.banTauState.player2.revealedShips = this.players.find((p) => p.id === this.banTauState?.player2Id)?.ships;

      const winCoins = 100;
      shooter.score += winCoins;
      target.score = Math.max(0, target.score - winCoins);

      this.addSystemChat(
        `🏆 HẠM ĐỘI ĐÃ QUÉT SẠCH TOÀN BỘ TÀU ĐỐI THỦ! Thuyền trưởng ${shooter.name} giành CHIẾN THẮNG HUY HOÀNG (+${winCoins} xu)!`
      );

      this.onStateChange();
      return { success: true };
    }

    if (isHit) {
      if (shipSunkName) {
        this.addSystemChat(
          `💥 [${shooter.name}] BẮN TRÚNG ô ${coordStr} VÀ ĐÃ BẮN CHÌM ${shipSunkName}! Thuyền trưởng được bắn thêm 1 phát!`
        );
      } else {
        this.addSystemChat(
          `💥 [${shooter.name}] BẮN TRÚNG TÀU tại ô ${coordStr}! Được bắn thêm 1 phát!`
        );
      }
      this.startBanTauBattleTimer();
    } else {
      this.addSystemChat(
        `💧 [${shooter.name}] bắn vào ô ${coordStr} nhưng trượt! Chuyển lượt cho Thuyền trưởng ${target.name}.`
      );
      this.banTauState.currentTurnPlayerId = targetPlayerId;
      this.currentTurnPlayerId = targetPlayerId;
      this.startBanTauBattleTimer();
    }

    this.onStateChange();
    return { success: true };
  }

  public banTauResign(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || this.rule !== 'BAN_TAU' || !this.banTauState || this.banTauState.winnerPlayerId) {
      return { success: false, message: 'Không thể đầu hàng lúc này' };
    }

    const isP1 = playerId === this.banTauState.player1Id;
    const isP2 = playerId === this.banTauState.player2Id;
    if (!isP1 && !isP2) {
      return { success: false, message: 'Bạn không phải thuyền trưởng trong trận đấu này' };
    }

    const winnerId = isP1 ? this.banTauState.player2Id : this.banTauState.player1Id;
    if (!winnerId) return { success: false };

    const resigner = this.players.find((p) => p.id === playerId);
    const winner = this.players.find((p) => p.id === winnerId);

    this.banTauState.phase = 'FINISHED';
    this.banTauState.winnerPlayerId = winnerId;
    this.banTauState.winReason = 'RESIGN';
    this.status = 'FINISHED';
    this.stopTimer();

    this.banTauState.player1.revealedShips = this.players.find((p) => p.id === this.banTauState?.player1Id)?.ships;
    this.banTauState.player2.revealedShips = this.players.find((p) => p.id === this.banTauState?.player2Id)?.ships;

    if (winner && resigner) {
      const winCoins = 100;
      winner.score += winCoins;
      resigner.score = Math.max(0, resigner.score - winCoins);
      this.addSystemChat(
        `🏳️ Thuyền trưởng ${resigner.name} đã chủ động xin đầu hàng! ${winner.name} giành chiến thắng (+${winCoins} xu).`
      );
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
        }
      } else {
        this.caroState.oTimeRemaining -= 1;
        if (this.caroState.oTimeRemaining <= 0) {
          this.caroState.oTimeRemaining = 0;
          this.handleCaroTimeout('O');
        }
      }

      this.turnTimeRemaining =
        this.caroState.currentTurn === 'X'
          ? this.caroState.xTimeRemaining
          : this.caroState.oTimeRemaining;

      this.onStateChange();
    }, 1000);
  }

  private handleCaroTimeout(loserPiece: CaroPiece) {
    this.stopTimer();
    if (!this.caroState) return;

    const winnerPiece: CaroPiece = loserPiece === 'X' ? 'O' : 'X';
    this.caroState.winnerPiece = winnerPiece;
    this.caroState.winReason = 'TIMEOUT';
    this.status = 'FINISHED';

    const winnerId = winnerPiece === 'X' ? this.caroState.xPlayerId : this.caroState.oPlayerId;
    const loserId = loserPiece === 'X' ? this.caroState.xPlayerId : this.caroState.oPlayerId;

    const winner = this.players.find((p) => p.id === winnerId);
    const loser = this.players.find((p) => p.id === loserId);

    const winCoins = 100;
    if (winner && loser) {
      winner.score += winCoins;
      loser.score = Math.max(0, loser.score - winCoins);
      this.addSystemChat(
        `⏱️ HẾT GIỜ! Kỳ thủ ${loser.name} (${loserPiece}) đã hết 5 phút suy nghĩ. ${winner.name} (${winnerPiece}) THẮNG (+${winCoins} xu)!`
      );
    }

    this.onStateChange();
  }

  public caroMove(playerId: string, x: number, y: number): { success: boolean; message?: string } {
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
      return { success: false, message: 'Tọa độ ngoài bàn cờ' };
    }

    if (!isPlayableCaroCell(x, y)) {
      return { success: false, message: 'Không được đánh vào viền ngoài của bàn cờ' };
    }

    if (this.caroState.board[y][x] !== null) {
      return { success: false, message: 'Ô này đã có quân cờ' };
    }

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
    this.caroState.drawOfferFrom = null;

    const winResult = checkCaroWin(this.caroState.board, x, y, currentPiece);

    if (winResult.isWin) {
      this.stopTimer();
      this.caroState.winnerPiece = currentPiece;
      this.caroState.winReason = 'FIVE_IN_A_ROW';
      this.caroState.winningLine = winResult.winningLine;
      this.status = 'FINISHED';

      const winnerId = playerId;
      const loserId = currentPiece === 'X' ? this.caroState.oPlayerId : this.caroState.xPlayerId;
      const winner = this.players.find((p) => p.id === winnerId);
      const loser = this.players.find((p) => p.id === loserId);

      const winCoins = 100;
      if (winner && loser) {
        winner.score += winCoins;
        loser.score = Math.max(0, loser.score - winCoins);
        this.addSystemChat(
          `🎉 CHÚC MỪNG! Kỳ thủ ${winner.name} (${currentPiece}) đã tạo chuỗi 5 quân liên tiếp và giành CHIẾN THẮNG (+${winCoins} xu)!`
        );
      }

      this.onStateChange();
      return { success: true };
    } else if (isCaroBoardFull(this.caroState.board)) {
      this.stopTimer();
      this.caroState.winnerPiece = 'DRAW';
      this.caroState.winReason = 'AGREED_DRAW';
      this.status = 'FINISHED';

      const xP = this.players.find((p) => p.id === this.caroState?.xPlayerId);
      const oP = this.players.find((p) => p.id === this.caroState?.oPlayerId);
      this.addSystemChat(`🤝 Bàn cờ đã đầy không còn ô trống. Trận đấu Cờ Caro KẾT THÚC HÒA!`);

      this.onStateChange();
      return { success: true };
    }

    const nextPiece: CaroPiece = currentPiece === 'X' ? 'O' : 'X';
    this.caroState.currentTurn = nextPiece;
    this.currentTurnPlayerId =
      nextPiece === 'X' ? this.caroState.xPlayerId : this.caroState.oPlayerId;

    this.onStateChange();
    return { success: true };
  }

  public caroResign(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.caroState || this.caroState.winnerPiece) {
      return { success: false, message: 'Trận đấu chưa diễn ra hoặc đã kết thúc' };
    }

    const isX = playerId === this.caroState.xPlayerId;
    const isO = playerId === this.caroState.oPlayerId;

    if (!isX && !isO) {
      return { success: false, message: 'Bạn không phải là kỳ thủ trong trận đấu này' };
    }

    this.stopTimer();

    const resignPiece: CaroPiece = isX ? 'X' : 'O';
    const winnerPiece: CaroPiece = isX ? 'O' : 'X';
    this.caroState.winnerPiece = winnerPiece;
    this.caroState.winReason = 'RESIGN';
    this.status = 'FINISHED';

    const winnerId = winnerPiece === 'X' ? this.caroState.xPlayerId : this.caroState.oPlayerId;
    const resignerId = playerId;
    const winner = this.players.find((p) => p.id === winnerId);
    const resigner = this.players.find((p) => p.id === resignerId);

    const winCoins = 100;
    if (winner && resigner) {
      winner.score += winCoins;
      resigner.score = Math.max(0, resigner.score - winCoins);
      this.addSystemChat(
        `🏳️ Kỳ thủ ${resigner.name} (${resignPiece}) đã chủ động xin đầu hàng. ${winner.name} (${winnerPiece}) giành chiến thắng (+${winCoins} xu)!`
      );
    }

    this.onStateChange();
    return { success: true };
  }

  public caroOfferDraw(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.caroState || this.caroState.winnerPiece) {
      return { success: false, message: 'Trận đấu chưa diễn ra hoặc đã kết thúc' };
    }

    const isX = playerId === this.caroState.xPlayerId;
    const isO = playerId === this.caroState.oPlayerId;
    if (!isX && !isO) {
      return { success: false, message: 'Bạn không phải là kỳ thủ trong trận đấu này' };
    }

    const piece: CaroPiece = isX ? 'X' : 'O';
    this.caroState.drawOfferFrom = piece;

    const offerPlayer = this.players.find((p) => p.id === playerId);
    this.addSystemChat(`🤝 Kỳ thủ ${offerPlayer?.name} (${piece}) đã gửi lời xin HÒA cờ.`);
    this.onStateChange();
    return { success: true };
  }

  public caroRespondDraw(playerId: string, accept: boolean): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.caroState || !this.caroState.drawOfferFrom) {
      return { success: false, message: 'Không có lời xin hòa nào đang chờ' };
    }

    const isX = playerId === this.caroState.xPlayerId;
    const isO = playerId === this.caroState.oPlayerId;
    const myPiece: CaroPiece = isX ? 'X' : 'O';

    if (myPiece === this.caroState.drawOfferFrom) {
      return { success: false, message: 'Bạn không thể tự trả lời lời mời hòa của chính mình' };
    }

    const responder = this.players.find((p) => p.id === playerId);

    if (accept) {
      this.stopTimer();
      this.caroState.winnerPiece = 'DRAW';
      this.caroState.winReason = 'AGREED_DRAW';
      this.status = 'FINISHED';

      const xP = this.players.find((p) => p.id === this.caroState?.xPlayerId);
      const oP = this.players.find((p) => p.id === this.caroState?.oPlayerId);
      this.addSystemChat(
        `🤝 Kỳ thủ ${responder?.name} đã ĐỒNG Ý hòa cờ! Trận cờ Caro kết thúc BẤT PHÂN THẮNG BẠI.`
      );
    } else {
      this.addSystemChat(`❌ Kỳ thủ ${responder?.name} đã TỪ CHỐI lời xin hòa. Trận đấu tiếp tục!`);
      this.caroState.drawOfferFrom = null;
    }

    this.onStateChange();
    return { success: true };
  }

  // --- CỜ TƯỚNG (XIANGQI) METHODS ---

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
        }
      } else {
        this.xiangqiState.blackTimeRemaining -= 1;
        if (this.xiangqiState.blackTimeRemaining <= 0) {
          this.xiangqiState.blackTimeRemaining = 0;
          this.handleXiangqiTimeout('BLACK');
        }
      }

      this.turnTimeRemaining =
        this.xiangqiState.currentSide === 'RED'
          ? this.xiangqiState.redTimeRemaining
          : this.xiangqiState.blackTimeRemaining;

      this.onStateChange();
    }, 1000);
  }

  private handleXiangqiTimeout(loserSide: XiangqiSide) {
    this.stopTimer();
    if (!this.xiangqiState) return;

    const winnerSide: XiangqiSide = loserSide === 'RED' ? 'BLACK' : 'RED';
    this.xiangqiState.winnerSide = winnerSide;
    this.xiangqiState.winReason = 'TIMEOUT';
    this.status = 'FINISHED';

    const winnerId =
      winnerSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;
    const loserId =
      loserSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;

    const winner = this.players.find((p) => p.id === winnerId);
    const loser = this.players.find((p) => p.id === loserId);

    const winCoins = 100;
    if (winner && loser) {
      winner.score += winCoins;
      loser.score = Math.max(0, loser.score - winCoins);
      const modeLabel = this.xiangqiState.timeMode === 'STANDARD' ? '60 phút' : '5 phút';
      this.addSystemChat(
        `⏱️ HẾT GIỜ! Kỳ thủ ${loser.name} (${loserSide === 'RED' ? 'Đỏ' : 'Đen'}) đã hết ${modeLabel} suy nghĩ. ${winner.name} (${winnerSide === 'RED' ? 'Đỏ' : 'Đen'}) THẮNG (+${winCoins} xu)!`
      );
    }

    this.onStateChange();
  }

  public xiangqiMove(
    playerId: string,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.xiangqiState || this.xiangqiState.winnerSide) {
      return { success: false, message: 'Trận cờ chưa bắt đầu hoặc đã kết thúc' };
    }

    const currentSide = this.xiangqiState.currentSide;
    const expectedPlayerId =
      currentSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;

    if (playerId !== expectedPlayerId) {
      return { success: false, message: 'Chưa đến lượt đi của bạn' };
    }

    const piece = getPieceAt(this.xiangqiState.pieces, from.x, from.y);
    if (!piece) {
      return { success: false, message: 'Không có quân cờ ở ô xuất phát' };
    }
    if (piece.color !== currentSide) {
      return { success: false, message: 'Không thể đi quân cờ của đối phương' };
    }

    const legalMoves = getLegalMoves(piece, this.xiangqiState.pieces);
    const isLegal = legalMoves.some((m) => m.x === to.x && m.y === to.y);
    if (!isLegal) {
      return { success: false, message: 'Nước đi không hợp lệ theo luật Cờ Tướng' };
    }

    const targetPiece = getPieceAt(this.xiangqiState.pieces, to.x, to.y);

    const nextPieces = this.xiangqiState.pieces
      .filter((p) => !(p.x === to.x && p.y === to.y))
      .map((p) => {
        if (p.id === piece.id) {
          return { ...p, x: to.x, y: to.y };
        }
        return p;
      });

    this.xiangqiState.pieces = nextPieces;

    const oppSide: XiangqiSide = currentSide === 'RED' ? 'BLACK' : 'RED';
    const isCheck = isSideInCheck(oppSide, nextPieces);
    this.xiangqiState.isCheck = isCheck;
    this.xiangqiState.checkSide = isCheck ? oppSide : null;

    const notation = generateMoveNotation(piece, to, targetPiece);

    const moveRecord: XiangqiMove = {
      from,
      to,
      piece: { ...piece, x: to.x, y: to.y },
      capturedPiece: targetPiece,
      notation,
      isCheck,
      timestamp: Date.now(),
    };

    this.xiangqiState.lastMove = moveRecord;
    this.xiangqiState.moveHistory.push(moveRecord);
    this.xiangqiState.drawOfferFrom = null;

    if (currentSide === 'RED') {
      this.xiangqiState.redTimeRemaining += this.xiangqiState.incrementSeconds;
    } else {
      this.xiangqiState.blackTimeRemaining += this.xiangqiState.incrementSeconds;
    }

    const oppHasLegalMoves = hasAnyLegalMoves(oppSide, nextPieces);
    if (!oppHasLegalMoves) {
      this.stopTimer();
      this.xiangqiState.winnerSide = currentSide;
      this.xiangqiState.winReason = isCheck ? 'CHECKMATE' : 'STALEMATE';
      this.status = 'FINISHED';

      const winnerId = playerId;
      const loserId = oppSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;
      const winner = this.players.find((p) => p.id === winnerId);
      const loser = this.players.find((p) => p.id === loserId);

      const winCoins = 100;
      if (winner && loser) {
        winner.score += winCoins;
        loser.score = Math.max(0, loser.score - winCoins);
        const winWord = isCheck ? 'CHIẾU BÍ' : 'BỨC TỬ (Hết nước đi)';
        this.addSystemChat(
          `⚔️ ${winWord}! ${winner.name} (${currentSide === 'RED' ? 'Đỏ' : 'Đen'}) đã giành CHIẾN THẮNG (+${winCoins} xu)!`
        );
      }

      this.onStateChange();
      return { success: true };
    }

    this.xiangqiState.currentSide = oppSide;
    this.currentTurnPlayerId =
      oppSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;

    if (isCheck) {
      this.addSystemChat(`⚡ CHIẾU TƯỚNG! Quân ${currentSide === 'RED' ? 'Đỏ' : 'Đen'} đang chiếu tướng!`);
    }

    this.onStateChange();
    return { success: true };
  }

  public xiangqiResign(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.xiangqiState || this.xiangqiState.winnerSide) {
      return { success: false, message: 'Trận cờ chưa diễn ra hoặc đã kết thúc' };
    }

    const isRed = playerId === this.xiangqiState.redPlayerId;
    const isBlack = playerId === this.xiangqiState.blackPlayerId;

    if (!isRed && !isBlack) {
      return { success: false, message: 'Bạn không phải là kỳ thủ trong trận đấu này' };
    }

    this.stopTimer();

    const resignSide: XiangqiSide = isRed ? 'RED' : 'BLACK';
    const winnerSide: XiangqiSide = isRed ? 'BLACK' : 'RED';
    this.xiangqiState.winnerSide = winnerSide;
    this.xiangqiState.winReason = 'RESIGN';
    this.status = 'FINISHED';

    const winnerId =
      winnerSide === 'RED' ? this.xiangqiState.redPlayerId : this.xiangqiState.blackPlayerId;
    const resignerId = playerId;
    const winner = this.players.find((p) => p.id === winnerId);
    const resigner = this.players.find((p) => p.id === resignerId);

    const winCoins = 100;
    if (winner && resigner) {
      winner.score += winCoins;
      resigner.score = Math.max(0, resigner.score - winCoins);
      this.addSystemChat(
        `🏳️ Kỳ thủ ${resigner.name} (${resignSide === 'RED' ? 'Đỏ' : 'Đen'}) đã chủ động xin đầu hàng. ${winner.name} (${winnerSide === 'RED' ? 'Đỏ' : 'Đen'}) giành chiến thắng (+${winCoins} xu)!`
      );
    }

    this.onStateChange();
    return { success: true };
  }

  public xiangqiOfferDraw(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.xiangqiState || this.xiangqiState.winnerSide) {
      return { success: false, message: 'Trận cờ chưa diễn ra hoặc đã kết thúc' };
    }

    const isRed = playerId === this.xiangqiState.redPlayerId;
    const isBlack = playerId === this.xiangqiState.blackPlayerId;
    if (!isRed && !isBlack) {
      return { success: false, message: 'Bạn không phải là kỳ thủ trong trận đấu này' };
    }

    const side: XiangqiSide = isRed ? 'RED' : 'BLACK';
    this.xiangqiState.drawOfferFrom = side;

    const offerPlayer = this.players.find((p) => p.id === playerId);
    this.addSystemChat(`🤝 Kỳ thủ ${offerPlayer?.name} (${side === 'RED' ? 'Đỏ' : 'Đen'}) đã gửi lời xin CẦU HÒA.`);
    this.onStateChange();
    return { success: true };
  }

  public xiangqiRespondDraw(playerId: string, accept: boolean): { success: boolean; message?: string } {
    if (!this.xiangqiState || !this.xiangqiState.drawOfferFrom) {
      return { success: false, message: 'Không có lời xin hòa nào đang chờ' };
    }

    const isRed = playerId === this.xiangqiState.redPlayerId;
    const isBlack = playerId === this.xiangqiState.blackPlayerId;
    const mySide: XiangqiSide = isRed ? 'RED' : 'BLACK';

    if (mySide === this.xiangqiState.drawOfferFrom) {
      return { success: false, message: 'Bạn không thể tự trả lời lời mời hòa của chính mình' };
    }

    const responder = this.players.find((p) => p.id === playerId);

    if (accept) {
      this.stopTimer();
      this.xiangqiState.winnerSide = 'DRAW';
      this.xiangqiState.winReason = 'AGREED_DRAW';
      this.status = 'FINISHED';

      const redP = this.players.find((p) => p.id === this.xiangqiState?.redPlayerId);
      const blackP = this.players.find((p) => p.id === this.xiangqiState?.blackPlayerId);
      this.addSystemChat(`🤝 Kỳ thủ ${responder?.name} đã ĐỒNG Ý hòa cờ! Trận đấu kết thúc HÒA.`);
    } else {
      this.addSystemChat(`❌ Kỳ thủ ${responder?.name} đã TỪ CHỐI lời xin hòa. Trận đấu tiếp tục!`);
      this.xiangqiState.drawOfferFrom = null;
    }

    this.onStateChange();
    return { success: true };
  }

  // --- CỜ VUA (CHESS) METHODS ---

  private startChessTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.status !== 'PLAYING' || !this.chessState || this.chessState.winnerSide) {
        this.stopTimer();
        return;
      }

      if (this.chessState.turn === 'WHITE') {
        this.chessState.whiteTimeRemaining -= 1;
        if (this.chessState.whiteTimeRemaining <= 0) {
          this.chessState.whiteTimeRemaining = 0;
          this.handleChessTimeout('WHITE');
        }
      } else {
        this.chessState.blackTimeRemaining -= 1;
        if (this.chessState.blackTimeRemaining <= 0) {
          this.chessState.blackTimeRemaining = 0;
          this.handleChessTimeout('BLACK');
        }
      }

      this.turnTimeRemaining =
        this.chessState.turn === 'WHITE'
          ? this.chessState.whiteTimeRemaining
          : this.chessState.blackTimeRemaining;

      this.onStateChange();
    }, 1000);
  }

  private handleChessTimeout(loserSide: ChessSide) {
    this.stopTimer();
    if (!this.chessState) return;

    const winnerSide: ChessSide = loserSide === 'WHITE' ? 'BLACK' : 'WHITE';
    this.chessState.winnerSide = winnerSide;
    this.chessState.winReason = 'TIMEOUT';
    this.status = 'FINISHED';

    const winnerId =
      winnerSide === 'WHITE' ? this.chessState.whitePlayerId : this.chessState.blackPlayerId;
    const loserId =
      loserSide === 'WHITE' ? this.chessState.whitePlayerId : this.chessState.blackPlayerId;

    const winner = this.players.find((p) => p.id === winnerId);
    const loser = this.players.find((p) => p.id === loserId);

    const winCoins = 100;
    if (winner && loser) {
      winner.score += winCoins;
      loser.score = Math.max(0, loser.score - winCoins);
      this.addSystemChat(
        `⏰ Hết thời gian! ${loser.name} (${loserSide === 'WHITE' ? 'Trắng' : 'Đen'}) bị xử thua do hết giờ. ${winner.name} (${winnerSide === 'WHITE' ? 'Trắng' : 'Đen'}) giành chiến thắng (+${winCoins} xu)!`
      );
    }

    this.onStateChange();
  }

  public chessMove(
    playerId: string,
    from: string,
    to: string,
    promotion?: string
  ): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.chessState || this.chessState.winnerSide) {
      return { success: false, message: 'Trận cờ chưa bắt đầu hoặc đã kết thúc' };
    }

    const currentTurn = this.chessState.turn;
    const expectedPlayerId =
      currentTurn === 'WHITE' ? this.chessState.whitePlayerId : this.chessState.blackPlayerId;

    if (playerId !== expectedPlayerId) {
      return { success: false, message: 'Chưa đến lượt đi của bạn' };
    }

    const moveRes = executeChessMove(this.chessState, from, to, promotion);
    if (!moveRes.success || !moveRes.newState || !moveRes.moveRecord) {
      return { success: false, message: moveRes.message || 'Nước đi không hợp lệ' };
    }

    this.chessState = moveRes.newState;
    const nextPlayerId =
      this.chessState.turn === 'WHITE' ? this.chessState.whitePlayerId : this.chessState.blackPlayerId;
    this.currentTurnPlayerId = nextPlayerId;
    this.turnTimeRemaining =
      this.chessState.turn === 'WHITE'
        ? this.chessState.whiteTimeRemaining
        : this.chessState.blackTimeRemaining;

    if (this.chessState.winnerSide) {
      this.stopTimer();
      this.status = 'FINISHED';

      if (this.chessState.winnerSide === 'DRAW') {
        const reasonMsg =
          this.chessState.winReason === 'STALEMATE'
            ? 'Hết nước đi hợp lệ (Stalemate / Pat)'
            : this.chessState.winReason === 'THREEFOLD'
            ? 'Thế cờ lặp lại 3 lần'
            : this.chessState.winReason === 'INSUFFICIENT_MATERIAL'
            ? 'Không đủ lực lượng chiếu bí'
            : 'Luật 50 nước';
        this.addSystemChat(`🤝 Trận đấu CỜ VUA kết thúc HÒA (${reasonMsg})!`);
      } else {
        const winnerId =
          this.chessState.winnerSide === 'WHITE'
            ? this.chessState.whitePlayerId
            : this.chessState.blackPlayerId;
        const loserId =
          this.chessState.winnerSide === 'WHITE'
            ? this.chessState.blackPlayerId
            : this.chessState.whitePlayerId;

        const winner = this.players.find((p) => p.id === winnerId);
        const loser = this.players.find((p) => p.id === loserId);

        const winCoins = 100;
        if (winner && loser) {
          winner.score += winCoins;
          loser.score = Math.max(0, loser.score - winCoins);
          this.addSystemChat(
            `👑 CHIẾU BÍ (CHECKMATE)! ${winner.name} (${this.chessState.winnerSide === 'WHITE' ? 'Trắng' : 'Đen'}) đã chiếu bí đối phương xuất sắc giành chiến thắng (+${winCoins} xu)!`
          );
        }
      }
    } else if (this.chessState.isCheck) {
      this.addSystemChat(
        `⚡ CHIẾU TƯỚNG! Bên ${this.chessState.turn === 'WHITE' ? 'Trắng' : 'Đen'} đang bị chiếu!`
      );
    }

    // GRANDMASTER COMMENTARY: Phân tích chuyên môn sâu sắc chỉ hiển thị cho khán giả (spectator)
    if (moveRes.triggerAiAnalysis) {
      const moveCount = this.chessState.moveHistory.length;
      const whiteName = this.players.find((p) => p.id === this.chessState?.whitePlayerId)?.name || 'Trắng';
      const blackName = this.players.find((p) => p.id === this.chessState?.blackPlayerId)?.name || 'Đen';
      const currentPgn = this.chessState.pgn;
      const currentFen = this.chessState.fen;

      const localEval = generateLocalGrandmasterAnalysis(
        this.chessState.moveHistory,
        currentFen,
        whiteName,
        blackName
      );

      analyzeChessPosition(
        currentPgn,
        currentFen,
        moveCount,
        whiteName,
        blackName,
        localEval,
        this.chessState.isCheckmate
      )
        .then((analysis) => {
          if (!this.chessState) return;
          // isSpectatorOnly = true: Chỉ khách mới xem được bình luận này, 2 người chơi không xem được
          this.addAiChat(analysis, true);
          this.chessState.lastAiAnalysis = {
            moveIndex: moveCount,
            text: analysis,
            timestamp: Date.now(),
          };
          this.onStateChange();
        })
        .catch((err) => {
          console.error('Lỗi khi phân tích cờ vua AI:', err);
          if (localEval?.fullGrandmasterCommentary) {
            this.addAiChat(localEval.fullGrandmasterCommentary, true);
            this.onStateChange();
          }
        });
    }

    this.onStateChange();
    return { success: true };
  }

  public chessResign(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.chessState || this.chessState.winnerSide) {
      return { success: false, message: 'Trận cờ chưa diễn ra hoặc đã kết thúc' };
    }

    const isWhite = playerId === this.chessState.whitePlayerId;
    const isBlack = playerId === this.chessState.blackPlayerId;
    if (!isWhite && !isBlack) {
      return { success: false, message: 'Bạn không phải là kỳ thủ trong trận đấu này' };
    }

    this.stopTimer();
    const resignSide: ChessSide = isWhite ? 'WHITE' : 'BLACK';
    const winnerSide: ChessSide = isWhite ? 'BLACK' : 'WHITE';
    this.chessState.winnerSide = winnerSide;
    this.chessState.winReason = 'RESIGN';
    this.status = 'FINISHED';

    const winnerId =
      winnerSide === 'WHITE' ? this.chessState.whitePlayerId : this.chessState.blackPlayerId;
    const resignerId = playerId;
    const winner = this.players.find((p) => p.id === winnerId);
    const resigner = this.players.find((p) => p.id === resignerId);

    const winCoins = 100;
    if (winner && resigner) {
      winner.score += winCoins;
      resigner.score = Math.max(0, resigner.score - winCoins);
      this.addSystemChat(
        `🏳️ Kỳ thủ ${resigner.name} (${resignSide === 'WHITE' ? 'Trắng' : 'Đen'}) đã xin đầu hàng. ${winner.name} (${winnerSide === 'WHITE' ? 'Trắng' : 'Đen'}) giành chiến thắng (+${winCoins} xu)!`
      );
    }

    this.onStateChange();
    return { success: true };
  }

  public chessOfferDraw(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.chessState || this.chessState.winnerSide) {
      return { success: false, message: 'Trận cờ chưa diễn ra hoặc đã kết thúc' };
    }

    const isWhite = playerId === this.chessState.whitePlayerId;
    const isBlack = playerId === this.chessState.blackPlayerId;
    if (!isWhite && !isBlack) {
      return { success: false, message: 'Bạn không phải là kỳ thủ trong trận đấu này' };
    }

    const side: ChessSide = isWhite ? 'WHITE' : 'BLACK';
    this.chessState.drawOfferFrom = side;

    const offerPlayer = this.players.find((p) => p.id === playerId);
    this.addSystemChat(`🤝 Kỳ thủ ${offerPlayer?.name} (${side === 'WHITE' ? 'Trắng' : 'Đen'}) đã gửi lời xin CẦU HÒA.`);
    this.onStateChange();
    return { success: true };
  }

  public chessRespondDraw(playerId: string, accept: boolean): { success: boolean; message?: string } {
    if (!this.chessState || !this.chessState.drawOfferFrom) {
      return { success: false, message: 'Không có lời xin hòa nào đang chờ' };
    }

    const isWhite = playerId === this.chessState.whitePlayerId;
    const isBlack = playerId === this.chessState.blackPlayerId;
    if (!isWhite && !isBlack) {
      return { success: false, message: 'Bạn không phải kỳ thủ trong trận đấu' };
    }

    const mySide: ChessSide = isWhite ? 'WHITE' : 'BLACK';

    if (mySide === this.chessState.drawOfferFrom) {
      return { success: false, message: 'Bạn không thể tự trả lời lời mời hòa của chính mình' };
    }

    const responder = this.players.find((p) => p.id === playerId);

    if (accept) {
      this.stopTimer();
      this.chessState.winnerSide = 'DRAW';
      this.chessState.winReason = 'AGREED_DRAW';
      this.status = 'FINISHED';

      this.addSystemChat(`🤝 Kỳ thủ ${responder?.name} đã ĐỒNG Ý hòa cờ! Trận đấu kết thúc HÒA.`);
    } else {
      this.addSystemChat(`❌ Kỳ thủ ${responder?.name} đã TỪ CHỐI lời xin hòa. Trận đấu tiếp tục!`);
      this.chessState.drawOfferFrom = null;
    }

    this.onStateChange();
    return { success: true };
  }

  // --- TIẾN LÊN / SÂM LỐC GAME METHODS ---

  private startTurnTimer() {
    this.stopTimer();
    this.turnTimeRemaining = this.turnDuration;

    this.timerInterval = setInterval(() => {
      if (this.status !== 'PLAYING') {
        this.stopTimer();
        return;
      }

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

    const currentPlayer = this.players.find((p) => p.id === this.currentTurnPlayerId);
    if (!currentPlayer) return;

    if (this.lastPlayedHand === null) {
      let cardToPlay: Card;
      if (this.mustPlayThreeOfSpades) {
        const threeSpade = currentPlayer.cards.find(isThreeOfSpades);
        cardToPlay = threeSpade || currentPlayer.cards[0];
      } else {
        cardToPlay = currentPlayer.cards[0];
      }

      this.playHand(currentPlayer.id, [cardToPlay.id]);
    } else {
      this.passTurn(currentPlayer.id);
    }
  }

  public playHand(playerId: string, cardIds: string[]): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING') {
      return { success: false, message: 'Ván đấu chưa bắt đầu' };
    }

    if (this.currentTurnPlayerId !== playerId) {
      return { success: false, message: 'Chưa đến lượt của bạn' };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Không tìm thấy người chơi' };

    const selectedCards = player.cards.filter((c) => cardIds.includes(c.id));
    if (selectedCards.length !== cardIds.length) {
      return { success: false, message: 'Một số lá bài không có trong tay bạn' };
    }

    if (this.mustPlayThreeOfSpades && !hasThreeOfSpades(selectedCards)) {
      return { success: false, message: 'Nước đi đầu tiên của ván mới BẮT BUỘC phải có 3 Bích (3♠)!' };
    }

    const analyzed = analyzeHandByRule(this.rule, selectedCards);
    if (!analyzed.isValid) {
      return { success: false, message: 'Bộ bài không hợp lệ theo luật' };
    }

    if (this.lastPlayedHand !== null) {
      const beatCheck = canBeatByRule(this.rule, analyzed, this.lastPlayedHand);
      if (!beatCheck.canBeat) {
        return { success: false, message: beatCheck.reason || 'Bài không chặt được bộ bài trước' };
      }
    }

    player.cards = player.cards.filter((c) => !cardIds.includes(c.id));

    const played: PlayedHand = {
      playerId: player.id,
      playerName: player.name,
      cards: selectedCards,
      type: analyzed.type,
      highestCard: analyzed.highestCard,
      description: analyzed.description,
      timestamp: Date.now(),
    };

    this.lastPlayedHand = played;
    this.roundHistory.push(played);
    this.consecutivePassCount = 0;
    this.mustPlayThreeOfSpades = false;
    this.isFirstTurnOfGame = false;

    const cardsStr = selectedCards
      .map((c) => `${getRankLabel(c.rank)}${SUIT_SYMBOLS[c.suit]}`)
      .join(' ');
    this.addSystemChat(`${player.name} đánh: ${analyzed.description} (${cardsStr})`);

    if (player.cards.length === 0) {
      player.status = 'FINISHED';
      this.roundWinners.push(player.id);
      player.rank = this.roundWinners.length;

      const rankTitle =
        player.rank === 1 ? 'NHẤT' : player.rank === 2 ? 'NHÌ' : player.rank === 3 ? 'BA' : 'BÉT';
      this.addSystemChat(`🎉 ${player.name} đã về ${rankTitle}!`);

      if (this.rule === 'SAM_LOC') {
        this.finishGame();
        return { success: true };
      }

      const activePlayers = this.players.filter((p) => p.status === 'PLAYING');
      if (activePlayers.length <= 1) {
        if (activePlayers.length === 1) {
          const lastPlayer = activePlayers[0];
          lastPlayer.status = 'FINISHED';
          this.roundWinners.push(lastPlayer.id);
          lastPlayer.rank = this.roundWinners.length;
        }
        this.finishGame();
        return { success: true };
      }
    }

    this.advanceTurn(playerId);
    this.onStateChange();
    return { success: true };
  }

  public passTurn(playerId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING') {
      return { success: false, message: 'Ván đấu chưa bắt đầu' };
    }

    if (this.currentTurnPlayerId !== playerId) {
      return { success: false, message: 'Chưa đến lượt của bạn' };
    }

    if (this.lastPlayedHand === null) {
      return { success: false, message: 'Bạn là người mở vòng, không được bỏ lượt' };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Không tìm thấy người chơi' };

    player.hasPassedCurrentRound = true;
    this.addSystemChat(`${player.name} bỏ qua.`);

    this.advanceTurn(playerId);
    this.onStateChange();
    return { success: true };
  }

  private advanceTurn(lastPlayerId: string) {
    const activePlayersInRound = this.players.filter(
      (p) => p.status === 'PLAYING' && !p.hasPassedCurrentRound
    );

    if (activePlayersInRound.length === 0) {
      this.startNewRound(lastPlayerId);
      return;
    }

    if (activePlayersInRound.length === 1) {
      this.startNewRound(activePlayersInRound[0].id);
      return;
    }

    const activePlayers = this.players.filter((p) => p.status === 'PLAYING');
    const currentIndex = activePlayers.findIndex((p) => p.id === lastPlayerId);

    let nextIndex = (currentIndex + 1) % activePlayers.length;
    let attempts = 0;

    while (activePlayers[nextIndex].hasPassedCurrentRound && attempts < activePlayers.length) {
      nextIndex = (nextIndex + 1) % activePlayers.length;
      attempts++;
    }

    if (attempts >= activePlayers.length) {
      this.startNewRound(lastPlayerId);
      return;
    }

    this.currentTurnPlayerId = activePlayers[nextIndex].id;
    this.startTurnTimer();
  }

  private startNewRound(winnerPlayerId: string) {
    let newRoundLeader = this.players.find((p) => p.id === winnerPlayerId);

    if (!newRoundLeader || newRoundLeader.status !== 'PLAYING') {
      const active = this.players.filter((p) => p.status === 'PLAYING');
      newRoundLeader = active[0];
    }

    if (!newRoundLeader) {
      this.finishGame();
      return;
    }

    this.lastPlayedHand = null;
    this.consecutivePassCount = 0;
    this.currentTurnPlayerId = newRoundLeader.id;

    this.players.forEach((p) => {
      p.hasPassedCurrentRound = false;
    });

    this.addSystemChat(`🌟 Vòng mới bắt đầu! Quyền đánh thuộc về ${newRoundLeader.name}.`);
    this.startTurnTimer();
    this.onStateChange();
  }

  private finishGame() {
    this.stopTimer();
    this.status = 'FINISHED';
    this.currentTurnPlayerId = null;

    if (this.roundWinners.length > 0) {
      this.lastRoundWinnerId = this.roundWinners[0];
    }

    const resultRecords: GameResultRecord[] = [];

    if (this.rule === 'SAM_LOC') {
      const winnerId = this.roundWinners[0];
      const winner = this.players.find((p) => p.id === winnerId);
      const isBaoSam = this.samLocState?.baoSamPlayerId === winnerId;

      let totalWon = 0;
      this.players.forEach((p) => {
        if (p.id !== winnerId) {
          const cardsCount = p.cards.length;
          const scoreLost = isBaoSam ? 200 : cardsCount * 10;
          totalWon += scoreLost;
          p.score = Math.max(0, p.score - scoreLost);

          resultRecords.push({
            playerId: p.id,
            playerName: p.name,
            avatar: p.avatar,
            rank: 2,
            cardsLeft: cardsCount,
            cardsLeftList: p.cards,
            scoreChange: -scoreLost,
            isCong: cardsCount === 10,
            isThoiHeo: p.cards.some((c) => c.rank === 15),
          });
        }
      });

      if (winner) {
        winner.score += totalWon;
        resultRecords.unshift({
          playerId: winner.id,
          playerName: winner.name,
          avatar: winner.avatar,
          rank: 1,
          cardsLeft: 0,
          cardsLeftList: [],
          scoreChange: totalWon,
        });
      }
    } else {
      // Tiến Lên Miền Nam
      const scoreMap: Record<number, number> = {
        1: 60,
        2: 20,
        3: -20,
        4: -60,
      };

      this.players.forEach((p) => {
        const rank = p.rank || 4;
        const change = scoreMap[rank] || 0;
        p.score = Math.max(0, p.score + change);

        resultRecords.push({
          playerId: p.id,
          playerName: p.name,
          avatar: p.avatar,
          rank,
          cardsLeft: p.cards.length,
          cardsLeftList: p.cards,
          scoreChange: change,
          isCong: p.cards.length === 13,
          isThoiHeo: p.cards.some((c) => c.rank === 15),
        });
      });

      resultRecords.sort((a, b) => a.rank - b.rank);
    }

    this.results = resultRecords;
    this.addSystemChat('🏁 Ván đấu đã kết thúc! Xem bảng tổng kết để kiểm tra kết quả.');
    this.onStateChange();
  }

  private endGamePrematurely() {
    this.stopTimer();
    this.status = 'FINISHED';
    this.addSystemChat('Ván đấu kết thúc do không còn đủ người chơi trên bàn.');
    this.onStateChange();
  }

  public resetToWaiting(requestedByPlayerId: string): { success: boolean; message?: string } {
    const requester = this.players.find((p) => p.id === requestedByPlayerId);
    if (!requester) {
      return { success: false, message: 'Người chơi không tồn tại trong bàn' };
    }

    const isGameFinished =
      this.status === 'FINISHED' ||
      (this.rule === 'CO_TUONG' && !!this.xiangqiState?.winnerSide) ||
      (this.rule === 'CARO' && !!this.caroState?.winnerPiece) ||
      (this.rule === 'BAN_TAU' && (this.banTauState?.phase === 'FINISHED' || !!this.banTauState?.winnerPlayerId)) ||
      (this.rule === 'CO_VUA' && !!this.chessState?.winnerSide);

    // Nếu ván đã kết thúc, BẤT KỲ người chơi hoặc khán giả nào cũng có thể đưa toàn bộ phòng về phòng chờ.
    // Nếu ván đang chơi, chỉ có chủ phòng mới có quyền dừng ván.
    if (!requester.isHost && !isGameFinished) {
      return { success: false, message: 'Chỉ chủ phòng mới có quyền đưa bàn về trạng thái chờ khi ván đang diễn ra' };
    }

    this.stopTimer();
    this.status = 'WAITING';
    this.currentTurnPlayerId = null;
    this.lastPlayedHand = null;
    this.roundHistory = [];
    this.roundWinners = [];
    this.isFirstTurnOfGame = true;

    this.players.forEach((p) => {
      p.status = 'WAITING';
      p.hasPassedCurrentRound = false;
      p.cards = [];
      p.ships = [];
      p.fleetPlaced = false;
    });

    if (this.xiangqiState) {
      this.xiangqiState.pieces = createInitialXiangqiPieces();
      this.xiangqiState.currentSide = 'RED';
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

    if (this.banTauState) {
      this.banTauState = undefined;
    }

    if (this.coCaNguaState) {
      this.coCaNguaState = undefined;
    }

    if (this.chessState) {
      this.chessState = undefined;
    }

    this.onStateChange();
    return { success: true };
  }

  public playerReturnToWaiting(playerId: string): { success: boolean; message?: string } {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Không tìm thấy người chơi' };

    player.returnedToWaiting = true;

    // Kiểm tra xem tất cả người chơi chính đã bấm quay về phòng chờ chưa
    const activeParticipants = this.players.filter(
      (p) =>
        !p.isSpectator &&
        p.socketId !== null &&
        (this.rule === 'CO_CA_NGUA'
          ? p.seatIndex >= 0 && p.seatIndex < 4
          : this.rule === 'CO_TUONG' || this.rule === 'CARO' || this.rule === 'BAN_TAU' || this.rule === 'CO_VUA'
          ? p.seatIndex === 0 || p.seatIndex === 1
          : true)
    );

    const allReturned = activeParticipants.every((p) => p.returnedToWaiting === true);
    if (allReturned) {
      this.status = 'WAITING';
      this.stopTimer();
    }

    this.onStateChange();
    return { success: true };
  }

  // --- CỜ CÁ NGỰA HANDLERS ---

  public coCaNguaRollDice(playerId: string): { success: boolean; message?: string; dice?: number } {
    if (this.status !== 'PLAYING' || !this.coCaNguaState) {
      return { success: false, message: 'Trận đấu chưa bắt đầu' };
    }
    if (this.coCaNguaState.phase !== 'ROLLING') {
      return { success: false, message: 'Không phải lượt gieo xúc xắc' };
    }
    if (this.coCaNguaState.currentTurnPlayerId !== playerId) {
      return { success: false, message: 'Chưa tới lượt của bạn' };
    }

    const dice = Math.floor(Math.random() * 6) + 1;
    this.coCaNguaState.lastDiceValue = dice;
    this.coCaNguaState.diceValue = dice;
    this.coCaNguaState.diceRollHistory.push(dice);

    const activePlayer = this.coCaNguaState.players.find((p) => p.playerId === playerId);
    if (!activePlayer) return { success: false, message: 'Lỗi người chơi' };

    const movableHorses = computeMovableHorses(this.coCaNguaState, activePlayer.color, dice);
    this.coCaNguaState.movableHorseIds = movableHorses;

    if (movableHorses.length === 0) {
      this.coCaNguaState.phase = 'IDLE';
      this.coCaNguaState.lastActionMessage = `${activePlayer.playerName} gieo ${dice} nhưng không có nước đi hợp lệ.`;
      setTimeout(() => {
        if (this.coCaNguaState && this.status === 'PLAYING') {
          const { nextColor, nextPlayerId } = getNextPlayerTurn(this.coCaNguaState);
          this.coCaNguaState.currentTurnColor = nextColor;
          this.coCaNguaState.currentTurnPlayerId = nextPlayerId;
          this.coCaNguaState.phase = 'ROLLING';
          this.coCaNguaState.turnTimeRemaining = 30;
          this.coCaNguaState.movableHorseIds = [];
          this.currentTurnPlayerId = nextPlayerId;
          this.onStateChange();
        }
      }, 1500);
    } else if (movableHorses.length === 1) {
      const moveRes = executeHorseMove(this.coCaNguaState, activePlayer.color, movableHorses[0], dice);
      this.coCaNguaState.lastActionMessage = moveRes.actionMessage;

      if (moveRes.winnerPlayerId) {
        this.status = 'FINISHED';
        this.coCaNguaState.phase = 'FINISHED';
        this.coCaNguaState.winnerPlayerId = moveRes.winnerPlayerId;
        this.stopTimer();
      } else if (moveRes.extraTurn) {
        this.coCaNguaState.phase = 'ROLLING';
        this.coCaNguaState.turnTimeRemaining = 30;
        this.coCaNguaState.movableHorseIds = [];
      } else {
        this.coCaNguaState.phase = 'ROLLING';
        this.coCaNguaState.turnTimeRemaining = 30;
        this.coCaNguaState.movableHorseIds = [];
        const { nextColor, nextPlayerId } = getNextPlayerTurn(this.coCaNguaState);
        this.coCaNguaState.currentTurnColor = nextColor;
        this.coCaNguaState.currentTurnPlayerId = nextPlayerId;
        this.currentTurnPlayerId = nextPlayerId;
      }
    } else {
      this.coCaNguaState.phase = 'SELECTING_HORSE';
      this.coCaNguaState.turnTimeRemaining = 30;
      this.coCaNguaState.lastActionMessage = `${activePlayer.playerName} gieo ${dice}. Hãy chọn 1 chú ngựa để di chuyển!`;
    }

    this.onStateChange();
    return { success: true, dice };
  }

  public coCaNguaMoveHorse(playerId: string, horseId: string): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING' || !this.coCaNguaState) {
      return { success: false, message: 'Trận đấu chưa bắt đầu' };
    }
    if (this.coCaNguaState.phase !== 'SELECTING_HORSE') {
      return { success: false, message: 'Không thể di chuyển lúc này' };
    }
    if (this.coCaNguaState.currentTurnPlayerId !== playerId) {
      return { success: false, message: 'Chưa tới lượt của bạn' };
    }
    if (!this.coCaNguaState.lastDiceValue) {
      return { success: false, message: 'Chưa gieo xúc xắc' };
    }

    const activePlayer = this.coCaNguaState.players.find((p) => p.playerId === playerId);
    if (!activePlayer) return { success: false, message: 'Lỗi người chơi' };

    const dice = this.coCaNguaState.lastDiceValue;
    const moveRes = executeHorseMove(this.coCaNguaState, activePlayer.color, Number(horseId), dice);

    if (!moveRes.success) {
      return { success: false, message: moveRes.actionMessage };
    }

    this.coCaNguaState.lastActionMessage = moveRes.actionMessage;

    if (moveRes.winnerPlayerId) {
      this.status = 'FINISHED';
      this.coCaNguaState.phase = 'FINISHED';
      this.coCaNguaState.winnerPlayerId = moveRes.winnerPlayerId;
      this.stopTimer();
    } else if (moveRes.extraTurn) {
      this.coCaNguaState.phase = 'ROLLING';
      this.coCaNguaState.turnTimeRemaining = 30;
      this.coCaNguaState.movableHorseIds = [];
    } else {
      this.coCaNguaState.phase = 'ROLLING';
      this.coCaNguaState.turnTimeRemaining = 30;
      this.coCaNguaState.movableHorseIds = [];
      const { nextColor, nextPlayerId } = getNextPlayerTurn(this.coCaNguaState);
      this.coCaNguaState.currentTurnColor = nextColor;
      this.coCaNguaState.currentTurnPlayerId = nextPlayerId;
      this.currentTurnPlayerId = nextPlayerId;
    }

    this.onStateChange();
    return { success: true };
  }

  private startCoCaNguaTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.status !== 'PLAYING' || !this.coCaNguaState) {
        this.stopTimer();
        return;
      }
      if (this.coCaNguaState.turnTimeRemaining > 0) {
        this.coCaNguaState.turnTimeRemaining -= 1;
        this.turnTimeRemaining = this.coCaNguaState.turnTimeRemaining;
        this.onStateChange();
      } else {
        if (this.coCaNguaState.phase === 'ROLLING') {
          this.coCaNguaRollDice(this.coCaNguaState.currentTurnPlayerId);
        } else if (this.coCaNguaState.phase === 'SELECTING_HORSE') {
          const activeP = this.coCaNguaState.players.find(
            (p) => p.playerId === this.coCaNguaState?.currentTurnPlayerId
          );
          if (activeP && this.coCaNguaState.lastDiceValue) {
            const movable = computeMovableHorses(
              this.coCaNguaState,
              activeP.color,
              this.coCaNguaState.lastDiceValue
            );
            if (movable.length > 0) {
              this.coCaNguaMoveHorse(activeP.playerId, String(movable[0]));
            }
          }
        }
      }
    }, 1000);
  }

  // --- DỮ LIỆU ĐỒNG BỘ CLIENT ---

  public getPublicState(targetPlayerId?: string): RoomPublicState {
    const targetPlayer = targetPlayerId ? this.players.find((p) => p.id === targetPlayerId) : null;
    const isSpectator = targetPlayer ? !!targetPlayer.isSpectator : false;

    // Lọc tin nhắn: người chơi trong ván đấu không xem được phân tích của Grandmaster
    const filteredChat = isSpectator
      ? this.chatMessages
      : this.chatMessages.filter((m) => !m.isSpectatorOnly);

    // Không gửi lastAiAnalysis cho 2 kỳ thủ đang thi đấu trực tiếp
    let currentChessState = this.chessState;
    if (this.chessState && targetPlayer && !isSpectator) {
      currentChessState = {
        ...this.chessState,
        lastAiAnalysis: null,
      };
    }

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
      chessSide: p.chessSide,
      fleetPlaced: p.fleetPlaced,
      caNguaColor: p.caNguaColor,
      returnedToWaiting: p.returnedToWaiting,
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
      banTauState: this.banTauState,
      coCaNguaState: this.coCaNguaState,
      chessState: currentChessState,
      results: this.results,
      chatMessages: filteredChat,
    };
  }

  public getPlayerCards(playerId: string): Card[] {
    const p = this.players.find((x) => x.id === playerId);
    return p ? p.cards : [];
  }

  public getPlayerShips(playerId: string): PlacedShip[] {
    const p = this.players.find((x) => x.id === playerId);
    return p && p.ships ? p.ships : [];
  }

  public addChatMessage(senderId: string, text: string): ChatMessage | null {
    const player = this.players.find((p) => p.id === senderId);
    if (!player) return null;

    const cleanText = text.trim();
    if (!cleanText) return null;

    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: player.id,
      senderName: player.name,
      senderAvatar: player.avatar,
      text: cleanText.substring(0, 300),
      timestamp: Date.now(),
      isSystem: false,
    };

    this.chatMessages.push(message);
    if (this.chatMessages.length > 100) {
      this.chatMessages.shift();
    }

    return message;
  }

  public addAiChat(text: string, isSpectatorOnly: boolean = false): ChatMessage {
    const message: ChatMessage = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: 'BOT_GEMINI',
      senderName: '🏆 Grandmaster Bình Luận (Chế độ Khách)',
      senderAvatar: '♟️',
      text,
      timestamp: Date.now(),
      isSystem: true,
      isSpectatorOnly,
    };

    this.chatMessages.push(message);
    if (this.chatMessages.length > 100) {
      this.chatMessages.shift();
    }

    return message;
  }

  public addSystemChat(text: string): ChatMessage | null {
    // Chỉ hiển thị thông báo người ra / vào phòng theo yêu cầu
    const isJoinLeave =
      text.includes('vào phòng') ||
      text.includes('rời phòng') ||
      text.includes('mất kết nối') ||
      text.includes('kết nối lại');
    if (!isJoinLeave) {
      return null;
    }

    const message: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: 'SYSTEM',
      senderName: 'Hệ thống',
      senderAvatar: '🤖',
      text,
      timestamp: Date.now(),
      isSystem: true,
    };

    this.chatMessages.push(message);
    if (this.chatMessages.length > 100) {
      this.chatMessages.shift();
    }

    return message;
  }

  public cleanup() {
    this.stopTimer();
    this.disconnectTimers.forEach((timer) => clearTimeout(timer));
    this.disconnectTimers.clear();
  }
}
