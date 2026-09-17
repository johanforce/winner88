import React, { useState } from 'react';
import {
  Crown,
  Copy,
  Check,
  LogOut,
  Play,
  Share2,
  Users,
  BookOpen,
  ArrowRightLeft,
} from 'lucide-react';
import { RoomPublicState, PlayerPublicInfo, ChatMessage } from '../types';
import { socket } from '../socket';
import { KhungChat } from './KhungChat';
import { RuleGuideModal } from './RuleGuideModal';

interface PhongChoiProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
}

export const PhongChoi: React.FC<PhongChoiProps> = ({
  roomState,
  myPlayerId,
  chatMessages,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost || false;
  const activePlayers = roomState.players.filter((p) => p.isConnected);
  const canStart = isHost && activePlayers.length >= 2;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomState.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    setErrorMsg(null);
    socket.emit(
      'ROOM_START_GAME',
      {
        roomCode: roomState.code,
        requestedByPlayerId: myPlayerId,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setErrorMsg(res.message || 'Không thể bắt đầu ván đấu');
        }
      }
    );
  };

  const handleTransferHost = (targetId: string) => {
    socket.emit(
      'ROOM_TRANSFER_HOST',
      {
        roomCode: roomState.code,
        targetPlayerId: targetId,
        requestedByPlayerId: myPlayerId,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setErrorMsg(res.message || 'Chuyển host thất bại');
        } else {
          setTransferTargetId(null);
        }
      }
    );
  };

  // 4 seats representation
  const seats: (PlayerPublicInfo | null)[] = [null, null, null, null];
  roomState.players.forEach((p, idx) => {
    if (idx < 4) seats[idx] = p;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-emerald-900/40 bg-slate-950/70 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Mã phòng:</span>
            <span className="font-extrabold text-amber-400 tracking-wider text-base">
              {roomState.code}
            </span>
            <button
              onClick={handleCopyCode}
              id="btn-copy-room-code"
              className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition"
              title="Sao chép mã phòng"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
              roomState.rule === 'TIEN_LEN_MIEN_NAM'
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                : 'bg-amber-950/60 border-amber-700 text-amber-300'
            }`}
          >
            {roomState.rule === 'TIEN_LEN_MIEN_NAM' ? '♠ Tiến Lên Miền Nam' : '🔥 Sâm Lốc (10 lá)'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRuleModalOpen(true)}
            id="btn-open-rules"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật chơi</span>
          </button>

          <button
            onClick={onLeaveRoom}
            id="btn-leave-room-header"
            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời phòng</span>
          </button>
        </div>
      </header>

      {/* Main Content: Seat Grid + Chat Sidebar */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 columns: Waiting Room Slots & Controls */}
        <div className="lg:col-span-2 flex flex-col justify-between space-y-6">
          {/* Instructions banner */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <h2 className="text-white font-extrabold text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                Phòng chờ ({roomState.players.length}/4 người chơi)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cần tối thiểu 2 người để bắt đầu ván. Chia sẻ mã <strong className="text-amber-300">{roomState.code}</strong> để mời bạn bè cùng vào sòng!
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              id="btn-share-room"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copied ? 'Đã sao chép!' : 'Chia sẻ mã'}</span>
            </button>
          </div>

          {/* 4 Player Slots Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {seats.map((player, index) => {
              if (player) {
                const isMe = player.id === myPlayerId;
                return (
                  <div
                    key={player.id}
                    className={`relative p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      player.isHost
                        ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-950/20'
                        : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    {/* Host crown badge */}
                    {player.isHost && (
                      <div className="absolute -top-2.5 left-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                        <Crown className="w-3 h-3 fill-slate-950" />
                        <span>CHỦ PHÒNG</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl filter drop-shadow">{player.avatar}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm sm:text-base">
                              {player.name}
                            </span>
                            {isMe && (
                              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                Bạn
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-amber-400 font-semibold mt-0.5">
                            {player.score} xu
                          </div>
                        </div>
                      </div>

                      {/* Connection status */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          player.isConnected
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                            : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                        }`}
                      >
                        {player.isConnected ? 'Sẵn sàng' : 'Mất kết nối'}
                      </span>
                    </div>

                    {/* Host transfer action (only host can see for other players) */}
                    {isHost && !player.isHost && player.isConnected && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleTransferHost(player.id)}
                          className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 hover:underline transition"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Chuyển quyền chủ phòng cho người này</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              // Empty Slot
              return (
                <div
                  key={`empty-${index}`}
                  className="border-2 border-dashed border-slate-800/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-950/20 hover:border-slate-700 transition"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-600 mb-2">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    Ghế trống #{index + 1}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đang đợi thêm người vào phòng...
                  </p>
                </div>
              );
            })}
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 text-center sm:text-left">
              {isHost ? (
                activePlayers.length < 2 ? (
                  <span className="text-amber-400 font-medium">
                    ⏳ Cần tối thiểu 2 người chơi để bắt đầu ván bài.
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    ✅ Đã đủ điều kiện. Bạn có thể bắt đầu ván chơi bất cứ lúc nào!
                  </span>
                )
              ) : (
                <span className="italic text-slate-400">
                  ⏳ Đang chờ chủ phòng bấm bắt đầu ván chơi...
                </span>
              )}
            </div>

            {isHost && (
              <button
                type="button"
                id="btn-start-game"
                disabled={!canStart}
                onClick={handleStartGame}
                className={`w-full sm:w-auto px-8 py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                  canStart
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-700/30 active:scale-95 animate-pulse'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Bắt Đầu Ván Chơi</span>
              </button>
            )}
          </div>
        </div>

        {/* Right column: In-room Chat */}
        <div className="h-[480px] lg:h-auto">
          <KhungChat
            roomCode={roomState.code}
            playerId={myPlayerId}
            messages={chatMessages}
            isOpen={true}
          />
        </div>
      </main>

      {/* Rule modal */}
      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        defaultRule={roomState.rule}
      />
    </div>
  );
};
