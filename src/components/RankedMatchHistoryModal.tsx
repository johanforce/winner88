import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  Trophy,
  RefreshCw,
  Clock,
  Swords,
  CheckCircle,
  AlertTriangle,
  MinusCircle,
} from 'lucide-react';
import { getRankedMatches, RankedMatchRecord } from '../firebase';

export interface RankedMatchHistoryModalProps {
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
  const [loading, setLoading] = useState<boolean>(false);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await getRankedMatches(50);
      setMatches(data);
    } catch (err) {
      console.error('Error fetching ranked matches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMatches();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'CHECKMATE':
        return 'Chiếu bí';
      case 'TIMEOUT':
        return 'Hết giờ';
      case 'RESIGN':
        return 'Xin hàng';
      case 'STALEMATE':
        return 'Hết nước đi';
      case 'AGREED_DRAW':
        return 'Hòa thỏa thuận';
      case 'REPETITION':
        return 'Hòa lặp nước';
      default:
        return reason;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-stone-900 border border-sky-600/50 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 text-stone-100 relative flex flex-col max-h-[85vh]">
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
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-500/50 flex items-center justify-center text-sky-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-sky-400">Lịch Sử Trận Đấu Xếp Hạng</h2>
              <p className="text-xs text-stone-400">Chi tiết kết quả thi đấu & biến động điểm Elo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadMatches}
            disabled={loading}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Actions Bar */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-stone-400">Hiển thị {matches.length} trận đấu gần nhất</span>
          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5" />
              Xem Bảng Phong Thần
            </button>
          )}
        </div>

        {/* Matches List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar min-h-[300px]">
          {loading && matches.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">Đang tải lịch sử đấu...</div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">Chưa có trận đấu xếp hạng nào</div>
          ) : (
            matches.map((m) => {
              const dateStr = new Date(m.playedAt).toLocaleString('vi-VN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const isRedWin = m.winnerSide === 'RED';
              const isBlackWin = m.winnerSide === 'BLACK';
              const isDraw = m.winnerSide === 'DRAW';

              const redDeltaStr = m.redEloDelta >= 0 ? `+${m.redEloDelta}` : `${m.redEloDelta}`;
              const blackDeltaStr = m.blackEloDelta >= 0 ? `+${m.blackEloDelta}` : `${m.blackEloDelta}`;

              return (
                <div
                  key={m.matchId}
                  className="p-3.5 bg-stone-950/80 border border-stone-800 rounded-xl hover:border-stone-700 transition space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-400 border-b border-stone-800/80 pb-1.5">
                    <span className="font-mono text-stone-300">Phòng: {m.roomCode}</span>
                    <span className="flex items-center gap-1 text-stone-400">
                      <Clock className="w-3 h-3" />
                      {dateStr} ({Math.round(m.durationSeconds / 60)} phút • {m.movesCount} nước)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-bold text-[10px]">
                      {getReasonLabel(m.winReason)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-center">
                    {/* Red player */}
                    <div
                      className={`p-2 rounded-lg border ${
                        isRedWin
                          ? 'bg-red-950/30 border-red-700/60'
                          : isDraw
                          ? 'bg-stone-900 border-stone-800'
                          : 'bg-stone-900/60 border-stone-800/60 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-400 truncate">
                          🔴 {m.redPlayerName}
                        </span>
                        {isRedWin && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 bg-red-900/60 text-red-300 rounded">
                            THẮNG
                          </span>
                        )}
                        {isDraw && (
                          <span className="text-[10px] font-bold text-stone-400">HÒA</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-stone-400">{m.redEloBefore} → {m.redEloAfter}</span>
                        <span
                          className={`font-black ${
                            m.redEloDelta > 0
                              ? 'text-emerald-400'
                              : m.redEloDelta < 0
                              ? 'text-rose-400'
                              : 'text-stone-400'
                          }`}
                        >
                          {redDeltaStr}
                        </span>
                      </div>
                    </div>

                    {/* Black player */}
                    <div
                      className={`p-2 rounded-lg border ${
                        isBlackWin
                          ? 'bg-amber-950/30 border-amber-700/60'
                          : isDraw
                          ? 'bg-stone-900 border-stone-800'
                          : 'bg-stone-900/60 border-stone-800/60 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-200 truncate">
                          ⚫ {m.blackPlayerName}
                        </span>
                        {isBlackWin && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 bg-amber-900/60 text-amber-300 rounded">
                            THẮNG
                          </span>
                        )}
                        {isDraw && (
                          <span className="text-[10px] font-bold text-stone-400">HÒA</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-stone-400">{m.blackEloBefore} → {m.blackEloAfter}</span>
                        <span
                          className={`font-black ${
                            m.blackEloDelta > 0
                              ? 'text-emerald-400'
                              : m.blackEloDelta < 0
                              ? 'text-rose-400'
                              : 'text-stone-400'
                          }`}
                        >
                          {blackDeltaStr}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
