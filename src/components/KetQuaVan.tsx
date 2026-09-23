import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RefreshCw, LogOut, Award, Flame, BookOpen } from 'lucide-react';
import { GameResultRecord, GameRule, PlayerPublicInfo } from '../types';
import { CardView } from './CardView';

interface KetQuaVanProps {
  results: GameResultRecord[];
  players?: PlayerPublicInfo[];
  isHost: boolean;
  rule: GameRule;
  onPlayAgain: () => void;
  onReturnToWaiting?: () => void;
  onLeaveRoom: () => void;
  onOpenRules?: () => void;
}

export const KetQuaVan: React.FC<KetQuaVanProps> = ({
  results,
  players,
  isHost,
  rule,
  onPlayAgain,
  onReturnToWaiting,
  onLeaveRoom,
  onOpenRules,
}) => {
  useEffect(() => {
    // Launch celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // Ignore if unavailable
    }
  }, []);

  const winner = results.find((r) => r.rank === 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Winner Announcement */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 p-4 sm:p-6 text-center text-slate-950 relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-full mb-1.5 sm:mb-2 backdrop-blur-sm">
            <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-slate-950 fill-slate-950" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">KẾT QUẢ VÁN ĐẤU</h2>
          <p className="text-xs font-bold text-slate-900 mt-0.5 sm:mt-1 uppercase tracking-wider">
            {rule === 'TIEN_LEN_MIEN_NAM' ? '♠ Tiến Lên Miền Nam' : '🔥 Sâm Lốc'}
          </p>
          {winner && (
            <div className="mt-2 bg-slate-950/20 inline-block px-4 py-1 rounded-full text-xs sm:text-sm font-extrabold">
              Chúc mừng {winner.playerName} ({winner.avatar}) về Nhất!
            </div>
          )}

          {onOpenRules && (
            <div className="mt-2">
              <button
                type="button"
                onClick={onOpenRules}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-950/30 hover:bg-slate-950/50 text-slate-950 transition cursor-pointer touch-manipulation"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Xem quy định phạt &amp; mức trừ xu</span>
              </button>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
          {results.map((r) => {
            const isWinner = r.rank === 1;
            const rankBadge =
              r.rank === 1 ? '🥇 Nhất' : r.rank === 2 ? '🥈 Nhì' : r.rank === 3 ? '🥉 Ba' : '💔 Bét';

            return (
              <div
                key={r.playerId}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isWinner
                    ? 'bg-amber-950/30 border-amber-500/50'
                    : 'bg-slate-950/40 border-slate-800'
                }`}
              >
                {/* Player info & rank */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="text-3xl">{r.avatar}</span>
                    <span
                      className={`absolute -bottom-1 -right-1 text-[10px] font-black px-1 rounded-full shadow ${
                        isWinner ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {r.rank}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{r.playerName}</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isWinner
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {rankBadge}
                      </span>
                    </div>

                    {/* Penalties tags */}
                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      {r.isCong && (
                        <span className="text-rose-400 font-bold bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-800/60">
                          BỊ CÓNG
                        </span>
                      )}
                      {r.isThoiHeo && (
                        <span className="text-amber-400 font-bold bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/60 flex items-center gap-0.5">
                          <Flame className="w-3 h-3" /> Thối Heo
                        </span>
                      )}
                      <span className="text-slate-400">
                        Còn {r.cardsLeft} lá
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score change and remaining cards */}
                <div className="flex flex-col sm:items-end w-full sm:w-auto">
                  <div
                    className={`font-black text-base ${
                      r.scoreChange > 0
                        ? 'text-emerald-400'
                        : r.scoreChange < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {r.scoreChange > 0
                      ? `+${r.scoreChange.toLocaleString('vi-VN')}`
                      : `${r.scoreChange.toLocaleString('vi-VN')}`}{' '}
                    xu
                  </div>

                  {(() => {
                    const pInfo = players?.find((p) => p.id === r.playerId);
                    if (pInfo && pInfo.score !== undefined) {
                      return (
                        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-0.5">
                          <span>💰 Ví:</span>
                          <span className="font-extrabold">{pInfo.score.toLocaleString('vi-VN')} xu</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Show face-up remaining cards */}
                  {r.cardsLeftList.length > 0 && (
                    <div className="flex items-center gap-0.5 mt-1 overflow-x-auto max-w-[200px] py-1">
                      {r.cardsLeftList.slice(0, 7).map((c) => (
                        <CardView key={c.id} card={c} size="xs" />
                      ))}
                      {r.cardsLeftList.length > 7 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{r.cardsLeftList.length - 7}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onReturnToWaiting && (
              <button
                type="button"
                onClick={onReturnToWaiting}
                id="btn-return-waiting-result"
                className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer touch-manipulation"
              >
                <span>Quay Về Phòng Chờ</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLeaveRoom}
              id="btn-leave-room-result"
              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer touch-manipulation"
            >
              <LogOut className="w-4 h-4" />
              <span>Rời phòng</span>
            </button>
          </div>

          {isHost ? (
            <button
              type="button"
              onClick={onPlayAgain}
              id="btn-play-again"
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/30 transition cursor-pointer touch-manipulation"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Chơi ván tiếp theo</span>
            </button>
          ) : (
            <div className="text-xs text-amber-400 flex items-center gap-1.5 italic">
              <Award className="w-4 h-4" />
              Chờ chủ phòng chọn chơi tiếp...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
