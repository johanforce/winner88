import React from 'react';
import { CaNguaHorse } from '../../types';
import { COLOR_CONFIG } from './caNguaBoardConfig';
import { Crown } from 'lucide-react';

interface HorsePawnProps {
  horse: CaNguaHorse;
  inStable?: boolean;
  selectable?: boolean;
  isMoving?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const HorsePawn: React.FC<HorsePawnProps> = ({
  horse,
  inStable = false,
  selectable = false,
  isMoving = false,
  onClick,
  size = 'md',
}) => {
  const conf = COLOR_CONFIG[horse.color];

  const sizeClasses =
    size === 'sm'
      ? 'w-6 h-6 sm:w-7 sm:h-7'
      : size === 'lg'
      ? 'w-9 h-9 sm:w-10 sm:h-10'
      : inStable
      ? 'w-8 h-8 sm:w-9 sm:h-9'
      : 'w-7 h-7 sm:w-8 sm:h-8';

  return (
    <button
      type="button"
      id={`horse-pawn-${horse.color}-${horse.id}`}
      disabled={!selectable}
      onClick={onClick}
      className={`relative group rounded-full flex items-center justify-center transition-all duration-300 select-none ${sizeClasses} ${
        selectable
          ? 'cursor-pointer ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 animate-bounce scale-110 z-30 shadow-xl shadow-amber-500/40'
          : isMoving
          ? 'scale-125 z-30 shadow-2xl animate-pulse ring-2 ring-white'
          : 'hover:scale-105 z-10'
      }`}
      title={`Ngựa #${horse.horseIndex + 1} (${conf.name}) ${
        selectable ? ' - BẤM ĐỂ ĐI!' : ''
      }`}
    >
      {/* 3D Pawn Base with metallic rim & glossy depth */}
      <div
        className={`w-full h-full rounded-full bg-gradient-to-tr ${conf.horseGradient} border-2 border-white/80 shadow-md flex items-center justify-center relative overflow-hidden`}
      >
        {/* Top glossy glass highlight reflection */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-full pointer-events-none" />

        {/* Horse Icon / Silhouette */}
        <span className="text-sm sm:text-base leading-none drop-shadow filter">
          🐴
        </span>

        {/* Finished Crown */}
        {horse.isFinished && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2">
            <Crown className="w-3.5 h-3.5 text-amber-300 drop-shadow" />
          </div>
        )}
      </div>

      {/* Horse number badge (#1, #2, #3, #4) */}
      <span className="absolute -bottom-1 -right-1 text-[8px] sm:text-[9px] font-black bg-slate-950 text-white px-1 rounded-full border border-slate-700 shadow flex items-center justify-center leading-tight">
        {horse.horseIndex + 1}
      </span>

      {/* Selectable pulsating badge */}
      {selectable && (
        <span className="absolute -top-2.5 bg-amber-400 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter shadow-md animate-pulse">
          ĐI!
        </span>
      )}
    </button>
  );
};
