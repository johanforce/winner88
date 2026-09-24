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
const SESSION_ID_KEY = 'winner88_session_player_info';
const LAST_ROOM_KEY = 'winner88_last_room_code';

export function getOrCreatePlayerProfile(): PlayerProfile {
  if (typeof window === 'undefined') {
    return { id: 'p_guest', name: '', avatar: '🐵', reconnectToken: 'tok_guest', score: 1000 };
  }

  // 1. Đọc cache tên, avatar, số xu từ localStorage (lưu bền vững giữa các lần vào web)
  let cachedName = '';
  let cachedAvatar = '🐵';
  let cachedScore = 1000;

  try {
    const rawLocal = localStorage.getItem(PROFILE_KEY);
    if (rawLocal) {
      const parsedLocal = JSON.parse(rawLocal);
      if (parsedLocal.name) cachedName = parsedLocal.name;
      if (parsedLocal.avatar) cachedAvatar = parsedLocal.avatar;
      if (typeof parsedLocal.score === 'number') cachedScore = parsedLocal.score;
    }
  } catch {
    // fallback
  }

  // 2. Đọc session ID của tab hiện tại từ sessionStorage
  // Giúp mỗi tab trình duyệt có một ID độc lập, có thể mở 2 tab cùng test chơi với nhau mà không bị đè session!
  let tabId = '';
  let reconnectToken = '';

  try {
    const rawSession = sessionStorage.getItem(SESSION_ID_KEY);
    if (rawSession) {
      const parsedSession = JSON.parse(rawSession);
      if (parsedSession.id && parsedSession.reconnectToken) {
        tabId = parsedSession.id;
        reconnectToken = parsedSession.reconnectToken;
      }
    }
  } catch {
    // fallback
  }

  if (!tabId || !reconnectToken) {
    tabId = 'p_' + Math.random().toString(36).substring(2, 9);
    reconnectToken = 'tok_' + Math.random().toString(36).substring(2, 12);
    try {
      sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id: tabId, reconnectToken }));
    } catch {
      // ignore
    }
  }

  const profile: PlayerProfile = {
    id: tabId,
    name: cachedName,
    avatar: cachedAvatar,
    reconnectToken,
    score: cachedScore,
  };

  return profile;
}

export function savePlayerProfile(profile: PlayerProfile) {
  if (typeof window === 'undefined') return;
  try {
    // Lưu tên, avatar và điểm vào localStorage để các lần sau vào lại không cần nhập tên nữa
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        name: profile.name,
        avatar: profile.avatar,
        score: profile.score,
      })
    );
    // Lưu phiên tab vào sessionStorage
    sessionStorage.setItem(
      SESSION_ID_KEY,
      JSON.stringify({
        id: profile.id,
        reconnectToken: profile.reconnectToken,
      })
    );
  } catch {
    // ignore
  }
}

export function savePlayerScore(score: number) {
  if (typeof window === 'undefined') return;
  try {
    const rawLocal = localStorage.getItem(PROFILE_KEY);
    const parsed = rawLocal ? JSON.parse(rawLocal) : {};
    parsed.score = score;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function saveLastRoomCode(code: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_ROOM_KEY, code);
  } catch {
    // ignore
  }
}

export function getLastRoomCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(LAST_ROOM_KEY);
  } catch {
    return null;
  }
}

export function clearLastRoomCode() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LAST_ROOM_KEY);
  } catch {
    // ignore
  }
}
