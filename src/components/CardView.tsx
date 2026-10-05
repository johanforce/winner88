import React from 'react';
import { Card, Suit } from '../types';

interface CardViewProps {
  card?: Card;
  isBack?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

const SUIT_META: Record<Suit, { symbol: string; color: string }> = {
  HEART: { symbol: '♥', color: 'text-red-500' },
  DIAMOND: { symbol: '♦', color: 'text-red-500' },
  CLUB: { symbol: '♣', color: 'text-slate-900' },
  SPADE: { symbol: '♠', color: 'text-slate-900' },
};

function getRankText(rank: number): string {
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  if (rank === 15) return '2';
  return String(rank);
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isBack = false,
  size = 'md',
  isSelected = false,
  onClick,
  className = '',
}) => {
  const sizeClasses = {
    xs: 'w-7 h-10 text-[9px] rounded',
    sm: 'w-10 h-14 text-xs rounded-md',
    md: 'w-14 h-20 text-sm rounded-lg',
    lg: 'w-20 h-28 text-base rounded-xl',
  }[size];

  if (isBack || !card) {
    return (
      <div
        className={`${sizeClasses} bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-950 border border-blue-400/40 shadow-md flex items-center justify-center select-none ${className}`}
      >
        <div className="w-4/5 h-4/5 border border-blue-300/30 rounded flex items-center justify-center">
          <span className="text-blue-300/60 font-black text-[10px]">🂠</span>
        </div>
      </div>
    );
  }

  const { symbol, color } = SUIT_META[card.suit] || { symbol: '', color: 'text-slate-900' };
  const rankText = getRankText(card.rank);

  return (
    <div
      onClick={onClick}
      className={`${sizeClasses} bg-white border border-slate-300 shadow-md flex flex-col justify-between p-1 select-none transition-all duration-150 cursor-pointer ${
        isSelected ? '-translate-y-4 ring-2 ring-amber-400 shadow-xl' : 'hover:-translate-y-1'
      } ${className}`}
    >
      <div className={`font-black leading-none ${color} flex items-center gap-0.5`}>
        <span>{rankText}</span>
        <span className="text-[10px]">{symbol}</span>
      </div>
      <div className={`self-center font-bold text-lg leading-none ${color}`}>
        {symbol}
      </div>
      <div className={`font-black leading-none ${color} flex items-center justify-end rotate-180`}>
        <span>{rankText}</span>
      </div>
    </div>
  );
};
