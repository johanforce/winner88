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
} from 'lucide-react';
import {
  loginCompetitionAccount,
  changeCompetitionAccountPassword,
  CompetitionAccount,
  PRESET_ACCOUNTS,
  seedPresetAccountsIfNotExist,
  getLeaderboard,
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
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'CHANGE_PW'>('LOGIN');
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [accountsList, setAccountsList] = useState<CompetitionAccount[]>([]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      const saved = getSavedCompetitionAccount();
      if (saved) {
        setSelectedUsername(saved.username);
        setChangeUser(saved.username);
      }
      seedPresetAccountsIfNotExist().then(() => {
        getLeaderboard().then(setAccountsList);
      });
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
      onLoginSuccess(savedAcc);
      onClose();
    } else {
      setErrorMsg(res.message || 'Đăng nhập thất bại');
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
            Đăng Nhập
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
                <select
                  value={selectedUsername}
                  onChange={(e) => setSelectedUsername(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-sm text-stone-100 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {PRESET_ACCOUNTS.map((p) => {
                    const dynamic = accountsList.find((a) => a.username === p.username);
                    const elo = dynamic?.elo ?? 1300;
                    return (
                      <option key={p.username} value={p.username}>
                        {p.displayName} ({p.username}) - {elo} Elo
                      </option>
                    );
                  })}
                </select>
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
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-sm text-stone-100 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {PRESET_ACCOUNTS.map((p) => (
                  <option key={p.username} value={p.username}>
                    {p.displayName} ({p.username})
                  </option>
                ))}
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
