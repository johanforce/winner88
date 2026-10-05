import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocFromServer,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection as required by skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface CompetitionAccount {
  username: string;
  displayName: string;
  password: string;
  elo: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  lastMatchAt: number;
  rankStatus: 'UNRANKED' | 'ACTIVE' | 'DECAYED' | 'RESET';
  isLoggedIn?: boolean;
  activeSessionId?: string | null;
  lastActiveAt?: number;
  updatedAt?: number;
  createdAt?: number;
}

export interface RankedMatchRecord {
  matchId: string;
  roomCode: string;
  redUsername: string;
  redPlayerName: string;
  redEloBefore: number;
  redEloAfter: number;
  redEloDelta: number;
  blackUsername: string;
  blackPlayerName: string;
  blackEloBefore: number;
  blackEloAfter: number;
  blackEloDelta: number;
  winnerSide: 'RED' | 'BLACK' | 'DRAW';
  winReason: 'CHECKMATE' | 'TIMEOUT' | 'RESIGN' | 'STALEMATE' | 'AGREED_DRAW' | 'REPETITION';
  movesCount: number;
  durationSeconds: number;
  playedAt: number;
}

export const PRESET_ACCOUNTS: Array<{ username: string; displayName: string }> = [
  { username: 'thangnc', displayName: 'Thắng NC' },
  { username: 'quannd', displayName: 'Quân NĐ' },
  { username: 'tuanhm', displayName: 'Tuấn HM' },
  { username: 'tientm', displayName: 'Tiến TM' },
  { username: 'cuongnb', displayName: 'Cường NB' },
  { username: 'duonghq', displayName: 'Dương HQ' },
  { username: 'anhnh', displayName: 'Ánh NH' },
  { username: 'tienlv', displayName: 'Tiến LV' },
  { username: 'anhnt', displayName: 'Anh NT08' },
];

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// Apply inactivity decay logic:
// > 1 week: deduct 5 losses equivalent (~80 elo), minimum 1301
// > 2 weeks: reset rank to 1300
export function applyInactivityDecay(acc: CompetitionAccount): CompetitionAccount {
  if (acc.matchesPlayed === 0 || !acc.lastMatchAt) {
    return {
      ...acc,
      elo: 1300,
      rankStatus: 'UNRANKED',
    };
  }

  const now = Date.now();
  const timeSinceLast = now - acc.lastMatchAt;

  if (timeSinceLast >= TWO_WEEKS_MS) {
    return {
      ...acc,
      elo: 1300,
      rankStatus: 'RESET',
    };
  } else if (timeSinceLast >= ONE_WEEK_MS) {
    const decayedElo = Math.max(1301, acc.elo - 80);
    return {
      ...acc,
      elo: decayedElo,
      rankStatus: 'DECAYED',
    };
  }

  return {
    ...acc,
    rankStatus: 'ACTIVE',
  };
}

// Fetch all competition accounts directly from Firestore
export async function getCompetitionAccounts(): Promise<CompetitionAccount[]> {
  try {
    const snap = await getDocs(collection(db, 'competition_accounts'));
    const accounts: CompetitionAccount[] = [];
    snap.forEach((d) => {
      const raw = d.data() as CompetitionAccount;
      accounts.push(
        applyInactivityDecay({
          ...raw,
          username: raw.username || d.id,
          displayName: raw.displayName || raw.username || d.id,
        })
      );
    });
    // Sort: 1. By Elo descending, 2. Alphabetically by displayName
    accounts.sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      return (a.displayName || a.username).localeCompare(b.displayName || b.username, 'vi');
    });
    return accounts;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'competition_accounts');
    return [];
  }
}

