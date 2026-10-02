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
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  timeout: 20000,
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

const COMPETITION_ACCOUNT_KEY = 'winner88_competition_account';
const REMEMBER_ACCOUNT_KEY = 'winner88_remember_account';

export interface SavedCompetitionAccount {
  username: string;
  displayName: string;
  elo: number;
}

export function getSavedCompetitionAccount(): SavedCompetitionAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COMPETITION_ACCOUNT_KEY) || sessionStorage.getItem(COMPETITION_ACCOUNT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCompetitionAccount(account: SavedCompetitionAccount | null, remember = true) {
  if (typeof window === 'undefined') return;
  try {
    if (!account) {
      localStorage.removeItem(COMPETITION_ACCOUNT_KEY);
      localStorage.removeItem(REMEMBER_ACCOUNT_KEY);
      sessionStorage.removeItem(COMPETITION_ACCOUNT_KEY);
      return;
    }
    if (remember) {
      localStorage.setItem(COMPETITION_ACCOUNT_KEY, JSON.stringify(account));
      localStorage.setItem(REMEMBER_ACCOUNT_KEY, 'true');
    } else {
      localStorage.removeItem(COMPETITION_ACCOUNT_KEY);
      localStorage.removeItem(REMEMBER_ACCOUNT_KEY);
      sessionStorage.setItem(COMPETITION_ACCOUNT_KEY, JSON.stringify(account));
    }
  } catch {
    // ignore
  }
}

export function getRememberAccountPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(REMEMBER_ACCOUNT_KEY);
  return val === null ? true : val === 'true';
}

const CLIENT_DEVICE_SESSION_KEY = 'winner88_client_device_session_id';

export function getClientSessionId(): string {
  if (typeof window === 'undefined') return 'sess_server';
  try {
    let sess = sessionStorage.getItem(CLIENT_DEVICE_SESSION_KEY);
    if (!sess) {
      sess = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem(CLIENT_DEVICE_SESSION_KEY, sess);
    }
    return sess;
  } catch {
    return 'sess_' + Math.random().toString(36).substring(2, 9);
  }
}

