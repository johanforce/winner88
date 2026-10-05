import React, { useState } from 'react';
import { X, Sparkles, RotateCcw, BookOpen } from 'lucide-react';
import { XiangqiPiece, XiangqiSide } from '../types';

export interface XiangqiSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const XiangqiSimulator: React.FC<XiangqiSimulatorProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-stone-900 border border-amber-600/50 w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-4 text-stone-100 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-400">Thao Luyện Cờ Thế (Simulator)</h2>
            <p className="text-xs text-stone-400">Nghiên cứu hình cờ tàn cuộc & thế cờ tinh hoa</p>
          </div>
        </div>

        <div className="p-4 bg-stone-950 rounded-xl border border-stone-800 text-xs text-stone-300 space-y-2">
          <p className="font-semibold text-amber-300">💡 Chế độ luyện tập cờ thế:</p>
          <p>
            Bạn có thể thử nghiệm các nước đi, giải các thế cờ kinh điển và rèn luyện tư duy chiến thuật trước khi bước vào các trận chiến xếp hạng Elo kịch tính.
          </p>
          <div className="pt-2 flex items-center gap-2">
            <span className="px-2 py-1 bg-stone-800 rounded text-stone-300 text-[11px] font-mono">
              Thế cờ mẫu: Khởi mã đối tốt • Thuận pháo tiến công • Khống chế tàn cuộc
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
          >
            Đóng Luyện Tập
          </button>
        </div>
      </div>
    </div>
  );
};
