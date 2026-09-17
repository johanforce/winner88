import React from 'react';
import { Card, Suit } from '../types';

interface CardViewProps {
  card?: Card;
  isBack?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  isHighlighted?: boolean;
}

const SUIT_DATA: Record<Suit, { symbol: string; color: string; bgSoft: string }> = {
  SPADE: { symbol: '♠', color: 'text-slate-900', bgSoft: 'hover:border-slate-400' },
  CLUB: { symbol: '♣', color: 'text-emerald-900', bgSoft: 'hover:border-emerald-400' },
  DIAMOND: { symbol: '♦', color: 'text-rose-600', bgSoft: 'hover:border-rose-300' },
  HEART: { symbol: '♥', color: 'text-red-600', bgSoft: 'hover:border-red-300' },
};

export function getRankLabel(rank: number): string {
  if (rank <= 10) return rank.toString();
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  if (rank === 15) return '2';
  return rank.toString();
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isBack = false,
  isSelected = false,
  onClick,
  disabled = false,
  size = 'md',
  className = '',
  isHighlighted = false,
}) => {
  // Dimensions per size
  const sizeClasses = {
    xs: 'w-7 h-10 text-[10px] rounded',
    sm: 'w-10 h-14 text-xs rounded-md',
    md: 'w-14 h-20 sm:w-16 sm:h-24 text-sm sm:text-base rounded-lg',
    lg: 'w-16 h-24 sm:w-20 sm:h-28 text-base sm:text-lg rounded-xl',
  }[size];

  // If rendering card back
  if (isBack || !card) {
    return (
      <div
        id={card ? `card-back-${card.id}` : undefined}
        className={`${sizeClasses} relative flex items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 border-2 border-amber-300/60 shadow-md select-none overflow-hidden ${className}`}
      >
        <div className="absolute inset-1 border border-amber-400/40 rounded flex items-center justify-center bg-indigo-900/40">
          <div className="w-5 h-7 sm:w-7 sm:h-10 border border-amber-300/50 rounded-sm rotate-45 flex items-center justify-center">
            <span className="text-amber-300 text-xs sm:text-sm">♠</span>
          </div>
        </div>
      </div>
    );
  }

  const suitInfo = SUIT_DATA[card.suit];
  const rankLabel = getRankLabel(card.rank);
  const isHeo = card.rank === 15;

  return (
    <button
      type="button"
      id={`card-${card.id}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        ${sizeClasses}
        relative flex flex-col justify-between p-1 sm:p-1.5
        bg-white
        border-2 transition-all duration-150 select-none shadow-md
        ${isSelected ? '-translate-y-4 sm:-translate-y-5 ring-2 ring-amber-400 border-amber-500 shadow-xl shadow-amber-500/20 z-20' : 'hover:-translate-y-1 z-0'}
        ${isHighlighted ? 'border-amber-400 ring-2 ring-amber-400/80 animate-pulse' : isSelected ? '' : 'border-slate-300 hover:border-slate-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed filter grayscale-[30%]' : 'cursor-pointer active:scale-95'}
        ${className}
      `}
    >
      {/* Top Left pip */}
      <div className={`flex flex-col items-center leading-none font-bold ${suitInfo.color}`}>
        <span className="font-extrabold tracking-tighter">{rankLabel}</span>
        <span className="text-[10px] sm:text-xs leading-none">{suitInfo.symbol}</span>
      </div>

      {/* Center artwork / symbol */}
      <div className="flex-1 flex items-center justify-center">
        <span
          className={`
            ${suitInfo.color} font-bold opacity-90 leading-none select-none
            ${size === 'lg' ? 'text-2xl sm:text-3xl' : size === 'md' ? 'text-lg sm:text-xl' : 'text-xs sm:text-sm'}
          `}
        >
          {isHeo ? '★' : suitInfo.symbol}
        </span>
      </div>

      {/* Bottom Right pip (inverted) */}
      <div className={`flex flex-col items-center leading-none font-bold rotate-180 ${suitInfo.color}`}>
        <span className="font-extrabold tracking-tighter">{rankLabel}</span>
        <span className="text-[10px] sm:text-xs leading-none">{suitInfo.symbol}</span>
      </div>

      {/* Special highlight tag for Heo (2) or 3 Spade */}
      {isHeo && (
        <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-amber-500 to-red-500 text-white text-[8px] sm:text-[9px] font-extrabold px-1 rounded-full shadow">
          HEO
        </div>
      )}
      {card.rank === 3 && card.suit === 'SPADE' && (
        <div className="absolute -top-1.5 -right-1.5 bg-slate-900 text-amber-300 text-[8px] sm:text-[9px] font-extrabold px-1 rounded-full shadow">
          3♠
        </div>
      )}
    </button>
  );
};
