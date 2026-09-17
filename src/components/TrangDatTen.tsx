import React, { useState } from 'react';
import { User, Sparkles, Trophy, ShieldCheck } from 'lucide-react';
import { savePlayerProfile } from '../socket';

interface TrangDatTenProps {
  initialName: string;
  initialAvatar: string;
  onComplete: (name: string, avatar: string) => void;
}

const AVATAR_LIST = [
  '🤠', '👑', '🦊', '🐱', '🦁', '🐉', '🐯', '🦹',
  '🎲', '🃏', '🎩', '🕶️', '🚀', '🔥', '💎', '🍀',
];

const RANDOM_NAMES = [
  'Thần Bài 88', 'Cậu Ba Tiến Lên', 'Trùm Sâm Lốc', 'Bất Bại Sòng',
  'Tứ Quý Chặt Heo', 'Bá Đạo Miền Nam', 'Cao Thủ Sân Đình', 'Thần Kê Chiến',
  'Vua Lốc 99', 'Heo Cơ Quyền Lực',
];

export const TrangDatTen: React.FC<TrangDatTenProps> = ({
  initialName,
  initialAvatar,
  onComplete,
}) => {
  const [name, setName] = useState(initialName || '');
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar || '🤠');
  const [error, setError] = useState<string | null>(null);

  const handleRandomName = () => {
    const random = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setName(random);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Vui lòng nhập tên người chơi');
      return;
    }
    if (trimmed.length < 2) {
      setError('Tên phải có ít nhất 2 ký tự');
      return;
    }
    if (trimmed.length > 20) {
      setError('Tên không được dài quá 20 ký tự');
      return;
    }
    // Check for dangerous scripts or special HTML characters
    if (/[<>{}]/.test(trimmed)) {
      setError('Tên không được chứa ký tự đặc biệt nguy hiểm (<, >, {, })');
      return;
    }

    savePlayerProfile(trimmed, selectedAvatar);
    onComplete(trimmed, selectedAvatar);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950">
      <div className="w-full max-w-md bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-700/30 mb-3 border border-emerald-300/30">
            <span className="text-3xl">♠♥</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Đánh Bài Online
          </h1>
          <p className="text-xs sm:text-sm text-emerald-300/80 mt-1 font-medium">
            Tiến Lên Miền Nam &bull; Sâm Lốc Realtime
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Chọn Avatar đại diện
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
              {AVATAR_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  id={`avatar-${emoji}`}
                  onClick={() => setSelectedAvatar(emoji)}
                  className={`
                    h-10 sm:h-9 rounded-lg flex items-center justify-center text-xl transition-all cursor-pointer touch-manipulation
                    ${selectedAvatar === emoji ? 'bg-emerald-600 scale-105 shadow-md ring-2 ring-emerald-400' : 'hover:bg-slate-800 text-slate-400'}
                  `}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="player-name-input" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Tên hiển thị của bạn
              </label>
              <button
                type="button"
                id="btn-random-name"
                onClick={handleRandomName}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors cursor-pointer touch-manipulation"
              >
                <Sparkles className="w-3 h-3" />
                Gợi ý tên hay
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="player-name-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="Ví dụ: Thần Bài 88, Cậu Ba..."
                maxLength={20}
                className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-white placeholder-slate-500 text-base sm:text-sm outline-none transition"
              />
            </div>
            {error && (
              <p className="text-rose-400 text-xs mt-1.5 font-medium flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}
          </div>

          {/* Features highlight pills */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
            <div className="flex items-center gap-1.5 bg-slate-950/40 p-2 rounded-lg border border-slate-800/80">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Không cần đăng ký</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950/40 p-2 rounded-lg border border-slate-800/80">
              <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Chơi Realtime mượt mà</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="btn-enter-lobby"
            className="w-full min-h-[48px] py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-700/25 transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <span>Vào Sảnh Chơi Ngay</span>
            <span className="text-lg leading-none">&rarr;</span>
          </button>
        </form>
      </div>
    </div>
  );
};
