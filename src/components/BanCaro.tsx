import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Clock,
  LogOut,
  BookOpen,
  RotateCcw,
  Sparkles,
  Flame,
  AlertTriangle,
  Crown,
  Eye,
  Handshake,
  Flag,
  Trophy,
  History,
  MessageSquare,
  Users,
  X,
  Swords,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  RoomPublicState,
  ChatMessage,
  CaroPiece,
} from '../types';
import { socket } from '../socket';
import { KhungChat } from './KhungChat';
import { RuleGuideModal } from './RuleGuideModal';
import { useVoiceChat } from '../context/VoiceChatContext';
import { BOARD_SIZE, isBorderCell, isPlayableCell, caroSound } from '../utils/caroLogic';

interface BanCaroProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
}

export const BanCaro: React.FC<BanCaroProps> = ({
  roomState,
  myPlayerId,
  chatMessages,
  onLeaveRoom,
}) => {
  const caro = roomState.caroState;
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost || false;

  const xPlayer = roomState.players.find((p) => p.seatIndex === 0 || p.caroPiece === 'X');
  const oPlayer = roomState.players.find((p) => p.seatIndex === 1 || p.caroPiece === 'O');
  const spectators = roomState.players.filter(
    (p) => p.isSpectator || (typeof p.seatIndex === 'number' && p.seatIndex >= 2)
  );

  const isMyTurn = roomState.currentTurnPlayerId === myPlayerId;
  const myPiece: CaroPiece | null =
    me?.id === xPlayer?.id ? 'X' : me?.id === oPlayer?.id ? 'O' : null;
  const isSpectator = myPiece === null || me?.isSpectator === true;

  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHAT' | 'SPECTATORS'>('CHAT');
  const [lastReadMessageCount, setLastReadMessageCount] = useState(chatMessages.length);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isGameOverModalDismissed, setIsGameOverModalDismissed] = useState(false);
  const [showMoveNumbers, setShowMoveNumbers] = useState(false);

  const { speakingMap } = useVoiceChat();

  // Keep read count updated when chat tab is open
  useEffect(() => {
    if (activeTab === 'CHAT') {
      setLastReadMessageCount(chatMessages.length);
    }
  }, [activeTab, chatMessages.length]);

  const unreadChatCount = activeTab === 'CHAT' ? 0 : Math.max(0, chatMessages.length - lastReadMessageCount);

  // Audio feedback on new move
  useEffect(() => {
    if (caro?.lastMove) {
      caroSound.playPiecePlace(caro.lastMove.piece === 'X');
    }
  }, [caro?.lastMove?.timestamp]);

  // Win confetti & audio
  useEffect(() => {
    if (caro?.winnerPiece) {
      if (caro.winReason === 'TIMEOUT') {
        caroSound.playTimeout();
      } else {
        caroSound.playWin();
      }

      if (caro.winnerPiece !== 'DRAW') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } else {
      setIsGameOverModalDismissed(false);
    }
  }, [caro?.winnerPiece, caro?.winReason]);

  // Click to place piece
  const handleCellClick = (x: number, y: number) => {
    if (!caro || caro.winnerPiece || isSpectator || !isMyTurn) return;

    // Luật cờ Caro 20x20: Không được đánh vào viền ngoài bàn cờ
    if (isBorderCell(x, y)) {
      setActionError('Không được đánh vào viền ngoài bàn cờ (hàng/cột ngoài cùng)!');
      return;
    }

    if (caro.board[y]?.[x] !== null) return;

    setActionError(null);
    socket.emit(
      'GAME_CARO_MOVE',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
        x,
        y,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Nước đi không hợp lệ');
        }
      }
    );
  };

  const handleResign = () => {
    setShowResignConfirm(false);
    socket.emit(
      'GAME_CARO_RESIGN',
      { roomCode: roomState.code, playerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) setActionError(res.message || 'Không thể xin thua');
      }
    );
  };

  const handleOfferDraw = () => {
    socket.emit(
      'GAME_CARO_OFFER_DRAW',
      { roomCode: roomState.code, playerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) setActionError(res.message || 'Không thể xin hòa');
      }
    );
  };

  const handleRespondDraw = (accept: boolean) => {
    socket.emit(
      'GAME_CARO_RESPOND_DRAW',
      { roomCode: roomState.code, playerId: myPlayerId, accept },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) setActionError(res.message || 'Phản hồi xin hòa thất bại');
      }
    );
  };

  const handleResetToWaiting = () => {
    socket.emit(
      'ROOM_RESET_TO_WAITING',
      { roomCode: roomState.code, requestedByPlayerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) setActionError(res.message || 'Không thể trở về phòng chờ');
      }
    );
  };

  // Format seconds as mm:ss
  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // Winning cells set for fast lookup
  const winningCellSet = useMemo(() => {
    const set = new Set<string>();
    if (caro?.winningLine) {
      caro.winningLine.forEach((pt) => set.add(`${pt.x},${pt.y}`));
    }
    return set;
  }, [caro?.winningLine]);

  // Star points trên bàn cờ 20x20 tại các giao điểm: (4,4), (15,4), (4,15), (15,15), (9,9), (10,10), (9,10), (10,9)
  const isStarPoint = (x: number, y: number) => {
    return (
      (x === 4 && y === 4) ||
      (x === 15 && y === 4) ||
      (x === 4 && y === 15) ||
      (x === 15 && y === 15) ||
      (x === 9 && y === 9) ||
      (x === 10 && y === 10) ||
      (x === 9 && y === 10) ||
      (x === 10 && y === 9)
    );
  };

  // Move numbers map
  const moveNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    if (caro?.moveHistory) {
      caro.moveHistory.forEach((m) => {
        map.set(`${m.x},${m.y}`, m.moveNumber);
      });
    }
    return map;
  }, [caro?.moveHistory]);

  const xTimeLow = (caro?.xTimeRemaining ?? 300) <= 30;
  const oTimeLow = (caro?.oTimeRemaining ?? 300) <= 30;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none overflow-x-hidden">
      {/* HEADER */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-xl">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Phòng</span>
            <span className="text-amber-400 font-black tracking-wider text-sm">{roomState.code}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-cyan-950/50 border border-cyan-800/60 px-2.5 py-1 rounded-xl text-xs font-bold text-cyan-300">
            <Swords className="w-3.5 h-3.5" />
            <span>Cờ Caro (Ăn 5 chặn 2 đầu vẫn Win)</span>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-200 px-1.5 py-0.2 rounded font-mono">5 phút Blitz</span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMoveNumbers(!showMoveNumbers)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer touch-manipulation ${
              showMoveNumbers
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Bật/Tắt hiển thị số thứ tự nước đi"
          >
            <span className="font-mono text-[11px] font-bold">123</span>
            <span className="hidden md:inline">Số nước đi</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRuleModalOpen(true)}
            id="btn-open-rules-caro"
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật chơi</span>
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            id="btn-leave-room-caro"
            className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-semibold text-rose-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rời phòng</span>
          </button>
        </div>
      </header>

      {/* ERROR BANNER */}
      {actionError && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-4 py-2 text-xs font-semibold text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-white font-bold text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* DRAW OFFER BANNER */}
      {caro?.drawOfferFrom && (
        <div className="bg-amber-950/90 border-b border-amber-800 px-4 py-2.5 text-xs font-semibold text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-lg z-10 animate-pulse">
          <div className="flex items-center gap-2">
            <Handshake className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Kỳ thủ <strong>{caro.drawOfferFrom === 'X' ? xPlayer?.name : oPlayer?.name}</strong> ({caro.drawOfferFrom}) đang đề nghị hòa cờ!
            </span>
          </div>
          {!isSpectator && myPiece && myPiece !== caro.drawOfferFrom && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRespondDraw(true)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow transition cursor-pointer"
              >
                Đồng ý hòa
              </button>
              <button
                type="button"
                onClick={() => handleRespondDraw(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-600 transition cursor-pointer"
              >
                Từ chối
              </button>
            </div>
          )}
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center p-2 sm:p-4 gap-4 max-w-7xl w-full mx-auto overflow-hidden">
        {/* LEFT / CENTER: BOARD & CLOCKS */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl">
          {/* PLAYER BARS (TOP & BOTTOM) */}
          <div className="w-full flex items-center justify-between gap-2 mb-2 px-1">
            {/* O Player Bar */}
            <div
              className={`flex-1 flex items-center justify-between p-2 sm:p-2.5 rounded-2xl border transition-all ${
                caro?.currentTurn === 'O' && !caro?.winnerPiece
                  ? 'bg-cyan-950/80 border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/40'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-lg font-black text-white shadow">
                    {oPlayer?.avatar || '⭕'}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyan-900 border border-cyan-400 text-cyan-200 font-black text-[9px] flex items-center justify-center">
                    O
                  </span>
                  {oPlayer && speakingMap[oPlayer.id] && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-xs sm:text-sm text-white truncate max-w-[100px] sm:max-w-[130px]">
                      {oPlayer?.name || 'Đang chờ...'}
                    </span>
                    {oPlayer?.id === myPlayerId && (
                      <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-700 px-1 rounded font-bold">
                        BẠN
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {oPlayer ? `${oPlayer.score.toLocaleString()} xu` : 'Ghế 2'}
                  </span>
                </div>
              </div>

              {/* Timer for O */}
              <div
                className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black transition ${
                  oTimeLow
                    ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                    : caro?.currentTurn === 'O' && !caro?.winnerPiece
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{formatTime(caro?.oTimeRemaining ?? 300)}</span>
              </div>
            </div>

            {/* VS Badge */}
            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">VS</span>
            </div>

            {/* X Player Bar */}
            <div
              className={`flex-1 flex items-center justify-between p-2 sm:p-2.5 rounded-2xl border transition-all ${
                caro?.currentTurn === 'X' && !caro?.winnerPiece
                  ? 'bg-rose-950/80 border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center text-lg font-black text-white shadow">
                    {xPlayer?.avatar || '❌'}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-900 border border-rose-400 text-rose-200 font-black text-[9px] flex items-center justify-center">
                    X
                  </span>
                  {xPlayer && speakingMap[xPlayer.id] && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-xs sm:text-sm text-white truncate max-w-[100px] sm:max-w-[130px]">
                      {xPlayer?.name || 'Đang chờ...'}
                    </span>
                    {xPlayer?.id === myPlayerId && (
                      <span className="text-[9px] bg-rose-950 text-rose-400 border border-rose-700 px-1 rounded font-bold">
                        BẠN
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {xPlayer ? `${xPlayer.score.toLocaleString()} xu` : 'Ghế 1'}
                  </span>
                </div>
              </div>

              {/* Timer for X */}
              <div
                className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black transition ${
                  xTimeLow
                    ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                    : caro?.currentTurn === 'X' && !caro?.winnerPiece
                    ? 'bg-rose-950 text-rose-300 border-rose-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{formatTime(caro?.xTimeRemaining ?? 300)}</span>
              </div>
            </div>
          </div>

          {/* TURN & RULES BANNER */}
          <div className="w-full mb-2 flex flex-wrap items-center justify-between gap-1.5 px-2 text-xs">
            <div className="flex items-center gap-1.5">
              {!caro?.winnerPiece ? (
                <>
                  <span
                    className={`w-2 h-2 rounded-full animate-ping ${
                      caro?.currentTurn === 'X' ? 'bg-rose-500' : 'bg-cyan-500'
                    }`}
                  />
                  <span className="text-slate-300 font-bold">
                    Lượt của{' '}
                    <strong className={caro?.currentTurn === 'X' ? 'text-rose-400' : 'text-cyan-400'}>
                      Quân {caro?.currentTurn} (
                      {caro?.currentTurn === 'X' ? xPlayer?.name : oPlayer?.name})
                    </strong>
                  </span>
                  {isMyTurn && (
                    <span className="ml-1.5 px-2 py-0.5 bg-amber-500 text-slate-950 font-black rounded-full text-[10px] animate-bounce">
                      ĐẾN LƯỢT BẠN!
                    </span>
                  )}
                </>
              ) : (
                <span className="font-extrabold text-amber-400 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" /> Trận đấu đã kết thúc
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span className="hidden sm:inline bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md text-amber-300/90">
                5:00 Tổng thời gian
              </span>
              <span>
                Nước đi: <strong className="text-white">{caro?.moveHistory.length || 0}</strong>
              </span>
            </div>
          </div>

          {/* BOARD CONTAINER: 20x20 INTERSECTIONS */}
          <div className="relative p-2 sm:p-3 rounded-2xl bg-amber-950/80 border-4 border-amber-900 shadow-2xl overflow-hidden flex flex-col items-center">
            {/* Top Coordinate Labels (A - T) */}
            <div
              className="grid w-full mb-1 text-[8px] sm:text-[10px] font-mono font-bold text-amber-800/90 text-center select-none"
              style={{
                gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                width: 'min(92vw, 580px)',
                maxWidth: '580px',
              }}
            >
              {Array.from({ length: BOARD_SIZE }).map((_, i) => (
                <span
                  key={`col-${i}`}
                  className={i === 0 || i === BOARD_SIZE - 1 ? 'text-amber-950/60 font-normal' : ''}
                  title={i === 0 || i === BOARD_SIZE - 1 ? 'Viền ngoài' : undefined}
                >
                  {String.fromCharCode(65 + i)}
                </span>
              ))}
            </div>

            {/* Board Canvas with Intersections */}
            <div className="flex items-center">
              {/* Left Row Labels (1 - 20) */}
              <div
                className="grid h-full mr-1 text-[8px] sm:text-[10px] font-mono font-bold text-amber-800/90 text-right pr-0.5 select-none"
                style={{
                  gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                  height: 'min(92vw, 580px)',
                  maxHeight: '580px',
                }}
              >
                {Array.from({ length: BOARD_SIZE }).map((_, i) => (
                  <span
                    key={`row-${i}`}
                    className={`flex items-center justify-end leading-none ${
                      i === 0 || i === BOARD_SIZE - 1 ? 'text-amber-950/60 font-normal' : ''
                    }`}
                    title={i === 0 || i === BOARD_SIZE - 1 ? 'Viền ngoài' : undefined}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>

              {/* 20x20 Grid of Intersections */}
              <div
                className="relative rounded-lg border-2 border-amber-950/90 shadow-inner grid select-none"
                style={{
                  backgroundColor: '#dcab6b',
                  backgroundImage:
                    'radial-gradient(#c29355 12%, transparent 13%), radial-gradient(#d6a260 12%, transparent 13%)',
                  backgroundSize: '20px 20px',
                  gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                  aspectRatio: '1 / 1',
                  width: 'min(92vw, 580px)',
                  maxWidth: '580px',
                }}
              >
                {Array.from({ length: BOARD_SIZE }).map((_, y) =>
                  Array.from({ length: BOARD_SIZE }).map((__, x) => {
                    const piece = caro?.board[y]?.[x] ?? null;
                    const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;
                    const isLastMove = caro?.lastMove?.x === x && caro?.lastMove?.y === y;
                    const isWinningCell = winningCellSet.has(`${x},${y}`);
                    const moveNumber = moveNumberMap.get(`${x},${y}`);
                    const star = isStarPoint(x, y);
                    const isBorder = isBorderCell(x, y);

                    return (
                      <div
                        key={`${x}-${y}`}
                        onClick={() => handleCellClick(x, y)}
                        onMouseEnter={() => setHoveredCell({ x, y })}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={
                          isBorder
                            ? 'Viền ngoài bàn cờ (không được đánh)'
                            : `Tọa độ: ${String.fromCharCode(65 + x)}${y + 1}`
                        }
                        className={`relative flex items-center justify-center transition-colors ${
                          isBorder
                            ? 'cursor-not-allowed bg-amber-950/10'
                            : !piece && isMyTurn && !caro?.winnerPiece
                            ? 'cursor-pointer hover:bg-amber-800/25'
                            : !piece
                            ? 'cursor-pointer'
                            : 'cursor-default'
                        }`}
                      >
                        {/* Horizontal Line passing through center (intersection) */}
                        <div
                          className="absolute pointer-events-none"
                          style={{
                            top: '50%',
                            left: x === 0 ? '50%' : '0',
                            right: x === BOARD_SIZE - 1 ? '50%' : '0',
                            height: y === 0 || y === BOARD_SIZE - 1 ? '2.5px' : '1px',
                            backgroundColor: y === 0 || y === BOARD_SIZE - 1 ? '#3a1e08' : '#683d16',
                            transform: 'translateY(-50%)',
                          }}
                        />

                        {/* Vertical Line passing through center (intersection) */}
                        <div
                          className="absolute pointer-events-none"
                          style={{
                            left: '50%',
                            top: y === 0 ? '50%' : '0',
                            bottom: y === BOARD_SIZE - 1 ? '50%' : '0',
                            width: x === 0 || x === BOARD_SIZE - 1 ? '2.5px' : '1px',
                            backgroundColor: x === 0 || x === BOARD_SIZE - 1 ? '#3a1e08' : '#683d16',
                            transform: 'translateX(-50%)',
                          }}
                        />

                        {/* Star Points (Hoa tiêu tại giao điểm) */}
                        {star && !piece && (
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#3a1e08] pointer-events-none z-0 shadow-sm" />
                        )}

                        {/* Winning cell glowing highlight */}
                        {isWinningCell && (
                          <div className="absolute inset-0 rounded-full bg-amber-400/40 ring-4 ring-amber-400 animate-pulse pointer-events-none z-20" />
                        )}

                        {/* Last Move Indicator Ring */}
                        {isLastMove && (
                          <div className="absolute inset-0 rounded-full border-2 border-emerald-400 ring-2 ring-emerald-400/50 animate-ping pointer-events-none z-20" />
                        )}

                        {/* Placed Piece: X (Crimson 3D Stone on Intersection) */}
                        {piece === 'X' && (
                          <div className="relative w-[86%] h-[86%] rounded-full bg-gradient-to-br from-rose-500 via-red-600 to-red-800 shadow-[0_2px_4px_rgba(0,0,0,0.6)] border border-rose-300/60 flex items-center justify-center z-10">
                            <span className="font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] select-none text-[11px] sm:text-sm md:text-base leading-none">
                              ✕
                            </span>
                            {showMoveNumbers && moveNumber && (
                              <span className="absolute -bottom-1 -right-1 text-[7px] sm:text-[8px] font-mono font-black text-white bg-slate-950/90 rounded-full px-1 shadow border border-slate-700">
                                {moveNumber}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Placed Piece: O (Midnight Blue 3D Stone on Intersection) */}
                        {piece === 'O' && (
                          <div className="relative w-[86%] h-[86%] rounded-full bg-gradient-to-br from-cyan-400 via-sky-600 to-blue-800 shadow-[0_2px_4px_rgba(0,0,0,0.6)] border border-cyan-200/60 flex items-center justify-center z-10">
                            <span className="font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] select-none text-[12px] sm:text-base md:text-lg leading-none">
                              ◯
                            </span>
                            {showMoveNumbers && moveNumber && (
                              <span className="absolute -bottom-1 -right-1 text-[7px] sm:text-[8px] font-mono font-black text-white bg-slate-950/90 rounded-full px-1 shadow border border-slate-700">
                                {moveNumber}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Hover ghost preview on playable intersection */}
                        {!piece &&
                          !isBorder &&
                          isHovered &&
                          isMyTurn &&
                          !caro?.winnerPiece &&
                          myPiece && (
                            <div className="w-[80%] h-[80%] rounded-full opacity-50 pointer-events-none z-10 flex items-center justify-center shadow">
                              {myPiece === 'X' ? (
                                <div className="w-full h-full rounded-full bg-rose-500/70 border border-rose-300 flex items-center justify-center text-white font-black text-[10px] sm:text-xs">
                                  ✕
                                </div>
                              ) : (
                                <div className="w-full h-full rounded-full bg-cyan-500/70 border border-cyan-300 flex items-center justify-center text-white font-black text-[10px] sm:text-xs">
                                  ◯
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Note banner under board */}
            <div className="w-full mt-2 pt-1 border-t border-amber-900/60 flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] text-amber-200/80 px-1 font-medium">
              <span>
                • Quân cờ nằm trên <strong>giao điểm</strong> đường thẳng • Các ô là <strong>hình vuông</strong>
              </span>
              <span className="text-amber-400 font-semibold">
                • Viền ngoài bàn cờ: <strong>Không được đánh</strong>
              </span>
            </div>
          </div>

          {/* IN-GAME CONTROLS (RESIGN, DRAW, WAITING ROOM) */}
          <div className="w-full flex items-center justify-between gap-2 mt-3 px-1">
            {!isSpectator && !caro?.winnerPiece ? (
              <>
                <button
                  type="button"
                  onClick={handleOfferDraw}
                  disabled={!!caro?.drawOfferFrom}
                  className="flex-1 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer touch-manipulation"
                >
                  <Handshake className="w-3.5 h-3.5 text-amber-400" />
                  <span>Xin hòa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowResignConfirm(true)}
                  className="flex-1 py-2 sm:py-2.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Xin thua</span>
                </button>
              </>
            ) : isHost && caro?.winnerPiece ? (
              <button
                type="button"
                onClick={handleResetToWaiting}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Trở về phòng chờ (Bắt đầu ván mới)</span>
              </button>
            ) : (
              <div className="w-full text-center py-2 text-xs text-slate-400 italic">
                {isSpectator ? '👁️ Bạn đang ở chế độ khán giả theo dõi trận đấu' : 'Ván cờ đã kết thúc'}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR: TABS (DEFAULT: CHAT, SPECTATORS) */}
        <div className="w-full lg:w-80 h-[380px] lg:h-[600px] flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Tab Selector */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 shrink-0">
            <button
              type="button"
              id="btn-caro-tab-chat"
              onClick={() => {
                setActiveTab('CHAT');
                setLastReadMessageCount(chatMessages.length);
              }}
              className={`flex-1 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'CHAT'
                  ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-900/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Trò chuyện</span>
              {unreadChatCount > 0 && (
                <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow">
                  +{unreadChatCount}
                </span>
              )}
            </button>

            <button
              type="button"
              id="btn-caro-tab-spectators"
              onClick={() => setActiveTab('SPECTATORS')}
              className={`flex-1 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'SPECTATORS'
                  ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-900/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Khán giả ({spectators.length})</span>
            </button>
          </div>

          {/* TAB 1: CHAT (MẶC ĐỊNH CHO CỜ CARO) */}
          {activeTab === 'CHAT' && (
            <div className="flex-1 flex flex-col min-h-0">
              <KhungChat
                roomCode={roomState.code}
                playerId={myPlayerId}
                messages={chatMessages}
                onReadAll={() => setLastReadMessageCount(chatMessages.length)}
              />
            </div>
          )}

          {/* TAB 2: SPECTATORS */}
          {activeTab === 'SPECTATORS' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              <div className="text-[11px] text-slate-400 mb-2">
                Danh sách khán giả đang xem ván cờ:
              </div>
              {spectators.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <Users className="w-8 h-8 mb-2 opacity-30" />
                  <span>Chưa có khán giả nào</span>
                </div>
              ) : (
                spectators.map((sp) => (
                  <div
                    key={sp.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{sp.avatar}</span>
                      <span className="font-bold text-white">{sp.name}</span>
                      {sp.id === myPlayerId && (
                        <span className="text-[9px] bg-slate-800 text-slate-300 px-1 rounded">BẠN</span>
                      )}
                    </div>
                    <span className="text-slate-400 font-mono text-[10px]">{sp.score.toLocaleString()} xu</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: RESIGN CONFIRMATION */}
      {showResignConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-extrabold text-base">
              <Flag className="w-5 h-5" />
              <span>Xác nhận xin thua</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn đầu hàng ván cờ Caro này không? Đối thủ sẽ được xử thắng và nhận 100 xu.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResignConfirm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleResign}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
              >
                Đầu hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GAME OVER RESULT BANNER */}
      {caro?.winnerPiece && !isGameOverModalDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 w-full max-w-md rounded-3xl p-6 shadow-2xl text-center space-y-4 relative overflow-hidden">
            <button
              type="button"
              onClick={() => setIsGameOverModalDismissed(true)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Đóng thông báo để xem lại bàn cờ"
            >
              <X className="w-5 h-5" />
            </button>

            {caro.winnerPiece === 'DRAW' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center mx-auto text-3xl text-amber-400 shadow-lg">
                  🤝
                </div>
                <h3 className="text-2xl font-black text-white">KẾT QUẢ HÒA</h3>
                <p className="text-xs text-slate-400">
                  {caro.winReason === 'AGREED_DRAW'
                    ? 'Hai kỳ thủ đã thỏa thuận hòa cờ'
                    : 'Bàn cờ đã đầy không còn ô trống để đi tiếp'}
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto text-3xl text-slate-950 shadow-xl shadow-amber-500/20">
                  🏆
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-1">
                    Chiến Thắng
                  </span>
                  <h3 className="text-2xl font-black text-white">
                    {caro.winnerPiece === 'X' ? xPlayer?.name : oPlayer?.name} THẮNG!
                  </h3>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300">
                    Quân {caro.winnerPiece}
                  </span>
                </div>

                <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300">
                  {caro.winReason === 'FIVE_IN_A_ROW' && (
                    <span className="text-emerald-400 font-bold">
                      ⭐ Xếp đủ chuỗi 5 quân liên tiếp (Ăn 5 chặn 2 đầu vẫn Thắng)!
                    </span>
                  )}
                  {caro.winReason === 'TIMEOUT' && (
                    <span className="text-rose-400 font-bold">
                      ⏰ Đối thủ hết 5 phút thời gian suy nghĩ (Timeout)!
                    </span>
                  )}
                  {caro.winReason === 'RESIGN' && (
                    <span className="text-rose-400 font-bold">
                      🏳️ Đối thủ đã đầu hàng ván đấu!
                    </span>
                  )}
                </div>
              </>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsGameOverModalDismissed(true)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Xem lại thế cờ trên bàn
              </button>

              {isHost && (
                <button
                  type="button"
                  onClick={handleResetToWaiting}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-xl shadow-lg transition cursor-pointer"
                >
                  Bắt đầu ván mới (Về phòng chờ)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RULE GUIDE MODAL */}
      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        defaultRule="CARO"
      />
    </div>
  );
};
