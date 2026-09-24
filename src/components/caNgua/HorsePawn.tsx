import React from 'react';
import { CaNguaHorse, CaNguaColor } from '../../types';

interface HorsePawnProps {
  horse: CaNguaHorse;
  selectable?: boolean;
  isMoving?: boolean;
  onClick?: () => void;
}

const COLOR_CLASSES: Record<CaNguaColor, { bg: string; border: string; glow: string; text: string }> = {
  RED: {
    bg: 'from-rose-500 to-red-700',
    border: 'border-rose-300',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.7)]',
    text: 'text-white',
  },
  BLUE: {
    bg: 'from-blue-500 to-indigo-700',
    border: 'border-blue-300',
    glow: 'shadow-[0_0_10px_rgba(59,130,246,0.7)]',
    text: 'text-white',
  },
  YELLOW: {
    bg: 'from-amber-400 to-yellow-600',
    border: 'border-amber-200',
    glow: 'shadow-[0_0_10px_rgba(245,158,11,0.7)]',
    text: 'text-slate-950',
  },
  GREEN: {
    bg: 'from-emerald-400 to-green-700',
    border: 'border-emerald-300',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.7)]',
    text: 'text-white',
  },
};

export const HorsePawn: React.FC<HorsePawnProps> = ({
  horse,
  selectable = false,
  isMoving = false,
  onClick,
}) => {
  const conf = COLOR_CLASSES[horse.color] || COLOR_CLASSES.RED;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (selectable && onClick) onClick();
      }}
      disabled={!selectable}
      className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-b ${conf.bg} border-2 ${conf.border} flex items-center justify-center shadow-lg transition-all duration-200 select-none cursor-pointer ${
        selectable
          ? `ring-4 ring-yellow-300 animate-bounce scale-110 z-30 ${conf.glow}`
          : 'cursor-default'
      } ${isMoving ? 'scale-125 ring-4 ring-white animate-pulse' : ''}`}
    >
      <span className="text-[12px] sm:text-[14px] leading-none filter drop-shadow">
        🐴
      </span>
      <span
        className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-950/80 border border-white/60 font-black text-[8px] flex items-center justify-center text-white`}
      >
        {horse.horseIndex + 1}
      </span>
    </button>
  );
};
