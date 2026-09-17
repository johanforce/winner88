import { io, Socket } from 'socket.io-client';

// Generate or retrieve persistent player ID and session token
export function getOrCreatePlayerProfile(): {
  id: string;
  name: string;
  avatar: string;
  reconnectToken: string;
} {
  let id = localStorage.getItem('cardgame_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('cardgame_player_id', id);
  }

  let name = localStorage.getItem('cardgame_player_name') || '';
  let avatar = localStorage.getItem('cardgame_player_avatar') || '🤠';

  let reconnectToken = sessionStorage.getItem('cardgame_reconnect_token');
  if (!reconnectToken) {
    reconnectToken = 'tok_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('cardgame_reconnect_token', reconnectToken);
  }

  return { id, name, avatar, reconnectToken };
}

export function savePlayerProfile(name: string, avatar: string) {
  localStorage.setItem('cardgame_player_name', name);
  localStorage.setItem('cardgame_player_avatar', avatar);
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