// Real-time subscription to competition accounts in Firestore
export function subscribeCompetitionAccounts(
  callback: (accounts: CompetitionAccount[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'competition_accounts'),
    (snap) => {
      const accounts: CompetitionAccount[] = [];
      snap.forEach((d) => {
        const raw = d.data() as CompetitionAccount;
        accounts.push(
          applyInactivityDecay({
            ...raw,
            username: raw.username || d.id,
            displayName: raw.displayName || raw.username || d.id,
          })
        );
      });
      accounts.sort((a, b) => {
        if (b.elo !== a.elo) return b.elo - a.elo;
        return (a.displayName || a.username).localeCompare(b.displayName || b.username, 'vi');
      });
      callback(accounts);
    },
    (err) => {
      console.error('Error in subscribeCompetitionAccounts:', err);
    }
  );
}

// Ensure initial preset accounts exist in Firestore if collection is empty
export async function seedPresetAccountsIfNotExist(): Promise<CompetitionAccount[]> {
  try {
    const existingSnap = await getDocs(collection(db, 'competition_accounts'));
    // If accounts already exist in Firestore, do NOT overwrite or re-seed deleted ones
    if (!existingSnap.empty) {
      const accounts: CompetitionAccount[] = [];
      for (const d of existingSnap.docs) {
        const raw = d.data() as CompetitionAccount;
        const adjusted = applyInactivityDecay({
          ...raw,
          username: raw.username || d.id,
          displayName: raw.displayName || raw.username || d.id,
        });
        if (adjusted.elo !== raw.elo || adjusted.rankStatus !== raw.rankStatus) {
          updateDoc(doc(db, 'competition_accounts', d.id), {
            elo: adjusted.elo,
            rankStatus: adjusted.rankStatus,
            updatedAt: Date.now(),
          }).catch(() => {});
        }
        accounts.push(adjusted);
      }
      return accounts;
    }
  } catch (err) {
    console.warn('Error checking existing accounts in seed check:', err);
  }

  // Only seed default accounts if the database collection is completely empty
  const accounts: CompetitionAccount[] = [];
  for (const preset of PRESET_ACCOUNTS) {
    const docRef = doc(db, 'competition_accounts', preset.username);
    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        const newAcc: CompetitionAccount = {
          username: preset.username,
          displayName: preset.displayName,
          password: '1',
          elo: 1300,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          lastMatchAt: 0,
          rankStatus: 'UNRANKED',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await setDoc(docRef, newAcc);
        accounts.push(newAcc);
      } else {
        const raw = snap.data() as CompetitionAccount;
        const adjusted = applyInactivityDecay({
          ...raw,
          username: raw.username || preset.username,
          displayName: raw.displayName || preset.displayName,
        });
        accounts.push(adjusted);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `competition_accounts/${preset.username}`);
    }
  }

  // Khởi tạo mã reset session ẩn trên Firebase nếu chưa tồn tại
  try {
    const configRef = doc(db, 'system_config', 'session_settings');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        configId: 'session_settings',
        resetSessionCode: DEFAULT_RESET_SESSION_CODE,
        updatedAt: Date.now(),
      });
    }
  } catch {
    // ignore
  }

  return accounts;
}

// Helper to find account docRef by username or doc ID
async function findCompetitionAccountDocRef(cleanUsername: string) {
  const directRef = doc(db, 'competition_accounts', cleanUsername);
  const snap = await getDoc(directRef);
  if (snap.exists()) {
    return { docRef: directRef, snap };
  }
  // Search by username field
  const allSnap = await getDocs(collection(db, 'competition_accounts'));
  for (const d of allSnap.docs) {
    const data = d.data() as CompetitionAccount;
    if (
      d.id.toLowerCase() === cleanUsername ||
      (data.username && data.username.toLowerCase() === cleanUsername)
    ) {
      return { docRef: doc(db, 'competition_accounts', d.id), snap: d };
    }
  }
  return { docRef: directRef, snap: null };
}

