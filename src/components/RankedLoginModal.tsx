import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  ShieldCheck,
  KeyRound,
  UserCheck,
  AlertCircle,
  Eye,
  EyeOff,
  History,
  Lock,
  LogOut,
  User,
  Sparkles,
  Award,
} from 'lucide-react';
import {
  loginCompetitionAccount,
  logoutCompetitionAccount,
  changeCompetitionAccountPassword,
  CompetitionAccount,
  getCompetitionAccounts,
  subscribeCompetitionAccounts,
  seedPresetAccountsIfNotExist,
} from '../firebase';
import {
  saveCompetitionAccount,
  getClientSessionId,
  SavedCompetitionAccount,
  getSavedCompetitionAccount,
} from '../socket';

export interface RankedLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (acc: SavedCompetitionAccount) => void;
  onLogoutSuccess?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenHistory?: () => void;
}

export const RankedLoginModal: React.FC<RankedLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onLogoutSuccess,
  onOpenLeaderboard,
  onOpenHistory,
}) => {
  const [loggedAccount, setLoggedAccount] = useState<SavedCompetitionAccount | null>(() =>
    getSavedCompetitionAccount()
  );
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'LOGIN' | 'CHANGE_PW'>('LOGIN');
  const [selectedUsername, setSelectedUsername] = useState<string>('anhnh');
  const [customUsername, setCustomUsername] = useState<string>('');
  const [isCustomUser, setIsCustomUser] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('1');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Change password states
  const [changeUser, setChangeUser] = useState<string>('anhnh');
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [accountsList, setAccountsList] = useState<CompetitionAccount[]>([]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setLoadingAccounts(true);
      const saved = getSavedCompetitionAccount();
      setLoggedAccount(saved);
      if (saved?.username) {
        setActiveTab('PROFILE');
        setSelectedUsername(saved.username);
        setChangeUser(saved.username);
      } else {
        setActiveTab('LOGIN');
      }

      // Initial seed check only if DB is empty
      seedPresetAccountsIfNotExist().catch(() => {});

      // Subscribe to real-time competition_accounts from Firestore
      const unsubscribe = subscribeCompetitionAccounts((accounts) => {
        setAccountsList(accounts);
        setLoadingAccounts(false);
        const savedCurrent = getSavedCompetitionAccount();
        if (savedCurrent) {
          setLoggedAccount(savedCurrent);
          setSelectedUsername(savedCurrent.username);
          setChangeUser(savedCurrent.username);
        } else if (accounts.length > 0) {
          setSelectedUsername((prev) => {
            if (prev && accounts.some((a) => a.username === prev)) return prev;
            return accounts[0].username;
          });
          setChangeUser((prev) => {
            if (prev && accounts.some((a) => a.username === prev)) return prev;
            return accounts[0].username;
          });
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentUsername = isCustomUser ? customUsername.trim().toLowerCase() : selectedUsername;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUsername) {
      setErrorMsg('Vui lòng chọn hoặc nhập tên đăng nhập');
      return;
    }
    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const sessionId = getClientSessionId();
    const res = await loginCompetitionAccount(currentUsername, password, sessionId);
    setLoading(false);

    if (res.success && res.account) {
      const savedAcc: SavedCompetitionAccount = {
        username: res.account.username,
        displayName: res.account.displayName,
        elo: res.account.elo,
      };
      saveCompetitionAccount(savedAcc);
      setLoggedAccount(savedAcc);
      setSuccessMsg(`Đăng nhập thành công với tài khoản "${savedAcc.displayName}"!`);
      onLoginSuccess(savedAcc);
      setTimeout(() => {
        setActiveTab('PROFILE');
        setSuccessMsg(null);
      }, 700);
    } else {
      setErrorMsg(res.message || 'Đăng nhập thất bại');
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const targetAccount = loggedAccount || getSavedCompetitionAccount();
    if (targetAccount?.username) {
      const sessionId = getClientSessionId();
      try {
        await logoutCompetitionAccount(targetAccount.username, sessionId);
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    saveCompetitionAccount(null);
    setLoggedAccount(null);
    setLoading(false);
    setSuccessMsg('Đã đăng xuất tài khoản thi đấu thành công!');
    setActiveTab('LOGIN');
    if (onLogoutSuccess) {
      onLogoutSuccess();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeUser) {
      setErrorMsg('Vui lòng chọn tài khoản cần đổi mật khẩu');
      return;
    }
    if (!oldPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (!newPassword || newPassword.length < 1) {
      setErrorMsg('Mật khẩu mới không được để trống');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await changeCompetitionAccountPassword(changeUser, oldPassword, newPassword);
    setLoading(false);

    if (res.success) {
      setSuccessMsg('Đổi mật khẩu thành công! Bạn có thể dùng mật khẩu mới để đăng nhập.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setActiveTab('LOGIN');
        setPassword(newPassword);
      }, 1200);
    } else {
      setErrorMsg(res.message || 'Đổi mật khẩu thất bại');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-stone-900 border border-amber-600/50 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 text-stone-100 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-400">Tài Khoản Xếp Hạng Cờ Tướng</h2>
            <p className="text-xs text-stone-400">Hệ thống tính điểm Elo chuẩn & Bảng phong thần</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex rounded-xl bg-stone-950 p-1 border border-stone-800 text-xs font-bold">
          {loggedAccount && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('PROFILE');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'PROFILE'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Hồ Sơ
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setActiveTab('LOGIN');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'LOGIN'
                ? 'bg-amber-600 text-white shadow'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {loggedAccount ? 'Đổi Tài Khoản' : 'Đăng Nhập'}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('CHANGE_PW');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'CHANGE_PW'
                ? 'bg-amber-600 text-white shadow'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Đổi Mật Khẩu
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab PROFILE: Logged-in view with stats & logout */}
        {activeTab === 'PROFILE' && loggedAccount && (() => {
          const currentAccInfo = accountsList.find(
            (a) => a.username.toLowerCase() === loggedAccount.username.toLowerCase()
          );
          const elo = currentAccInfo?.elo ?? loggedAccount.elo ?? 1300;
          const displayName = currentAccInfo?.displayName || loggedAccount.displayName;
          const matches = currentAccInfo?.matchesPlayed ?? 0;
          const wins = currentAccInfo?.wins ?? 0;
          const draws = currentAccInfo?.draws ?? 0;
          const losses = currentAccInfo?.losses ?? 0;
          const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
          const status = currentAccInfo?.rankStatus ?? 'ACTIVE';

          return (
            <div className="space-y-4">
              {/* Account Overview Card */}
              <div className="bg-gradient-to-b from-stone-800/80 to-stone-950 border border-amber-500/40 rounded-2xl p-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center gap-3.5 mb-3.5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 font-black text-xl shadow-lg border border-amber-300/40 shrink-0">
                    🏆
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-amber-400 truncate">
                        {displayName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                        {status === 'UNRANKED' ? 'Tập sự' : 'Đang thi đấu'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 font-mono mt-0.5">
                      Tài khoản: <span className="text-stone-200 font-semibold">{loggedAccount.username}</span>
                    </p>
                  </div>
                </div>

                {/* Elo Rating Display */}
                <div className="p-3 bg-stone-900/90 rounded-xl border border-amber-500/30 text-center mb-3">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">
                    Hệ Số Elo Cờ Tướng
                  </div>
                  <div className="text-3xl font-black text-amber-400 tracking-tight">
                    {elo} <span className="text-xs font-bold text-amber-300/80">Elo</span>
                  </div>
                </div>

                {/* Stats 4-box */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
                    <div className="text-[10px] text-stone-400 font-medium">Trận đấu</div>
                    <div className="text-sm font-black text-white">{matches}</div>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
                    <div className="text-[10px] text-emerald-400 font-medium">Thắng</div>
                    <div className="text-sm font-black text-emerald-400">{wins}</div>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
                    <div className="text-[10px] text-amber-400 font-medium">Hòa</div>
                    <div className="text-sm font-black text-amber-400">{draws}</div>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
                    <div className="text-[10px] text-rose-400 font-medium">Thua</div>
                    <div className="text-sm font-black text-rose-400">{losses}</div>
                  </div>
                </div>

                {/* Win rate progress bar */}
                {matches > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-800/80">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-stone-400 font-medium">Tỷ lệ thắng</span>
                      <span className="text-amber-400 font-bold">{winRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
                        style={{ width: `${winRate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('CHANGE_PW');
                    setChangeUser(loggedAccount.username);
                  }}
                  className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white font-bold text-xs rounded-xl border border-stone-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  Đổi Mật Khẩu
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('LOGIN')}
                  className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white font-bold text-xs rounded-xl border border-stone-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  Đổi Tài Khoản
                </button>
              </div>

              {/* Nút Đăng Xuất */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                {loading ? 'Đang đăng xuất...' : 'Đăng Xuất Khỏi Thiết Bị Này'}
              </button>
            </div>
          );
        })()}

        {/* Tab LOGIN */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-stone-300">Tài khoản kỳ thủ</label>
                <button
                  type="button"
                  onClick={() => setIsCustomUser(!isCustomUser)}
                  className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                >
                  {isCustomUser ? 'Chọn từ danh sách' : 'Nhập tài khoản khác'}
                </button>
              </div>

              {!isCustomUser ? (
                <div className="relative">
                  <select
                    value={selectedUsername}
                    onChange={(e) => setSelectedUsername(e.target.value)}
                    disabled={loadingAccounts || accountsList.length === 0}
                    className="w-full px-3 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-sm text-stone-100 font-medium focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-60"
                  >
                    {loadingAccounts && accountsList.length === 0 ? (
                      <option value="">Đang tải danh sách từ Firebase...</option>
                    ) : accountsList.length === 0 ? (
                      <option value="">Không tìm thấy tài khoản nào trên Firebase</option>
                    ) : (
                      accountsList.map((acc) => (
                        <option key={acc.username} value={acc.username}>
                          {acc.displayName || acc.username} ({acc.username}) - {acc.elo ?? 1300} Elo
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Nhập tên đăng nhập..."
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-sm text-stone-100 font-medium focus:outline-none focus:border-amber-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                Mật khẩu (Mặc định: 1)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 bg-stone-950 border border-stone-700 rounded-xl text-sm text-stone-100 font-medium focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? 'Đang xác thực...' : 'Đăng Nhập Thi Đấu'}
            </button>
          </form>
        )}

        {/* Tab CHANGE PASSWORD */}
        {activeTab === 'CHANGE_PW' && (
          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                Tài khoản cần đổi
              </label>
              <select
                value={changeUser}
                onChange={(e) => setChangeUser(e.target.value)}
                disabled={loadingAccounts || accountsList.length === 0}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-sm text-stone-100 font-medium focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-60"
              >
                {loadingAccounts && accountsList.length === 0 ? (
                  <option value="">Đang tải danh sách từ Firebase...</option>
                ) : accountsList.length === 0 ? (
                  <option value="">Không tìm thấy tài khoản nào trên Firebase</option>
                ) : (
                  accountsList.map((acc) => (
                    <option key={acc.username} value={acc.username}>
                      {acc.displayName || acc.username} ({acc.username})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                Mật khẩu hiện tại
              </label>
              <input
                type="password"
                placeholder="Mật khẩu cũ (mặc định: 1)"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-sm text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">Mật khẩu mới</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu mới..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-sm text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                Xác nhận mật khẩu mới
              </label>
              <input
                type="password"
                placeholder="Nhập lại mật khẩu mới..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-sm text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? 'Đang lưu...' : 'Xác Nhận Đổi Mật Khẩu'}
            </button>
          </form>
        )}

        {/* Bottom Quick Links */}
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="hover:text-amber-400 transition flex items-center gap-1 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              Bảng Xếp Hạng
            </button>
          )}
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="hover:text-amber-400 transition flex items-center gap-1 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              Lịch Sử Đấu
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
