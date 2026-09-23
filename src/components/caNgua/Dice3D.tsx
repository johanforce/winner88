import React, { useEffect, useState } from 'react';
import { Sparkles, Crown } from 'lucide-react';

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

export const Dice3D: React.FC<Dice3DProps> = ({
  value,
  isRolling,
  canRoll,
  onRoll,
  rollerName = 'Chủ phòng',
  isHost = false,
  enableAnimation = true,
  turnTimeRemaining,
}) => {
  const [internalRolling, setInternalRolling] = useState(false);
  const [displayValue, setDisplayValue] = useState<number>(value || 1);
  const [rotations, setRotations] = useState<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });

  // Tính góc quay tương ứng với mỗi mặt xúc xắc để quay về phía người xem
  const getAnglesForValue = (val: number) => {
    switch (val) {
      case 1:
        return { x: 0, y: 0 };
      case 6:
        return { x: 180, y: 0 };
      case 2:
        return { x: 0, y: -90 };
      case 5:
        return { x: 0, y: 90 };
      case 3:
        return { x: -90, y: 0 };
      case 4:
        return { x: 90, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  };

  useEffect(() => {
    if (value && value >= 1 && value <= 6) {
      setDisplayValue(value);
      if (enableAnimation) {
        setInternalRolling(true);
        // Thêm các vòng quay ngẫu nhiên 720/1080/1440 độ để tạo hiệu ứng xúc xắc lăn chân thực
        const turns = (Math.floor(Math.random() * 2) + 2) * 360;
        const target = getAnglesForValue(value);
        setRotations({
          x: target.x + turns,
          y: target.y + turns,
          z: Math.floor(Math.random() * 20) - 10,
        });

        const timer = setTimeout(() => {
          setInternalRolling(false);
        }, 900);
        return () => clearTimeout(timer);
      } else {
        const target = getAnglesForValue(value);
        setRotations({ x: target.x, y: target.y, z: 0 });
      }
    }
  }, [value, enableAnimation]);

  const currentlyRolling = isRolling || internalRolling;

  // Render các chấm tròn (pips) trên từng mặt
  const renderPips = (count: number) => {
    switch (count) {
      case 1:
        return (
          <div className="w-full h-full flex items-center justify-center">
            <span className="w-4 h-4 rounded-full bg-rose-600 shadow-inner" />
          </div>
        );
      case 2:
        return (
          <div className="w-full h-full p-2 flex justify-between items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 self-start" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 self-end" />
          </div>
        );
      case 3:
        return (
          <div className="w-full h-full p-2 flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 self-start" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 self-center" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 self-end" />
          </div>
        );
      case 4:
        return (
          <div className="w-full h-full p-2 grid grid-cols-2 gap-2 place-items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
          </div>
        );
      case 5:
        return (
          <div className="w-full h-full p-2 grid grid-cols-3 grid-rows-3 place-items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 col-start-1 row-start-1" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 col-start-3 row-start-1" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 col-start-2 row-start-2" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 col-start-1 row-start-3" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 col-start-3 row-start-3" />
          </div>
        );
      case 6:
        return (
          <div className="w-full h-full p-1.5 grid grid-cols-2 grid-rows-3 gap-1 place-items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
          </div>
        );
      default:
        return null;
    }
  };

  const faceStyle =
    'absolute w-14 h-14 bg-gradient-to-br from-amber-50 via-white to-amber-100 border-2 border-amber-200/90 rounded-xl shadow-md flex items-center justify-center select-none backface-visible';

  return (
    <div className="w-full bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-amber-900/60 rounded-3xl p-3 sm:p-4 shadow-xl flex flex-col items-center justify-between relative overflow-hidden">
      {/* Decorative wood grain header */}
      <div className="w-full flex items-center justify-between border-b border-amber-950/60 pb-2 mb-2">
        <div className="flex items-center gap-1.5">
          {isHost && <Crown className="w-4 h-4 text-amber-400" />}
          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
            {isHost ? 'Bàn Lắc Chủ Phòng' : 'Lắc Xúc Xắc'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400">Người gieo:</span>
          <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
            {rollerName}
          </span>
        </div>
      </div>

      {/* 3D Dice Stage (Đĩa nỉ nhung đựng xúc xắc) */}
      <div className="relative w-44 h-32 my-1 flex items-center justify-center">
        {/* Felt Tray Background */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-950 via-green-950 to-emerald-900 border-4 border-amber-800/80 shadow-inner flex items-center justify-center">
          <div className="w-full h-full opacity-20 bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:8px_8px]" />
        </div>

        {/* Dice Shadow */}
        <div
          className={`absolute bottom-5 w-16 h-5 rounded-full bg-black/50 blur-[3px] transition-all duration-300 ${
            currentlyRolling ? 'scale-75 opacity-30 translate-y-3' : 'scale-100 opacity-60'
          }`}
        />

        {/* 3D Dice Cube */}
        <div
          className="relative w-14 h-14 z-10"
          style={{
            perspective: '600px',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            id="dice-3d-cube"
            className="w-full h-full relative"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotations.x}deg) rotateY(${rotations.y}deg) rotateZ(${rotations.z}deg)`,
              transition: currentlyRolling
                ? 'transform 0.9s cubic-bezier(0.2, 0.9, 0.3, 1.2)'
                : 'transform 0.3s ease-out',
            }}
          >
            {/* Front: 1 */}
            <div className={faceStyle} style={{ transform: 'translateZ(28px)' }}>
              {renderPips(1)}
            </div>
            {/* Back: 6 */}
            <div
              className={faceStyle}
              style={{ transform: 'rotateX(180deg) translateZ(28px)' }}
            >
              {renderPips(6)}
            </div>
            {/* Right: 2 */}
            <div
              className={faceStyle}
              style={{ transform: 'rotateY(90deg) translateZ(28px)' }}
            >
              {renderPips(2)}
            </div>
            {/* Left: 5 */}
            <div
              className={faceStyle}
              style={{ transform: 'rotateY(-90deg) translateZ(28px)' }}
            >
              {renderPips(5)}
            </div>
            {/* Top: 3 */}
            <div
              className={faceStyle}
              style={{ transform: 'rotateX(90deg) translateZ(28px)' }}
            >
              {renderPips(3)}
            </div>
            {/* Bottom: 4 */}
            <div
              className={faceStyle}
              style={{ transform: 'rotateX(-90deg) translateZ(28px)' }}
            >
              {renderPips(4)}
            </div>
          </div>
        </div>

        {/* Rolling Spin Blur Overlay */}
        {currentlyRolling && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full border-2 border-amber-400/40 border-t-amber-300 animate-spin" />
          </div>
        )}
      </div>

      {/* Result indicator & special rule badges */}
      <div className="w-full flex items-center justify-between text-xs px-2 py-1.5 my-1 bg-slate-950/70 rounded-xl border border-slate-800">
        <span className="text-slate-400">Kết quả:</span>
        <div className="flex items-center gap-1.5">
          <span className="text-base font-black text-amber-300">
            {displayValue ? `${displayValue} nút` : '---'}
          </span>
          {(displayValue === 1 || displayValue === 6) && (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" />
              {displayValue === 6 ? 'Thêm lượt & Ra quân' : 'Được ra quân'}
            </span>
          )}
        </div>
      </div>

      {/* Interactive Roll Button */}
      <div className="w-full mt-2">
        {canRoll ? (
          <button
            type="button"
            id="btn-roll-dice-3d"
            onClick={onRoll}
            disabled={currentlyRolling}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-2xl text-sm shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 animate-pulse"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>{currentlyRolling ? 'Đang lắc xúc xắc...' : '🎲 GIEO XÚC XẮC NGAY!'}</span>
            {turnTimeRemaining !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-950 text-amber-300 rounded font-mono">
                {turnTimeRemaining}s
              </span>
            )}
          </button>
        ) : (
          <div className="w-full py-2.5 px-3 bg-slate-950/80 border border-slate-800 rounded-xl text-center text-xs text-slate-400 font-medium">
            {rollerName ? `Đang chờ ${rollerName} gieo xúc xắc...` : 'Chưa đến lượt gieo'}
          </div>
        )}
      </div>
    </div>
  );
};
