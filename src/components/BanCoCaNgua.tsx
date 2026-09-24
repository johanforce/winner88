import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  Volume2,
  VolumeX,
  BookOpen,
  LogOut,
  Users,
  Eye,
  Sparkles,
  ArrowRight,
  Crown,
  PlayCircle,
  Settings,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { socket } from '../socket';
import {
  RoomPublicState,
  ChatMessage,
  CaNguaColor,
  CaNguaHorse,
} from '../types';
import { KhungChat } from './KhungChat';
import {
  TRACK_COORDINATES,
  BARN_COORDINATES,
  COLOR_CONFIG,
} from './caNgua/caNguaBoardConfig';
import { Dice3D } from './caNgua/Dice3D';
import { HorsePawn } from './caNgua/HorsePawn';

interface BanCoCaNguaProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
}

export const BanCoCaNgua: React.FC<BanCoCaNguaProps> = ({
  roomState,
  myPlayerId,
  chatMessages,
  onLeaveRoom,
}) => {
  // Tùy chọn cài đặt theo yêu cầu người dùng:
  // 1. Option animation khi di chuyển quân cờ
  const [moveAnimationEnabled, setMoveAnimationEnabled] = useState(true);
  // 2. Option animation khi xúc xắc quay
  const [diceAnimationEnabled, setDiceAnimationEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Hiệu ứng đá ngựa / va chạm
  const [kickedEffect, setKickedEffect] = useState<{
    text: string;
    pos: [number, number];
  } | null>(null);

  // Quân cờ đang được animate bước đi
  const [movingHorseId, setMovingHorseId] = useState<number | null>(null);
  const [highlightCell, setHighlightCell] = useState<[number, number] | null>(null);

  const prevDiceRef = useRef<number | null>(null);
  const prevHorsesRef = useRef<CaNguaHorse[]>([]);

  const coCaNgua = roomState.coCaNguaState;
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isSpectator = me?.isSpectator || false;
  const hostPlayer = roomState.players.find((p) => p.isHost);
  const isHost = me?.isHost || false;

  const currentTurnPlayer = coCaNgua?.players.find(
    (p) => p.playerId === coCaNgua.currentTurnPlayerId
  );
  const isMyTurn = coCaNgua?.currentTurnPlayerId === myPlayerId && !isSpectator;

  // Spectators (tối đa 4 người)
  const spectators = roomState.players.filter(
    (p) => p.isSpectator || p.seatIndex >= 4
  );

  // Âm thanh Web Audio
  const playTone = (
    freq: number,
    type: OscillatorType = 'sine',
    duration: number = 0.1,
    vol: number = 0.12
  ) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignored if audio not supported
    }
  };

  // Hiệu ứng âm thanh xúc xắc lăn
  const playDiceRollSound = () => {
    if (!soundEnabled) return;
    playTone(380, 'triangle', 0.08, 0.15);
    setTimeout(() => playTone(440, 'triangle', 0.08, 0.15), 100);
    setTimeout(() => playTone(520, 'square', 0.15, 0.2), 220);
  };

  // Hiệu ứng âm thanh đá ngựa
  const playKickSound = () => {
    if (!soundEnabled) return;
    playTone(200, 'sawtooth', 0.25, 0.25);
    setTimeout(() => playTone(120, 'sawtooth', 0.35, 0.3), 120);
  };

  // Hiệu ứng âm thanh bước nhảy của ngựa
  const playStepSound = () => {
    if (!soundEnabled) return;
    playTone(600, 'sine', 0.06, 0.1);
  };

  // Theo dõi sự thay đổi của xúc xắc
  useEffect(() => {
    if (
      coCaNgua?.lastDiceValue &&
      coCaNgua.lastDiceValue !== prevDiceRef.current
    ) {
      prevDiceRef.current = coCaNgua.lastDiceValue;
      playDiceRollSound();
    }
  }, [coCaNgua?.lastDiceValue]);

  // Theo dõi sự di chuyển của các quân ngựa để kích hoạt Animation Di Chuyển
  useEffect(() => {
    if (!coCaNgua?.horses) return;

    if (prevHorsesRef.current.length > 0 && moveAnimationEnabled) {
      // Tìm quân ngựa có sự thay đổi về step hoặc vị trí
      for (const currH of coCaNgua.horses) {
        const prevH = prevHorsesRef.current.find(
          (h) => h.id === currH.id && h.color === currH.color
        );
        if (prevH && prevH.step !== currH.step) {
          // Quân cờ đã di chuyển!
          setMovingHorseId(currH.id);

          // Lấy tọa độ đích để tạo hiệu ứng sáng ô
          let targetCoord: [number, number] | null = null;
          if (currH.state === 'ON_TRACK' && currH.trackPosition >= 0) {
            targetCoord = TRACK_COORDINATES[currH.trackPosition];
          } else if (currH.state === 'IN_BARN' && currH.barnStep >= 1) {
            targetCoord = BARN_COORDINATES[currH.color][currH.barnStep - 1];
          }

          if (targetCoord) {
            setHighlightCell(targetCoord);
            playStepSound();
          }

          // Kiểm tra xem có sự kiện đá ngựa không (CHỈ hiển thị khi thực sự có ngựa đối thủ bị đá)
          if (
            coCaNgua.lastKickedHorse &&
            coCaNgua.lastKickedHorse.trackPosition >= 0 &&
            coCaNgua.lastKickedHorse.trackPosition < TRACK_COORDINATES.length
          ) {
            const kickCoord = TRACK_COORDINATES[coCaNgua.lastKickedHorse.trackPosition];
            playKickSound();
            setKickedEffect({
              text: `💥 ĐÁ VĂNG NGỰA #${coCaNgua.lastKickedHorse.horseIndex + 1}!`,
              pos: kickCoord,
            });
            setTimeout(() => setKickedEffect(null), 2200);
          } else {
            // Khi di chuyển bình thường, đảm bảo KHÔNG hiển thị text đá ngựa
            setKickedEffect(null);
          }

          // Tắt hiệu ứng di chuyển sau thời gian ngắn
          const timer = setTimeout(() => {
            setMovingHorseId(null);
            setHighlightCell(null);
          }, 800);

          prevHorsesRef.current = coCaNgua.horses;
          return () => clearTimeout(timer);
        }
      }
    }

    prevHorsesRef.current = coCaNgua.horses;
  }, [coCaNgua?.horses, moveAnimationEnabled]);

  // Pháo hoa ăn mừng khi có người chiến thắng
  useEffect(() => {
    if (roomState.status === 'FINISHED' || coCaNgua?.winnerPlayerId) {
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignored
      }
    }
  }, [roomState.status, coCaNgua?.winnerPlayerId]);

  // Gieo xúc xắc
  const handleRollDice = () => {
    if (!isMyTurn || coCaNgua?.phase !== 'ROLLING') return;
    setActionError(null);
    playDiceRollSound();

    socket.emit(
      'CO_CA_NGUA_ROLL_DICE',
      { roomCode: roomState.code, playerId: myPlayerId },
      (res: { success: boolean; message?: string; dice?: number }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể gieo xúc xắc');
        }
      }
    );
  };

  // Chọn ngựa di chuyển
  const handleSelectHorse = (horseId: number | string) => {
    if (!isMyTurn || coCaNgua?.phase !== 'SELECTING_HORSE') return;
    setActionError(null);
    playTone(680, 'triangle', 0.12);

    socket.emit(
      'CO_CA_NGUA_MOVE_HORSE',
      { roomCode: roomState.code, playerId: myPlayerId, horseId: String(horseId) },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể đi ngựa này');
        }
      }
    );
  };

  // Quay về phòng chờ
  const handleReturnToWaiting = () => {
    setActionError(null);
    socket.emit(
      'PLAYER_RETURN_TO_WAITING',
      { roomCode: roomState.code, playerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể quay về phòng chờ');
        }
      }
    );
  };

  // Bản đồ vị trí quân ngựa trên đường đua và thang chuồng
  const trackHorsesMap = new Map<number, CaNguaHorse[]>();
  const barnHorsesMap = new Map<string, CaNguaHorse[]>();

  if (coCaNgua?.horses) {
    coCaNgua.horses.forEach((h) => {
      if (h.state === 'ON_TRACK') {
        const list = trackHorsesMap.get(h.trackPosition) || [];
        list.push(h);
        trackHorsesMap.set(h.trackPosition, list);
      } else if (h.state === 'IN_BARN') {
        const key = `${h.color}_${h.barnStep}`;
        const list = barnHorsesMap.get(key) || [];
        list.push(h);
        barnHorsesMap.set(key, list);
      }
    });
  }

  // Ngựa có thể di chuyển không
  const isHorseSelectable = (horse: CaNguaHorse) => {
    if (!isMyTurn || coCaNgua?.phase !== 'SELECTING_HORSE') return false;
    if (horse.playerId !== myPlayerId) return false;
    if (Array.isArray(coCaNgua?.movableHorseIds)) {
      return coCaNgua.movableHorseIds.includes(horse.id);
    }
    const dice = coCaNgua?.lastDiceValue;
    if (!dice) return false;
    if (horse.state === 'STABLE') {
      return dice === 1 || dice === 6;
    }
    return true;
  };

  // Render Chuồng Ngựa ở 4 Góc
  const renderCornerStable = (color: CaNguaColor) => {
    const conf = COLOR_CONFIG[color];
    const playerInColor = coCaNgua?.players.find((p) => p.color === color);
    const horsesInStable =
      coCaNgua?.horses.filter(
        (h) => h.color === color && h.state === 'STABLE'
      ) || [];
    const winningHorses =
      coCaNgua?.horses.filter(
        (h) => h.color === color && h.state === 'IN_BARN' && [3, 4, 5, 6].includes(h.barnStep)
      ) || [];

    const isCurrentPlayerColor = currentTurnPlayer?.color === color;
    const isOwnerHost = playerInColor ? roomState.players.find((p) => p.id === playerInColor.playerId)?.isHost : false;

    return (
      <div
        className={`w-full h-full rounded-2xl p-2 sm:p-3 border-2 flex flex-col justify-between transition-all duration-300 relative overflow-hidden bg-gradient-to-br ${
          conf.stableClass
        } ${
          isCurrentPlayerColor
            ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-[#1c120c] shadow-2xl scale-[1.02]'
            : 'border-amber-900/60'
        }`}
      >
        {/* Subtle wood-inlay texture */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />

        {/* Stable Header */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-3 h-3 rounded-full ${conf.bg} inline-block shadow-sm ${
                isCurrentPlayerColor ? 'animate-ping' : ''
              }`}
            />
            <span className="text-[11px] sm:text-xs font-black tracking-wide text-white drop-shadow">
              {conf.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {isOwnerHost && (
              <span
                className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-black flex items-center gap-0.5"
                title="Chủ phòng"
              >
                <Crown className="w-2.5 h-2.5" /> Host
              </span>
            )}
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border max-w-[85px] truncate ${conf.badge}`}
            >
              {playerInColor ? playerInColor.playerName : 'Trống'}
            </span>
          </div>
        </div>

        {/* 4 Chuồng / Vị trí ngựa */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 my-auto p-1.5 sm:p-2 bg-black/40 rounded-2xl border border-amber-900/40 z-10">
          {[0, 1, 2, 3].map((idx) => {
            const horse = horsesInStable.find((h) => h.horseIndex === idx);
            const selectable = horse ? isHorseSelectable(horse) : false;
            const isMoving = horse ? movingHorseId === horse.id : false;

            return (
              <div
                key={`stable-${color}-${idx}`}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-b from-slate-900 to-black border border-amber-800/40 flex items-center justify-center mx-auto transition-transform ${
                  selectable ? 'ring-2 ring-amber-400' : ''
                }`}
              >
                {horse ? (
                  <HorsePawn
                    horse={horse}
                    inStable={true}
                    selectable={selectable}
                    isMoving={isMoving}
                    onClick={() => handleSelectHorse(horse.id)}
                  />
                ) : (
                  <span className="text-[9px] text-amber-500/30 font-black select-none">
                    #{idx + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: Tiến độ về đích (cần xếp 6, 5, 4, 3) */}
        <div className="flex items-center justify-between text-[10px] text-amber-200/80 z-10 bg-black/30 px-2 py-0.5 rounded-lg border border-amber-900/30">
          <span className="font-semibold">Chuồng 6,5,4,3:</span>
          <span className="font-black text-amber-300">
            {winningHorses.length}/4 🏆
          </span>
        </div>
      </div>
    );
  };

  // Render từng ô trên lưới 15x15
  const renderCell = (r: number, c: number) => {
    // 1. Góc Chuồng Red: r: 0..5, c: 0..5
    if (r === 0 && c === 0) {
      return (
        <div
          key="corner-red"
          style={{ gridRow: '1 / span 6', gridColumn: '1 / span 6' }}
          className="p-1 z-10"
        >
          {renderCornerStable('RED')}
        </div>
      );
    }
    if (r < 6 && c < 6) return null;

    // 2. Góc Chuồng Blue: r: 0..5, c: 9..14
    if (r === 0 && c === 9) {
      return (
        <div
          key="corner-blue"
          style={{ gridRow: '1 / span 6', gridColumn: '10 / span 6' }}
          className="p-1 z-10"
        >
          {renderCornerStable('BLUE')}
        </div>
      );
    }
    if (r < 6 && c >= 9) return null;

    // 3. Góc Chuồng Green: r: 9..14, c: 0..5
    if (r === 9 && c === 0) {
      return (
        <div
          key="corner-green"
          style={{ gridRow: '10 / span 6', gridColumn: '1 / span 6' }}
          className="p-1 z-10"
        >
          {renderCornerStable('GREEN')}
        </div>
      );
    }
    if (r >= 9 && c < 6) return null;

    // 4. Góc Chuồng Yellow: r: 9..14, c: 9..14
    if (r === 9 && c === 9) {
      return (
        <div
          key="corner-yellow"
          style={{ gridRow: '10 / span 6', gridColumn: '10 / span 6' }}
          className="p-1 z-10"
        >
          {renderCornerStable('YELLOW')}
        </div>
      );
    }
    if (r >= 9 && c >= 9) return null;

    // 5. Ô Trung Tâm Đích: r: 7, c: 7
    if (r === 7 && c === 7) {
      return (
        <div
          key="center-goal"
          className="relative rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600 border-2 border-yellow-200 flex items-center justify-center p-1 shadow-2xl shadow-amber-500/50 ring-2 ring-amber-300 animate-pulse z-20"
        >
          <div className="w-full h-full rounded-xl bg-gradient-to-tr from-amber-600/60 to-yellow-300/40 flex items-center justify-center">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 filter drop-shadow" />
          </div>
        </div>
      );
    }

    // 6. Thang Chuồng (Barn Stairs 1..6)
    for (const colKey of ['RED', 'BLUE', 'YELLOW', 'GREEN'] as CaNguaColor[]) {
      const barnCoords = BARN_COORDINATES[colKey];
      const stepIdx = barnCoords.findIndex(([br, bc]) => br === r && bc === c);
      if (stepIdx !== -1) {
        const stepNum = stepIdx + 1;
        const conf = COLOR_CONFIG[colKey];
        const horsesHere = barnHorsesMap.get(`${colKey}_${stepNum}`) || [];
        const isHighlighted =
          highlightCell && highlightCell[0] === r && highlightCell[1] === c;

        return (
          <div
            key={`barn-${colKey}-${stepNum}`}
            className={`relative rounded-xl border flex items-center justify-center transition-all duration-200 ${
              conf.bg
            }/30 ${conf.border} shadow-sm ${
              isHighlighted
                ? 'ring-4 ring-amber-300 scale-110 z-20 bg-amber-400/50'
                : 'hover:scale-105'
            }`}
          >
            <span
              className={`text-[9px] sm:text-[11px] font-black drop-shadow ${conf.text}`}
            >
              {stepNum}
            </span>

            {horsesHere.length > 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                {horsesHere.map((h) => {
                  const selectable = isHorseSelectable(h);
                  const isMoving = movingHorseId === h.id;
                  return (
                    <HorsePawn
                      key={h.id}
                      horse={h}
                      selectable={selectable}
                      isMoving={isMoving}
                      onClick={() => handleSelectHorse(h.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      }
    }

    // 7. Ô trên Đường Đua (Track Cells 0..55)
    const trackIndex = TRACK_COORDINATES.findIndex(
      ([tr, tc]) => tr === r && tc === c
    );
    const horsesOnTrack =
      trackIndex !== -1 ? trackHorsesMap.get(trackIndex) || [] : [];

    const isRedStart = trackIndex === 55;
    const isBlueStart = trackIndex === 13;
    const isYellowStart = trackIndex === 27;
    const isGreenStart = trackIndex === 41;

    const isBlueApex = trackIndex === 12; // Cửa chuồng Blue
    const isYellowApex = trackIndex === 26; // Cửa chuồng Yellow
    const isGreenApex = trackIndex === 40; // Cửa chuồng Green
    const isRedApex = trackIndex === 54; // Cửa chuồng Red
    const isApexCell = isBlueApex || isYellowApex || isGreenApex || isRedApex;

    const isHighlighted =
      highlightCell && highlightCell[0] === r && highlightCell[1] === c;

    let cellClass =
      'bg-[#1e1510]/90 border-amber-950/80 text-amber-200/50 shadow-inner';
    if (isRedStart) {
      cellClass =
        'bg-rose-950/90 border-rose-500 text-rose-300 ring-2 ring-rose-500/50';
    } else if (isBlueStart) {
      cellClass =
        'bg-blue-950/90 border-blue-500 text-blue-300 ring-2 ring-blue-500/50';
    } else if (isYellowStart) {
      cellClass =
        'bg-amber-950/90 border-amber-500 text-amber-300 ring-2 ring-amber-500/50';
    } else if (isGreenStart) {
      cellClass =
        'bg-emerald-950/90 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/50';
    } else if (isRedApex) {
      cellClass =
        'bg-rose-950/80 border-rose-400/90 text-rose-200 ring-1 ring-rose-400/50 shadow-[0_0_8px_rgba(244,63,94,0.25)]';
    } else if (isBlueApex) {
      cellClass =
        'bg-blue-950/80 border-blue-400/90 text-blue-200 ring-1 ring-blue-400/50 shadow-[0_0_8px_rgba(59,130,246,0.25)]';
    } else if (isYellowApex) {
      cellClass =
        'bg-amber-950/80 border-amber-400/90 text-amber-200 ring-1 ring-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]';
    } else if (isGreenApex) {
      cellClass =
        'bg-emerald-950/80 border-emerald-400/90 text-emerald-200 ring-1 ring-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.25)]';
    }

    return (
      <div
        key={`track-${r}-${c}`}
        className={`relative rounded-xl border flex items-center justify-center transition-all duration-200 select-none ${cellClass} ${
          isHighlighted
            ? 'ring-4 ring-amber-300 scale-110 z-20 bg-amber-500/60'
            : isApexCell
            ? 'hover:border-amber-400'
            : 'hover:border-amber-700'
        }`}
      >
        {/* Nhãn xuất phát: các ô XP chỉ cần ghi XP */}
        {(isRedStart || isBlueStart || isYellowStart || isGreenStart) && (
          <span className="text-[7.5px] sm:text-[9px] font-black text-amber-200 tracking-wider">
            XP
          </span>
        )}

        {/* Ô cửa chuồng: không cần ghi text, vẽ 1 vòng tròn lồng ngoài chấm tròn cùng màu */}
        {isRedApex && (
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-rose-400/90 flex items-center justify-center">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shadow-sm" />
          </div>
        )}
        {isBlueApex && (
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-blue-400/90 flex items-center justify-center">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 shadow-sm" />
          </div>
        )}
        {isYellowApex && (
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-amber-400/90 flex items-center justify-center">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 shadow-sm" />
          </div>
        )}
        {isGreenApex && (
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-emerald-400/90 flex items-center justify-center">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shadow-sm" />
          </div>
        )}

        {/* Số thứ tự các ô thông thường */}
        {!isRedStart &&
          !isBlueStart &&
          !isYellowStart &&
          !isGreenStart &&
          !isApexCell &&
          trackIndex !== -1 && (
            <span className="text-[7px] sm:text-[8px] text-amber-500/40 font-mono select-none">
              {trackIndex}
            </span>
          )}

        {/* Quân ngựa trên ô này */}
        {horsesOnTrack.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            {horsesOnTrack.map((h) => {
              const selectable = isHorseSelectable(h);
              const isMoving = movingHorseId === h.id;
              const isBayOCandidate =
                selectable && isApexCell && coCaNgua?.lastDiceValue === 1;

              return (
                <div key={h.id} className="relative flex items-center justify-center">
                  {isBayOCandidate && (
                    <span className="absolute -top-3.5 whitespace-nowrap bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[7px] px-1.5 py-0.2 rounded-full shadow-lg border border-white animate-bounce z-30 pointer-events-none">
                      🐸 NHẢY CÓC
                    </span>
                  )}
                  <HorsePawn
                    horse={h}
                    selectable={selectable}
                    isMoving={isMoving}
                    onClick={() => handleSelectHorse(h.id)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Floating Kick Effect */}
        {kickedEffect &&
          kickedEffect.pos[0] === r &&
          kickedEffect.pos[1] === c && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-40 whitespace-nowrap bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-xl border border-white animate-bounce">
              {kickedEffect.text}
            </div>
          )}
      </div>
    );
  };

  const isGameOver =
    roomState.status === 'FINISHED' || !!coCaNgua?.winnerPlayerId;
  const winnerPlayer = roomState.players.find(
    (p) => p.id === coCaNgua?.winnerPlayerId
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0d0906] to-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="px-3 sm:px-6 py-2.5 bg-slate-900/90 border-b border-amber-900/40 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/40 text-amber-400 shadow-md">
            <Trophy className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wide text-white flex items-center gap-1.5">
                <span>CỜ CÁ NGỰA</span>
                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.2 rounded-full border border-purple-500/40 font-bold">
                  Bản Đẹp 3D
                </span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 font-bold">
                Phòng {roomState.code}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isGameOver
                ? 'Ván đấu đã hoàn tất!'
                : currentTurnPlayer
                ? `Lượt của: ${currentTurnPlayer.playerName} (${COLOR_CONFIG[currentTurnPlayer.color].name})`
                : 'Đang diễn ra'}
            </p>
          </div>
        </div>

        {/* Toolbar Controls & Toggles */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Option: Bật/Tắt Animation Di Chuyển Quân Cờ */}
          <button
            type="button"
            id="toggle-move-animation"
            onClick={() => setMoveAnimationEnabled(!moveAnimationEnabled)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              moveAnimationEnabled
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Bật/Tắt hiệu ứng chuyển động quân cờ"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Animation Quân:</span>
            <span>{moveAnimationEnabled ? 'BẬT' : 'TẮT'}</span>
          </button>

          {/* Option: Bật/Tắt Animation Xúc Xắc 3D */}
          <button
            type="button"
            id="toggle-dice-animation"
            onClick={() => setDiceAnimationEnabled(!diceAnimationEnabled)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              diceAnimationEnabled
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Bật/Tắt hiệu ứng xúc xắc 3D quay cạnh bàn cờ"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Xúc Xắc 3D:</span>
            <span>{diceAnimationEnabled ? 'BẬT' : 'TẮT'}</span>
          </button>

          {/* Âm thanh */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-amber-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Luật chơi */}
          <button
            type="button"
            onClick={() => setIsRuleModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật</span>
          </button>

          {/* Nút quay về sảnh chờ khi xong ván */}
          {isGameOver && (
            <button
              type="button"
              onClick={handleReturnToWaiting}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-extrabold rounded-xl text-xs shadow-lg transition flex items-center gap-1.5 cursor-pointer animate-pulse"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Quay Về Chờ</span>
            </button>
          )}

          {/* Rời phòng */}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rời</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* CỘT TRÁI: BÀN CỜ CAO CẤP */}
        <div className="lg:col-span-8 flex flex-col items-center gap-3 sm:gap-4">
          {/* Lỗi nếu có */}
          {actionError && (
            <div className="w-full bg-rose-950/90 border border-rose-700 text-rose-200 text-xs px-3 py-2 rounded-xl flex items-center justify-between shadow-lg">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-slate-400 hover:text-white font-bold ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Banner Trạng Thái Lượt Đi & Thông Báo */}
          <div className="w-full bg-gradient-to-r from-[#1c120c] via-slate-900 to-[#1c120c] border border-amber-900/60 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-3">
              {currentTurnPlayer && (
                <div
                  className={`w-4 h-4 rounded-full ${
                    COLOR_CONFIG[currentTurnPlayer.color].bg
                  } animate-ping ring-2 ring-white`}
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-white">
                    {currentTurnPlayer
                      ? `Lượt đi: ${currentTurnPlayer.playerName}`
                      : 'Đang khởi động'}
                  </span>
                  {currentTurnPlayer && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        COLOR_CONFIG[currentTurnPlayer.color].badge
                      }`}
                    >
                      {COLOR_CONFIG[currentTurnPlayer.color].name}
                    </span>
                  )}
                  {isMyTurn && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold animate-pulse">
                      LƯỢT CỦA BẠN!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-amber-200/70 mt-0.5 line-clamp-1">
                  {coCaNgua?.lastActionMessage ||
                    'Gieo 1 hoặc 6 để xuất chuồng. Đưa toàn bộ 4 ngựa về đích để chiến thắng!'}
                </p>
              </div>
            </div>

            {/* Đếm thời gian lượt */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400">Thời gian</span>
              <span
                className={`text-base sm:text-xl font-mono font-black ${
                  (coCaNgua?.turnTimeRemaining || 0) <= 5
                    ? 'text-rose-400 animate-pulse'
                    : 'text-amber-400'
                }`}
              >
                {coCaNgua?.turnTimeRemaining || 30}s
              </span>
            </div>
          </div>

          {/* BÀN CỜ CỜ CÁ NGỰA GỖ SƠN MÀI 15x15 */}
          <div className="relative w-full max-w-[620px] aspect-square bg-gradient-to-b from-[#1c120c] via-[#150d08] to-[#0d0805] border-4 sm:border-8 border-[#3d2415] rounded-3xl sm:rounded-[2.5rem] p-2 sm:p-3.5 shadow-2xl shadow-black ring-2 ring-amber-900/60 select-none">
            {/* Corner Brass Rivets */}
            <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border border-amber-800 shadow" />
            <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border border-amber-800 shadow" />
            <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border border-amber-800 shadow" />
            <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border border-amber-800 shadow" />

            {/* Grid 15x15 */}
            <div className="w-full h-full grid grid-cols-15 grid-rows-15 gap-0.5 sm:gap-1">
              {Array.from({ length: 15 }).map((_, r) =>
                Array.from({ length: 15 }).map((_, c) => renderCell(r, c))
              )}
            </div>
          </div>

          {/* Bảng nhắc việc khi đang chọn ngựa */}
          {isMyTurn && coCaNgua?.phase === 'SELECTING_HORSE' && (
            <div className="w-full max-w-[620px] p-3 bg-gradient-to-r from-amber-950/80 via-yellow-950/70 to-amber-950/80 border-2 border-amber-500/80 rounded-2xl flex items-center justify-between shadow-xl animate-pulse">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-xs sm:text-sm font-black text-amber-200">
                  Bạn vừa gieo được {coCaNgua.lastDiceValue} nút! Hãy bấm vào 1 chú ngựa đang nhấp nháy trên bàn cờ để đi!
                </span>
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: BÀN LẮC XÚC XẮC 3D CỦA CHỦ PHÒNG/NGƯỜI CHƠI + KHÁN GIẢ + CHAT */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* BÀN LẮC XÚC XẮC 3D (Cạnh bàn cờ của chủ phòng theo yêu cầu) */}
          <Dice3D
            value={coCaNgua?.lastDiceValue || null}
            isRolling={coCaNgua?.isRolling || false}
            canRoll={isMyTurn && coCaNgua?.phase === 'ROLLING'}
            onRoll={handleRollDice}
            rollerName={currentTurnPlayer?.playerName || hostPlayer?.name || 'Chủ phòng'}
            isHost={isHost || (currentTurnPlayer ? !!roomState.players.find((p) => p.id === currentTurnPlayer.playerId)?.isHost : false)}
            enableAnimation={diceAnimationEnabled}
            turnTimeRemaining={coCaNgua?.turnTimeRemaining}
          />

          {/* KHÁN GIẢ THEO DÕI */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Khán giả theo dõi
                </h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                {spectators.length}/4
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {[0, 1, 2, 3].map((slotIdx) => {
                const spec = spectators[slotIdx];
                return (
                  <div
                    key={`spectator-slot-${slotIdx}`}
                    className={`p-1.5 rounded-xl border flex items-center gap-1.5 text-xs transition ${
                      spec
                        ? 'bg-slate-950/80 border-indigo-900/60 text-slate-200'
                        : 'bg-slate-950/30 border-dashed border-slate-800 text-slate-600'
                    }`}
                  >
                    {spec ? (
                      <>
                        <span className="text-base">{spec.avatar}</span>
                        <div className="truncate">
                          <div className="font-bold truncate text-[11px]">
                            {spec.name}
                          </div>
                          <div className="text-[9px] text-indigo-400">Khán giả</div>
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-600">Ghế trống</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* KHUNG CHAT PHÒNG CHƠI */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col h-[520px] lg:h-[600px]">
            <div className="p-2.5 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                💬 Trò chuyện trong phòng
              </span>
              <span className="text-[10px] text-amber-400 font-mono font-bold">
                {roomState.code}
              </span>
            </div>

            <div className="flex-1 p-2 overflow-hidden">
              <KhungChat
                roomCode={roomState.code}
                myPlayerId={myPlayerId}
                messages={chatMessages}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Hướng Dẫn Luật */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-800/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-400" />
              Luật Cờ Cá Ngựa Truyền Thống
            </h3>
            <div className="text-xs text-slate-300 space-y-2.5 max-h-[60vh] overflow-y-auto pr-2">
              <p>
                • <strong>Số người chơi:</strong> 2 đến 4 người chơi (Đỏ, Xanh Dương, Vàng, Xanh Lá) + 4 khán giả theo dõi trực tiếp.
              </p>
              <p>
                • <strong>Xuất chuồng:</strong> Gieo được <strong>1</strong> hoặc <strong>6</strong> mới có quyền đưa ngựa từ chuồng ra ô xuất phát (cửa chuồng màu mình).
              </p>
              <p>
                • <strong>Di chuyển:</strong> Tiến quân theo chiều kim đồng hồ quanh 56 ô liên hoàn theo đúng số nút của xúc xắc.
              </p>
              <p>
                • <strong>Đá ngựa đối phương:</strong> Nếu điểm đến của ngựa trùng với ô đang có ngựa của đối thủ, ngựa của đối thủ sẽ bị <strong>ĐÁ văng về lại chuồng</strong>!
              </p>
              <p>
                • <strong>Thưởng thêm lượt:</strong> Người gieo được <strong>1</strong>, <strong>6</strong> hoặc <strong>đá thành công ngựa đối phương</strong> sẽ được thưởng thêm 1 lượt gieo tiếp theo.
              </p>
              <p className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 text-amber-200">
                • <strong>Quy tắc Về Đích (Ô Chốt 12, 26, 40, 54):</strong> Khi ngựa chạy gần hết 1 vòng (54 ô), người chơi <strong>bắt buộc phải gieo đúng số nút</strong> để ngựa đáp chính xác vào ô chốt ngay dưới chân chuồng (Ô 12 cho Xanh Biển, 26 cho Vàng, 40 cho Xanh Lá, 54 cho Đỏ). Không được gieo vượt quá. Sau khi ngựa đã đứng trên ô chốt này, người chơi mới được gieo nút để tiến vào thang chuồng bậc 1 đến 6.
              </p>
              <p className="bg-cyan-950/40 border border-cyan-500/40 rounded-xl p-2.5 text-cyan-200">
                • <strong>Quy tắc Bay Ô 90° (Phi Ô Chốt):</strong> Khi bất kỳ chú ngựa nào đang đứng trên 1 trong 4 ô chốt (12, 26, 40, 54), nếu gieo được <strong>1 điểm</strong> thì được quyền kích hoạt <strong>Bay Ô 90°</strong> (12 ➔ 26 ➔ 40 ➔ 54 ➔ 12)! Nếu tại ô chốt hạ cánh có ngựa đối thủ, ngựa đối thủ sẽ bị <strong>đá văng về chuồng</strong> và người chơi được thưởng thêm lượt!
              </p>
              <p>
                • <strong>Vào chuồng & Về đích:</strong> Thang chuồng gồm các bậc từ số 1 đến số 6. Ngựa lên đến bậc 6 (đỉnh chuồng) là hoàn thành cuộc đua. Người đầu tiên đưa cả 4 ngựa vào chuồng sẽ giành chiến thắng!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsRuleModalOpen(false)}
              className="mt-5 w-full py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer"
            >
              Đã hiểu luật chơi
            </button>
          </div>
        </div>
      )}

      {/* Modal Chiến Thắng Kết Thúc Ván */}
      {isGameOver && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl shadow-amber-950/60 animate-scaleIn">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/40">
              <Trophy className="w-8 h-8 text-slate-950 animate-bounce" />
            </div>

            <h3 className="text-xl font-black text-white mb-1">
              {winnerPlayer ? `CHIẾN THẮNG: ${winnerPlayer.name}` : 'KẾT THÚC VÁN ĐẤU'}
            </h3>
            <p className="text-xs text-amber-200/80 mb-6">
              {winnerPlayer
                ? `Đội ${COLOR_CONFIG[winnerPlayer.caNguaColor || 'RED'].name} đã xuất sắc hoàn thành cuộc đua kỳ thú và đưa cả 4 chú ngựa về đích an toàn!`
                : 'Ván cờ cá ngựa đã khép lại.'}
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleReturnToWaiting}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black rounded-xl text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Quay Về Phòng Chờ</span>
              </button>

              <button
                type="button"
                onClick={onLeaveRoom}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Rời phòng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
