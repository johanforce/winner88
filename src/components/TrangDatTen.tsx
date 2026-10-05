import React, { useState } from 'react';
import { User, Sparkles, Trophy, ShieldCheck } from 'lucide-react';

interface TrangDatTenProps {
  initialName: string;
  initialAvatar: string;
  onComplete: (name: string, avatar: string) => void;
}

const AVATAR_LIST = [
  '🐵', '👑', '🦊', '🐱', '🦁', '🐉', '🐯', '🦹',
  '🎲', '🃏', '🎩', '🕶️', '🚀', '🔥', '💎', '🍀',
];

const RANDOM_NAMES = [
  'Thần Bài 88',
  'Cậu Ba',
  'Trùm Sâm Lốc',
  'Bất Bại Sòng',
  'Tứ Quý Chặt Heo',
  'Bá Đạo Miền Nam',
  'Cao Thủ Sân Đình',
  'Thần Kê Chiến',
  'Vua Lốc 99',
  'Heo Cơ Quyền Lực',
  'Vua Cờ Tướng',
  'Kỳ Vương 88',
];

export const TrangDatTen: React.FC<TrangDatTenProps> = ({
  initialName,
  initialAvatar,
  onComplete,
}) => {
  const [name, setName] = useState(initialName || '');
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar || '🐵');
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
      setError('Vui lòng nhập tên hiển thị của bạn');
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
    if (/[<>{}]/.test(trimmed)) {
      setError('Tên không được chứa ký tự đặc biệt nguy hiểm');
      return;
    }

    onComplete(trimmed, selectedAvatar);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#020b08] via-[#051913] to-[#020b08] text-white">
      <div className="w-full max-w-md bg-[#091a16]/95 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Icon Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 mb-3 border border-emerald-400/30">
            <span className="text-2xl font-black tracking-tight select-none">♠♥</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Đánh Bài Online
          </h1>
          <p className="text-xs sm:text-sm text-emerald-400 mt-1 font-semibold tracking-wide">
            Tiến Lên Miền Nam • Sâm Lốc Realtime
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              CHỌN AVATAR ĐẠI DIỆN
            </label>
            <div className="p-2.5 bg-[#051310]/80 rounded-2xl border border-slate-800/80">
              <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
                {AVATAR_LIST.map((emoji) => {
                  const isSelected = selectedAvatar === emoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      id={`avatar-${emoji}`}
                      onClick={() => setSelectedAvatar(emoji)}
                      className={`
                        h-10 w-full rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer touch-manipulation
                        ${
                          isSelected
                            ? 'bg-emerald-600 scale-105 shadow-md ring-2 ring-emerald-400 border border-emerald-300/40 text-white'
                            : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                        }
                      `}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Name input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="player-name-input" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                TÊN HIỂN THỊ CỦA BẠN
              </label>
              <button
                type="button"
                id="btn-random-name"
                onClick={handleRandomName}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold transition-colors cursor-pointer touch-manipulation"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Gợi ý tên hay</span>
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
                className="w-full pl-10 pr-4 py-3 bg-[#051310]/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 rounded-xl text-white placeholder-slate-500 text-sm outline-none transition"
              />
            </div>
            {error && (
              <p className="text-rose-400 text-xs mt-1.5 font-medium flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}
          </div>

          {/* Badges row */}
          <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-300 pt-1">
            <div className="flex items-center gap-2 bg-[#051310]/60 px-3 py-2.5 rounded-xl border border-slate-800/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium text-slate-300 text-[11px] sm:text-xs">Không cần đăng ký</span>
            </div>
            <div className="flex items-center gap-2 bg-[#051310]/60 px-3 py-2.5 rounded-xl border border-slate-800/80">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-medium text-slate-300 text-[11px] sm:text-xs">Chơi Realtime mượt mà</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="btn-enter-lobby"
            className="w-full min-h-[48px] py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <span>Vào Sảnh Chơi Ngay</span>
            <span className="text-lg leading-none">&rarr;</span>
          </button>
        </form>
      </div>
    </div>
  );
};
