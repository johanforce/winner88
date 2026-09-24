import React from 'react';
import { GameResultRecord, PlayerPublicInfo, GameRule } from '../types';
import { Trophy, RotateCcw } from 'lucide-react';

interface KetQuaVanProps {
  results: GameResultRecord[];
  players: PlayerPublicInfo[];
  isHost: boolean;
  rule: GameRule;
  onPlayAgain: () => void;
}

export const KetQuaVan: React.FC<KetQuaVanProps> = ({
  results,
  players,
  isHost,
  onPlayAgain,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 text-slate-950 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
          <Trophy className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide">
          Kết Quả Ván Đấu
        </h2>

        <div className="mt-4 space-y-2">
          {results.map((res, index) => {
            const player = players.find((p) => p.id === res.playerId);
            const isWinner = res.rank === 1;
            return (
              <div
                key={res.playerId}
                className={`p-3 rounded-xl flex items-center justify-between border ${
                  isWinner
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">#{index + 1}</span>
                  <span className="text-lg">{player?.avatar || '👤'}</span>
                  <div className="text-left">
                    <p className="font-bold text-sm text-white">
                      {player?.name || 'Kỳ thủ'}
                    </p>
                    {res.reason && (
                      <p className="text-xs text-slate-400">{res.reason}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`font-black text-sm ${
                      res.scoreChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {res.scoreChange >= 0 ? `+${res.scoreChange}` : res.scoreChange} xu
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {isHost ? (
          <button
            onClick={onPlayAgain}
            className="mt-6 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Ván Mới</span>
          </button>
        ) : (
          <p className="mt-6 text-xs text-slate-400 italic">
            Chờ chủ phòng bắt đầu ván mới...
          </p>
        )}
      </div>
    </div>
  );
};
