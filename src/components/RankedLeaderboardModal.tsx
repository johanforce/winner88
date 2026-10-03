import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  Medal,
  Flame,
  Search,
  RefreshCw,
  History,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { getLeaderboard, CompetitionAccount } from '../firebase';

export interface RankedLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHistory?: () => void;
}

export const RankedLeaderboardModal: React.FC<RankedLeaderboardModalProps> = ({
  isOpen,
  onClose,
  onOpenHistory,
}) => {
  const [leaderboard, setLeaderboard] = useState<CompetitionAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = leaderboard.filter((acc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      acc.username.toLowerCase().includes(q) ||
      (acc.displayName && acc.displayName.toLowerCase().includes(q))
    );
  });

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500 text-amber-400 font-black text-xs flex items-center justify-center shadow-lg">
          🥇
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="w-7 h-7 rounded-full bg-slate-300/20 border border-slate-300 text-slate-200 font-black text-xs flex items-center justify-center">
          🥈
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="w-7 h-7 rounded-full bg-amber-700/20 border border-amber-700 text-amber-600 font-black text-xs flex items-center justify-center">
          🥉
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-full bg-stone-800 text-stone-400 font-bold text-xs flex items-center justify-center">
        {index + 1}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-stone-900 border border-amber-600/50 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 text-stone-100 relative flex flex-col max-h-[85vh]">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pr-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-400">Bảng Phong Thần Cờ Tướng</h2>
              <p className="text-xs text-stone-400">Hệ thống xếp hạng Elo chuẩn 9 kỳ thủ cao thủ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm kỳ thủ theo tên hoặc ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-sky-400 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <History className="w-4 h-4" />
              Lịch Sử Đấu
            </button>
          )}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[300px]">
          {loading && leaderboard.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">Đang tải bảng xếp hạng...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              Không tìm thấy kỳ thủ phù hợp
            </div>
          ) : (
            filtered.map((acc, idx) => {
              const winRate =
                acc.matchesPlayed > 0
                  ? Math.round((acc.wins / acc.matchesPlayed) * 100)
                  : 0;

              const isUnranked = acc.matchesPlayed === 0;

              return (
                <div
                  key={acc.username}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                    idx === 0
                      ? 'bg-amber-950/30 border-amber-600/40 hover:border-amber-500'
                      : idx === 1
                      ? 'bg-stone-800/40 border-slate-700/50 hover:border-slate-500'
                      : idx === 2
                      ? 'bg-amber-950/20 border-amber-900/40 hover:border-amber-700'
                      : 'bg-stone-950/60 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getRankBadge(idx)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-100">
                          {acc.displayName || acc.username}
                        </span>
                        <span className="text-[11px] text-stone-400">@{acc.username}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-400">
                        {isUnranked ? (
                          <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 text-[10px] font-semibold">
                            Chưa đấu ván nào
                          </span>
                        ) : (
                          <span>
                            {acc.matchesPlayed} trận • {acc.wins}T - {acc.draws}H - {acc.losses}B (
                            {winRate}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span className="text-base font-black text-amber-400">{acc.elo}</span>
                    </div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider">
                      {acc.rankStatus || (isUnranked ? 'UNRANKED' : 'ACTIVE')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-400 flex items-center justify-between">
          <span>Tiêu chí: Elo cao nhất → Tỷ lệ thắng → Số trận thắng → Số trận hòa. (Elo sàn 1301).</span>
          <span className="text-amber-400 font-semibold">Cập nhật thời gian thực</span>
        </div>
      </div>
    </div>
  );
};