// Get account by username
export async function getCompetitionAccount(username: string): Promise<CompetitionAccount | null> {
  const clean = username.trim().toLowerCase();
  try {
    const { snap } = await findCompetitionAccountDocRef(clean);
    if (!snap || !snap.exists()) return null;
    const raw = snap.data() as CompetitionAccount;
    return applyInactivityDecay({
      ...raw,
      username: raw.username || snap.id,
      displayName: raw.displayName || raw.username || snap.id,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `competition_accounts/${clean}`);
    return null;
  }
}

// Change account password
export async function changeCompetitionAccountPassword(
  username: string,
  oldPass: string,
  newPass: string
): Promise<{ success: boolean; message: string }> {
  const clean = username.trim().toLowerCase();
  try {
    const { docRef, snap } = await findCompetitionAccountDocRef(clean);
    if (!snap || !snap.exists()) {
      return { success: false, message: 'Tài khoản không tồn tại!' };
    }
    const data = snap.data() as CompetitionAccount;
    if (data.password !== oldPass) {
      return { success: false, message: 'Mật khẩu hiện tại không chính xác!' };
    }
    if (!newPass || newPass.trim().length === 0) {
      return { success: false, message: 'Mật khẩu mới không được để trống!' };
    }
    await updateDoc(docRef, {
      password: newPass.trim(),
      updatedAt: Date.now(),
    });
    return { success: true, message: 'Đổi mật khẩu thành công!' };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `competition_accounts/${clean}`);
    return { success: false, message: 'Lỗi khi cập nhật mật khẩu!' };
  }
}

export interface SystemConfig {
  configId: string;
  resetSessionCode: string;
  updatedAt?: number;
}

export const DEFAULT_RESET_SESSION_CODE = '_reset_session';

// Lấy hoặc khởi tạo mã reset session ẩn trên Firebase Firestore
export async function getResetSessionCode(): Promise<string> {
  try {
    const docRef = doc(db, 'system_config', 'session_settings');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as SystemConfig;
      if (data?.resetSessionCode) {
        return data.resetSessionCode;
      }
    }
    // Khởi tạo mã ẩn mặc định trên Firestore nếu chưa có
    await setDoc(docRef, {
      configId: 'session_settings',
      resetSessionCode: DEFAULT_RESET_SESSION_CODE,
      updatedAt: Date.now(),
    });
    return DEFAULT_RESET_SESSION_CODE;
  } catch (err) {
    console.warn('Lỗi đọc mã reset_session từ Firestore, sử dụng mặc định:', err);
    return DEFAULT_RESET_SESSION_CODE;
  }
}

