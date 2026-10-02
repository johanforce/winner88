import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  RefreshCw,
  Medal,
  Clock,
  AlertTriangle,
  Flame,
  Shield,
  Info,
} from 'lucide-react';
import { getLeaderboard, CompetitionAccount } from '../firebase';

interface RankedLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHistory?: () => void;
}

export const RankedLeaderboardModal: React.FC<RankedLeaderboardModalProps> = ({
  isOpen,
  onClose,
  onOpenHistory,
}) => {
  const [accounts, setAccounts] = useState<CompetitionAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showRuleInfo, setShowRuleInfo] = useState(false);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await getLeaderboard();
      setAccounts(data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (timestamp?: number) => {
    if (!timestamp || timestamp === 0) return 'Chưa đấu';
    const date = new Date(timestamp);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">
          🥇 1
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-300 to-slate-100 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">
          🥈 2
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-700 to-amber-600 text-white font-black flex items-center justify-center text-xs shadow-md">
          🥉 3
        </span>
      );
    }
    return (
      <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold flex items-center justify-center text-xs">
        {index + 1}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                Bảng Xếp Hạng Cờ Tướng (Elo)
              </h2>
              <p className="text-[11px] text-amber-300/80 font-medium">
                9 Kỳ Thủ Đấu Xếp Hạng &bull; Chuẩn Elo Quốc Tế
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRuleInfo(!showRuleInfo)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Xem thể thức xếp hạng & luật trừ Elo"
            >
              <Info className="w-4 h-4 text-amber-400" />
            </button>
            <button
              onClick={fetchLeaderboard}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Làm mới bảng xếp hạng"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rule info banner */}
        {showRuleInfo && (
          <div className="px-6 py-3 bg-amber-950/40 border-b border-amber-500/20 text-xs text-amber-200/90 space-y-1 animate-in slide-in-from-top-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Quy chế Xếp hạng & Elo Cờ Tướng:</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-300">
              <li>
                <strong>Elo khởi điểm:</strong> 1300. Khi bắt đầu thi đấu, mức sàn không thể dưới <strong>1301</strong> (kỳ thủ 1301 elo nếu thua sẽ không bị trừ nữa).
              </li>
              <li>
                <strong>Thời gian ván đấu:</strong> 30 phút/kỳ thủ (không cộng dồn), giới hạn 2 phút suy nghĩ/nước. Hết 30p hoặc quá 2p không đi sẽ tính thua.
              </li>
              <li>
                <strong>Cảnh báo vắng mặt:</strong> Quá 1 tuần không phát sinh trận đấu sẽ bị trừ 80 Elo (tương ứng 5 trận thua, tối đa về 1301 Elo).
              </li>
              <li>
                <strong>Reset rank:</strong> Quá 2 tuần không thi đấu sẽ bị reset rank về mốc 1300 Elo.
              </li>
              <li>
                <strong>Dọn dẹp phòng:</strong> Mỗi 22:00 hàng ngày hệ thống sẽ tự động dọn các phòng không trong trận.
              </li>
            </ul>
          </div>
        )}

        {/* Content table */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-inner">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <th className="py-3 px-3 text-center">Hạng</th>
                  <th className="py-3 px-3">Kỳ Thủ</th>
                  <th className="py-3 px-3 text-center">Điểm Elo</th>
                  <th className="py-3 px-3 text-center">Trận (T - H - B)</th>
                  <th className="py-3 px-3 text-center">Tỉ Lệ Thắng</th>
                  <th className="py-3 px-3 text-right">Trận Gần Nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {accounts.map((acc, idx) => {
                  const winRate =
                    acc.matchesPlayed > 0
                      ? Math.round((acc.wins / acc.matchesPlayed) * 100)
                      : 0;

                  return (
                    <tr
                      key={acc.username}
                      className={`hover:bg-slate-800/40 transition ${
                        idx < 3 ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {getRankBadge(idx)}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-300">
                            {acc.displayName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{acc.displayName}</span>
                              {acc.rankStatus === 'DECAYED' && (
                                <span className="text-[9px] bg-rose-950/60 border border-rose-500/40 text-rose-300 px-1 rounded">
                                  -80 Elo vắng mặt
                                </span>
                              )}
                              {acc.rankStatus === 'RESET' && (
                                <span className="text-[9px] bg-slate-800 border border-slate-600 text-slate-300 px-1 rounded">
                                  Reset 1300
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              @{acc.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-black text-sm text-amber-400 bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-500/30">
                          {acc.elo}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-white font-semibold">
                          {acc.matchesPlayed}
                        </span>{' '}
                        <span className="text-slate-400 text-[10px]">
                          ({acc.wins}W - {acc.draws}D - {acc.losses}L)
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 font-bold">
                          <span
                            className={
                              winRate >= 60
                                ? 'text-emerald-400'
                                : winRate >= 40
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }
                          >
                            {winRate}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap text-[11px] text-slate-400">
                        {formatDate(acc.lastMatchAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Tổng số: {accounts.length} kỳ thủ</span>
          {onOpenHistory && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHistory();
              }}
              className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer flex items-center gap-1"
            >
              <span>Xem lịch sử tất cả các trận đấu &rarr;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
