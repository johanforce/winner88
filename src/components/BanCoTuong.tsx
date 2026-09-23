import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Award,
  History,
  MessageSquare,
  Users,
  X,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Swords,
  Maximize2,
  Mic,
  MicOff,
  Radio,
  Headphones,
} from 'lucide-react';
import {
  RoomPublicState,
  PlayerPublicInfo,
  ChatMessage,
  XiangqiPiece,
  XiangqiSide,
  XiangqiMove,
} from '../types';
import { socket } from '../socket';
import { KhungChat } from './KhungChat';
import { RuleGuideModal } from './RuleGuideModal';
import {
  getPieceAt,
  getLegalMoves,
  getPieceCharacter,
  getPieceNameVN,
  isSideInCheck,
} from '../utils/xiangqiLogic';
import { findBestXiangqiMove, XiangqiAiHint } from '../utils/xiangqiAi';

interface BanCoTuongProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
}

export const BanCoTuong: React.FC<BanCoTuongProps> = ({
  roomState,
  myPlayerId,
  chatMessages,
  onLeaveRoom,
}) => {
  const xiangqi = roomState.xiangqiState;
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost || false;

  // Identify red player, black player, and spectators (up to 6 spectator slots)
  const redPlayer = roomState.players.find((p) => p.seatIndex === 0 || p.xiangqiSide === 'RED');
  const blackPlayer = roomState.players.find((p) => p.seatIndex === 1 || p.xiangqiSide === 'BLACK');
  const spectators = roomState.players.filter(
    (p) => p.isSpectator || (typeof p.seatIndex === 'number' && p.seatIndex >= 2)
  );

  const isMyTurn = roomState.currentTurnPlayerId === myPlayerId;
  const mySide: XiangqiSide | null =
    me?.id === redPlayer?.id ? 'RED' : me?.id === blackPlayer?.id ? 'BLACK' : null;
  const isSpectator = mySide === null || me?.isSpectator === true;

  // Perspective flip: if I'm Black, default flipped = true so my pieces are at the bottom
  const [isFlipped, setIsFlipped] = useState<boolean>(() => mySide === 'BLACK');

  // Interactive piece selection & legal moves
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'MOVES' | 'SPECTATORS' | 'CHAT'>('MOVES');
  const [lastReadMessageCount, setLastReadMessageCount] = useState(chatMessages.length);
  const [actionError, setActionError] = useState<string | null>(null);

  // Secret AI Assistant (Sunfish Xiangqi Engine) activated via "lickmyball", deactivated via "sonofbitch"
  const [isAiHintActive, setIsAiHintActive] = useState<boolean>(false);
  const [aiHint, setAiHint] = useState<XiangqiAiHint | null>(null);
  const [isCalculatingHint, setIsCalculatingHint] = useState<boolean>(false);
  const [aiToastMessage, setAiToastMessage] = useState<string | null>(null);

  // Auto-dismiss AI toast after 4s
  useEffect(() => {
    if (aiToastMessage) {
      const t = setTimeout(() => setAiToastMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [aiToastMessage]);

  // Compute best move whenever it's my turn and AI assistant is enabled
  useEffect(() => {
    if (!isAiHintActive || !isMyTurn || isSpectator || !mySide || !xiangqi?.pieces || xiangqi.winnerSide) {
      setAiHint(null);
      return;
    }

    setIsCalculatingHint(true);
    const timer = setTimeout(() => {
      try {
        const best = findBestXiangqiMove(xiangqi.pieces, mySide, 2);
        setAiHint(best);
      } catch (err) {
        console.error('Error calculating AI hint:', err);
      } finally {
        setIsCalculatingHint(false);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isAiHintActive, isMyTurn, isSpectator, mySide, xiangqi?.pieces, xiangqi?.winnerSide]);

  // Handle secret chat trigger commands
  const handleInterceptChat = (text: string): boolean => {
    const clean = text.trim().toLowerCase();
    if (clean === 'lickmyball') {
      setIsAiHintActive(true);
      setAiToastMessage('⚡ Đã kích hoạt Trợ lý Cờ Tướng Sunfish! Gợi ý nước đi sẽ hiển thị khi đến lượt bạn.');
      return true;
    }
    if (clean === 'sonofbitch') {
      setIsAiHintActive(false);
      setAiHint(null);
      setAiToastMessage('🛑 Đã TẮT trợ lý Cờ Tướng.');
      return true;
    }
    return false;
  };

  // Keep read count synchronized when chat tab is active
  useEffect(() => {
    if (activeTab === 'CHAT') {
      setLastReadMessageCount(chatMessages.length);
    }
  }, [activeTab, chatMessages.length]);

  const unreadChatCount = activeTab === 'CHAT' ? 0 : Math.max(0, chatMessages.length - lastReadMessageCount);

  // Endgame review & move inspection state
  const [isGameOverModalDismissed, setIsGameOverModalDismissed] = useState(false);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null);
  const moveListEndRef = useRef<HTMLDivElement>(null);

  // Reset endgame modal dismissal and selected move when a new match starts
  useEffect(() => {
    if (!xiangqi?.winnerSide) {
      setIsGameOverModalDismissed(false);
      setSelectedMoveIndex(null);
    }
  }, [xiangqi?.winnerSide]);

  // Auto confetti on game end
  useEffect(() => {
    if (xiangqi?.winnerSide && xiangqi.winnerSide !== 'DRAW') {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignore
      }
    }
  }, [xiangqi?.winnerSide]);

  // Find currently selected piece and calculate its legal moves
  const selectedPiece = useMemo(() => {
    if (!selectedPieceId || !xiangqi) return null;
    return xiangqi.pieces.find((p) => p.id === selectedPieceId) || null;
  }, [selectedPieceId, xiangqi]);

  const legalMoves = useMemo(() => {
    if (!selectedPiece || !xiangqi) return [];
    // Only current turn player can see/make legal moves
    if (isSpectator || selectedPiece.color !== mySide || !isMyTurn) return [];
    return getLegalMoves(selectedPiece, xiangqi.pieces);
  }, [selectedPiece, xiangqi, isSpectator, mySide, isMyTurn]);

  // Captured pieces calculation
  const capturedPieces = useMemo(() => {
    if (!xiangqi) return { redCaptured: [], blackCaptured: [] };
    // Normal initial counts
    const initialCounts = {
      RED: { GENERAL: 1, ADVISOR: 2, ELEPHANT: 2, HORSE: 2, CHARIOT: 2, CANNON: 2, SOLDIER: 5 },
      BLACK: { GENERAL: 1, ADVISOR: 2, ELEPHANT: 2, HORSE: 2, CHARIOT: 2, CANNON: 2, SOLDIER: 5 },
    };
    const currentCounts = {
      RED: { GENERAL: 0, ADVISOR: 0, ELEPHANT: 0, HORSE: 0, CHARIOT: 0, CANNON: 0, SOLDIER: 0 },
      BLACK: { GENERAL: 0, ADVISOR: 0, ELEPHANT: 0, HORSE: 0, CHARIOT: 0, CANNON: 0, SOLDIER: 0 },
    };
    for (const p of xiangqi.pieces) {
      currentCounts[p.color][p.type]++;
    }

    const redCaptured: { type: keyof typeof currentCounts.RED; count: number }[] = [];
    const blackCaptured: { type: keyof typeof currentCounts.BLACK; count: number }[] = [];

    (Object.keys(initialCounts.RED) as (keyof typeof currentCounts.RED)[]).forEach((type) => {
      const lostRed = initialCounts.RED[type] - currentCounts.RED[type];
      if (lostRed > 0) redCaptured.push({ type, count: lostRed });
      const lostBlack = initialCounts.BLACK[type] - currentCounts.BLACK[type];
      if (lostBlack > 0) blackCaptured.push({ type, count: lostBlack });
    });

    return { redCaptured, blackCaptured };
  }, [xiangqi]);

  // Click on a piece or intersection
  const handleIntersectionClick = (x: number, y: number) => {
    if (!xiangqi || xiangqi.winnerSide || isSpectator) return;
    setActionError(null);

    const clickedPiece = getPieceAt(xiangqi.pieces, x, y);

    // If already selected a piece and clicked on a valid destination
    if (selectedPiece && isMyTurn && selectedPiece.color === mySide) {
      const isTarget = legalMoves.some((m) => m.x === x && m.y === y);
      if (isTarget) {
        // Send move to server
        socket.emit(
          'GAME_XIANGQI_MOVE',
          {
            roomCode: roomState.code,
            playerId: myPlayerId,
            from: { x: selectedPiece.x, y: selectedPiece.y },
            to: { x, y },
          },
          (res: { success: boolean; message?: string }) => {
            if (!res.success) {
              setActionError(res.message || 'Nước đi không hợp lệ');
            }
          }
        );
        setSelectedPieceId(null);
        return;
      }
    }

    // Otherwise select or switch to friendly piece
    if (clickedPiece && clickedPiece.color === mySide && isMyTurn) {
      setSelectedPieceId(clickedPiece.id);
    } else {
      setSelectedPieceId(null);
    }
  };

  // Handlers for draw and resign
  const handleOfferDraw = () => {
    setActionError(null);
    socket.emit(
      'GAME_XIANGQI_OFFER_DRAW',
      { roomCode: roomState.code, playerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) setActionError(res.message || 'Không thể xin hòa');
      }
    );
  };

  const handleRespondDraw = (accept: boolean) => {
    setActionError(null);
    socket.emit(
      'GAME_XIANGQI_RESPOND_DRAW',
      { roomCode: roomState.code, playerId: myPlayerId, accept },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) setActionError(res.message || 'Phản hồi thất bại');
      }
    );
  };

  const handleResign = () => {
    setShowResignConfirm(false);
    setActionError(null);
    socket.emit(
      'GAME_XIANGQI_RESIGN',
      { roomCode: roomState.code, playerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) setActionError(res.message || 'Không thể đầu hàng');
      }
    );
  };

  const handlePlayAgain = () => {
    setActionError(null);
    socket.emit(
      'ROOM_START_GAME',
      { roomCode: roomState.code, requestedByPlayerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) setActionError(res.message || 'Không thể bắt đầu ván mới');
      }
    );
  };

  const handleResetToWaiting = () => {
    setActionError(null);
    socket.emit(
      'PLAYER_RETURN_TO_WAITING',
      { roomCode: roomState.code, playerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) setActionError(res.message || 'Không thể về phòng chờ');
      }
    );
  };

  // Format seconds to MM:SS or HH:MM:SS
  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    if (s >= 3600) {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const rem = s % 60;
      return `${h}:${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
    }
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // Convert board coordinate (x, y) to visual position based on flip
  const getVisualCoord = (x: number, y: number) => {
    if (isFlipped) {
      return { vx: 8 - x, vy: 9 - y };
    }
    return { vx: x, vy: y };
  };

  // Check if General is currently checked
  const isRedInCheck = xiangqi?.isCheck && xiangqi.checkSide === 'RED';
  const isBlackInCheck = xiangqi?.isCheck && xiangqi.checkSide === 'BLACK';

  const isStandardMode = xiangqi?.timeMode === 'STANDARD' || roomState.xiangqiTimeMode === 'STANDARD';

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-neutral-900 to-stone-950 text-stone-100 flex flex-col selection:bg-amber-600 selection:text-white font-sans">
      {/* Top Header */}
      <header className="border-b border-stone-800 bg-stone-950/80 backdrop-blur-md px-4 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-stone-900 border border-stone-700 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] text-stone-400 font-medium">Mã phòng:</span>
            <span className="font-black text-amber-400 tracking-wider text-sm sm:text-base">
              {roomState.code}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-950/60 border border-amber-800 text-amber-300 text-xs font-bold rounded-xl">
            {isStandardMode ? (
              <>
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Cờ Tiêu Chuẩn Quốc Tế (60p + 30s WXF)</span>
              </>
            ) : (
              <>
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Cờ Chớp 5 Phút (+ 3s/nước)</span>
              </>
            )}
          </div>

          {isSpectator && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/70 border border-indigo-700 text-indigo-300 text-xs font-semibold rounded-xl">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Khán giả theo dõi</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('CHAT');
              const chatElem = document.getElementById('co-tuong-sidebar-tabs');
              if (chatElem) {
                chatElem.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            id="btn-co-tuong-chat-header"
            className={`px-2 sm:px-2.5 py-1.5 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer touch-manipulation lg:hidden ${
              activeTab === 'CHAT'
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
            }`}
            title="Trò chuyện"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline">Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFlipped((prev) => !prev)}
            id="btn-flip-board"
            className="px-2 sm:px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-700 rounded-xl text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer touch-manipulation"
            title="Đổi chiều nhìn bàn cờ"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Lật Bàn</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRuleModalOpen(true)}
            id="btn-co-tuong-rules"
            className="px-2 sm:px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-700 rounded-xl text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer touch-manipulation"
            title="Luật cờ"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Luật Cờ</span>
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            id="btn-leave-co-tuong"
            className="px-2 sm:px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1.5 transition cursor-pointer touch-manipulation"
            title="Rời phòng"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rời phòng</span>
          </button>
        </div>
      </header>

      {/* Global Action Error */}
      {actionError && (
        <div className="bg-rose-950 border-b border-rose-800 text-rose-200 px-4 py-1.5 text-xs text-center font-bold flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Check Notification Banner */}
      {xiangqi?.isCheck && !xiangqi.winnerSide && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white font-black text-xs sm:text-sm py-1.5 px-4 text-center tracking-wide shadow-md flex items-center justify-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4 fill-white text-rose-700" />
          <span>
            ⚡ CHIẾU TƯỚNG! Kỳ thủ {xiangqi.checkSide === 'RED' ? 'ĐỎ' : 'ĐEN'} ĐANG BỊ CHIẾU!
          </span>
        </div>
      )}

      {/* Main Container: Board Area & Right Sidebar */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col lg:flex-row items-start justify-center gap-5">
        {/* Left Side: Chess Playing Arena */}
        <div className="flex-1 w-full max-w-2xl flex flex-col items-center">
          {/* ENDGAME REVIEW BANNER: Appears when game has ended and user dismissed modal to review the board */}
          {xiangqi?.winnerSide && isGameOverModalDismissed && (
            <div className="w-full mb-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-stone-900 via-amber-950/60 to-stone-900 border border-amber-500/60 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Trophy className="w-5 h-5 fill-amber-400/20" />
                </div>
                <div>
                  <div className="text-xs font-black text-white flex items-center gap-2 flex-wrap">
                    <span>
                      {xiangqi.winnerSide === 'RED'
                        ? '🔴 Kỳ thủ ĐỎ chiến thắng!'
                        : xiangqi.winnerSide === 'BLACK'
                        ? '⚫ Kỳ thủ ĐEN chiến thắng!'
                        : '🤝 Kết quả Hòa cờ!'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                      {xiangqi.winReason === 'CHECKMATE'
                        ? 'Chiếu bí Tướng'
                        : xiangqi.winReason === 'TIMEOUT'
                        ? 'Hết giờ cờ chớp'
                        : xiangqi.winReason === 'RESIGN'
                        ? 'Đối thủ đầu hàng'
                        : xiangqi.winReason === 'STALEMATE'
                        ? 'Hết nước đi'
                        : 'Thuận hòa'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-300 mt-0.5">
                    Đang xem thế cờ tàn cuộc ({xiangqi.moveHistory.length} nước đi). Bấm nước cờ để xem lại.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('MOVES')}
                  className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 text-xs font-bold rounded-xl border border-stone-700 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ký Phổ Nước Đi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsGameOverModalDismissed(false)}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 active:scale-95 text-stone-950 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Bảng Kết Quả</span>
                </button>
              </div>
            </div>
          )}

          {/* Opponent Info Bar */}
          {(() => {
            const opp = isFlipped ? redPlayer : blackPlayer;
            const oppSide: XiangqiSide = isFlipped ? 'RED' : 'BLACK';
            const oppTime = oppSide === 'RED' ? xiangqi?.redTimeRemaining ?? 0 : xiangqi?.blackTimeRemaining ?? 0;
            const isOppTurn = xiangqi?.currentSide === oppSide && !xiangqi.winnerSide;
            const isLowTime = oppTime <= 30;

            return (
              <div
                className={`w-full mb-3 px-4 py-2.5 rounded-2xl border transition-all flex items-center justify-between shadow-md ${
                  isOppTurn
                    ? 'bg-stone-900 border-amber-500/60 shadow-amber-950/30'
                    : 'bg-stone-900/80 border-stone-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="text-3xl inline-block transition-all rounded-full">
                      {opp?.avatar || (oppSide === 'RED' ? '🔴' : '⚫')}
                    </span>
                    {opp?.isHost && (
                      <Crown className="w-3.5 h-3.5 fill-amber-400 text-amber-400 absolute -top-1 -right-1" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-stone-100">
                        {opp?.name || (oppSide === 'RED' ? 'Kỳ thủ Đỏ' : 'Kỳ thủ Đen')}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          oppSide === 'RED'
                            ? 'bg-red-950 text-red-300 border-red-800'
                            : 'bg-stone-950 text-stone-300 border-stone-700'
                        }`}
                      >
                        {oppSide === 'RED' ? '🔴 Quân Đỏ' : '⚫ Quân Đen'}
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-400 font-semibold">
                      {opp?.score ?? 1000} xu
                    </div>
                  </div>
                </div>

                {/* Clock */}
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-base font-black border transition-all ${
                    isOppTurn
                      ? isLowTime
                        ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                        : 'bg-amber-950/80 border-amber-500 text-amber-300 ring-2 ring-amber-500/20'
                      : 'bg-stone-950 border-stone-800 text-stone-400'
                  }`}
                >
                  <Clock className={`w-4 h-4 ${isOppTurn ? 'animate-spin' : ''}`} />
                  <span>{formatTime(oppTime)}</span>
                  {xiangqi?.incrementSeconds ? (
                    <span className="text-[10px] text-emerald-400 font-semibold opacity-90">
                      +{xiangqi.incrementSeconds}s
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })()}

          {/* ACTIVE REVIEWED MOVE RIBBON: Shows details when a specific move in history is selected */}
          {selectedMoveIndex !== null && xiangqi?.moveHistory && xiangqi.moveHistory[selectedMoveIndex] && (
            <div className="w-full max-w-[560px] mb-2 px-3.5 py-2 bg-stone-900/95 border border-cyan-500/70 rounded-xl flex items-center justify-between shadow-xl text-xs backdrop-blur-sm animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded">
                  NƯỚC #{selectedMoveIndex + 1}
                </span>
                <span className="font-black text-white text-sm">
                  {xiangqi.moveHistory[selectedMoveIndex].notation}
                </span>
                {xiangqi.moveHistory[selectedMoveIndex].isCheck && (
                  <span className="text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded animate-pulse">
                    ⚡ Chiếu
                  </span>
                )}
                {xiangqi.moveHistory[selectedMoveIndex].capturedPiece && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800 px-1.5 py-0.5 rounded">
                    Ăn {getPieceNameVN(
                      xiangqi.moveHistory[selectedMoveIndex].capturedPiece!.type,
                      xiangqi.moveHistory[selectedMoveIndex].capturedPiece!.color
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={selectedMoveIndex <= 0}
                  onClick={() => setSelectedMoveIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : 0))}
                  className="p-1 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-200 transition cursor-pointer"
                  title="Nước trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={selectedMoveIndex >= xiangqi.moveHistory.length - 1}
                  onClick={() =>
                    setSelectedMoveIndex((prev) =>
                      prev !== null ? Math.min(xiangqi.moveHistory.length - 1, prev + 1) : 0
                    )
                  }
                  className="p-1 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-200 transition cursor-pointer"
                  title="Nước tiếp"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMoveIndex(null)}
                  className="ml-1 text-[11px] font-semibold text-stone-400 hover:text-white px-2 py-0.5 bg-stone-800 hover:bg-stone-700 rounded transition cursor-pointer"
                  title="Đóng xem nước đi"
                >
                  Về tàn cuộc ✕
                </button>
              </div>
            </div>
          )}

          {/* XIANGQI BOARD CONTAINER */}
          <div
            id="xiangqi-board-wrapper"
            className="w-full max-w-[560px] aspect-[9/10] relative rounded-2xl bg-[#c8924b] shadow-2xl border-4 border-[#653911] select-none overflow-hidden touch-manipulation"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at center, #dfaa68 0%, #be8744 70%, #9c672b 100%)',
              boxShadow: '0 20px 35px -10px rgba(0,0,0,0.8), inset 0 2px 8px rgba(255,255,255,0.2)',
            }}
          >
            {/* Exact 9:10 Board Surface Container */}
            <div className="relative w-full h-full">
              {/* SVG Grid Lines, River, Palaces and Star Points (ViewBox 900x1000, 50px margin = 0.5 cell width) */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 900 1000"
                preserveAspectRatio="none"
              >
                {/* Outer Board Boundary Frame */}
                <rect x="16" y="16" width="868" height="968" rx="10" fill="none" stroke="#543015" strokeWidth="4" />
                <rect x="28" y="28" width="844" height="944" rx="6" fill="none" stroke="#683d1b" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.7" />
                
                {/* Outer Grid Playing Border (From File 0 to 8, Rank 0 to 9) */}
                <rect x="50" y="50" width="800" height="900" fill="none" stroke="#4a2a10" strokeWidth="2.5" />

                {/* 10 Horizontal lines (Rank 0 to 9 at y = 50 + row * 100) */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
                  <line
                    key={`h-${row}`}
                    x1="50"
                    y1={50 + row * 100}
                    x2="850"
                    y2={50 + row * 100}
                    stroke="#4a2a10"
                    strokeWidth="2"
                  />
                ))}

                {/* 9 Vertical lines (File 0 to 8 at x = 50 + col * 100) */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((col) => {
                  const x = 50 + col * 100;
                  // Outer border lines go all the way across
                  if (col === 0 || col === 8) {
                    return (
                      <line
                        key={`v-${col}`}
                        x1={x}
                        y1="50"
                        x2={x}
                        y2="950"
                        stroke="#4a2a10"
                        strokeWidth="2.5"
                      />
                    );
                  }
                  // Inner lines do not cross the river (y: 450 to 550)
                  return (
                    <React.Fragment key={`v-${col}`}>
                      <line x1={x} y1="50" x2={x} y2="450" stroke="#4a2a10" strokeWidth="2" />
                      <line x1={x} y1="550" x2={x} y2="950" stroke="#4a2a10" strokeWidth="2" />
                    </React.Fragment>
                  );
                })}

                {/* Black Palace Diagonals (x: 350..550, y: 50..250) */}
                <line x1="350" y1="50" x2="550" y2="250" stroke="#4a2a10" strokeWidth="2" />
                <line x1="550" y1="50" x2="350" y2="250" stroke="#4a2a10" strokeWidth="2" />

                {/* Red Palace Diagonals (x: 350..550, y: 750..950) */}
                <line x1="350" y1="750" x2="550" y2="950" stroke="#4a2a10" strokeWidth="2" />
                <line x1="550" y1="750" x2="350" y2="950" stroke="#4a2a10" strokeWidth="2" />

                {/* River Water Tint */}
                <rect x="51" y="451" width="798" height="98" fill="#a47239" opacity="0.12" />

                {/* River Text: SỞ HÀ - HÁN GIỚI (楚河 漢界) */}
                <text
                  x="250"
                  y="500"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#543015"
                  fontSize="38"
                  fontWeight="bold"
                  fontFamily="serif"
                  letterSpacing="8"
                >
                  楚 河
                </text>
                <text
                  x="650"
                  y="500"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#543015"
                  fontSize="38"
                  fontWeight="bold"
                  fontFamily="serif"
                  letterSpacing="8"
                >
                  漢 界
                </text>

                {/* Star Point Tick Marks (Cross markings for Cannons and Soldiers) */}
                {[
                  // Black Cannons (row 2)
                  { cx: 150, cy: 250, edge: 'none' },
                  { cx: 750, cy: 250, edge: 'none' },
                  // Black Soldiers (row 3)
                  { cx: 50, cy: 350, edge: 'left' },
                  { cx: 250, cy: 350, edge: 'none' },
                  { cx: 450, cy: 350, edge: 'none' },
                  { cx: 650, cy: 350, edge: 'none' },
                  { cx: 850, cy: 350, edge: 'right' },
                  // Red Soldiers (row 6)
                  { cx: 50, cy: 650, edge: 'left' },
                  { cx: 250, cy: 650, edge: 'none' },
                  { cx: 450, cy: 650, edge: 'none' },
                  { cx: 650, cy: 650, edge: 'none' },
                  { cx: 850, cy: 650, edge: 'right' },
                  // Red Cannons (row 7)
                  { cx: 150, cy: 750, edge: 'none' },
                  { cx: 750, cy: 750, edge: 'none' },
                ].map(({ cx, cy, edge }, idx) => {
                  const gap = 5;
                  const len = 10;
                  return (
                    <g key={`star-${idx}`} stroke="#4a2a10" strokeWidth="1.5" fill="none">
                      {edge !== 'right' && (
                        <path d={`M ${cx + gap} ${cy - gap - len} L ${cx + gap} ${cy - gap} L ${cx + gap + len} ${cy - gap}`} />
                      )}
                      {edge !== 'right' && (
                        <path d={`M ${cx + gap} ${cy + gap + len} L ${cx + gap} ${cy + gap} L ${cx + gap + len} ${cy + gap}`} />
                      )}
                      {edge !== 'left' && (
                        <path d={`M ${cx - gap} ${cy - gap - len} L ${cx - gap} ${cy - gap} L ${cx - gap - len} ${cy - gap}`} />
                      )}
                      {edge !== 'left' && (
                        <path d={`M ${cx - gap} ${cy + gap + len} L ${cx - gap} ${cy + gap} L ${cx - gap - len} ${cy + gap}`} />
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* INTERACTIVE 9x10 GRID OF INTERSECTIONS (Exact sub-pixel center matches SVG grid lines) */}
              <div className="absolute inset-0 w-full h-full grid grid-cols-9 grid-rows-10 z-10">
                {Array.from({ length: 10 }).map((_, vy) =>
                  Array.from({ length: 9 }).map((__, vx) => {
                    // Translate visual vx, vy back to logical x, y based on isFlipped
                    const x = isFlipped ? 8 - vx : vx;
                    const y = isFlipped ? 9 - vy : vy;

                    const piece = xiangqi ? getPieceAt(xiangqi.pieces, x, y) : undefined;
                    const isSelected = selectedPiece?.x === x && selectedPiece?.y === y;
                    const isLegalTarget = legalMoves.some((m) => m.x === x && m.y === y);
                    const isLastMoveFrom =
                      xiangqi?.lastMove && xiangqi.lastMove.from.x === x && xiangqi.lastMove.from.y === y;
                    const isLastMoveTo =
                      xiangqi?.lastMove && xiangqi.lastMove.to.x === x && xiangqi.lastMove.to.y === y;
                    const isGeneralChecked =
                      piece?.type === 'GENERAL' &&
                      ((piece.color === 'RED' && isRedInCheck) || (piece.color === 'BLACK' && isBlackInCheck));

                    // Reviewed move indicators from move history
                    const reviewedMove =
                      selectedMoveIndex !== null && xiangqi?.moveHistory
                        ? xiangqi.moveHistory[selectedMoveIndex]
                        : null;
                    const isReviewedFrom =
                      reviewedMove && reviewedMove.from.x === x && reviewedMove.from.y === y;
                    const isReviewedTo =
                      reviewedMove && reviewedMove.to.x === x && reviewedMove.to.y === y;

                    // AI Suggestion Indicators (Sunfish Engine)
                    const isAiHintFrom =
                      isAiHintActive && isMyTurn && !isSpectator && aiHint && aiHint.from.x === x && aiHint.from.y === y;
                    const isAiHintTo =
                      isAiHintActive && isMyTurn && !isSpectator && aiHint && aiHint.to.x === x && aiHint.to.y === y;

                    return (
                      <div
                        key={`cell-${vx}-${vy}`}
                        onClick={() => handleIntersectionClick(x, y)}
                        className="relative flex items-center justify-center cursor-pointer group"
                      >
                        {/* Last move highlight halo */}
                        {(isLastMoveFrom || isLastMoveTo) && (
                          <div className="absolute w-[86%] h-[86%] max-w-[50px] max-h-[50px] rounded-full bg-amber-400/35 ring-2 ring-amber-400/70 pointer-events-none animate-pulse" />
                        )}

                        {/* Move Review Highlight Halos */}
                        {isReviewedFrom && (
                          <div className="absolute w-[94%] h-[94%] max-w-[54px] max-h-[54px] rounded-full border-2 border-dashed border-amber-400 bg-amber-500/30 ring-4 ring-amber-400/50 pointer-events-none z-30 flex items-center justify-center shadow-lg">
                            <span className="text-[9px] font-black bg-amber-500 text-stone-950 px-1 py-0.2 rounded shadow tracking-tight">
                              TỪ
                            </span>
                          </div>
                        )}

                        {isReviewedTo && (
                          <div className="absolute w-[94%] h-[94%] max-w-[54px] max-h-[54px] rounded-full border-2 border-cyan-400 bg-cyan-500/35 ring-4 ring-cyan-400/60 pointer-events-none z-30 flex items-center justify-center animate-pulse shadow-lg">
                            <span className="text-[9px] font-black bg-cyan-400 text-stone-950 px-1 py-0.2 rounded shadow tracking-tight">
                              ĐẾN
                            </span>
                          </div>
                        )}

                        {/* Secret AI Hint Halos (Sunfish) */}
                        {isAiHintFrom && (
                          <div className="absolute w-[94%] h-[94%] max-w-[54px] max-h-[54px] rounded-full border-2 border-dashed border-violet-400 bg-violet-600/30 ring-4 ring-violet-500/50 pointer-events-none z-30 flex items-center justify-center shadow-lg animate-pulse">
                            <span className="text-[8px] font-black bg-violet-600 text-white px-1 py-0.2 rounded shadow tracking-tight">
                              GỢI Ý
                            </span>
                          </div>
                        )}

                        {isAiHintTo && (
                          <div className="absolute w-[94%] h-[94%] max-w-[54px] max-h-[54px] rounded-full border-2 border-emerald-400 bg-emerald-500/30 ring-4 ring-emerald-400/60 pointer-events-none z-30 flex items-center justify-center animate-pulse shadow-lg">
                            <span className="text-[8px] font-black bg-emerald-500 text-slate-950 px-1 py-0.2 rounded shadow tracking-tight">
                              ĐẾN
                            </span>
                          </div>
                        )}

                        {/* Legal Move Target Indicator (Empty square: green dot; Occupied: capture reticle) */}
                        {isLegalTarget && (
                          <>
                            {piece ? (
                              <div className="absolute w-[94%] h-[94%] max-w-[54px] max-h-[54px] rounded-full border-2 border-emerald-400 bg-emerald-500/25 ring-4 ring-emerald-400/40 animate-ping pointer-events-none" />
                            ) : (
                              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-700/85 border-2 border-emerald-300 shadow-md transform hover:scale-125 transition" />
                            )}
                          </>
                        )}

                        {/* PIECE RENDERING (Centered directly on intersection) */}
                        {piece && (
                          <div
                            className={`relative w-[84%] h-[84%] max-w-[50px] max-h-[50px] aspect-square rounded-full flex flex-col items-center justify-center shadow-lg transition-transform ${
                              isSelected
                                ? 'scale-110 z-20 ring-4 ring-amber-400 shadow-amber-950/60'
                                : 'hover:scale-105'
                            } ${
                              isGeneralChecked
                                ? 'ring-4 ring-rose-500 animate-bounce'
                                : ''
                            } ${
                              piece.color === 'RED'
                                ? 'bg-gradient-to-br from-amber-50 via-amber-100 to-orange-100 border-2 border-red-700 text-red-700'
                                : 'bg-gradient-to-br from-stone-800 via-stone-900 to-neutral-950 border-2 border-stone-600 text-amber-200'
                            }`}
                            style={{
                              boxShadow:
                                piece.color === 'RED'
                                  ? '0 4px 6px -1px rgba(185, 28, 28, 0.45), inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.3)'
                                  : '0 4px 6px -1px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.8)',
                            }}
                          >
                            {/* Inner piece ring - Authentic Chinese Calligraphy without Vietnamese text */}
                            <div
                              className={`w-[86%] h-[86%] rounded-full border-2 flex items-center justify-center ${
                                piece.color === 'RED'
                                  ? 'border-red-600/70 bg-amber-50/50'
                                  : 'border-stone-500/70 bg-stone-900/50'
                              }`}
                            >
                              <span className="text-lg sm:text-2xl font-black leading-none select-none font-serif tracking-tight">
                                {getPieceCharacter(piece.type, piece.color)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* My Player Info Bar */}
          {(() => {
            const mePlayer = isFlipped ? blackPlayer : redPlayer;
            const myCurrentSide: XiangqiSide = isFlipped ? 'BLACK' : 'RED';
            const myTime = myCurrentSide === 'RED' ? xiangqi?.redTimeRemaining ?? 0 : xiangqi?.blackTimeRemaining ?? 0;
            const isTurn = xiangqi?.currentSide === myCurrentSide && !xiangqi.winnerSide;
            const isLowTime = myTime <= 30;

            return (
              <div
                className={`w-full mt-3 px-4 py-2.5 rounded-2xl border transition-all flex items-center justify-between shadow-md ${
                  isTurn
                    ? 'bg-stone-900 border-amber-500/60 shadow-amber-950/30 ring-1 ring-amber-500/30'
                    : 'bg-stone-900/80 border-stone-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="text-3xl inline-block transition-all rounded-full">
                      {mePlayer?.avatar || (myCurrentSide === 'RED' ? '🔴' : '⚫')}
                    </span>
                    {mePlayer?.isHost && (
                      <Crown className="w-3.5 h-3.5 fill-amber-400 text-amber-400 absolute -top-1 -right-1" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-stone-100">
                        {mePlayer?.name || (myCurrentSide === 'RED' ? 'Kỳ thủ Đỏ' : 'Kỳ thủ Đen')}
                      </span>
                      {me?.id === mePlayer?.id && (
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          Bạn
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          myCurrentSide === 'RED'
                            ? 'bg-red-950 text-red-300 border-red-800'
                            : 'bg-stone-950 text-stone-300 border-stone-700'
                        }`}
                      >
                        {myCurrentSide === 'RED' ? '🔴 Quân Đỏ' : '⚫ Quân Đen'}
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-400 font-semibold">
                      {mePlayer?.score ?? 1000} xu
                    </div>
                  </div>
                </div>

                {/* Clock */}
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-base font-black border transition-all ${
                    isTurn
                      ? isLowTime
                        ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                        : 'bg-amber-950/80 border-amber-500 text-amber-300 ring-2 ring-amber-500/20'
                      : 'bg-stone-950 border-stone-800 text-stone-400'
                  }`}
                >
                  <Clock className={`w-4 h-4 ${isTurn ? 'animate-spin' : ''}`} />
                  <span>{formatTime(myTime)}</span>
                  {xiangqi?.incrementSeconds ? (
                    <span className="text-[10px] text-emerald-400 font-semibold opacity-90">
                      +{xiangqi.incrementSeconds}s
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })()}

          {/* Action Toolbar for Current Players */}
          {!isSpectator && !xiangqi?.winnerSide && (
            <div className="w-full mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleOfferDraw}
                disabled={xiangqi?.drawOfferFrom === mySide}
                id="btn-offer-draw"
                className="flex-1 min-h-[42px] py-2 px-3 bg-stone-900 hover:bg-stone-800 border border-stone-700 rounded-xl text-xs font-bold text-stone-300 hover:text-white flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer touch-manipulation"
              >
                <Handshake className="w-4 h-4 text-amber-400" />
                <span>
                  {xiangqi?.drawOfferFrom === mySide ? 'Đã Gửi Lời Cầu Hòa' : 'Xin Hòa Cờ'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowResignConfirm(true)}
                id="btn-resign-game"
                className="flex-1 min-h-[42px] py-2 px-3 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-bold text-rose-300 hover:text-rose-200 flex items-center justify-center gap-1.5 transition cursor-pointer touch-manipulation"
              >
                <Flag className="w-4 h-4" />
                <span>Đầu Hàng</span>
              </button>
            </div>
          )}

          {/* Action Toolbar when Game is Over - For all players and spectators */}
          {xiangqi?.winnerSide && (
            <div className="w-full mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResetToWaiting}
                id="btn-co-tuong-toolbar-back-waiting"
                className="flex-1 min-h-[42px] py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-xs font-bold text-white shadow-lg flex items-center justify-center gap-1.5 transition cursor-pointer touch-manipulation"
              >
                <Users className="w-4 h-4" />
                <span>Quay Về Phòng Chờ</span>
              </button>
              <button
                type="button"
                onClick={() => setIsGameOverModalDismissed(false)}
                className="py-2 px-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl text-xs font-bold text-stone-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Xem Kết Quả</span>
              </button>
            </div>
          )}

          {/* Secret AI Hint Banner (Sunfish) */}
          {isAiHintActive && !isSpectator && !xiangqi?.winnerSide && (
            <div className="w-full mt-2.5 p-3 bg-gradient-to-r from-violet-950/90 via-purple-950/80 to-slate-900/90 border border-violet-600/80 rounded-2xl flex items-center justify-between text-xs text-violet-100 shadow-xl backdrop-blur-sm animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-violet-600/40 border border-violet-400/60 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-violet-300 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-[11px] text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Trợ Lý Sunfish AI</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  </div>
                  <div className="truncate text-xs">
                    {isCalculatingHint ? (
                      <span className="text-violet-300/80 italic">Đang tính toán thế cờ...</span>
                    ) : isMyTurn && aiHint ? (
                      <span>
                        Nước đi tốt nhất:{' '}
                        <strong className="text-emerald-300 font-black text-sm underline decoration-emerald-400 ml-1">
                          {aiHint.notation}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-stone-400">Đợi đối thủ đi xong...</span>
                    )}
                  </div>
                </div>
              </div>
              {isMyTurn && aiHint && (
                <button
                  type="button"
                  onClick={() => setSelectedPieceId(aiHint.piece.id)}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer shrink-0 ml-2"
                >
                  Chọn Quân
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Tabbed Panel (Move History, Spectator Slots, Chat) */}
        <div id="co-tuong-sidebar-tabs" className="w-full lg:w-80 xl:w-96 flex flex-col space-y-4">
          {/* Navigation Tabs */}
          <div className="bg-stone-900/90 border border-stone-800 p-1 rounded-2xl flex text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('MOVES')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'MOVES' ? 'bg-amber-600 text-white shadow' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Ký Phổ ({xiangqi?.moveHistory.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SPECTATORS')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'SPECTATORS'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Khán Giả ({spectators.length}/6)</span>
            </button>

            <button
              type="button"
              id="btn-xiangqi-tab-chat"
              onClick={() => {
                setActiveTab('CHAT');
                setLastReadMessageCount(chatMessages.length);
              }}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'CHAT' ? 'bg-amber-600 text-white shadow' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Trò Chuyện</span>
              {unreadChatCount > 0 && (
                <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow">
                  +{unreadChatCount}
                </span>
              )}
            </button>
          </div>

          {/* TAB CONTENT: MOVES BIÊN BẢN (KÝ PHỔ) */}
          {activeTab === 'MOVES' && (
            <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-4 flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-800 mb-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Danh Sách Nước Đi ({xiangqi?.moveHistory.length || 0})
                  </span>
                  <span className="text-[10px] text-stone-400">
                    Bấm vào nước cờ để xem lại vị trí trên bàn cờ
                  </span>
                </div>
                {selectedMoveIndex !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedMoveIndex(null)}
                    className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
                  >
                    Về tàn cuộc
                  </button>
                )}
              </div>

              {/* Endgame Status Banner inside Moves Tab if finished */}
              {xiangqi?.winnerSide && (
                <div className="mb-2 p-2.5 rounded-xl bg-amber-950/40 border border-amber-600/50 text-xs text-amber-200 flex items-start gap-2">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold text-white block">
                      {xiangqi.winnerSide === 'RED'
                        ? '🔴 Kỳ thủ Đỏ thắng trận!'
                        : xiangqi.winnerSide === 'BLACK'
                        ? '⚫ Kỳ thủ Đen thắng trận!'
                        : '🤝 Trận đấu hòa cờ!'}
                    </span>
                    <span className="text-[11px] text-amber-300/80">
                      {xiangqi.winReason === 'CHECKMATE'
                        ? 'Chiếu bí Tướng'
                        : xiangqi.winReason === 'TIMEOUT'
                        ? 'Đối thủ hết giờ'
                        : xiangqi.winReason === 'RESIGN'
                        ? 'Đối thủ đầu hàng'
                        : xiangqi.winReason === 'STALEMATE'
                        ? 'Hết nước đi hợp lệ'
                        : 'Hòa cờ'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGameOverModalDismissed(false)}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-black text-[10px] rounded-lg cursor-pointer"
                  >
                    Bảng điểm
                  </button>
                </div>
              )}

              {/* Move Stepper Controls */}
              {xiangqi && xiangqi.moveHistory.length > 0 && (
                <div className="flex items-center justify-between gap-1 py-1 px-2 bg-stone-950/80 rounded-xl border border-stone-800 mb-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedMoveIndex(0)}
                    disabled={selectedMoveIndex === 0}
                    className="p-1 rounded hover:bg-stone-800 disabled:opacity-30 text-stone-300 hover:text-white transition cursor-pointer"
                    title="Nước đầu tiên"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMoveIndex((prev) =>
                        prev === null ? xiangqi.moveHistory.length - 1 : Math.max(0, prev - 1)
                      )
                    }
                    disabled={selectedMoveIndex === 0}
                    className="p-1 rounded hover:bg-stone-800 disabled:opacity-30 text-stone-300 hover:text-white transition cursor-pointer"
                    title="Nước trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-bold text-stone-300">
                    {selectedMoveIndex !== null ? (
                      <span className="text-cyan-400 font-extrabold">
                        Nước {selectedMoveIndex + 1}/{xiangqi.moveHistory.length}
                      </span>
                    ) : (
                      <span className="text-amber-400">Thế cờ tàn cuộc (hiện tại)</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMoveIndex((prev) =>
                        prev === null ? null : Math.min(xiangqi.moveHistory.length - 1, prev + 1)
                      )
                    }
                    disabled={
                      selectedMoveIndex === null || selectedMoveIndex >= xiangqi.moveHistory.length - 1
                    }
                    className="p-1 rounded hover:bg-stone-800 disabled:opacity-30 text-stone-300 hover:text-white transition cursor-pointer"
                    title="Nước tiếp theo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMoveIndex(xiangqi.moveHistory.length - 1)}
                    disabled={selectedMoveIndex === xiangqi.moveHistory.length - 1}
                    className="p-1 rounded hover:bg-stone-800 disabled:opacity-30 text-stone-300 hover:text-white transition cursor-pointer"
                    title="Nước cuối cùng"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Moves List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {(!xiangqi || xiangqi.moveHistory.length === 0) && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 py-10">
                    <History className="w-8 h-8 opacity-40 mb-2" />
                    <span>Trận đấu vừa bắt đầu. Chưa có nước cờ nào.</span>
                  </div>
                )}

                {xiangqi?.moveHistory.map((m, idx) => {
                  const isSelected = selectedMoveIndex === idx;
                  const isRed = m.piece.color === 'RED';

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedMoveIndex(isSelected ? null : idx)}
                      className={`px-3 py-2 rounded-xl flex items-center justify-between font-mono transition cursor-pointer border ${
                        isSelected
                          ? 'bg-cyan-950/80 border-cyan-500 ring-2 ring-cyan-500/40 text-white shadow-lg'
                          : idx % 2 === 0
                          ? 'bg-stone-950/60 border-stone-850 hover:border-stone-700'
                          : 'bg-stone-950/30 border-stone-850 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-stone-500 w-6 font-bold">{idx + 1}.</span>
                        <span className="text-xs">{isRed ? '🔴' : '⚫'}</span>
                        <span
                          className={`font-black text-xs ${
                            isSelected ? 'text-cyan-300' : isRed ? 'text-red-400' : 'text-stone-200'
                          }`}
                        >
                          {m.notation}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {m.capturedPiece && (
                          <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-bold">
                            Ăn {getPieceNameVN(m.capturedPiece.type, m.capturedPiece.color)}
                          </span>
                        )}
                        {m.isCheck && (
                          <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded font-black">
                            ⚡ Chiếu
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB CONTENT: SPECTATOR SLOTS (6 SLOTS) */}
          {activeTab === 'SPECTATORS' && (
            <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-4 flex flex-col h-[520px]">
              <div className="pb-3 border-b border-stone-800 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> 6 Slot Theo Dõi Trận Đấu
                </span>
                <p className="text-[11px] text-stone-400 mt-1">
                  Khán giả theo dõi trực tiếp nước đi và đồng hồ cờ chớp thời gian thực.
                </p>
              </div>

              <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
                {[2, 3, 4, 5, 6, 7].map((slotIndex) => {
                  const spectator = roomState.players.find((p) => p.seatIndex === slotIndex);
                  return (
                    <div
                      key={slotIndex}
                      className="p-3 rounded-xl border border-stone-800 bg-stone-950/60 flex items-center justify-between"
                    >
                      {spectator ? (
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{spectator.avatar}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-stone-200">
                                {spectator.name}
                              </span>
                              {spectator.id === myPlayerId && (
                                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.2 rounded font-bold">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-stone-400">
                              Slot theo dõi #{slotIndex - 1}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-stone-500">
                          <div className="w-7 h-7 rounded-full border border-dashed border-stone-700 flex items-center justify-center">
                            <Eye className="w-3.5 h-3.5 opacity-50" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-stone-400">
                              Slot theo dõi #{slotIndex - 1} (Trống)
                            </span>
                            <p className="text-[10px] text-stone-600">Đang chờ khán giả vào...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Controls in spectators tab */}
                {xiangqi?.winnerSide ? (
                  <div className="mt-3 pt-3 border-t border-stone-800">
                    <span className="text-xs font-bold text-emerald-400 block mb-2">
                      Ván Cờ Đã Kết Thúc
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToWaiting}
                      id="btn-all-reset-waiting"
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      <span>Quay Về Phòng Chờ</span>
                    </button>
                  </div>
                ) : isHost && (
                  <div className="mt-3 pt-3 border-t border-stone-800">
                    <span className="text-xs font-bold text-amber-400 block mb-2">
                      Quyền Chủ Phòng
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToWaiting}
                      id="btn-host-reset-waiting"
                      className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl border border-stone-700 flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <span>Về Phòng Chờ Đổi Vị Trí</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: CHAT */}
          {activeTab === 'CHAT' && (
            <div className="h-[480px]">
              <KhungChat
                roomCode={roomState.code}
                playerId={myPlayerId}
                messages={chatMessages}
                isOpen={true}
                onReadAll={() => setLastReadMessageCount(chatMessages.length)}
                onInterceptMessage={handleInterceptChat}
              />
            </div>
          )}
        </div>
      </main>

      {/* DRAW OFFER MODAL PROMPT */}
      {xiangqi?.drawOfferFrom && xiangqi.drawOfferFrom !== mySide && !isSpectator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-stone-900 border border-amber-500/50 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-950/60 border border-amber-700 text-amber-400 flex items-center justify-center mx-auto">
              <Handshake className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Lời Đề Nghị Hòa Cờ</h3>
            <p className="text-xs text-stone-300">
              Đối thủ ({xiangqi.drawOfferFrom === 'RED' ? 'Kỳ thủ Đỏ' : 'Kỳ thủ Đen'}) muốn xin hòa
              cờ. Bạn có đồng ý kết thúc trận đấu với tỷ số hòa không?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleRespondDraw(false)}
                className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Từ Chối
              </button>
              <button
                type="button"
                onClick={() => handleRespondDraw(true)}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow transition cursor-pointer"
              >
                Đồng Ý Hòa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESIGN CONFIRMATION MODAL */}
      {showResignConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-stone-900 border border-rose-800/60 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-700 text-rose-400 flex items-center justify-center mx-auto">
              <Flag className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Xác Nhận Đầu Hàng?</h3>
            <p className="text-xs text-stone-300">
              Bạn có chắc chắn muốn nhận thua ván cờ chớp này không? Điểm cược 100 xu sẽ chuyển cho
              đối thủ.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowResignConfirm(false)}
                className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleResign}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow transition cursor-pointer"
              >
                Đầu Hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* END GAME RESULT MODAL */}
      {xiangqi?.winnerSide && !isGameOverModalDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-stone-900 border border-amber-500/40 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 p-6 text-center text-stone-950 relative">
              <button
                type="button"
                onClick={() => {
                  setIsGameOverModalDismissed(true);
                  setActiveTab('MOVES');
                }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-stone-950/20 hover:bg-stone-950/40 text-stone-950 flex items-center justify-center transition cursor-pointer"
                title="Đóng bảng để xem thế cờ tàn cuộc"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-full mb-2 backdrop-blur-sm">
                <Trophy className="w-8 h-8 text-stone-950 fill-stone-950" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">KẾT THÚC TRẬN ĐẤU</h2>
              <p className="text-xs font-extrabold uppercase tracking-wider mt-1 text-stone-900">
                {xiangqi.winnerSide === 'DRAW'
                  ? '🤝 KẾT QUẢ: HÒA CỜ'
                  : xiangqi.winnerSide === 'RED'
                  ? '🏆 KỲ THỦ ĐỎ THẮNG CUỘC'
                  : '🏆 KỲ THỦ ĐEN THẮNG CUỘC'}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-center">
              <div className="text-xs text-stone-300 bg-stone-950/60 p-3 rounded-xl border border-stone-800">
                Lý do kết thúc:{' '}
                <strong className="text-amber-300 font-bold">
                  {xiangqi.winReason === 'CHECKMATE'
                    ? 'Chiếu bí (Checkmate)'
                    : xiangqi.winReason === 'TIMEOUT'
                    ? 'Hết thời gian cờ chớp (Timeout)'
                    : xiangqi.winReason === 'RESIGN'
                    ? 'Đối thủ xin đầu hàng'
                    : xiangqi.winReason === 'STALEMATE'
                    ? 'Hết nước đi hợp lệ (Stalemate)'
                    : 'Hai bên thuận hòa'}
                </strong>
              </div>

              {/* Player Outcome Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div
                  className={`p-3 rounded-xl border ${
                    xiangqi.winnerSide === 'RED'
                      ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400'
                  }`}
                >
                  <span className="text-2xl block mb-1">{redPlayer?.avatar || '🔴'}</span>
                  <strong className="block text-sm text-white">{redPlayer?.name || 'Đỏ'}</strong>
                  <span className="text-[10px] block mt-0.5">Kỳ thủ Đỏ</span>
                  <span
                    className={`font-black text-xs block mt-1 ${
                      xiangqi.winnerSide === 'RED' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {xiangqi.winnerSide === 'RED' ? '+100 xu' : xiangqi.winnerSide === 'DRAW' ? '0 xu' : '-100 xu'}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    xiangqi.winnerSide === 'BLACK'
                      ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400'
                  }`}
                >
                  <span className="text-2xl block mb-1">{blackPlayer?.avatar || '⚫'}</span>
                  <strong className="block text-sm text-white">{blackPlayer?.name || 'Đen'}</strong>
                  <span className="text-[10px] block mt-0.5">Kỳ thủ Đen</span>
                  <span
                    className={`font-black text-xs block mt-1 ${
                      xiangqi.winnerSide === 'BLACK' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {xiangqi.winnerSide === 'BLACK' ? '+100 xu' : xiangqi.winnerSide === 'DRAW' ? '0 xu' : '-100 xu'}
                  </span>
                </div>
              </div>

              {/* BUTTON TO REVIEW ENDGAME AND MOVE HISTORY */}
              <button
                type="button"
                onClick={() => {
                  setIsGameOverModalDismissed(true);
                  setActiveTab('MOVES');
                }}
                id="btn-co-tuong-review-endgame"
                className="w-full py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Xem Thế Cờ Tàn Cuộc & Nước Đi ({xiangqi.moveHistory.length} nước)</span>
              </button>

              {/* Action buttons for all players and spectators */}
              <div className="pt-2 space-y-2">
                <div className="flex gap-2">
                  {isHost && (
                    <button
                      type="button"
                      onClick={handlePlayAgain}
                      id="btn-co-tuong-rematch"
                      className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer"
                    >
                      Đấu Ván Mới
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetToWaiting}
                    id="btn-co-tuong-back-waiting"
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Quay Về Phòng Chờ</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="w-full py-2.5 bg-stone-950 hover:bg-stone-900 text-stone-400 hover:text-white text-xs font-semibold rounded-xl border border-stone-800 transition cursor-pointer"
                >
                  Rời Phòng Chơi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rule Guide Modal */}
      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        defaultRule="CO_TUONG"
      />

      {/* Discreet AI Activation Toast Notification */}
      {aiToastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-950/95 border border-violet-500/80 text-violet-200 rounded-full shadow-2xl text-xs font-bold backdrop-blur-md flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <span>{aiToastMessage}</span>
        </div>
      )}
    </div>
  );
};