// Single-session login handler:
// Cho phép đăng nhập tài khoản thi đấu.
// Nếu tài khoản đang đăng nhập ở nơi khác, người dùng có thể nhập [mật_khẩu]_reset_session
// để buộc đăng xuất thiết bị cũ và đăng nhập ngay vào máy hiện tại.
export async function loginCompetitionAccount(
  username: string,
  passwordInput: string,
  clientSessionId: string
): Promise<{
  success: boolean;
  message?: string;
  account?: CompetitionAccount;
  resetSessionTriggered?: boolean;
}> {
  const clean = username.trim().toLowerCase();
  try {
    const { docRef, snap } = await findCompetitionAccountDocRef(clean);
    if (!snap || !snap.exists()) {
      return { success: false, message: `Tài khoản "${clean}" không tồn tại trong danh sách thi đấu!` };
    }

    const raw = snap.data() as CompetitionAccount;
    const acc: CompetitionAccount = {
      ...raw,
      username: raw.username || snap.id,
      displayName: raw.displayName || raw.username || snap.id,
    };
    const now = Date.now();
    const SESSION_TIMEOUT_MS = 60 * 1000; // 60s timeout cho phiên không hoạt động

    // Lấy mã reset session ẩn được lưu trên Firebase
    const resetCode = await getResetSessionCode();

    // Kiểm tra mật khẩu bình thường hoặc mật khẩu kèm mã reset_session
    // Ví dụ: thangnc1_reset_session hoặc thangnc1reset_session
    const isNormalPassword = acc.password === passwordInput;
    const isResetPassword =
      passwordInput === acc.password + resetCode ||
      (resetCode.startsWith('_') && passwordInput === acc.password + resetCode.substring(1)) ||
      passwordInput === acc.password + '_reset_session' ||
      passwordInput === acc.password + 'reset_session';

    if (!isNormalPassword && !isResetPassword) {
      return { success: false, message: 'Mật khẩu không chính xác! (Mặc định: 1)' };
    }

    // Kiểm tra xem tài khoản có đang login ở thiết bị/tab khác không
    const isLoggedElsewhere =
      acc.isLoggedIn === true &&
      acc.activeSessionId &&
      acc.activeSessionId !== clientSessionId &&
      acc.lastActiveAt &&
      now - acc.lastActiveAt < SESSION_TIMEOUT_MS;

    // Nếu tài khoản đang login nơi khác và người dùng KHÔNG nhập mã reset session:
    // Hướng dẫn nhập thêm mã _reset_session để chiếm quyền phiên
    if (isLoggedElsewhere && !isResetPassword) {
      const elapsedSec = Math.max(1, Math.round((now - (acc.lastActiveAt || now)) / 1000));
      return {
        success: false,
        message: `Tài khoản "${acc.displayName || acc.username}" đang đăng nhập ở một thiết bị khác (hoạt động ${elapsedSec}s trước). Để đăng xuất nơi khác và đăng nhập vào máy này, vui lòng nhập mật khẩu kèm mã reset: ví dụ [mật_khẩu]_reset_session`,
      };
    }

    // Nếu người dùng nhập mã reset session hoặc tài khoản không bị kẹt:
    // Cập nhật session mới ngay lập tức trên Firestore, đá phiên cũ ra ngoài
    await updateDoc(docRef, {
      isLoggedIn: true,
      activeSessionId: clientSessionId,
      lastActiveAt: now,
      updatedAt: now,
    });

    const updatedAcc = applyInactivityDecay({
      ...acc,
      isLoggedIn: true,
      activeSessionId: clientSessionId,
      lastActiveAt: now,
    });

    return {
      success: true,
      account: updatedAcc,
      resetSessionTriggered: isResetPassword,
      message: isResetPassword
        ? 'Đã đăng xuất tài khoản ở nơi khác và đăng nhập thành công vào máy này!'
        : undefined,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `competition_accounts/${clean}`);
    return { success: false, message: 'Lỗi máy chủ cơ sở dữ liệu khi đăng nhập!' };
  }
}

// Logout handler: releases the session lock in Firestore
export async function logoutCompetitionAccount(
  username: string,
  clientSessionId?: string
): Promise<{ success: boolean }> {
  const clean = username.trim().toLowerCase();
  const docRef = doc(db, 'competition_accounts', clean);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const acc = snap.data() as CompetitionAccount;
      if (!clientSessionId || acc.activeSessionId === clientSessionId) {
        await updateDoc(docRef, {
          isLoggedIn: false,
          activeSessionId: null,
          lastActiveAt: 0,
          updatedAt: Date.now(),
        });
      }
    }
    return { success: true };
  } catch (err) {
    console.error('Error logging out competition account from Firestore:', err);
    return { success: false };
  }
}

// Heartbeat handler: updates lastActiveAt every 20s while the tab is open
export async function heartbeatCompetitionAccount(
  username: string,
  clientSessionId: string
): Promise<{ stillValid: boolean }> {
  const clean = username.trim().toLowerCase();
  const docRef = doc(db, 'competition_accounts', clean);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return { stillValid: false };
    const acc = snap.data() as CompetitionAccount;

    // Check if session ownership was taken by another device
    if (acc.activeSessionId && acc.activeSessionId !== clientSessionId && acc.isLoggedIn) {
      return { stillValid: false };
    }

    await updateDoc(docRef, {
      isLoggedIn: true,
      activeSessionId: clientSessionId,
      lastActiveAt: Date.now(),
    });
    return { stillValid: true };
  } catch {
    return { stillValid: true };
  }
}

