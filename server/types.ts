export type Suit = 'SPADE' | 'CLUB' | 'DIAMOND' | 'HEART';

export type GameRule = 'TIEN_LEN_MIEN_NAM' | 'SAM_LOC' | 'CO_TUONG' | 'CARO' | 'BAN_TAU' | 'CO_CA_NGUA' | 'CO_VUA';

// --- CỜ VUA (CHESS) TYPES ---
export type ChessSide = 'WHITE' | 'BLACK';

export interface ChessMoveRecord {
  moveNumber: number; // 1, 2, 3...
  turn: ChessSide;
  from: string; // 'e2'
  to: string; // 'e4'
  piece: string; // 'p', 'n', 'b', 'r', 'q', 'k'
  captured?: string;
  promotion?: string;
  san: string; // 'e4', 'Nf3', 'O-O', 'Qxf7#'
  fenAfter: string;
  isCheck: boolean;
  isCheckmate: boolean;
  timestamp: number;
}

export interface ChessState {
  fen: string;
  pgn: string;
  turn: ChessSide;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  spectatorIds: string[];
  whiteTimeRemaining: number; // 900s (15 phút)
  blackTimeRemaining: number; // 900s (15 phút)
  initialTime: number; // 900s
  increment: number; // 10s cho mỗi nước đi
  lastMove: ChessMoveRecord | null;
  moveHistory: ChessMoveRecord[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  winnerSide: ChessSide | 'DRAW' | null;
  winReason?: 'CHECKMATE' | 'TIMEOUT' | 'RESIGN' | 'STALEMATE' | 'THREEFOLD' | 'INSUFFICIENT_MATERIAL' | 'FIFTY_MOVES' | 'AGREED_DRAW';
  drawOfferFrom?: ChessSide | null;
  lastAiAnalysis?: {
    moveIndex: number;
    text: string;
    timestamp: number;
  } | null;
}

// --- CỜ CÁ NGỰA (LUDO / HORSE RACING) TYPES ---
export type CaNguaColor = 'RED' | 'BLUE' | 'YELLOW' | 'GREEN';
export type CaNguaHorseState = 'STABLE' | 'ON_TRACK' | 'IN_BARN' | 'FINISHED';

export interface CaNguaHorse {
  id: number; // 0..3 (4 horses per player)
  color: CaNguaColor;
  playerId: string;
  horseIndex: number;
  step: number; // -1: in stable, 0..55: on track (relative to start cell), 56..61: in home barn (1..6)
  state: CaNguaHorseState;
  trackPosition: number; // 0..55 (absolute position on the track)
  barnStep: number; // 0..5
  isFinished: boolean;
}

export interface CaNguaPlayerState {
  playerId: string;
  playerName: string;
  seatIndex: number;
  color: CaNguaColor;
  horses: CaNguaHorse[];
  score: number;
}

export interface CoCaNguaState {
  players: CaNguaPlayerState[];
  currentTurnColor: CaNguaColor;
  currentTurnPlayerId: string;
  turnTimeRemaining: number; // 30s
  phase: 'ROLLING' | 'SELECTING_HORSE' | 'IDLE' | 'FINISHED';
  diceValue: number | null; // 1..6
  lastDiceValue: number | null;
  diceRollHistory: number[];
  isRolling: boolean;
  consecutiveSixes: number; // max 3
  canRoll: boolean;
  canSelectHorse: boolean;
  movableHorseIds: number[];
  spectatorIds: string[];
  winnerColor: CaNguaColor | null;
  winnerPlayerId: string | null;
  ranks: { playerId: string; color: CaNguaColor; rank: number }[];
  lastActionText?: string;
  lastActionMessage?: string;
  lastKickedHorse?: {
    horseIndex: number;
    color: CaNguaColor;
    trackPosition: number;
    kickerColor: CaNguaColor;
  } | null;
  horses: CaNguaHorse[];
}

// --- BẮN TÀU (BATTLESHIP) TYPES ---
export type ShipOrientation = 'HORIZONTAL' | 'VERTICAL';

export interface ShipDefinition {
  id: string; // 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer'
  name: string;
  size: number;
  color: string;
  icon: string;
}

export interface PlacedShip {
  shipId: string;
  name: string;
  size: number;
  originX: number; // 0..9
  originY: number; // 0..9
  orientation: ShipOrientation;
  cells: { x: number; y: number }[];
  hits: number;
  isSunk: boolean;
}

export interface ShotRecord {
  x: number; // 0..9
  y: number; // 0..9
  shooterId: string;
  targetPlayerId: string;
  isHit: boolean;
  shipSunkName?: string | null;
  timestamp: number;
  shotNumber: number;
}

export interface BanTauPlayerState {
  playerId: string;
  playerName: string;
  fleetPlaced: boolean;
  isReady: boolean;
  totalHitsDealt: number; // total successful hits on opponent (out of 17)
  shotsFired: { x: number; y: number; isHit: boolean; shipSunkName?: string | null }[];
  shotsReceived: { x: number; y: number; isHit: boolean }[];
  sunkShips: { shipId: string; name: string; size: number; cells: { x: number; y: number }[] }[];
  revealedShips?: PlacedShip[]; // populated when FINISHED or for the player themselves
}

export type BanTauPhase = 'PLACEMENT' | 'BATTLE' | 'FINISHED';

export interface BanTauState {
  phase: BanTauPhase;
  player1Id: string | null;
  player2Id: string | null;
  currentTurnPlayerId: string | null;
  turnTimeRemaining: number; // 30s
  placementTimeRemaining: number; // 60s
  player1: BanTauPlayerState;
  player2: BanTauPlayerState;
  shotHistory: ShotRecord[];
  lastShot: ShotRecord | null;
  spectatorIds: string[];
  winnerPlayerId: string | null;
  winReason?: 'ALL_SHIPS_SUNK' | 'TIMEOUT' | 'RESIGN';
}

// --- CỜ CARO TYPES ---
export type CaroPiece = 'X' | 'O';

export interface CaroMove {
  x: number; // 0..19 (0 và 19 là viền ngoài)
  y: number; // 0..19 (0 và 19 là viền ngoài)
  piece: CaroPiece;
  playerId: string;
  moveNumber: number;
  timestamp: number;
}

export interface CaroState {
  board: (CaroPiece | null)[][]; // 20x20 grid
  currentTurn: CaroPiece; // 'X' đi trước
  xPlayerId: string | null;
  oPlayerId: string | null;
  spectatorIds: string[];
  xTimeRemaining: number; // 300s (5 phút tổng)
  oTimeRemaining: number; // 300s (5 phút tổng)
  initialTime: number; // 300
  lastMove: CaroMove | null;
  moveHistory: CaroMove[];
  winningLine?: { x: number; y: number }[] | null;
  winnerPiece: CaroPiece | 'DRAW' | null;
  winReason?: 'FIVE_IN_A_ROW' | 'TIMEOUT' | 'RESIGN' | 'AGREED_DRAW';
  drawOfferFrom?: CaroPiece | null;
}

// --- CỜ TƯỚNG (XIANGQI) TYPES ---
export type XiangqiPieceType =
  | 'GENERAL'
  | 'ADVISOR'
  | 'ELEPHANT'
  | 'HORSE'
  | 'CHARIOT'
  | 'CANNON'
  | 'SOLDIER';

export type XiangqiSide = 'RED' | 'BLACK';

export type XiangqiTimeMode = 'STANDARD' | 'BLITZ_5M';

export interface XiangqiPiece {
  id: string;
  type: XiangqiPieceType;
  color: XiangqiSide;
  x: number;
  y: number;
}

export interface XiangqiMove {
  from: { x: number; y: number };
  to: { x: number; y: number };
  piece: XiangqiPiece;
  capturedPiece?: XiangqiPiece;
  notation: string;
  isCheck?: boolean;
  timestamp: number;
}

export interface XiangqiState {
  pieces: XiangqiPiece[];
  currentSide: XiangqiSide;
  redPlayerId: string | null;
  blackPlayerId: string | null;
  spectatorIds: string[];
  redTimeRemaining: number;
  blackTimeRemaining: number;
  initialBlitzTime: number;
  timeMode: XiangqiTimeMode;
  incrementSeconds: number;
  lastMove: XiangqiMove | null;
  moveHistory: XiangqiMove[];
  isCheck: boolean;
  checkSide: XiangqiSide | null;
  winnerSide: XiangqiSide | 'DRAW' | null;
  winReason?: 'CHECKMATE' | 'TIMEOUT' | 'RESIGN' | 'STALEMATE' | 'AGREED_DRAW';
  drawOfferFrom?: XiangqiSide | null;
}

export interface Card {
  id: string;
  rank: number;
  suit: Suit;
}

export type HandType =
  | 'INVALID'
  | 'SINGLE'
  | 'PAIR'
  | 'TRIPLE'
  | 'STRAIGHT'
  | 'FOUR_OF_A_KIND'
  | 'THREE_PAIRS_SEQUENCE'
  | 'FOUR_PAIRS_SEQUENCE';

export interface AnalyzedHand {
  isValid: boolean;
  type: HandType;
  cards: Card[];
  highestCard: Card;
  description: string;
}

export interface PlayedHand {
  playerId: string;
  playerName: string;
  cards: Card[];
  type: HandType;
  highestCard: Card;
  description: string;
  timestamp: number;
}

export type PlayerStatus =
  | 'WAITING'
  | 'READY'
  | 'PLAYING'
  | 'PASSED'
  | 'FINISHED'
  | 'DISCONNECTED';

export interface PlayerPublicInfo {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  status: PlayerStatus;
  cardCount: number;
  seatIndex: number;
  rank?: number;
  hasPassedCurrentRound: boolean;
  isCurrentTurn: boolean;
  isConnected: boolean;
  score: number;
  isSpectator?: boolean;
  xiangqiSide?: XiangqiSide;
  caroPiece?: CaroPiece;
  fleetPlaced?: boolean;
  caNguaColor?: CaNguaColor;
  chessSide?: ChessSide;
  returnedToWaiting?: boolean;
}

export interface Player {
  id: string;
  socketId: string | null;
  name: string;
  avatar: string;
  isHost: boolean;
  status: PlayerStatus;
  cards: Card[];
  seatIndex: number;
  rank?: number;
  hasPassedCurrentRound: boolean;
  disconnectedAt: number | null;
  reconnectToken: string;
  score: number;
  isSpectator?: boolean;
  xiangqiSide?: XiangqiSide;
  caroPiece?: CaroPiece;
  ships?: PlacedShip[]; // for BAN_TAU
  fleetPlaced?: boolean;
  caNguaColor?: CaNguaColor;
  chessSide?: ChessSide;
  returnedToWaiting?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isSpectatorOnly?: boolean;
}

export interface GameResultRecord {
  playerId: string;
  playerName: string;
  avatar: string;
  rank: number;
  cardsLeft: number;
  cardsLeftList: Card[];
  scoreChange: number;
  isCong?: boolean;
  isThoiHeo?: boolean;
}

export interface SamLocState {
  isBaoSamPhase: boolean;
  baoSamTimeRemaining: number;
  baoSamPlayerId: string | null;
  respondedPlayerIds?: string[];
}

export interface RoomPublicState {
  code: string;
  rule: GameRule;
  xiangqiTimeMode?: XiangqiTimeMode;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: PlayerPublicInfo[];
  currentTurnPlayerId: string | null;
  turnTimeRemaining: number;
  turnDuration: number;
  lastPlayedHand: PlayedHand | null;
  lastRoundWinnerId: string | null;
  gameNumber: number;
  isFirstTurnOfGame: boolean;
  mustPlayThreeOfSpades?: boolean;
  samLocState?: SamLocState;
  xiangqiState?: XiangqiState;
  caroState?: CaroState;
  banTauState?: BanTauState;
  coCaNguaState?: CoCaNguaState;
  chessState?: ChessState;
  results?: GameResultRecord[];
  chatMessages?: ChatMessage[];
}

export interface RoomListItem {
  code: string;
  rule: GameRule;
  xiangqiTimeMode?: XiangqiTimeMode;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: 'WAITING' | 'PLAYING';
}
