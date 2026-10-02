import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  User,
  ShieldCheck,
  Award,
  KeyRound,
  LogOut,
  Trophy,
  History,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  PRESET_ACCOUNTS,
  getCompetitionAccount,
  CompetitionAccount,
  seedPresetAccountsIfNotExist,
  changeCompetitionAccountPassword,
  loginCompetitionAccount,
  logoutCompetitionAccount,
} from '../firebase';
import {
  getSavedCompetitionAccount,
  saveCompetitionAccount,
  getRememberAccountPreference,
  getClientSessionId,
  SavedCompetitionAccount,
} from '../socket';

interface RankedLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (account: SavedCompetitionAccount) => void;
  onOpenLeaderboard?: () => void;
  onOpenHistory?: () => void;
}

export const RankedLoginModal: React.FC<RankedLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenLeaderboard,
  onOpenHistory,
}) => {
  const [currentAccount, setCurrentAccount] = useState<SavedCompetitionAccount | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Change password mode state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedCompetitionAccount();
      setCurrentAccount(saved);
      setRememberMe(getRememberAccountPreference());
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsChangingPassword(false);

      if (saved) {
        setUsernameInput(saved.username);
        // Refresh account elo from DB
        getCompetitionAccount(saved.username).then((acc) => {
          if (acc) {
            const updated: SavedCompetitionAccount = {
              username: acc.username,
              displayName: acc.displayName,
              elo: acc.elo,
            };
            setCurrentAccount(updated);
            saveCompetitionAccount(updated, rememberMe);
          }
        });
      } else {
        setUsernameInput('thangnc');
        setPasswordInput('1');
      }

      // Seed preset accounts if needed
      seedPresetAccountsIfNotExist();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const cleanUser = usernameInput.trim().toLowerCase();
    if (!cleanUser) {
      setErrorMsg('Vui lòng nhập tên tài khoản thi đấu!');
      return;
    }
    if (!passwordInput) {
      setErrorMsg('Vui lòng nhập mật khẩu (mặc định: 1)!');
      return;
    }

    setIsLoading(true);
    try {
      const clientSessionId = getClientSessionId();
      const loginRes = await loginCompetitionAccount(cleanUser, passwordInput, clientSessionId);

      if (!loginRes.success || !loginRes.account) {
        setErrorMsg(loginRes.message || 'Đăng nhập không thành công!');
        setIsLoading(false);
        return;
      }

      const acc = loginRes.account;
      const saved: SavedCompetitionAccount = {
        username: acc.username,
        displayName: acc.displayName,
        elo: acc.elo,
      };

      saveCompetitionAccount(saved, rememberMe);
      setCurrentAccount(saved);
      setSuccessMsg(`Đăng nhập thành công! Chào kỳ thủ ${acc.displayName} (Elo: ${acc.elo})`);
      onLoginSuccess(saved);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg('Lỗi kết nối cơ sở dữ liệu Firebase. Vui lòng thử lại!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (uname: string) => {
    setUsernameInput(uname);
    setPasswordInput('1');
    setErrorMsg(null);
  };

  const handleLogout = async () => {
    if (currentAccount?.username) {
      try {
        await logoutCompetitionAccount(currentAccount.username, getClientSessionId());
      } catch (err) {
        console.error('Error logging out:', err);
      }
    }
    saveCompetitionAccount(null);
    setCurrentAccount(null);
    setUsernameInput('thangnc');
    setPasswordInput('1');
    setSuccessMsg('Đã đăng xuất tài khoản thi đấu.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!oldPasswordInput) {
      setErrorMsg('Vui lòng nhập mật khẩu hiện tại!');
      return;
    }
    if (!newPasswordInput) {
      setErrorMsg('Vui lòng nhập mật khẩu mới!');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setErrorMsg('Mật khẩu xác nhận không khớp!');
      return;
    }

    setIsPasswordLoading(true);
    try {
      const res = await changeCompetitionAccountPassword(
        currentAccount.username,
        oldPasswordInput,
        newPasswordInput
      );
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setSuccessMsg('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới nhé.');
        setIsChangingPassword(false);
        setOldPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
      }
    } catch {
      setErrorMsg('Lỗi khi cập nhật mật khẩu trên hệ thống!');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/80 border-b border-amber-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                Tài Khoản Cờ Tướng Xếp Hạng
              </h2>
              <p className="text-[11px] text-amber-300/80 font-medium">
                Hệ thống Elo Quốc Tế &bull; Khởi điểm 1300 &bull; Sàn 1301
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Status banners */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/70 border border-rose-600/60 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-600/60 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* If already logged in */}
          {currentAccount && !isChangingPassword ? (
            <div className="bg-slate-800/50 border border-amber-500/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-red-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                    {currentAccount.displayName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-base">
                        {currentAccount.displayName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold">
                        @{currentAccount.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-300">Điểm Elo xếp hạng:</span>
                      <span className="text-sm font-black text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30">
                        {currentAccount.elo}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Đăng xuất khỏi tài khoản này"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(true)}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Đổi Mật Khẩu</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLeaderboard?.();
                  }}
                  className="p-2.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bảng Xếp Hạng</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenHistory?.();
                  }}
                  className="w-full p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Xem Lịch Sử Các Trận Đấu Xếp Hạng</span>
                </button>
              </div>
            </div>
          ) : isChangingPassword ? (
            /* Change password form */
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Đổi Mật Khẩu (@{currentAccount?.username})
                </span>
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Quay lại
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  value={oldPasswordInput}
                  onChange={(e) => setOldPasswordInput(e.target.value)}
                  placeholder="Mật khẩu hiện tại (mặc định là: 1)"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-xs outline-none transition"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPasswordLoading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isPasswordLoading ? 'Đang cập nhật...' : 'Xác Nhận Đổi'}
                </button>
              </div>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Tên đăng nhập tài khoản</span>
                  <span className="text-[10px] text-amber-400/90 font-normal">
                    Chọn nhanh 1 trong 9 kỳ thủ bên dưới
                  </span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
                    placeholder="ví dụ: thangnc, quannd, tuanhm..."
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-xs outline-none transition uppercase-placeholder font-mono"
                  />
                </div>
              </div>

              {/* Quick Preset Accounts Grid */}
              <div>
                <span className="block text-[11px] text-slate-400 mb-1.5">
                  Danh sách 9 tài khoản thi đấu có sẵn:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => handleSelectPreset(acc.username)}
                      className={`px-2 py-1.5 rounded-lg border text-left text-[11px] font-semibold transition cursor-pointer ${
                        usernameInput === acc.username
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="truncate font-mono">{acc.username}</div>
                      <div className="text-[9px] text-slate-400 truncate">{acc.displayName}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Mật khẩu</span>
                  <span className="text-[10px] text-slate-400">Mặc định: <strong>1</strong> (có thể đổi sau)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Mật khẩu"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-xs outline-none transition"
                  />
                </div>
              </div>

              {/* Remember account option */}
              <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 accent-amber-500"
                  />
                  <span>Ghi nhớ tài khoản trên thiết bị này</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-slate-950 font-black text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 touch-manipulation"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isLoading ? 'Đang kiểm tra...' : 'Đăng Nhập Thi Đấu Ngay'}</span>
              </button>
            </form>
          )}

          {/* Quick links footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLeaderboard?.();
              }}
              className="hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Bảng xếp hạng Elo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHistory?.();
              }}
              className="hover:text-emerald-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span>Lịch sử đấu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