// Calculate International Chess / Xiangqi Elo
export function calculateEloChanges(
  redElo: number,
  blackElo: number,
  winnerSide: 'RED' | 'BLACK' | 'DRAW'
): { redDelta: number; blackDelta: number; newRedElo: number; newBlackElo: number } {
  const K = 32;

  // Expected scores
  const expectedRed = 1 / (1 + Math.pow(10, (blackElo - redElo) / 400));
  const expectedBlack = 1 - expectedRed;

  let actualRed = 0.5;
  let actualBlack = 0.5;

  if (winnerSide === 'RED') {
    actualRed = 1;
    actualBlack = 0;
  } else if (winnerSide === 'BLACK') {
    actualRed = 0;
    actualBlack = 1;
  }

  let redDelta = Math.round(K * (actualRed - expectedRed));
  let blackDelta = Math.round(K * (actualBlack - expectedBlack));

  // Thưởng +1 Elo khi kỳ thủ quay trở lại từ unrank (1300)
  if (redElo === 1300) {
    if (winnerSide === 'RED' || winnerSide === 'DRAW') {
      redDelta += 1;
    }
  }
  if (blackElo === 1300) {
    if (winnerSide === 'BLACK' || winnerSide === 'DRAW') {
      blackDelta += 1;
    }
  }

  let newRedElo = redElo + redDelta;
  let newBlackElo = blackElo + blackDelta;

  // Rule:
  // Elo cannot fall below 1301 for active players. If someone is at 1301 and loses, they won't lose any elo.
  // 1300 is exclusively for unplayed or reset.
  if (redElo <= 1301 && winnerSide === 'BLACK') {
    newRedElo = 1301;
    redDelta = 0;
  } else if (newRedElo < 1301) {
    newRedElo = 1301;
    redDelta = newRedElo - redElo;
  }

  if (blackElo <= 1301 && winnerSide === 'RED') {
    newBlackElo = 1301;
    blackDelta = 0;
  } else if (newBlackElo < 1301) {
    newBlackElo = 1301;
    blackDelta = newBlackElo - blackElo;
  }

  return { redDelta, blackDelta, newRedElo, newBlackElo };
}

// Record ranked match and update both players' Elo and statistics
export async function recordRankedMatchResult(record: {
  roomCode: string;
  redUsername: string;
  redPlayerName: string;
  blackUsername: string;
  blackPlayerName: string;
  winnerSide: 'RED' | 'BLACK' | 'DRAW';
  winReason: 'CHECKMATE' | 'TIMEOUT' | 'RESIGN' | 'STALEMATE' | 'AGREED_DRAW' | 'REPETITION';
  movesCount: number;
  durationSeconds: number;
}): Promise<RankedMatchRecord> {
  await seedPresetAccountsIfNotExist();
  const redAcc = await getCompetitionAccount(record.redUsername);
  const blackAcc = await getCompetitionAccount(record.blackUsername);

  const redEloBefore = redAcc?.elo ?? 1300;
  const blackEloBefore = blackAcc?.elo ?? 1300;

  const { redDelta, blackDelta, newRedElo, newBlackElo } = calculateEloChanges(
    redEloBefore,
    blackEloBefore,
    record.winnerSide
  );

  const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  const matchDoc: RankedMatchRecord = {
    matchId,
    roomCode: record.roomCode,
    redUsername: record.redUsername,
    redPlayerName: record.redPlayerName,
    redEloBefore,
    redEloAfter: newRedElo,
    redEloDelta: redDelta,
    blackUsername: record.blackUsername,
    blackPlayerName: record.blackPlayerName,
    blackEloBefore,
    blackEloAfter: newBlackElo,
    blackEloDelta: blackDelta,
    winnerSide: record.winnerSide,
    winReason: record.winReason,
    movesCount: record.movesCount,
    durationSeconds: record.durationSeconds,
    playedAt: now,
  };

  try {
    // 1. Save match record
    await setDoc(doc(db, 'ranked_matches', matchId), matchDoc);

    // 2. Update Red player account
    if (redAcc) {
      await updateDoc(doc(db, 'competition_accounts', redAcc.username), {
        elo: newRedElo,
        matchesPlayed: (redAcc.matchesPlayed || 0) + 1,
        wins: (redAcc.wins || 0) + (record.winnerSide === 'RED' ? 1 : 0),
        draws: (redAcc.draws || 0) + (record.winnerSide === 'DRAW' ? 1 : 0),
        losses: (redAcc.losses || 0) + (record.winnerSide === 'BLACK' ? 1 : 0),
        lastMatchAt: now,
        rankStatus: 'ACTIVE',
        updatedAt: now,
      });
    }

    // 3. Update Black player account
    if (blackAcc) {
      await updateDoc(doc(db, 'competition_accounts', blackAcc.username), {
        elo: newBlackElo,
        matchesPlayed: (blackAcc.matchesPlayed || 0) + 1,
        wins: (blackAcc.wins || 0) + (record.winnerSide === 'BLACK' ? 1 : 0),
        draws: (blackAcc.draws || 0) + (record.winnerSide === 'DRAW' ? 1 : 0),
        losses: (blackAcc.losses || 0) + (record.winnerSide === 'RED' ? 1 : 0),
        lastMatchAt: now,
        rankStatus: 'ACTIVE',
        updatedAt: now,
      });
    }

    return matchDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `ranked_matches/${matchId}`);
    return matchDoc;
  }
}

