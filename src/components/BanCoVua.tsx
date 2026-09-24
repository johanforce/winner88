import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Chess } from 'chess.js';
import {
  Clock,
  LogOut,
  BookOpen,
  RotateCcw,
  AlertTriangle,
  Crown,
  Handshake,
  Flag,
  Trophy,
  History,
  MessageSquare,
  Users,
  ShieldAlert,
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

// Standard piece point values
const PIECE_VALS: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export const BanCoVua: React.FC<BanCoVuaProps> = ({
  roomState,
  myPlayerId,
  chatMessages,
  onLeaveRoom,
}) => {
  const chessState = roomState.chessState;
  const me = roomState.players.find((p) => p.id === myPlayerId);

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

  // Commentary sound cue for spectators only
  useEffect(() => {
    if (isSpectator && chessState?.lastAiAnalysis) {
      chessSound.playAiCommentary();
    }
  }, [chessState?.lastAiAnalysis?.timestamp, isSpectator]);

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

  // Calculate captured pieces and material score
  const { whiteCaptured, blackCaptured, whiteMaterialAdv, blackMaterialAdv } = useMemo(() => {
    const initialCounts: Record<string, number> = {
      p: 8,
      n: 2,
      b: 2,
      r: 2,
      q: 1,
    };

    const whiteCurrent: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    const blackCurrent: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

    let whiteScore = 0;
    let blackScore = 0;

    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece || piece.type === 'k') continue;
        const val = PIECE_VALS[piece.type] || 0;
        if (piece.color === 'w') {
          whiteCurrent[piece.type] = (whiteCurrent[piece.type] || 0) + 1;
          whiteScore += val;
        } else {
          blackCurrent[piece.type] = (blackCurrent[piece.type] || 0) + 1;
          blackScore += val;
        }
      }
    }

    const whiteCapturedList: { type: 'p' | 'n' | 'b' | 'r' | 'q'; count: number }[] = [];
    const blackCapturedList: { type: 'p' | 'n' | 'b' | 'r' | 'q'; count: number }[] = [];

    const order: ('q' | 'r' | 'b' | 'n' | 'p')[] = ['q', 'r', 'b', 'n', 'p'];
    for (const t of order) {
      const missingBlack = (initialCounts[t] || 0) - (blackCurrent[t] || 0);
      if (missingBlack > 0) {
        whiteCapturedList.push({ type: t, count: missingBlack });
      }
      const missingWhite = (initialCounts[t] || 0) - (whiteCurrent[t] || 0);
      if (missingWhite > 0) {
        blackCapturedList.push({ type: t, count: missingWhite });
      }
    }

    const diff = whiteScore - blackScore;

    return {
      whiteCaptured: whiteCapturedList,
      blackCaptured: blackCapturedList,
      whiteMaterialAdv: diff > 0 ? diff : 0,
      blackMaterialAdv: diff < 0 ? Math.abs(diff) : 0,
    };
  }, [chess]);

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
        const movingPiece = chess.get(selectedSquare as any);
        const isPawn = movingPiece && movingPiece.type === 'p';
        const isPromoting =
          isPawn &&
          ((mySide === 'WHITE' && square[1] === '8') ||
            (mySide === 'BLACK' && square[1] === '1'));

        if (isPromoting) {
          setPendingPromotion({ from: selectedSquare, to: square });
        } else {
          executeMove(selectedSquare, square);
          setSelectedSquare(null);
        }
      } else {
        setSelectedSquare(null);
      }
    }
  };

  const executeMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
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

  const isIncomingDrawOffer =
    chessState?.drawOfferFrom &&
    mySide &&
    chessState.drawOfferFrom !== mySide &&
    !chessState.winnerSide;

  return (
    <div className="min-h-screen bg-[#161512] text-slate-100 flex flex-col select-none">
      {/* Top Header Navigation */}
      <header className="bg-[#1f1e1b] border-b border-[#2d2b27] px-4 py-2.5 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl drop-shadow">♟️</span>
            <div>
              <h1 className="font-black text-sm text-white flex items-center gap-2">
                <span>CỜ VUA TIÊU CHUẨN</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.5 rounded font-bold">
                  15+10 RAPID
                </span>
                {isSpectator && (
                  <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700 px-1.5 py-0.5 rounded font-bold">
                    KHÁN GIẢ
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-stone-400">
                Phòng: <span className="font-mono font-bold text-amber-400">{roomState.code}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Flip Board */}
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            title="Xoay hướng bàn cờ"
            className="px-2.5 py-1.5 bg-[#2b2926] hover:bg-[#36332f] border border-[#3d3a36] rounded-xl text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xoay bàn</span>
          </button>

          {/* Rules Modal */}
          <button
            onClick={() => setIsRuleModalOpen(true)}
            className="px-2.5 py-1.5 bg-[#2b2926] hover:bg-[#36332f] border border-[#3d3a36] rounded-xl text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật chơi</span>
          </button>

          {/* Leave Button */}
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
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center overflow-hidden max-w-7xl mx-auto w-full p-2 sm:p-4 gap-5">
        {/* Left / Center Board Column */}
        <div className="flex flex-col items-center justify-center w-full max-w-[560px]">
          {/* Top Player Bar */}
          <div className="w-full mb-1.5">
            {renderPlayerBar(
              isFlipped ? whitePlayer : blackPlayer,
              isFlipped ? 'WHITE' : 'BLACK',
              isFlipped ? whiteCaptured : blackCaptured,
              isFlipped ? whiteMaterialAdv : blackMaterialAdv
            )}
          </div>

          {/* Exact Chess.com Green & Cream Chessboard from user image */}
          <div className="relative w-full aspect-square rounded-sm overflow-hidden shadow-2xl border border-black/30 select-none bg-[#779556]">
            {/* The 8x8 Grid */}
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
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
                      className={`relative flex items-center justify-center cursor-pointer select-none transition-colors duration-100 ${
                        isLightSquare ? 'bg-[#ebecd0]' : 'bg-[#779556]'
                      } ${
                        isSelected
                          ? '!bg-[#f5f682]'
                          : isLastMove
                          ? '!bg-[#bbcb2b]'
                          : ''
                      } ${
                        isKingInCheck
                          ? '!bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-600 via-red-600 to-rose-700/80 animate-pulse'
                          : ''
                      }`}
                    >
                      {/* Rank Label on left file squares (Top-Left corner) */}
                      {fIdx === 0 && (
                        <span
                          className={`absolute top-0.5 left-1 text-[11px] sm:text-xs font-black select-none pointer-events-none ${
                            isLightSquare ? 'text-[#779556]' : 'text-[#ebecd0]'
                          }`}
                        >
                          {rank}
                        </span>
                      )}

                      {/* File Label on bottom rank squares (Bottom-Right corner) */}
                      {rIdx === 7 && (
                        <span
                          className={`absolute bottom-0.5 right-1 text-[11px] sm:text-xs font-black select-none pointer-events-none ${
                            isLightSquare ? 'text-[#779556]' : 'text-[#ebecd0]'
                          }`}
                        >
                          {file}
                        </span>
                      )}

                      {/* Piece Icon matching user image */}
                      {piece && (
                        <div
                          className={`w-[90%] h-[90%] z-10 transition-transform duration-100 ${
                            isSelected ? 'scale-105 -translate-y-0.5' : 'active:scale-95'
                          }`}
                        >
                          <ChessPieceSvg type={piece.type} color={piece.color} />
                        </div>
                      )}

                      {/* King in Check Warning Icon */}
                      {isKingInCheck && (
                        <div className="absolute top-1 right-1 z-20 pointer-events-none animate-bounce">
                          <ShieldAlert className="w-3.5 h-3.5 text-white drop-shadow" />
                        </div>
                      )}

                      {/* Move Hint: Empty square target (Translucent grey disc) */}
                      {isLegalTarget && !piece && (
                        <div className="absolute w-[32%] h-[32%] rounded-full bg-black/18 z-20 pointer-events-none hover:scale-110 transition-transform" />
                      )}

                      {/* Move Hint: Capture target (Ring indicator) */}
                      {isLegalTarget && piece && (
                        <div className="absolute inset-0 border-[5px] border-black/20 rounded-full z-20 pointer-events-none animate-pulse" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Promotion Selection Modal */}
            {pendingPromotion && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-4">
                <h4 className="text-sm font-bold text-amber-300 mb-3 flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Chọn Quân Phong Cấp (Promotion)</span>
                </h4>
                <div className="grid grid-cols-4 gap-3 bg-[#262421] p-3 rounded-2xl border border-stone-600">
                  {[
                    { type: 'q', label: 'Hậu' },
                    { type: 'r', label: 'Xe' },
                    { type: 'b', label: 'Tượng' },
                    { type: 'n', label: 'Mã' },
                  ].map((p) => (
                    <button
                      key={p.type}
                      onClick={() => handleConfirmPromotion(p.type as any)}
                      className="flex flex-col items-center p-3 bg-[#312e2b] hover:bg-[#3f3b37] border border-stone-600 rounded-xl transition cursor-pointer group"
                    >
                      <div className="w-12 h-12 mb-1 group-hover:scale-110 transition">
                        <ChessPieceSvg
                          type={p.type as any}
                          color={mySide === 'WHITE' ? 'w' : 'b'}
                        />
                      </div>
                      <span className="text-xs font-bold text-stone-200 group-hover:text-amber-300">
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPendingPromotion(null)}
                  className="mt-4 px-4 py-1.5 bg-[#312e2b] hover:bg-[#3f3b37] text-xs text-stone-400 rounded-lg cursor-pointer"
                >
                  Hủy nước đi
                </button>
              </div>
            )}
          </div>

          {/* Bottom Player Bar */}
          <div className="w-full mt-1.5">
            {renderPlayerBar(
              isFlipped ? blackPlayer : whitePlayer,
              isFlipped ? 'BLACK' : 'WHITE',
              isFlipped ? blackCaptured : whiteCaptured,
              isFlipped ? blackMaterialAdv : whiteMaterialAdv
            )}
          </div>

          {/* Duel Control Buttons for Active Players */}
          {!isSpectator && !chessState?.winnerSide && (
            <div className="w-full flex items-center justify-between gap-3 mt-2.5">
              <button
                onClick={() => setShowDrawConfirm(true)}
                className="flex-1 py-2 px-3 bg-[#262421] hover:bg-[#312e2b] border border-[#3d3a36] text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
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
            <div className="w-full mt-2 p-2 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
        </div>

        {/* Right Sidebar: Fixed Width & Controlled Height with Full Scrollability */}
        <div className="w-full lg:w-[380px] lg:min-w-[380px] lg:max-w-[380px] shrink-0 flex flex-col bg-[#21201d] border border-[#312e2b] rounded-2xl overflow-hidden shadow-2xl h-[560px] sm:h-[600px] lg:h-[640px] max-h-[calc(100vh-120px)]">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-[#312e2b] bg-[#1a1917] px-2 pt-2 shrink-0">
            <button
              onClick={() => setActiveTab('CHAT')}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer relative ${
                activeTab === 'CHAT'
                  ? 'border-emerald-400 text-emerald-300 bg-[#262421]/60'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
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
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'border-amber-400 text-amber-300 bg-[#262421]/60'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Nước đi ({chessState?.moveHistory?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('SPECTATORS')}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'SPECTATORS'
                  ? 'border-indigo-400 text-indigo-300 bg-[#262421]/60'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Khán giả ({spectators.length}/4)</span>
            </button>
          </div>

          {/* Tab Content Area: flex-1 min-h-0 guarantees scrollability! */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeTab === 'CHAT' && (
              <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
                <KhungChat
                  roomCode={roomState.code}
                  myPlayerId={myPlayerId}
                  messages={chatMessages}
                  isSpectator={isSpectator}
                  hideHeader={true}
                />
              </div>
            )}

            {activeTab === 'HISTORY' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-stone-700">
                {movePairs.length === 0 ? (
                  <div className="text-center py-12 text-xs text-stone-500">
                    Chưa có nước đi nào. Ván cờ bắt đầu khi quân Trắng xuất phát!
                  </div>
                ) : (
                  <div className="border border-stone-700 rounded-xl overflow-hidden text-xs">
                    <div className="grid grid-cols-5 bg-[#1a1917] p-2 font-bold text-stone-400 border-b border-stone-700">
                      <span className="col-span-1 text-center">#</span>
                      <span className="col-span-2 text-stone-200">Trắng (White)</span>
                      <span className="col-span-2 text-stone-200">Đen (Black)</span>
                    </div>
                    {movePairs.map((pair) => (
                      <div
                        key={pair.index}
                        className={`grid grid-cols-5 p-2 border-b border-stone-800 font-mono transition ${
                          pair.index % 2 === 0 ? 'bg-[#262421]' : 'bg-[#1e1d1b]'
                        }`}
                      >
                        <span className="col-span-1 text-center text-stone-500 font-bold">
                          {pair.index}.
                        </span>
                        <span className="col-span-2 text-white font-semibold">{pair.white || '...'}</span>
                        <span className="col-span-2 text-stone-300 font-semibold">{pair.black || ''}</span>
                      </div>
                    ))}
                    <div ref={moveHistoryEndRef} />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'SPECTATORS' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-stone-700">
                <div className="text-xs text-stone-400 mb-2">
                  Phòng hỗ trợ tối đa <strong>4 khán giả</strong> theo dõi ván cờ trực tiếp:
                </div>
                {spectators.length === 0 ? (
                  <div className="text-center py-8 text-xs text-stone-500 bg-[#1a1917] rounded-xl border border-stone-800 p-4">
                    Hiện chưa có khán giả nào. Bạn bè có thể nhập mã{' '}
                    <strong className="text-amber-400 font-mono">{roomState.code}</strong> để vào xem trực tiếp!
                  </div>
                ) : (
                  spectators.map((s, idx) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 bg-[#262421] border border-stone-700 rounded-xl"
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
                          <span className="text-[10px] text-stone-400">Khán giả #{idx + 1}</span>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#262421] border border-amber-600 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Handshake className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Lời Mời Cầu Hòa!</h3>
            <p className="text-xs text-stone-300 mt-2">
              Đối thủ vừa gửi đề nghị <strong>CẦU HÒA</strong>. Bạn có đồng ý kết thúc trận đấu với tỷ số hòa không?
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => handleRespondDraw(false)}
                className="py-2.5 bg-[#36332f] hover:bg-[#45423d] text-stone-300 font-bold text-xs rounded-xl cursor-pointer"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#262421] border border-rose-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Flag className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Xác Nhận Đầu Hàng?</h3>
            <p className="text-xs text-stone-300 mt-2">
              Bạn có chắc chắn muốn xin đầu hàng ván cờ này không? Đối thủ sẽ được xử thắng và nhận +100 xu.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => setShowResignConfirm(false)}
                className="py-2 bg-[#36332f] hover:bg-[#45423d] text-stone-300 font-bold text-xs rounded-xl cursor-pointer"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#262421] border border-amber-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Handshake className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Gửi Lời Cầu Hòa?</h3>
            <p className="text-xs text-stone-300 mt-2">
              Bạn muốn gửi lời xin hòa tới đối thủ? Trận đấu sẽ kết thúc hòa nếu đối phương đồng ý.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => setShowDrawConfirm(false)}
                className="py-2 bg-[#36332f] hover:bg-[#45423d] text-stone-300 font-bold text-xs rounded-xl cursor-pointer"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#262421] border-2 border-amber-500/80 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center relative overflow-hidden">
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
            <div className="grid grid-cols-2 gap-3 my-5 bg-[#1a1917] p-4 rounded-2xl border border-stone-800">
              <div
                className={`p-2.5 rounded-xl border ${
                  chessState.winnerSide === 'WHITE'
                    ? 'border-amber-500 bg-amber-950/30'
                    : 'border-stone-800'
                }`}
              >
                <div className="text-xl mb-1">{whitePlayer?.avatar || '⚪'}</div>
                <div className="text-xs font-bold text-white truncate">{whitePlayer?.name || 'Trắng'}</div>
                <div className="text-[10px] text-stone-400">Quân Trắng</div>
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
                    : 'border-stone-800'
                }`}
              >
                <div className="text-xl mb-1">{blackPlayer?.avatar || '⚫'}</div>
                <div className="text-xs font-bold text-white truncate">{blackPlayer?.name || 'Đen'}</div>
                <div className="text-[10px] text-stone-400">Quân Đen</div>
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
                className="flex-1 py-3 bg-[#36332f] hover:bg-[#45423d] text-stone-300 font-bold text-xs rounded-xl cursor-pointer"
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
    side: 'WHITE' | 'BLACK',
    capturedPieces: { type: 'p' | 'n' | 'b' | 'r' | 'q'; count: number }[],
    materialAdvantage: number
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
        className={`flex items-center justify-between p-2 rounded-xl border transition duration-150 ${
          isCurrentTurn
            ? 'bg-[#262421] border-emerald-500/80 ring-1 ring-emerald-500/30 shadow-md'
            : 'bg-[#1f1e1b] border-[#312e2b]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <span className="text-xl drop-shadow">{player?.avatar || '👤'}</span>
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] font-black ${
                isWhite
                  ? 'bg-white text-slate-900 border-black'
                  : 'bg-stone-900 text-white border-white'
              }`}
            >
              {isWhite ? 'W' : 'B'}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[180px]">
                {player?.name || (isWhite ? 'Chưa có quân Trắng' : 'Chưa có quân Đen')}
              </span>
              {player?.id === myPlayerId && (
                <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1 rounded shrink-0 font-bold">
                  Bạn
                </span>
              )}
            </div>

            {/* Sub-info: Score & Captured pieces tray */}
            <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mt-0.5 flex-wrap">
              <span className="text-amber-400 font-mono font-bold">{player?.score ?? 1000} xu</span>
              <span>•</span>

              {/* Captured piece icons */}
              <div className="flex items-center gap-1">
                {capturedPieces.map((cap) => (
                  <div key={cap.type} className="flex items-center text-[10px] text-stone-300">
                    <div className="w-3.5 h-3.5 inline-block">
                      <ChessPieceSvg
                        type={cap.type}
                        color={isWhite ? 'b' : 'w'}
                        className="w-full h-full"
                      />
                    </div>
                    {cap.count > 1 && <span className="font-mono text-[9px]">x{cap.count}</span>}
                  </div>
                ))}

                {/* Material score difference badge */}
                {materialAdvantage > 0 && (
                  <span className="ml-1 px-1 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-mono font-bold">
                    +{materialAdvantage}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timer countdown badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-black border transition shrink-0 ${
            isLowTime && isCurrentTurn
              ? 'bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse ring-2 ring-rose-500/30'
              : isCurrentTurn
              ? 'bg-[#2e2b27] text-white border-emerald-600'
              : 'bg-[#181715] text-stone-400 border-stone-800'
          }`}
        >
          <Clock className={`w-3.5 h-3.5 ${isCurrentTurn ? 'text-emerald-400' : 'text-stone-500'}`} />
          <span>{formatTimer(timeRemaining)}</span>
          <span className="text-[10px] text-emerald-400 font-bold opacity-85">(+10s)</span>
        </div>
      </div>
    );
  }
};
