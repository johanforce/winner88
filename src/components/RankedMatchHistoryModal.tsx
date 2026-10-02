import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  RefreshCw,
  Search,
  Trophy,
  Clock,
  Swords,
  ChevronRight,
  Shield,
  Calendar,
} from 'lucide-react';
import { getRankedMatches, RankedMatchRecord } from '../firebase';

interface RankedMatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLeaderboard?: () => void;
}

export const RankedMatchHistoryModal: React.FC<RankedMatchHistoryModalProps> = ({
  isOpen,
  onClose,
  onOpenLeaderboard,
}) => {
  const [matches, setMatches] = useState<RankedMatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const data = await getRankedMatches(100);
      setMatches(data);
    } catch (err) {
      console.error('Error fetching match history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMatches();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'CHECKMATE':
        return 'Chiếu Bí';
      case 'TIMEOUT':
        return 'Hết Giờ';
      case 'RESIGN':
        return 'Đầu Hàng';
      case 'STALEMATE':
        return 'Bức Tử';
      case 'AGREED_DRAW':
        return 'Hòa Thỏa Thuận';
      case 'REPETITION':
        return 'Hòa Lặp Nước';
      default:
        return reason;
    }
  };

  const filteredMatches = matches.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.redUsername.toLowerCase().includes(q) ||
      m.redPlayerName.toLowerCase().includes(q) ||
      m.blackUsername.toLowerCase().includes(q) ||
      m.blackPlayerName.toLowerCase().includes(q) ||
      m.roomCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border-b border-emerald-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
              <History className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                Lịch Sử Trận Đấu Cờ Tướng Xếp Hạng
              </h2>
              <p className="text-[11px] text-emerald-300/80 font-medium">
                Lưu trữ tất cả các trận đấu, biến động Elo & kết quả chi tiết
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMatches}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Làm mới lịch sử"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên kỳ thủ hoặc mã phòng..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-white text-xs outline-none"
            />
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {filteredMatches.length} trận đấu
          </span>
        </div>

        {/* Matches list */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {isLoading && matches.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-emerald-400" />
              <span>Đang tải lịch sử ván đấu...</span>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
              <History className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="font-bold text-white text-sm">Chưa có trận đấu xếp hạng nào</p>
              <p className="text-[11px] mt-1 text-slate-500">
                Hãy vào phòng Cờ Tướng Xếp Hạng để bắt đầu thi đấu tích lũy Elo!
              </p>
            </div>
          ) : (
            filteredMatches.map((match) => {
              const isRedWin = match.winnerSide === 'RED';
              const isBlackWin = match.winnerSide === 'BLACK';
              const isDraw = match.winnerSide === 'DRAW';

              return (
                <div
                  key={match.matchId}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl transition shadow-sm space-y-3"
                >
                  {/* Top info row */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {match.roomCode}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(match.playedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {formatDuration(match.durationSeconds)} ({match.movesCount || 0} nước)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isDraw
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-600/40'
                            : 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/40'
                        }`}
                      >
                        {getReasonLabel(match.winReason)}
                      </span>
                    </div>
                  </div>

                  {/* Players duel matchup row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    {/* RED Player */}
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        isRedWin
                          ? 'bg-red-950/40 border-red-500/60 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shadow">
                          Đỏ
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white flex items-center gap-1.5">
                            <span>{match.redPlayerName}</span>
                            {isRedWin && <span className="text-[10px] text-amber-400 font-black">👑 THẮNG</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            @{match.redUsername}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-black text-white">
                          {match.redEloAfter}
                        </div>
                        <div
                          className={`text-[10px] font-bold ${
                            match.redEloDelta > 0
                              ? 'text-emerald-400'
                              : match.redEloDelta < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {match.redEloDelta > 0 ? `+${match.redEloDelta}` : match.redEloDelta}
                        </div>
                      </div>
                    </div>

                    {/* BLACK Player */}
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        isBlackWin
                          ? 'bg-slate-800/60 border-slate-600/60 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-600 text-white font-bold text-xs flex items-center justify-center shadow">
                          Đen
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white flex items-center gap-1.5">
                            <span>{match.blackPlayerName}</span>
                            {isBlackWin && <span className="text-[10px] text-amber-400 font-black">👑 THẮNG</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            @{match.blackUsername}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-black text-white">
                          {match.blackEloAfter}
                        </div>
                        <div
                          className={`text-[10px] font-bold ${
                            match.blackEloDelta > 0
                              ? 'text-emerald-400'
                              : match.blackEloDelta < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {match.blackEloDelta > 0 ? `+${match.blackEloDelta}` : match.blackEloDelta}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Tổng số {matches.length} ván đấu đã lưu trữ</span>
          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLeaderboard();
              }}
              className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer flex items-center gap-1"
            >
              <span>Xem Bảng Xếp Hạng Elo &rarr;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