// Fetch all ranked matches (sorted latest first)
export async function getRankedMatches(limitCount = 50): Promise<RankedMatchRecord[]> {
  try {
    const q = query(collection(db, 'ranked_matches'), orderBy('playedAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    const matches: RankedMatchRecord[] = [];
    snap.forEach((d) => {
      matches.push(d.data() as RankedMatchRecord);
    });
    return matches;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'ranked_matches');
    return [];
  }
}

// Fetch leaderboard sorted by Elo descending
export async function getLeaderboard(): Promise<CompetitionAccount[]> {
  try {
    await seedPresetAccountsIfNotExist();
    const snap = await getDocs(collection(db, 'competition_accounts'));
    const accounts: CompetitionAccount[] = [];
    snap.forEach((d) => {
      accounts.push(applyInactivityDecay(d.data() as CompetitionAccount));
    });
    // Sort: 1. Elo -> 2. Tỷ lệ thắng (Win rate) -> 3. Số trận thắng -> 4. Số trận hòa -> 5. Ít trận thua hơn
    accounts.sort((a, b) => {
      // 1. So sánh Elo
      if (b.elo !== a.elo) return b.elo - a.elo;

      // 2. So sánh tỷ lệ thắng (Win Rate = số trận thắng / tổng số trận)
      const aWinRate = a.matchesPlayed > 0 ? a.wins / a.matchesPlayed : 0;
      const bWinRate = b.matchesPlayed > 0 ? b.wins / b.matchesPlayed : 0;
      if (Math.abs(bWinRate - aWinRate) > 0.00001) {
        return bWinRate - aWinRate;
      }

      // 3. So sánh số trận thắng
      if (b.wins !== a.wins) return b.wins - a.wins;

      // 4. So sánh số trận hòa
      if (b.draws !== a.draws) return b.draws - a.draws;

      // 5. Ưu tiên ít trận thua hơn, rồi theo tên username
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.username.localeCompare(b.username);
    });
    return accounts;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'competition_accounts');
    return [];
  }
}

export interface PlayerRankStats {
  rank: number;
  total: number;
  elo: number;
  displayName: string;
}

// Fetch map of username -> rank / total / elo
export async function getLeaderboardRankMap(): Promise<Map<string, PlayerRankStats>> {
  const map = new Map<string, PlayerRankStats>();
  try {
    const list = await getLeaderboard();
    const total = Math.max(list.length, 9);
    list.forEach((acc, idx) => {
      map.set(acc.username.toLowerCase(), {
        rank: idx + 1,
        total,
        elo: acc.elo,
        displayName: acc.displayName || acc.username,
      });
    });
  } catch (err) {
    console.error('Error fetching leaderboard rank map:', err);
  }
  return map;
}
