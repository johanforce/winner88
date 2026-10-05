import { io, Socket } from 'socket.io-client';

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
  reconnectToken: string;
  score: number;
}

export const socket: Socket = io(typeof window !== 'undefined' ? window.location.origin : '', {
  transports: ['websocket', 'polling'],
  autoConnect: true,
});

const PROFILE_KEY = 'winner88_player_profile';
const LAST_ROOM_KEY = 'winner88_last_room_code';

export function getOrCreatePlayerProfile(): PlayerProfile {
  if (typeof window === 'undefined') {
    return { id: 'p_guest', name: '', avatar: '🤠', reconnectToken: 'tok_guest', score: 1000 };
  }
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.id && parsed.reconnectToken) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  const id = 'p_' + Math.random().toString(36).substring(2, 9);
  const reconnectToken = 'tok_' + Math.random().toString(36).substring(2, 12);
  const newProfile: PlayerProfile = {
    id,
    name: '',
    avatar: '🤠',
    reconnectToken,
    score: 1000,
  };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
  } catch {
    // ignore
  }
  return newProfile;
}

export function savePlayerProfile(profile: PlayerProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function savePlayerScore(score: number) {
  try {
    const current = getOrCreatePlayerProfile();
    current.score = score;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function saveLastRoomCode(code: string) {
  try {
    localStorage.setItem(LAST_ROOM_KEY, code);
  } catch {
    // ignore
  }
}

export function getLastRoomCode(): string | null {
  try {
    return localStorage.getItem(LAST_ROOM_KEY);
  } catch {
    return null;
  }
}

export function clearLastRoomCode() {
  try {
    localStorage.removeItem(LAST_ROOM_KEY);
  } catch {
    // ignore
  }
}
