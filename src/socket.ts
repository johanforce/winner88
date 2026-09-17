import { io, Socket } from 'socket.io-client';

// Generate or retrieve persistent player ID and session token
export function getOrCreatePlayerProfile(): {
  id: string;
  name: string;
  avatar: string;
  reconnectToken: string;
  score: number;
} {
  // Use sessionStorage for tab-specific ID so testing 2+ tabs on same machine works without collision!
  let id = sessionStorage.getItem('cardgame_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem('cardgame_player_id', id);
  }

  // Name and avatar can be loaded from sessionStorage or localStorage
  let name = sessionStorage.getItem('cardgame_player_name') || localStorage.getItem('cardgame_player_name') || '';
  let avatar = sessionStorage.getItem('cardgame_player_avatar') || localStorage.getItem('cardgame_player_avatar') || '🤠';

  let reconnectToken = sessionStorage.getItem('cardgame_reconnect_token');
  if (!reconnectToken) {
    reconnectToken = 'tok_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('cardgame_reconnect_token', reconnectToken);
  }

  const rawScore = sessionStorage.getItem('cardgame_player_score') || localStorage.getItem('cardgame_player_score');
  const score = rawScore ? parseInt(rawScore, 10) : 1000;

  return { id, name, avatar, reconnectToken, score };
}

export function savePlayerProfile(name: string, avatar: string, score?: number) {
  sessionStorage.setItem('cardgame_player_name', name);
  sessionStorage.setItem('cardgame_player_avatar', avatar);
  localStorage.setItem('cardgame_player_name', name);
  localStorage.setItem('cardgame_player_avatar', avatar);
  if (typeof score === 'number') {
    savePlayerScore(score);
  }
}

export function savePlayerScore(score: number) {
  sessionStorage.setItem('cardgame_player_score', score.toString());
  localStorage.setItem('cardgame_player_score', score.toString());
}

export function saveLastRoomCode(code: string) {
  sessionStorage.setItem('cardgame_last_room', code);
}

export function getLastRoomCode(): string | null {
  return sessionStorage.getItem('cardgame_last_room');
}

export function clearLastRoomCode() {
  sessionStorage.removeItem('cardgame_last_room');
}

// Global socket singleton
export const socket: Socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});
