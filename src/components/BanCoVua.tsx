import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Chess } from 'chess.js';
import {
  Clock,
  LogOut,
  BookOpen,
  RotateCcw,
  Sparkles,
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
  Bot,
  Brain,
} from 'lucide-react';
import { RoomPublicState, ChatMessage, ChessSide } from '../types';
import { socket } from '../socket';
import { KhungChat } from './KhungChat';
import { RuleGuideModal } from './RuleGuideModal';
import { ChessPieceSvg } from './ChessPieceSvg';
import { chessSound } from '../utils/chessSound';

interface BanCoVuaProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const BanCoVua: React.FC<BanCoVuaProps> = ({
  roomState,
  myPlayerId,
  chatMessages,
  onLeaveRoom,
}) => {
  const chessState = roomState.chessState;
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost || false;

  const whitePlayer = roomState.players.find(
    (p) => p.seatIndex === 0 || p.chessSide === 'WHITE'
  );
  const blackPlayer = roomState.players.find(
    (p) => p.seatIndex === 1 || p.chessSide === 'BLACK'
  );
  const spectators = roomState.players.filter(
    (p) => p.isSpectator || (typeof p.seatIndex === 'number' && p.seatIndex >= 2)
  );

  const mySide: ChessSide | null =
    me?.id === whitePlayer?.id
      ? 'WHITE'
      : me?.id === blackPlayer?.id
      ? 'BLACK'
      : null;
  const isSpectator = mySide === null || me?.isSpectator === true;
  const isMyTurn =
    !isSpectator &&
    chessState &&
    !chessState.winnerSide &&
    chessState.turn === mySide;

  // Board orientation: black on bottom if I am black; otherwise white on bottom
  const [isFlipped, setIsFlipped] = useState<boolean>(mySide === 'BLACK');

  // Selected square e.g. 'e2'
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'CHAT' | 'HISTORY' | 'SPECTATORS'>('CHAT');
  const [lastReadMessageCount, setLastReadMessageCount] = useState(chatMessages?.length || 0);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showDrawConfirm, setShowDrawConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isGameOverModalDismissed, setIsGameOverModalDismissed] = useState(false);

  const moveHistoryEndRef = useRef<HTMLDivElement>(null);

  // Sync chess.js instance from current FEN
  const chess = useMemo(() => {
    try {
      return new Chess(chessState?.fen || undefined);
    } catch {
      return new Chess();
    }
  }, [chessState?.fen]);

  // Keep read count updated when chat tab is open
  useEffect(() => {
    if (activeTab === 'CHAT') {
      setLastReadMessageCount(chatMessages?.length || 0);
    }
  }, [activeTab, chatMessages?.length]);

  const unreadChatCount =
    activeTab === 'CHAT'
      ? 0
      : Math.max(0, (chatMessages?.length || 0) - lastReadMessageCount);

  // Auto scroll move history
  useEffect(() => {
    if (activeTab === 'HISTORY') {
      moveHistoryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chessState?.moveHistory?.length, activeTab]);

  // Audio feedback on new move
  useEffect(() => {
    if (chessState?.lastMove) {
      if (chessState.isCheck) {
        chessSound.playCheck();
      } else if (chessState.lastMove.captured) {
        chessSound.playCapture();
      } else {
        chessSound.playMove();
      }
    }
  }, [chessState?.moveHistory?.length]);

  // AI Commentary audio notification
  useEffect(() => {
    if (chessState?.lastAiAnalysis) {
      chessSound.playAiCommentary();
    }
  }, [chessState?.lastAiAnalysis?.timestamp]);

  // Win confetti & audio
  useEffect(() => {
    if (chessState?.winnerSide) {
      if (chessState.winReason === 'TIMEOUT') {
        chessSound.playTimeout();
      } else {
        chessSound.playWin();
      }

      if (chessState.winnerSide !== 'DRAW') {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    } else {
      setIsGameOverModalDismissed(false);
    }
  }, [chessState?.winnerSide, chessState?.winReason]);

  // Compute legal moves for current selected square
  const legalMovesForSelected = useMemo(() => {
    if (!selectedSquare || !isMyTurn || isSpectator || !chessState || chessState.winnerSide) {
      return [];
    }
    try {
      return chess.moves({
        square: selectedSquare as any,
        verbose: true,
      });
    } catch {
      return [];
    }
  }, [selectedSquare, chess, isMyTurn, isSpectator, chessState?.winnerSide]);

  const legalTargetSquares = useMemo(() => {
    return new Set(legalMovesForSelected.map((m) => m.to));
  }, [legalMovesForSelected]);

  // Find king square that is in check
  const checkSquare = useMemo(() => {
    if (!chessState?.isCheck) return null;
    const turnColor = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turnColor) {
          const file = FILES[c];
          const rank = RANKS[r];
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }, [chessState?.isCheck, chess]);

  // Handle square click
  const handleSquareClick = (square: string) => {
    if (!chessState || chessState.winnerSide || isSpectator || !isMyTurn) return;
    setActionError(null);

    const piece = chess.get(square as any);
    const myPieceColor = mySide === 'WHITE' ? 'w' : 'b';

    // 1. If clicking on own piece -> select it
    if (piece && piece.color === myPieceColor) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
      } else {
        setSelectedSquare(square);
      }
      return;
    }

    // 2. If a piece was selected and clicking a target square
    if (selectedSquare) {
      if (legalTargetSquares.has(square)) {
        // Check if promotion is needed (Pawn moving to 8th rank for white or 1st rank for black)
        const selectedPiece = chess.get(selectedSquare as any);
        const isPawn = selectedPiece && selectedPiece.type === 'p';
        const isPromotion =
          isPawn &&
          ((mySide === 'WHITE' && square[1] === '8') ||
            (mySide === 'BLACK' && square[1] === '1'));

        if (isPromotion) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        executeMove(selectedSquare, square);
        setSelectedSquare(null);
      } else {
        setSelectedSquare(null);
      }
    }
  };

  const executeMove = (from: string, to: string, promotion?: string) => {
    setActionError(null);
    socket.emit(
      'GAME_CHESS_MOVE',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
        from,
        to,
        promotion,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Nước đi không hợp lệ');
        }
      }
    );
  };

  const handleConfirmPromotion = (pieceType: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    executeMove(pendingPromotion.from, pendingPromotion.to, pieceType);
    setPendingPromotion(null);
    setSelectedSquare(null);
  };

  // Surrender / Resign
  const handleResign = () => {
    setShowResignConfirm(false);
    setActionError(null);
    socket.emit(
      'GAME_CHESS_RESIGN',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể xin đầu hàng');
        }
      }
    );
  };

  // Draw offer
  const handleOfferDraw = () => {
    setShowDrawConfirm(false);
    setActionError(null);
    socket.emit(
      'GAME_CHESS_OFFER_DRAW',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể xin hòa');
        }
      }
    );
  };

  const handleRespondDraw = (accept: boolean) => {
    socket.emit(
      'GAME_CHESS_RESPOND_DRAW',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
        accept,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể xử lý yêu cầu hòa');
        }
      }
    );
  };

  const handleReturnToWaiting = () => {
    socket.emit('PLAYER_RETURN_TO_WAITING', {
      roomCode: roomState.code,
      playerId: myPlayerId,
    });
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.max(0, seconds) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Move Pairs for Move History Table
  const movePairs = useMemo(() => {
    const moves = chessState?.moveHistory || [];
    const pairs: { index: number; white?: string; black?: string }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        index: Math.floor(i / 2) + 1,
        white: moves[i]?.san,
        black: moves[i + 1]?.san,
      });
    }
    return pairs;
  }, [chessState?.moveHistory]);

  // Board coordinate rendering
  const displayFiles = isFlipped ? [...FILES].reverse() : FILES;
  const displayRanks = isFlipped ? [...RANKS].reverse() : RANKS;

  // Incoming draw offer from opponent
  const isIncomingDrawOffer =
    chessState?.drawOfferFrom &&
    mySide !== null &&
    chessState.drawOfferFrom !== mySide &&
    !chessState.winnerSide;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Top Header Navigation */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">♟️</span>
            <div>
              <h1 className="font-black text-sm text-white flex items-center gap-1.5">
                <span>CỜ VUA TIÊU CHUẨN</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-600 px-1.5 py-0.5 rounded font-bold">
                  FIDE 10M
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Phòng: <span className="font-mono font-bold text-amber-400">{roomState.code}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            title="Xoay hướng bàn cờ"
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xoay bàn</span>
          </button>

          <button
            onClick={() => setIsRuleModalOpen(true)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật chơi</span>
          </button>

          <button
            onClick={onLeaveRoom}
            className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời</span>
          </button>
        </div>
      </header>

      {/* Main Playing Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-7xl mx-auto w-full p-2 sm:p-4 gap-4">
        {/* Left / Center Board Column */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          {/* Top Player Bar (Opponent or Black if normal) */}
          <div className="w-full max-w-[560px] mb-2">
            {renderPlayerBar(isFlipped ? whitePlayer : blackPlayer, isFlipped ? 'WHITE' : 'BLACK')}
          </div>

          {/* Chess Board Container */}
          <div className="relative w-full max-w-[560px] aspect-square bg-[#779556] p-2 sm:p-3 rounded-2xl shadow-2xl border-4 border-stone-800 flex flex-col justify-center">
            {/* The 8x8 Grid */}
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-lg overflow-hidden border border-black/20">
              {displayRanks.map((rank, rIdx) =>
                displayFiles.map((file, fIdx) => {
                  const square = `${file}${rank}`;
                  const isLightSquare = (rIdx + fIdx) % 2 === 0;
                  const piece = chess.get(square as any);
                  const isSelected = selectedSquare === square;
                  const isLegalTarget = legalTargetSquares.has(square);
                  const isLastMove =
                    chessState?.lastMove &&
                    (chessState.lastMove.from === square || chessState.lastMove.to === square);
                  const isKingInCheck = checkSquare === square;

                  return (
                    <div
                      key={square}
                      onClick={() => handleSquareClick(square)}
                      className={`relative flex items-center justify-center cursor-pointer transition-colors ${
                        isLightSquare ? 'bg-[#ebecd0]' : 'bg-[#779556]'
                      } ${isSelected ? '!bg-[#f6f669]' : ''} ${
                        isLastMove && !isSelected ? '!bg-[#cdd26a]' : ''
                      } ${isKingInCheck ? '!bg-rose-500/80 animate-pulse' : ''}`}
                    >
                      {/* Rank Label on left column */}
                      {fIdx === 0 && (
                        <span
                          className={`absolute top-0.5 left-1 text-[10px] font-extrabold select-none ${
                            isLightSquare ? 'text-[#779556]' : 'text-[#ebecd0]'
                          }`}
                        >
                          {rank}
                        </span>
                      )}

                      {/* File Label on bottom row */}
                      {rIdx === 7 && (
                        <span
                          className={`absolute bottom-0.5 right-1 text-[10px] font-extrabold select-none ${
                            isLightSquare ? 'text-[#779556]' : 'text-[#ebecd0]'
                          }`}
                        >
                          {file}
                        </span>
                      )}

                      {/* Piece Icon */}
                      {piece && (
                        <div className="w-[84%] h-[84%] z-10 transition-transform active:scale-95 drop-shadow-md">
                          <ChessPieceSvg type={piece.type} color={piece.color} />
                        </div>
                      )}

                      {/* Move Hint: Empty square target */}
                      {isLegalTarget && !piece && (
                        <div className="absolute w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-black/25 z-20 pointer-events-none" />
                      )}

                      {/* Move Hint: Capture target */}
                      {isLegalTarget && piece && (
                        <div className="absolute inset-0 border-4 border-rose-500/70 rounded-full z-20 pointer-events-none" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Promotion Selection Modal */}
            {pendingPromotion && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 rounded-2xl flex flex-col items-center justify-center p-4">
                <h4 className="text-sm font-bold text-amber-300 mb-3 flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Chọn Quân Phong Cấp (Pawn Promotion)</span>
                </h4>
                <div className="grid grid-cols-4 gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-700">
                  {[
                    { type: 'q', label: 'Hậu' },
                    { type: 'r', label: 'Xe' },
                    { type: 'b', label: 'Tượng' },
                    { type: 'n', label: 'Mã' },
                  ].map((p) => (
                    <button
                      key={p.type}
                      onClick={() => handleConfirmPromotion(p.type as any)}
                      className="flex flex-col items-center p-3 bg-slate-800 hover:bg-amber-600/30 border border-slate-600 rounded-xl transition cursor-pointer group"
                    >
                      <div className="w-12 h-12 mb-1 group-hover:scale-110 transition">
                        <ChessPieceSvg
                          type={p.type as any}
                          color={mySide === 'WHITE' ? 'w' : 'b'}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300">
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPendingPromotion(null)}
                  className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 rounded-lg cursor-pointer"
                >
                  Hủy nước đi
                </button>
              </div>
            )}
          </div>

          {/* Bottom Player Bar (Me or White if normal) */}
          <div className="w-full max-w-[560px] mt-2">
            {renderPlayerBar(isFlipped ? blackPlayer : whitePlayer, isFlipped ? 'BLACK' : 'WHITE')}
          </div>

          {/* Duel Control Buttons for Active Players */}
          {!isSpectator && !chessState?.winnerSide && (
            <div className="w-full max-w-[560px] flex items-center justify-between gap-3 mt-3">
              <button
                onClick={() => setShowDrawConfirm(true)}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Handshake className="w-4 h-4" />
                <span>Xin Hòa</span>
              </button>

              <button
                onClick={() => setShowResignConfirm(true)}
                className="flex-1 py-2 px-3 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                <span>Đầu Hàng</span>
              </button>
            </div>
          )}

          {/* Action Error Message */}
          {actionError && (
            <div className="w-full max-w-[560px] mt-2 p-2 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
        </div>

        {/* Right Sidebar: AI Commentary, Move History, Chat & Spectators */}
        <div className="w-full lg:w-96 flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg h-[500px] lg:h-auto min-h-[460px]">
          {/* AI Commentary Spotlight Banner */}
          <div className="bg-gradient-to-r from-indigo-950/90 via-purple-950/80 to-slate-900 border-b border-indigo-900/50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                  <span>Trợ Lý AI Grandmaster</span>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </span>
              </div>
              <span className="text-[10px] bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 px-1.5 py-0.5 rounded font-mono">
                Gemini 2.5
              </span>
            </div>

            {chessState?.lastAiAnalysis ? (
              <div className="bg-indigo-950/60 border border-indigo-800/50 p-2.5 rounded-xl">
                <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold mb-1">
                  <span>Nhận định sau nước thứ {chessState.lastAiAnalysis.moveIndex}:</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {new Date(chessState.lastAiAnalysis.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed italic line-clamp-3">
                  "{chessState.lastAiAnalysis.text}"
                </p>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
                <Brain className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  Bot Gemini sẽ tự động nhận định thế cờ Đen &amp; Trắng sau mỗi 10 nước đi (nước hiện tại:{' '}
                  <strong className="text-indigo-300">{chessState?.moveHistory?.length || 0}</strong>)
                </span>
              </div>
            )}
          </div>

          {/* Sidebar Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 px-2 pt-2">
            <button
              onClick={() => setActiveTab('CHAT')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer relative ${
                activeTab === 'CHAT'
                  ? 'border-indigo-400 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Trò chuyện</span>
              {unreadChatCount > 0 && (
                <span className="w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Nước đi ({chessState?.moveHistory?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('SPECTATORS')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'SPECTATORS'
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Khán giả ({spectators.length}/4)</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'CHAT' && (
              <div className="flex-1 h-full min-h-0">
                <KhungChat
                  roomCode={roomState.code}
                  myPlayerId={myPlayerId}
                  messages={chatMessages}
                />
              </div>
            )}

            {activeTab === 'HISTORY' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {movePairs.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-500">
                    Chưa có nước đi nào. Trận đấu bắt đầu khi quân Trắng đi nước đầu tiên!
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <div className="grid grid-cols-6 bg-slate-950 p-2 font-bold text-slate-400 border-b border-slate-800">
                      <span className="col-span-1 text-center">#</span>
                      <span className="col-span-2 text-slate-200">Trắng (White)</span>
                      <span className="col-span-2 text-slate-200">Đen (Black)</span>
                      <span className="col-span-1 text-center text-slate-500">AI</span>
                    </div>
                    {movePairs.map((pair) => {
                      const isAiMove = (pair.index * 2) % 10 === 0 || (pair.index * 2 - 1) % 10 === 0;
                      return (
                        <div
                          key={pair.index}
                          className={`grid grid-cols-6 p-2 border-b border-slate-800/60 font-mono transition ${
                            pair.index % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900/80'
                          }`}
                        >
                          <span className="col-span-1 text-center text-slate-500 font-bold">
                            {pair.index}.
                          </span>
                          <span className="col-span-2 text-white font-semibold">{pair.white || '...'}</span>
                          <span className="col-span-2 text-slate-300 font-semibold">{pair.black || ''}</span>
                          <span className="col-span-1 text-center">
                            {isAiMove ? <Sparkles className="w-3 h-3 text-amber-400 inline" /> : null}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={moveHistoryEndRef} />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'SPECTATORS' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="text-xs text-slate-400 mb-2">
                  Phòng cho phép tối đa <strong>4 khán giả</strong> cùng theo dõi và đọc phân tích từ AI:
                </div>
                {spectators.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800 p-4">
                    Hiện chưa có khán giả nào. Bạn bè có thể nhập mã{' '}
                    <strong className="text-amber-400 font-mono">{roomState.code}</strong> để vào xem trực tiếp!
                  </div>
                ) : (
                  spectators.map((s, idx) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{s.avatar}</span>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{s.name}</span>
                            {s.id === myPlayerId && (
                              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1 rounded">
                                Bạn
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">Khán giả #{idx + 1}</span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-400">{s.score} xu</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Opponent Draw Offer Alert Modal */}
      {isIncomingDrawOffer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-600 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Handshake className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Lời Mời Cầu Hòa!</h3>
            <p className="text-xs text-slate-300 mt-2">
              Đối thủ vừa gửi đề nghị <strong>CẦU HÒA</strong>. Bạn có đồng ý kết thúc trận đấu với tỷ số hòa không?
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => handleRespondDraw(false)}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Từ chối
              </button>
              <button
                onClick={() => handleRespondDraw(true)}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Đồng ý hòa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resign Confirm Modal */}
      {showResignConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Flag className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Xác Nhận Đầu Hàng?</h3>
            <p className="text-xs text-slate-300 mt-2">
              Bạn có chắc chắn muốn xin đầu hàng ván cờ này không? Đối thủ sẽ được xử thắng và nhận +100 xu.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => setShowResignConfirm(false)}
                className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleResign}
                className="py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Đầu hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draw Offer Confirm Modal */}
      {showDrawConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Handshake className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Gửi Lời Cầu Hòa?</h3>
            <p className="text-xs text-slate-300 mt-2">
              Bạn muốn gửi lời xin hòa tới đối thủ? Trận đấu sẽ kết thúc hòa nếu đối phương đồng ý.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => setShowDrawConfirm(false)}
                className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleOfferDraw}
                className="py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Gửi lời xin hòa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {chessState?.winnerSide && !isGameOverModalDismissed && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center relative overflow-hidden">
            {/* Header icon */}
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/40">
              <Trophy className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-white">
              {chessState.winnerSide === 'DRAW'
                ? '🤝 TRẬN ĐẤU HÒA!'
                : `🏆 ${chessState.winnerSide === 'WHITE' ? 'QUÂN TRẮNG' : 'QUÂN ĐEN'} CHIẾN THẮNG!`}
            </h2>

            <p className="text-xs text-amber-300 font-medium mt-1">
              {chessState.winReason === 'CHECKMATE' && '👑 Chiếu bí đối phương (Checkmate)'}
              {chessState.winReason === 'TIMEOUT' && '⏰ Đối thủ hết thời gian suy nghĩ'}
              {chessState.winReason === 'RESIGN' && '🏳️ Đối thủ đã chủ động xin đầu hàng'}
              {chessState.winReason === 'AGREED_DRAW' && '🤝 Hai kỳ thủ đồng ý hòa cờ'}
              {chessState.winReason === 'STALEMATE' && 'Hết nước đi hợp lệ (Stalemate / Pat)'}
              {chessState.winReason === 'THREEFOLD' && 'Thế cờ lặp lại 3 lần'}
              {chessState.winReason === 'INSUFFICIENT_MATERIAL' && 'Không đủ lực lượng chiếu bí'}
              {chessState.winReason === '50_MOVES' && 'Luật 50 nước không ăn quân/đi tốt'}
            </p>

            {/* Players summary */}
            <div className="grid grid-cols-2 gap-3 my-5 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div
                className={`p-2.5 rounded-xl border ${
                  chessState.winnerSide === 'WHITE'
                    ? 'border-amber-500 bg-amber-950/30'
                    : 'border-slate-800'
                }`}
              >
                <div className="text-xl mb-1">{whitePlayer?.avatar || '⚪'}</div>
                <div className="text-xs font-bold text-white truncate">{whitePlayer?.name || 'Trắng'}</div>
                <div className="text-[10px] text-slate-400">Quân Trắng</div>
                {chessState.winnerSide === 'WHITE' && (
                  <span className="inline-block mt-1 text-[10px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full">
                    +100 xu
                  </span>
                )}
              </div>

              <div
                className={`p-2.5 rounded-xl border ${
                  chessState.winnerSide === 'BLACK'
                    ? 'border-amber-500 bg-amber-950/30'
                    : 'border-slate-800'
                }`}
              >
                <div className="text-xl mb-1">{blackPlayer?.avatar || '⚫'}</div>
                <div className="text-xs font-bold text-white truncate">{blackPlayer?.name || 'Đen'}</div>
                <div className="text-[10px] text-slate-400">Quân Đen</div>
                {chessState.winnerSide === 'BLACK' && (
                  <span className="inline-block mt-1 text-[10px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full">
                    +100 xu
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsGameOverModalDismissed(true)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Xem lại bàn cờ
              </button>

              <button
                onClick={handleReturnToWaiting}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer"
              >
                Về phòng chờ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule Guide Modal */}
      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        defaultRule="CO_VUA"
      />
    </div>
  );

  // Helper to render player info bar above / below the board
  function renderPlayerBar(
    player: typeof whitePlayer,
    side: 'WHITE' | 'BLACK'
  ) {
    if (!chessState) return null;
    const isWhite = side === 'WHITE';
    const isCurrentTurn = chessState.turn === side && !chessState.winnerSide;
    const timeRemaining = isWhite
      ? chessState.whiteTimeRemaining
      : chessState.blackTimeRemaining;
    const isLowTime = timeRemaining <= 30;

    return (
      <div
        className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
          isCurrentTurn
            ? 'bg-slate-900 border-amber-500 ring-2 ring-amber-500/20'
            : 'bg-slate-900/60 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="text-2xl">{player?.avatar || '👤'}</span>
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-black flex items-center justify-center text-[10px] ${
                isWhite ? 'bg-white text-slate-900 font-bold' : 'bg-slate-900 text-white border-white'
              }`}
            >
              {isWhite ? 'W' : 'B'}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
                {player?.name || (isWhite ? 'Chưa có quân Trắng' : 'Chưa có quân Đen')}
              </span>
              {player?.id === myPlayerId && (
                <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1 rounded">
                  Bạn
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="text-amber-400 font-mono font-bold">{player?.score ?? 1000} xu</span>
              <span>•</span>
              <span>{isWhite ? '⚪ Quân Trắng (Đi trước)' : '⚫ Quân Đen (Đi sau)'}</span>
            </div>
          </div>
        </div>

        {/* Timer countdown badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-black border transition ${
            isLowTime && isCurrentTurn
              ? 'bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse'
              : isCurrentTurn
              ? 'bg-amber-950 text-amber-300 border-amber-600'
              : 'bg-slate-950 text-slate-400 border-slate-800'
          }`}
        >
          <Clock className={`w-3.5 h-3.5 ${isCurrentTurn ? 'text-amber-400' : 'text-slate-500'}`} />
          <span>{formatTimer(timeRemaining)}</span>
        </div>
      </div>
    );
  }
};
