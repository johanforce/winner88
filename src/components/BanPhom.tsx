import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  LogOut,
  BookOpen,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Crown,
  Zap,
  RotateCcw,
  Coins,
  ShieldAlert,
  Trophy,
  ArrowRight,
  Plus,
} from 'lucide-react';
import {
  RoomPublicState,
  Card,
  PlayerPublicInfo,
  ChatMessage,
  PhomMeld,
} from '../types';
import { socket } from '../socket';
import { CardView } from './CardView';
import { KhungChat } from './KhungChat';
import { RuleGuideModal } from './RuleGuideModal';
import {
  isValidPhom,
  findBestPhomPartition,
  canEatCardWithHand,
  getRankLabel,
  SUIT_SYMBOLS,
} from '../utils/phomLogic';
import { useVoiceChat } from '../context/VoiceChatContext';

interface BanPhomProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  playerCards: Card[];
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
}

export const BanPhom: React.FC<BanPhomProps> = ({
  roomState,
  myPlayerId,
  playerCards,
  chatMessages,
  onLeaveRoom,
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(chatMessages.length);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { participants: voiceParticipants, speakingMap } = useVoiceChat();

  useEffect(() => {
    if (isChatOpen) {
      setLastReadMessageCount(chatMessages.length);
    }
  }, [isChatOpen, chatMessages.length]);

  const unreadChatCount = isChatOpen ? 0 : Math.max(0, chatMessages.length - lastReadMessageCount);

  // Clear selection when turn step changes or intercept window closes
  useEffect(() => {
    setSelectedCardIds([]);
    setActionError(null);
  }, [roomState.phomState?.turnStep, roomState.currentTurnPlayerId]);

  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost || false;
  const isMyTurn = roomState.currentTurnPlayerId === myPlayerId;
  const isGameFinished = roomState.status === 'FINISHED';
  const phomState = roomState.phomState;
  const interceptWindow = phomState?.interceptWindow;

  // Determine seats relative to "me" (clockwise: Me -> Left -> Top -> Right)
  const sortedPlayers = useMemo(() => {
    if (!me) return roomState.players;
    const myIndex = roomState.players.findIndex((p) => p.id === myPlayerId);
    if (myIndex === -1) return roomState.players;
    const count = roomState.players.length;
    const list: (PlayerPublicInfo | null)[] = [];
    for (let i = 0; i < 4; i++) {
      const idx = (myIndex + i) % count;
      list.push(roomState.players[idx] || null);
    }
    return list;
  }, [roomState.players, myPlayerId, me]);

  const playerBottom = sortedPlayers[0]; // Me
  const playerLeft = sortedPlayers[1];
  const playerTop = sortedPlayers[2];
  const playerRight = sortedPlayers[3];

  // Top card of discard pile
  const topDiscard = useMemo(() => {
    if (!phomState?.discardPile || phomState.discardPile.length === 0) return null;
    return phomState.discardPile[phomState.discardPile.length - 1];
  }, [phomState?.discardPile]);

  // Melds grouped by player
  const playerMeldsMap = useMemo(() => {
    const map: Record<string, PhomMeld[]> = {};
    if (phomState?.melds) {
      for (const m of phomState.melds) {
        if (!map[m.playerId]) map[m.playerId] = [];
        map[m.playerId].push(m);
      }
    }
    return map;
  }, [phomState?.melds]);

  // Check if active player can eat the top discarded card
  const canEatTopDiscard = useMemo(() => {
    if (!isMyTurn || !topDiscard || phomState?.turnStep !== 'DRAW_OR_EAT') return false;
    if (topDiscard.discardedByPlayerId === myPlayerId) return false;
    return canEatCardWithHand(topDiscard.card, playerCards);
  }, [isMyTurn, topDiscard, phomState?.turnStep, myPlayerId, playerCards]);

  // Check if selected cards form a valid phỏm with top discard
  const isSelectedPhomValidWithTopDiscard = useMemo(() => {
    if (selectedCardIds.length !== 2 || !topDiscard) return false;
    const c1 = playerCards.find((c) => c.id === selectedCardIds[0]);
    const c2 = playerCards.find((c) => c.id === selectedCardIds[1]);
    if (!c1 || !c2) return false;
    return isValidPhom([c1, c2, topDiscard.card]).isValid;
  }, [selectedCardIds, topDiscard, playerCards]);

  // Check if user can intercept (chặt) the currently intercepted card
  const canInterceptCurrentCard = useMemo(() => {
    if (!interceptWindow) return false;
    if (interceptWindow.discardedByPlayerId === myPlayerId) return false;
    return canEatCardWithHand(interceptWindow.card, playerCards);
  }, [interceptWindow, myPlayerId, playerCards]);

  const isSelectedPhomValidForIntercept = useMemo(() => {
    if (!interceptWindow || selectedCardIds.length !== 2) return false;
    const c1 = playerCards.find((c) => c.id === selectedCardIds[0]);
    const c2 = playerCards.find((c) => c.id === selectedCardIds[1]);
    if (!c1 || !c2) return false;
    return isValidPhom([c1, c2, interceptWindow.card]).isValid;
  }, [interceptWindow, selectedCardIds, playerCards]);

  // Helper phom analysis on hand
  const handPartition = useMemo(() => {
    return findBestPhomPartition(playerCards);
  }, [playerCards]);

  // Card selection toggle
  const handleToggleCard = (cardId: string) => {
    setActionError(null);
    setSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  // Actions
  const handleDrawCard = () => {
    setActionError(null);
    socket.emit(
      'PHOM_DRAW_CARD',
      { roomCode: roomState.code, playerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể bốc bài');
        }
      }
    );
  };

  const handleEatCard = () => {
    setActionError(null);
    if (selectedCardIds.length !== 2) {
      setActionError('Hãy chọn đúng 2 lá bài trên tay để ghép phỏm với lá ngửa!');
      return;
    }
    socket.emit(
      'PHOM_EAT_CARD',
      { roomCode: roomState.code, playerId: myPlayerId, handCardIds: selectedCardIds },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể ăn bài');
        } else {
          setSelectedCardIds([]);
        }
      }
    );
  };

  const handleDiscardCard = () => {
    setActionError(null);
    if (selectedCardIds.length !== 1) {
      setActionError('Hãy chọn 1 lá bài trên tay để đánh ra!');
      return;
    }
    const cardId = selectedCardIds[0];
    if (phomState?.eatenCardThisTurnId === cardId) {
      setActionError('Không được đánh ra lá bài vừa ăn được!');
      return;
    }
    socket.emit(
      'PHOM_DISCARD_CARD',
      { roomCode: roomState.code, playerId: myPlayerId, cardId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể đánh lá bài này');
        } else {
          setSelectedCardIds([]);
        }
      }
    );
  };

  const handleIntercept = () => {
    setActionError(null);
    if (selectedCardIds.length !== 2) {
      setActionError('Hãy chọn đúng 2 lá trên tay tạo phỏm để CHẶT!');
      return;
    }
    socket.emit(
      'PHOM_INTERCEPT',
      { roomCode: roomState.code, playerId: myPlayerId, handCardIds: selectedCardIds },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể chặt bài');
        } else {
          setSelectedCardIds([]);
        }
      }
    );
  };

  const handleAddCoins = () => {
    socket.emit('PLAYER_ADD_COINS', { roomCode: roomState.code, playerId: myPlayerId, amount: 500 });
  };

  const handleStartNextGame = () => {
    socket.emit(
      'ROOM_START_GAME',
      { roomCode: roomState.code, requestedByPlayerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể bắt đầu ván mới');
        }
      }
    );
  };

  const handleResetToWaiting = () => {
    socket.emit(
      'ROOM_RESET_TO_WAITING',
      { roomCode: roomState.code, requestedByPlayerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể quay lại phòng chờ');
        }
      }
    );
  };

  // Render a player badge/info pod
  const renderPlayerPod = (player: PlayerPublicInfo | null, position: 'top' | 'left' | 'right') => {
    if (!player) return null;
    const isTurn = roomState.currentTurnPlayerId === player.id;
    const isSpeaking = speakingMap[player.id];
    const melds = playerMeldsMap[player.id] || [];
    const chattedCount = phomState?.chattedCounts[player.id] || 0;

    return (
      <div
        className={`flex flex-col items-center p-2 sm:p-3 rounded-2xl transition-all ${
          isTurn
            ? 'bg-purple-950/80 border-2 border-purple-500 ring-4 ring-purple-500/20 shadow-lg'
            : 'bg-slate-900/85 border border-slate-800'
        }`}
      >
        <div className="relative">
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-xl sm:text-2xl shadow">
            {player.avatar}
          </div>
          {player.isHost && (
            <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 p-1 rounded-full shadow">
              <Crown className="w-3 h-3" />
            </div>
          )}
          {isTurn && (
            <div className="absolute -bottom-1 -left-1 bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-bounce shadow">
              LƯỢT
            </div>
          )}
        </div>

        <div className="mt-1 text-center max-w-[90px] sm:max-w-[120px]">
          <div className="text-xs font-bold text-white truncate">{player.name}</div>
          <div className="text-[11px] text-amber-400 font-semibold flex items-center justify-center gap-1">
            <Coins className="w-3 h-3" />
            <span>{player.score} xu</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {player.cardCount} lá trên tay
          </div>
          {chattedCount > 0 && (
            <span className="inline-block mt-0.5 text-[9px] bg-rose-950 text-rose-300 border border-rose-800 px-1 py-0.2 rounded font-bold">
              Bị chặt: {chattedCount}
            </span>
          )}
        </div>

        {/* Melds hạ của đối thủ */}
        {melds.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 w-full max-w-[160px]">
            {melds.map((m) => (
              <div
                key={m.id}
                className="bg-slate-950/70 border border-purple-800/60 rounded-lg p-1 text-center"
              >
                <div className="text-[9px] text-purple-300 font-bold uppercase">
                  {m.type === 'STRAIGHT' ? 'Sảnh' : 'Sáp'}
                </div>
                <div className="flex items-center justify-center gap-0.5">
                  {m.cards.map((c) => (
                    <span
                      key={c.id}
                      className={`text-[10px] font-bold ${
                        c.suit === 'HEART' || c.suit === 'DIAMOND'
                          ? 'text-rose-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {getRankLabel(c.rank)}
                      {SUIT_SYMBOLS[c.suit]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-radial from-slate-900 via-slate-950 to-stone-950 flex flex-col text-slate-100 select-none overflow-x-hidden">
      {/* Top Header */}
      <header className="border-b border-purple-900/30 bg-slate-950/80 backdrop-blur-md px-3 sm:px-5 py-2.5 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl">
            <span className="text-xs text-slate-400">Phòng:</span>
            <span className="font-black text-amber-400 text-sm tracking-wider">
              {roomState.code}
            </span>
          </div>

          <div className="bg-purple-950/60 border border-purple-800/60 px-2.5 py-1 rounded-xl text-xs font-bold text-purple-300 flex items-center gap-1.5">
            <span>🎴 Phỏm (Tá Lả)</span>
            <span className="text-[10px] bg-purple-900 text-purple-200 px-1.5 py-0.2 rounded font-mono">
              Ván #{roomState.gameNumber}
            </span>
          </div>

          {/* Turn countdown */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className={roomState.turnTimeRemaining <= 5 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}>
              {roomState.turnTimeRemaining}s
            </span>
          </div>

          {/* Coin Top-up Helper */}
          <button
            type="button"
            onClick={handleAddCoins}
            title="Nhận thêm 500 xu để chơi"
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition cursor-pointer"
          >
            <Coins className="w-3 h-3 text-amber-400" />
            <span>+500 xu</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRuleModalOpen(true)}
            className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-1 transition cursor-pointer"
            title="Luật chơi Phỏm"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật chơi</span>
          </button>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="relative p-1.5 sm:px-3 sm:py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-1 transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Chat</span>
            {unreadChatCount > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow">
                {unreadChatCount}
              </span>
            )}
          </button>

          <button
            onClick={onLeaveRoom}
            className="p-1.5 sm:px-3 sm:py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-1 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rời bàn</span>
          </button>
        </div>
      </header>

      {/* Main Table Arena */}
      <main className="flex-1 flex flex-col items-center justify-between p-2 sm:p-4 max-w-6xl w-full mx-auto relative">
        {/* Top Player */}
        <div className="w-full flex justify-center">{renderPlayerPod(playerTop, 'top')}</div>

        {/* Middle Row: Left Player, Center Table Arena, Right Player */}
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4 my-auto">
          {/* Left Player */}
          <div className="w-24 sm:w-36 flex justify-start">{renderPlayerPod(playerLeft, 'left')}</div>

          {/* SÂN ĐẤU TRUNG TÂM (CENTER TABLE) */}
          <div className="flex-1 max-w-xl mx-auto flex flex-col items-center justify-center p-3 sm:p-5 rounded-3xl bg-slate-950/60 border border-slate-800/80 shadow-2xl relative">
            {/* 5-SECOND INTERCEPT WINDOW ALERT */}
            {interceptWindow && (
              <div className="w-full mb-3 p-3 rounded-2xl bg-gradient-to-r from-rose-950/90 via-purple-950/90 to-rose-950/90 border-2 border-rose-500 ring-4 ring-rose-500/30 animate-pulse shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-left">
                  <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                    <ShieldAlert className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-1.5">
                      <span>CỬA SỔ CHẶT BÀI 5 GIÂY</span>
                      <span className="bg-rose-500 text-white px-1.5 py-0.2 rounded font-mono text-[11px]">
                        {interceptWindow.secondsRemaining}s
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-200 mt-0.5">
                      {interceptWindow.discardedByPlayerName} vừa đánh lá{' '}
                      <strong className="text-amber-300 font-bold">
                        {getRankLabel(interceptWindow.card.rank)}
                        {SUIT_SYMBOLS[interceptWindow.card.suit]}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Chặt bài action button */}
                {interceptWindow.discardedByPlayerId !== myPlayerId && (
                  <button
                    type="button"
                    onClick={handleIntercept}
                    disabled={!isSelectedPhomValidForIntercept}
                    className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow transition cursor-pointer shrink-0 ${
                      isSelectedPhomValidForIntercept
                        ? 'bg-rose-500 hover:bg-rose-400 text-white ring-2 ring-white animate-bounce'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    <span>CHẶT BÀI NGAY! (Chọn 2 lá)</span>
                  </button>
                )}
              </div>
            )}

            {/* Deck & Discard Pile Container */}
            <div className="flex items-center justify-center gap-6 sm:gap-12 w-full py-2">
              {/* Nọc bài (Draw Pile) */}
              <div className="flex flex-col items-center">
                <div className="relative cursor-pointer group" onClick={isMyTurn && phomState?.turnStep === 'DRAW_OR_EAT' ? handleDrawCard : undefined}>
                  {/* Stacked cards effect */}
                  <div className="w-16 h-22 sm:w-20 sm:h-28 rounded-xl bg-purple-950 border-2 border-purple-700/60 shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-800/40 via-transparent to-black/60" />
                    <span className="text-2xl sm:text-3xl mb-1">🎴</span>
                    <span className="text-[11px] font-black text-purple-200">
                      {phomState?.deckCount ?? 0} lá
                    </span>
                  </div>

                  {isMyTurn && phomState?.turnStep === 'DRAW_OR_EAT' && (
                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow animate-bounce">
                      BỐC
                    </div>
                  )}
                </div>

                <span className="text-[11px] text-slate-400 font-semibold mt-1.5">
                  Nọc bài
                </span>
              </div>

              {/* Đống bài rác / Lá đánh ra (Discard Pile) */}
              <div className="flex flex-col items-center">
                {topDiscard ? (
                  <div className="relative flex flex-col items-center">
                    <div className="transform hover:scale-105 transition shadow-2xl">
                      <CardView card={topDiscard.card} size="md" />
                    </div>

                    <div className="mt-1.5 text-center">
                      <span className="text-[10px] text-slate-400 block">
                        Đánh bởi: <strong className="text-slate-200">{topDiscard.discardedByPlayerName}</strong>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-22 sm:w-20 sm:h-28 rounded-xl border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-xs">
                    Trống
                  </div>
                )}
                <span className="text-[11px] text-slate-400 font-semibold mt-1">
                  Bài rác trên bàn ({phomState?.discardPile.length ?? 0})
                </span>
              </div>
            </div>

            {/* Turn Prompt Guidance */}
            {isMyTurn && (
              <div className="mt-3 px-3 py-1.5 rounded-xl bg-purple-950/80 border border-purple-600/40 text-center">
                <span className="text-xs font-bold text-purple-200">
                  {phomState?.turnStep === 'DRAW_OR_EAT'
                    ? '👉 Bước 1: Bốc 1 lá từ nọc HOẶC chọn 2 lá trên tay để Ăn bài!'
                    : '👉 Bước 2: Chọn 1 lá bài rác trên tay và bấm Đánh Bài!'}
                </span>
              </div>
            )}
          </div>

          {/* Right Player */}
          <div className="w-24 sm:w-36 flex justify-end">{renderPlayerPod(playerRight, 'right')}</div>
        </div>

        {/* Bottom Section: My Hand & Controls */}
        <div className="w-full flex flex-col items-center mt-2 sm:mt-4 z-10">
          {/* Error Banner */}
          {actionError && (
            <div className="mb-2 px-3 py-1 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5 shadow">
              <AlertCircle className="w-4 h-4" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Action Control Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap justify-center">
            {/* Step 1: Ăn bài button */}
            {isMyTurn && phomState?.turnStep === 'DRAW_OR_EAT' && (
              <>
                <button
                  type="button"
                  id="btn-phom-eat"
                  onClick={handleEatCard}
                  disabled={!isSelectedPhomValidWithTopDiscard}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-lg transition cursor-pointer ${
                    isSelectedPhomValidWithTopDiscard
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <span>Ăn Bài (Hạ Phỏm)</span>
                </button>

                <button
                  type="button"
                  id="btn-phom-draw"
                  onClick={handleDrawCard}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Bốc 1 Lá Từ Nọc</span>
                </button>
              </>
            )}

            {/* Step 2: Đánh bài rác button */}
            {isMyTurn && phomState?.turnStep === 'DISCARD' && (
              <button
                type="button"
                id="btn-phom-discard"
                onClick={handleDiscardCard}
                disabled={selectedCardIds.length !== 1}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-lg transition cursor-pointer ${
                  selectedCardIds.length === 1
                    ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-400'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                <span>Đánh Lá Đã Chọn</span>
              </button>
            )}

            {/* Intercept button fallback in controls */}
            {interceptWindow && interceptWindow.discardedByPlayerId !== myPlayerId && (
              <button
                type="button"
                id="btn-phom-intercept-bar"
                onClick={handleIntercept}
                disabled={!isSelectedPhomValidForIntercept}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow transition cursor-pointer ${
                  isSelectedPhomValidForIntercept
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400 animate-bounce'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                <Zap className="w-4 h-4 text-rose-300" />
                <span>CHẶT ({interceptWindow.secondsRemaining}s)</span>
              </button>
            )}
          </div>

          {/* Phỏm đã hạ của TÔI */}
          {playerMeldsMap[myPlayerId] && playerMeldsMap[myPlayerId].length > 0 && (
            <div className="mb-2 flex items-center gap-2 flex-wrap justify-center">
              <span className="text-[11px] font-bold text-purple-300">Phỏm của bạn đã hạ:</span>
              {playerMeldsMap[myPlayerId].map((m) => (
                <div
                  key={m.id}
                  className="bg-purple-950/80 border border-purple-600/60 rounded-xl px-2.5 py-1 flex items-center gap-1 shadow"
                >
                  <span className="text-[10px] text-purple-300 font-bold uppercase mr-1">
                    {m.type === 'STRAIGHT' ? 'Sảnh' : 'Sáp'}:
                  </span>
                  {m.cards.map((c) => (
                    <span
                      key={c.id}
                      className={`text-xs font-bold ${
                        c.suit === 'HEART' || c.suit === 'DIAMOND'
                          ? 'text-rose-400'
                          : 'text-white'
                      }`}
                    >
                      {getRankLabel(c.rank)}
                      {SUIT_SYMBOLS[c.suit]}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Bài trên tay của Tôi */}
          <div className="w-full flex flex-col items-center">
            <div className="flex items-center justify-center -space-x-4 sm:-space-x-6 overflow-x-auto max-w-full p-2 py-4">
              {playerCards.map((card) => {
                const isSelected = selectedCardIds.includes(card.id);
                const isEatenThisTurn = phomState?.eatenCardThisTurnId === card.id;

                return (
                  <div
                    key={card.id}
                    onClick={() => handleToggleCard(card.id)}
                    className={`transform transition-all duration-200 cursor-pointer ${
                      isSelected ? '-translate-y-4 scale-105 z-20' : 'hover:-translate-y-2 z-10'
                    }`}
                  >
                    <div className="relative">
                      <CardView card={card} isSelected={isSelected} size="md" />
                      {isEatenThisTurn && (
                        <span className="absolute -bottom-2 inset-x-0 mx-auto bg-purple-700 text-white text-[8px] font-bold px-1 rounded text-center truncate">
                          Vừa ăn
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* My Info Bar */}
            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-4 py-1.5 rounded-2xl text-xs shadow-md">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="text-base">{me?.avatar}</span>
                <span>{me?.name} (Bạn)</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                <span>{me?.score} xu</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-purple-300 font-semibold">
                Bài rác: {handPartition.unmeldedPoints} điểm
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* RESULT MODAL (KHI KẾT THÚC VÁN PHỎM) */}
      {isGameFinished && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border-2 border-purple-500/80 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl relative">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-purple-950 border border-purple-600 flex items-center justify-center mx-auto mb-2 text-2xl shadow">
                🏆
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {phomState?.winReason === 'U_TRANG'
                  ? 'Ù TRẮNG (Ù TỰ NHIÊN - THƯỞNG X2 XU)!'
                  : phomState?.winReason === 'U'
                  ? 'CHIẾN THẮNG Ù PHỎM!'
                  : 'VÁN ĐẤU HÒA (HẾT NỌC)!'}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {phomState?.winnerPlayerId
                  ? `Người thắng: ${roomState.players.find((p) => p.id === phomState.winnerPlayerId)?.name}`
                  : 'Nọc bài đã bốc hết mà chưa có ai Ù.'}
              </p>
            </div>

            {/* Score & Penalty Details Table */}
            <div className="space-y-2 mb-5">
              {roomState.results?.map((rec) => {
                const isWinner = rec.playerId === phomState?.winnerPlayerId;
                const penalty = phomState?.penalties?.[rec.playerId];

                return (
                  <div
                    key={rec.playerId}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isWinner
                        ? 'bg-purple-950/60 border-purple-500 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{rec.avatar}</span>
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <span>{rec.playerName}</span>
                          {isWinner && (
                            <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                              Ù THẮNG
                            </span>
                          )}
                        </div>
                        {penalty && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Rác: {penalty.unmeldedPoints}đ | Bị chặt: {penalty.chattedCount} lần
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-sm font-black ${
                          rec.scoreChange > 0
                            ? 'text-emerald-400'
                            : rec.scoreChange < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {rec.scoreChange > 0 ? `+${rec.scoreChange}` : rec.scoreChange} xu
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Số dư: {roomState.players.find((p) => p.id === rec.playerId)?.score ?? 0} xu
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3">
              {isHost && (
                <>
                  <button
                    type="button"
                    onClick={handleStartNextGame}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-black rounded-xl shadow-lg transition cursor-pointer"
                  >
                    Ván Mới Tiếp Tục
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToWaiting}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    Về Phòng Chờ
                  </button>
                </>
              )}
              {!isHost && (
                <div className="flex-1 text-center text-xs text-slate-400 italic">
                  Đang đợi chủ phòng quyết định tiếp tục...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Drawer */}
      {isChatOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-80 bg-slate-950 border-l border-slate-800 shadow-2xl z-40 flex flex-col">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-sm text-white">Khung Trò Chuyện</span>
            <button
              onClick={() => setIsChatOpen(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Đóng
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-2">
            <KhungChat roomCode={roomState.code} myPlayerId={myPlayerId} messages={chatMessages} />
          </div>
        </div>
      )}

      {/* Rule Guide Modal */}
      {isRuleModalOpen && (
        <RuleGuideModal
          initialRule="PHOM"
          isOpen={isRuleModalOpen}
          onClose={() => setIsRuleModalOpen(false)}
        />
      )}
    </div>
  );
};
