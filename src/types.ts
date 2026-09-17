export type Suit = 'SPADE' | 'CLUB' | 'DIAMOND' | 'HEART';

export type GameRule = 'TIEN_LEN_MIEN_NAM' | 'SAM_LOC' | 'CO_TUONG';

// --- CỜ TƯỚNG (XIANGQI) TYPES ---
export type XiangqiPieceType =
  | 'GENERAL' // Tướng / Soái (帥 / 將)
  | 'ADVISOR' // Sĩ (仕 / 士)
  | 'ELEPHANT' // Tượng (相 / 象)
  | 'HORSE' // Mã (傌 / 馬)
  | 'CHARIOT' // Xe (俥 / 車)
  | 'CANNON' // Pháo (炮 / 砲)
  | 'SOLDIER'; // Tốt / Binh (兵 / 卒)

export type XiangqiSide = 'RED' | 'BLACK';

export type XiangqiTimeMode = 'STANDARD' | 'BLITZ_5M';

export interface XiangqiPiece {
  id: string; // e.g. "R_CH_1", "B_GE"
  type: XiangqiPieceType;
  color: XiangqiSide;
  x: number; // 0..8 (0 is left from Red's perspective, 8 is right)
  y: number; // 0..9 (0 is Black palace/baseline, 9 is Red palace/baseline)
}

export interface XiangqiMove {
  from: { x: number; y: number };
  to: { x: number; y: number };
  piece: XiangqiPiece;
  capturedPiece?: XiangqiPiece;
  notation: string; // e.g. "Pháo 2 bình 5"
  isCheck?: boolean;
  timestamp: number;
}

export interface XiangqiState {
  pieces: XiangqiPiece[];
  currentSide: XiangqiSide;
  redPlayerId: string | null;
  blackPlayerId: string | null;
  spectatorIds: string[];
  redTimeRemaining: number; // in seconds
  blackTimeRemaining: number;
  initialBlitzTime: number; // 3600 (Standard 60m) or 300 (Blitz 5m)
  timeMode: XiangqiTimeMode; // 'STANDARD' | 'BLITZ_5M'
  incrementSeconds: number; // e.g. 30s for standard, 3s for blitz
  lastMove: XiangqiMove | null;
  moveHistory: XiangqiMove[];
  isCheck: boolean;
  checkSide: XiangqiSide | null;
  winnerSide: XiangqiSide | 'DRAW' | null;
  winReason?: 'CHECKMATE' | 'TIMEOUT' | 'RESIGN' | 'STALEMATE' | 'AGREED_DRAW';
  drawOfferFrom?: XiangqiSide | null;
}

export interface Card {
  id: string; // e.g. "3_SPADE", "14_HEART", "15_DIAMOND"
  rank: number; // 3..15 (11=J, 12=Q, 13=K, 14=A, 15=2/Heo)
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
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
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
  results?: GameResultRecord[];
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
