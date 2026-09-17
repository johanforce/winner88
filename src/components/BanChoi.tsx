import React, { useState, useMemo } from 'react';
import {
  Clock,
  LogOut,
  BookOpen,
  MessageSquare,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  Flame,
  AlertCircle,
  Crown,
} from 'lucide-react';
import {
  RoomPublicState,
  Card,
  PlayerPublicInfo,
  ChatMessage,
  GameRule,
} from '../types';
import { socket } from '../socket';
import { CardView } from './CardView';
import { KhungChat } from './KhungChat';
import { RuleGuideModal } from './RuleGuideModal';
import { KetQuaVan } from './KetQuaVan';

interface BanChoiProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  playerCards: Card[];
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
}

export const BanChoi: React.FC<BanChoiProps> = ({
  roomState,
  myPlayerId,
  playerCards,
  chatMessages,
  onLeaveRoom,
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'RANK' | 'SUIT'>('RANK');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isMyTurn = roomState.currentTurnPlayerId === myPlayerId;
  const isHost = me?.isHost || false;

  // Relative seat arrangement so "Me" is always at the bottom!
  const myIndex = roomState.players.findIndex((p) => p.id === myPlayerId);
  const orderedPlayers: (PlayerPublicInfo | null)[] = useMemo(() => {
    if (myIndex === -1) return roomState.players;
    const count = roomState.players.length;
    const result: (PlayerPublicInfo | null)[] = [];
    for (let i = 0; i < 4; i++) {
      if (i < count) {
        const playerIndex = (myIndex + i) % count;
        result.push(roomState.players[playerIndex]);
      } else {
        result.push(null);
      }
    }
    return result;
  }, [roomState.players, myIndex]);

  // Positions: 0 = Bottom (Me), 1 = Right, 2 = Top, 3 = Left
  const playerMe = orderedPlayers[0];
  const playerRight = orderedPlayers.length > 1 ? orderedPlayers[1] : null;
  const playerTop = orderedPlayers.length > 2 ? orderedPlayers[2] : null;
  const playerLeft = orderedPlayers.length > 3 ? orderedPlayers[3] : null;

  // Sorted cards in hand
  const sortedCards = useMemo(() => {
    return [...playerCards].sort((a, b) => {
      if (sortBy === 'RANK') {
        if (a.rank !== b.rank) return a.rank - b.rank;
        const suitOrder = { SPADE: 0, CLUB: 1, DIAMOND: 2, HEART: 3 };
        return suitOrder[a.suit] - suitOrder[b.suit];
      } else {
        const suitOrder = { SPADE: 0, CLUB: 1, DIAMOND: 2, HEART: 3 };
        if (suitOrder[a.suit] !== suitOrder[b.suit]) {
          return suitOrder[a.suit] - suitOrder[b.suit];
        }
        return a.rank - b.rank;
      }
    });
  }, [playerCards, sortBy]);

  const toggleCardSelect = (cardId: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
    setActionError(null);
  };

  const handleDeselectAll = () => {
    setSelectedCardIds([]);
    setActionError(null);
  };

  const handlePlayHand = () => {
    if (selectedCardIds.length === 0) {
      setActionError('Vui lòng chọn ít nhất 1 lá bài để đánh');
      return;
    }

    socket.emit(
      'GAME_PLAY_HAND',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
        cardIds: selectedCardIds,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Nước đi không hợp lệ');
        } else {
          setSelectedCardIds([]);
          setActionError(null);
        }
      }
    );
  };

  const handlePassTurn = () => {
    socket.emit(
      'GAME_PASS_TURN',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setActionError(res.message || 'Không thể bỏ lượt');
        } else {
          setSelectedCardIds([]);
          setActionError(null);
        }
      }
    );
  };

  const handleBaoSamChoice = (wantsBaoSam: boolean) => {
    socket.emit('GAME_BAO_SAM', {
      roomCode: roomState.code,
      playerId: myPlayerId,
      wantsBaoSam,
    });
  };

  const handlePlayAgain = () => {
    socket.emit('ROOM_START_GAME', {
      roomCode: roomState.code,
      requestedByPlayerId: myPlayerId,
    });
  };

  // Helper render for Opponent Seat
  const renderOpponentSeat = (player: PlayerPublicInfo | null, positionClass: string) => {
    if (!player) return null;
    const isTheirTurn = player.isCurrentTurn;

    return (
      <div className={`absolute z-10 flex flex-col items-center ${positionClass}`}>
        <div className="relative">
          {/* Active Turn Pulsing Ring */}
          {isTheirTurn && (
            <div className="absolute -inset-2 rounded-full border-2 border-amber-400 animate-ping opacity-75" />
          )}

          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-2xl sm:text-3xl border-2 transition-all shadow-lg ${
              isTheirTurn
                ? 'bg-amber-950 border-amber-400 ring-2 ring-amber-400/50 scale-105'
                : 'bg-slate-900 border-slate-700'
            }`}
          >
            {player.avatar}
          </div>

          {/* Host crown badge */}
          {player.isHost && (
            <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 p-1 rounded-full shadow">
              <Crown className="w-2.5 h-2.5 fill-slate-950" />
            </div>
          )}

          {/* Cards count badge */}
          <div className="absolute -bottom-1.5 inset-x-0 flex justify-center">
            <span className="bg-slate-950/90 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2 py-0.2 rounded-full shadow">
              {player.cardCount} lá
            </span>
          </div>
        </div>

        {/* Player Name and status */}
        <div className="mt-2 text-center">
          <div className="text-xs font-bold text-white max-w-[90px] truncate">
            {player.name}
          </div>
          {player.hasPassedCurrentRound && (
            <span className="text-[9px] font-bold text-slate-400 bg-slate-900/80 px-1.5 py-0.2 rounded">
              Đã bỏ lượt
            </span>
          )}
          {!player.isConnected && (
            <span className="text-[9px] font-bold text-rose-400 bg-rose-950/80 px-1.5 py-0.2 rounded">
              Mất kết nối
            </span>
          )}
          {player.rank && (
            <span className="text-[9px] font-black text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded">
              Hạng {player.rank}
            </span>
          )}
        </div>

        {/* Small card backs indicator */}
        <div className="flex -space-x-4 mt-1 pointer-events-none">
          {Array.from({ length: Math.min(5, player.cardCount) }).map((_, i) => (
            <CardView key={i} isBack size="xs" />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col select-none overflow-hidden relative font-sans">
      {/* Table Top Header */}
      <header className="h-12 bg-slate-950/80 border-b border-emerald-900/40 px-3 sm:px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="text-xs font-extrabold text-amber-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
            {roomState.code}
          </div>
          <span className="text-xs text-emerald-400 font-semibold hidden sm:inline">
            {roomState.rule === 'TIEN_LEN_MIEN_NAM' ? '♠ Tiến Lên Miền Nam' : '🔥 Sâm Lốc'} &bull; Ván #{roomState.gameNumber}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRuleModalOpen(true)}
            id="btn-rules-header"
            className="p-1.5 sm:px-3 sm:py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật</span>
          </button>

          <button
            onClick={() => setIsChatOpen((v) => !v)}
            id="btn-toggle-chat"
            className={`p-1.5 sm:px-3 sm:py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
              isChatOpen
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat</span>
            {chatMessages.length > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {chatMessages.length}
              </span>
            )}
          </button>

          <button
            onClick={onLeaveRoom}
            id="btn-leave-table"
            className="p-1.5 sm:px-3 sm:py-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rời</span>
          </button>
        </div>
      </header>

      {/* Main Playing Area: Felt Card Table */}
      <div className="flex-1 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Felt Casino Table Canvas */}
        <div className="w-full max-w-5xl h-full max-h-[720px] rounded-[40px] sm:rounded-[60px] bg-gradient-to-b from-emerald-800 via-emerald-900 to-teal-950 border-[10px] sm:border-[16px] border-amber-950/90 shadow-2xl relative flex flex-col justify-between p-3 sm:p-6 overflow-hidden">
          {/* Inner Golden Felt Border */}
          <div className="absolute inset-2 sm:inset-3 rounded-[30px] sm:rounded-[48px] border-2 border-amber-400/20 pointer-events-none" />

          {/* Center Logo watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
            <span className="text-8xl sm:text-9xl font-black text-amber-300 select-none">
              ♠♥♦♣
            </span>
          </div>

          {/* SÂM LỐC BÁO SÂM BANNER */}
          {roomState.samLocState?.isBaoSamPhase && (
            <div className="absolute top-16 inset-x-6 z-40 bg-slate-950/90 border-2 border-amber-500 p-3 sm:p-4 rounded-2xl shadow-2xl text-center animate-bounce">
              <div className="text-amber-400 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2">
                <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
                GIAI ĐOẠN XIN SÂM ({roomState.samLocState.baoSamTimeRemaining}s)
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Bạn có muốn Báo Sâm không? Đánh hết 10 lá không ai chặn để thắng lớn!
              </p>
              <div className="flex justify-center gap-3 mt-3">
                <button
                  onClick={() => handleBaoSamChoice(true)}
                  id="btn-bao-sam-yes"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition"
                >
                  🔥 BÁO SÂM!
                </button>
                <button
                  onClick={() => handleBaoSamChoice(false)}
                  id="btn-bao-sam-no"
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm rounded-xl transition"
                >
                  Không Báo
                </button>
              </div>
            </div>
          )}

          {/* TOP OPPONENT SEAT */}
          {playerTop && renderOpponentSeat(playerTop, 'top-3 inset-x-0 mx-auto')}

          {/* LEFT OPPONENT SEAT */}
          {playerLeft && renderOpponentSeat(playerLeft, 'left-3 top-1/3 -translate-y-1/2')}

          {/* RIGHT OPPONENT SEAT */}
          {playerRight && renderOpponentSeat(playerRight, 'right-3 top-1/3 -translate-y-1/2')}

          {/* TABLE CENTER: Current Trick & Turn Status */}
          <div className="flex-1 flex flex-col items-center justify-center my-auto z-10 py-6">
            {/* Turn Status Pill & Timer */}
            <div className="mb-3 flex items-center gap-2 bg-slate-950/70 border border-emerald-500/30 px-3.5 py-1.5 rounded-full shadow-md backdrop-blur-sm">
              <Clock
                className={`w-4 h-4 ${
                  isMyTurn ? 'text-amber-400 animate-spin' : 'text-emerald-400'
                }`}
              />
              <span className="text-xs font-bold text-white">
                {isMyTurn ? (
                  <span className="text-amber-300 font-black">LƯỢT CỦA BẠN!</span>
                ) : (
                  <span>
                    Lượt của:{' '}
                    <strong className="text-emerald-300">
                      {roomState.players.find((p) => p.id === roomState.currentTurnPlayerId)?.name || '...'}
                    </strong>
                  </span>
                )}
              </span>
              <span
                className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                  roomState.turnTimeRemaining <= 5
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-slate-800 text-amber-300'
                }`}
              >
                {roomState.turnTimeRemaining}s
              </span>
            </div>

            {/* Played Hand on Table */}
            <div className="min-h-[110px] sm:min-h-[130px] flex flex-col items-center justify-center">
              {roomState.lastPlayedHand ? (
                <div className="flex flex-col items-center animate-fadeIn">
                  <div className="text-[11px] sm:text-xs text-amber-200 font-bold bg-slate-950/60 px-3 py-1 rounded-full border border-amber-500/30 mb-2">
                    {roomState.lastPlayedHand.playerName}: {roomState.lastPlayedHand.description}
                  </div>
                  <div className="flex -space-x-4 sm:-space-x-6">
                    {roomState.lastPlayedHand.cards.map((card, idx) => (
                      <CardView key={card.id || idx} card={card} size="md" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 backdrop-blur-xs">
                  <div className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> VÒNG ĐÁNH TỰ DO MỚI
                  </div>
                  <p className="text-[11px] text-emerald-200/80 mt-0.5">
                    {isMyTurn ? 'Bạn đang giữ quyền đi đầu, hãy đánh bất kỳ bộ bài hợp lệ nào!' : 'Đang chờ người đi đầu đánh bài...'}
                  </p>
                </div>
              )}
            </div>

            {/* Action feedback / error message toast */}
            {actionError && (
              <div className="mt-2 text-rose-300 bg-rose-950/90 border border-rose-700/80 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg animate-shake">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{actionError}</span>
              </div>
            )}
          </div>

          {/* BOTTOM: Current Player Hand & Control Actions */}
          <div className="z-20 flex flex-col items-center w-full">
            {/* Action Bar (Play, Pass, Sort) */}
            <div className="w-full flex items-center justify-between gap-2 mb-2 px-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="btn-sort-cards"
                  onClick={() => setSortBy((prev) => (prev === 'RANK' ? 'SUIT' : 'RANK'))}
                  className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-xl text-[11px] font-bold text-slate-300 flex items-center gap-1 transition"
                  title="Đổi kiểu sắp xếp bài"
                >
                  <ArrowUpDown className="w-3 h-3 text-amber-400" />
                  <span>Xếp: {sortBy === 'RANK' ? 'Số' : 'Chất'}</span>
                </button>

                {selectedCardIds.length > 0 && (
                  <button
                    type="button"
                    id="btn-deselect-cards"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Bỏ chọn ({selectedCardIds.length})</span>
                  </button>
                )}
              </div>

              {/* Play & Pass Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-pass-turn"
                  disabled={!isMyTurn || !roomState.lastPlayedHand}
                  onClick={handlePassTurn}
                  className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition shadow-md ${
                    isMyTurn && roomState.lastPlayedHand
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer active:scale-95'
                      : 'bg-slate-900/50 text-slate-600 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  Bỏ Lượt
                </button>

                <button
                  type="button"
                  id="btn-play-cards"
                  disabled={!isMyTurn || selectedCardIds.length === 0}
                  onClick={handlePlayHand}
                  className={`px-5 sm:px-8 py-2 rounded-xl text-xs sm:text-sm font-black transition shadow-lg ${
                    isMyTurn && selectedCardIds.length > 0
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/30 cursor-pointer active:scale-95 animate-pulse'
                      : 'bg-slate-900/50 text-slate-600 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  ĐÁNH BÀI ({selectedCardIds.length})
                </button>
              </div>
            </div>

            {/* Fanned Cards In Hand */}
            <div className="w-full overflow-x-auto no-scrollbar py-2 px-1 flex items-end justify-center -space-x-3 sm:-space-x-5 min-h-[96px] sm:min-h-[116px]">
              {sortedCards.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-4">
                  {playerMe?.status === 'FINISHED' ? '🎉 Bạn đã hết bài!' : 'Đang chia bài...'}
                </div>
              ) : (
                sortedCards.map((card) => {
                  const isSelected = selectedCardIds.includes(card.id);
                  return (
                    <CardView
                      key={card.id}
                      card={card}
                      size="md"
                      isSelected={isSelected}
                      onClick={() => toggleCardSelect(card.id)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chat Drawer */}
      <KhungChat
        roomCode={roomState.code}
        playerId={myPlayerId}
        messages={chatMessages}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isFloating={true}
      />

      {/* Rule Guide Modal */}
      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        defaultRule={roomState.rule}
      />

      {/* Game Results Modal */}
      {roomState.status === 'FINISHED' && roomState.results && (
        <KetQuaVan
          results={roomState.results}
          isHost={isHost}
          rule={roomState.rule}
          onPlayAgain={handlePlayAgain}
          onLeaveRoom={onLeaveRoom}
        />
      )}
    </div>
  );
};
