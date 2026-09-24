import React, { useState, useEffect } from 'react';
import { Dices, Clock } from 'lucide-react';

interface Dice3DProps {
  value: number | null;
  isRolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  rollerName?: string;
  isHost?: boolean;
  enableAnimation?: boolean;
  turnTimeRemaining?: number;
}

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

export const Dice3D: React.FC<Dice3DProps> = ({
  value,
  isRolling,
  canRoll,
  onRoll,
  rollerName,
  turnTimeRemaining,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value || 1);

  useEffect(() => {
    if (value) {
      setDisplayValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (!isRolling) return;
    const interval = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 6) + 1);
    }, 80);
    return () => clearInterval(interval);
  }, [isRolling]);

  const dots = DICE_DOTS[displayValue] || DICE_DOTS[1];

  return (
    <div className="bg-slate-900/90 border border-amber-900/40 rounded-2xl p-4 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur">
      <div className="flex items-center justify-between w-full mb-3 px-1">
        <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold uppercase tracking-wider">
          <Dices className="w-4 h-4 text-amber-400" />
          <span>Bàn Lắc Xúc Xắc</span>
        </div>
        {typeof turnTimeRemaining === 'number' && (
          <div className="flex items-center gap-1 text-xs font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{turnTimeRemaining}s</span>
          </div>
        )}
      </div>

      {/* 3D Dice Container */}
      <div className="my-3 py-2 flex flex-col items-center justify-center">
        <div
          className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-200 border-2 border-amber-300 shadow-[0_10px_25px_rgba(245,158,11,0.35)] transition-all duration-300 flex items-center justify-center ${
            isRolling ? 'animate-spin scale-110' : ''
          }`}
        >
          {dots.map(([top, left], i) => (
            <div
              key={i}
              className={`absolute w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shadow-inner ${
                displayValue === 1 || displayValue === 4 ? 'bg-red-600' : 'bg-slate-900'
              }`}
              style={{
                top: `${top}%`,
                left: `${left}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 font-medium mb-3">
        Lượt của: <span className="text-amber-300 font-bold">{rollerName || 'Người chơi'}</span>
      </p>

      <button
        onClick={onRoll}
        disabled={!canRoll || isRolling}
        className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
          canRoll && !isRolling
            ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 text-slate-950 hover:brightness-110 hover:shadow-amber-500/40 cursor-pointer animate-pulse ring-2 ring-yellow-300'
            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-75'
        }`}
      >
        <Dices className="w-4 h-4" />
        <span>{isRolling ? 'Đang Lắc...' : canRoll ? 'Lắc Xúc Xắc (Đến Lượt!)' : 'Chờ Lượt Của Bạn'}</span>
      </button>
    </div>
  );
};
