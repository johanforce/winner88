import React, { useState } from 'react';
import { User, Sparkles, ArrowRight } from 'lucide-react';

interface TrangDatTenProps {
  initialName: string;
  initialAvatar: string;
  onComplete: (name: string, avatar: string) => void;
}

const AVATAR_LIST = ['🤠', '😎', '🐱', '🐶', '🦊', '🦁', '🐯', '🐼', '🤖', '👾', '👑', '🚀'];

export const TrangDatTen: React.FC<TrangDatTenProps> = ({
  initialName,
  initialAvatar,
  onComplete,
}) => {
  const [name, setName] = useState(initialName || '');
  const [avatar, setAvatar] = useState(initialAvatar || '🤠');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Vui lòng nhập tên của bạn');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError('Tên phải từ 2 đến 20 ký tự');
      return;
    }
    onComplete(trimmed, avatar);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-[#120e0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur relative overflow-hidden">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-amber-400 tracking-wide uppercase">
            Winner88 Club
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Đặt tên và chọn ảnh đại diện để bắt đầu cuộc đấu
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Tên Hiển Thị
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                maxLength={20}
                placeholder="Nhập tên của bạn..."
                className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-semibold focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none text-sm placeholder:text-slate-600"
                autoFocus
              />
            </div>
            {error && <p className="text-rose-400 text-xs mt-1.5 font-medium">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Chọn Avatar
            </label>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_LIST.map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => setAvatar(emo)}
                  className={`h-12 rounded-xl text-2xl flex items-center justify-center transition border ${
                    avatar === emo
                      ? 'bg-amber-500/30 border-amber-400 shadow-md scale-105'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition cursor-pointer"
          >
            <span>Vào Sảnh Thi Đấu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
