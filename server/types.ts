export type Suit = 'SPADE' | 'CLUB' | 'DIAMOND' | 'HEART';

export type GameRule = 'TIEN_LEN_MIEN_NAM' | 'SAM_LOC';

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
  | 'FOUR_OF_A_KIND' // Tứ quý
  | 'THREE_PAIRS_SEQUENCE' // 3 đôi thông
  | 'FOUR_PAIRS_SEQUENCE'; // 4 đôi thông

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
  rank?: number; // 1 (Nhất), 2 (Nhì), 3 (Ba), 4 (Bét)
  hasPassedCurrentRound: boolean;
  isCurrentTurn: boolean;
  isConnected: boolean;
  score: number;
}

export interface Player {
  id: string; // persistent client-generated ID
  socketId: string | null;
  name: string;
  avatar: string;
  isHost: boolean;
  status: PlayerStatus;
  cards: Card[]; // secret to player
  seatIndex: number;
  rank?: number;
  hasPassedCurrentRound: boolean;
  disconnectedAt: number | null;
  reconnectToken: string;
  score: number;
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
  rank: number; // 1, 2, 3, 4
  cardsLeft: number;
  cardsLeftList: Card[];
  scoreChange: number;
  isCong?: boolean; // Chưa đánh được lá nào
  isThoiHeo?: boolean; // Còn heo trên tay
}

export interface SamLocState {
  isBaoSamPhase: boolean;
  baoSamTimeRemaining: number;
  baoSamPlayerId: string | null;
}

export interface RoomPublicState {
  code: string;
  rule: GameRule;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: PlayerPublicInfo[];
  currentTurnPlayerId: string | null;
  turnTimeRemaining: number;
  turnDuration: number;
  lastPlayedHand: PlayedHand | null;
  lastRoundWinnerId: string | null;
  gameNumber: number;
  isFirstTurnOfGame: boolean;
  samLocState?: SamLocState;
  results?: GameResultRecord[];
}

export interface RoomListItem {
  code: string;
  rule: GameRule;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: 'WAITING' | 'PLAYING';
}
