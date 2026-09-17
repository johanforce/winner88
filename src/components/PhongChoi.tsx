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
  Eye,
  Flame,
  UserCheck,
  Award,
  MessageSquare,
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'SEATS' | 'CHAT'>('SEATS');

  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost || false;
  const isCoTuong = roomState.rule === 'CO_TUONG';
  const activePlayers = roomState.players.filter((p) => p.isConnected);

  // Slots representation strictly indexed by seatIndex (0..3 for cards, 0..7 for Xiangqi)
  const totalSlots = isCoTuong ? 8 : 4;
  const seats: (PlayerPublicInfo | null)[] = Array(totalSlots).fill(null);
  roomState.players.forEach((p) => {
    if (typeof p.seatIndex === 'number' && p.seatIndex >= 0 && p.seatIndex < totalSlots) {
      seats[p.seatIndex] = p;
    }
  });

  // Start criteria: For Xiangqi, both Red (Seat 0) and Black (Seat 1) must be filled
  const canStart = isCoTuong
    ? isHost && !!seats[0]?.isConnected && !!seats[1]?.isConnected
    : isHost && activePlayers.length >= 2;

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
        }
      }
    );
  };

  const handleSwitchSeat = (targetSeatIndex: number) => {
    setErrorMsg(null);
    socket.emit(
      'ROOM_SWITCH_SEAT',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
        targetSeatIndex,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setErrorMsg(res.message || 'Không thể đổi ghế');
        }
      }
    );
  };

  const handleSetXiangqiTimeMode = (timeMode: 'STANDARD' | 'BLITZ_5M') => {
    setErrorMsg(null);
    socket.emit(
      'ROOM_SET_XIANGQI_TIME_MODE',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
        timeMode,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setErrorMsg(res.message || 'Không thể đổi chế độ thời gian');
        }
      }
    );
  };

  // Seat metadata for Cờ Tướng
  const getSeatConfig = (index: number) => {
    if (!isCoTuong) {
      return {
        title: `Ghế #${index + 1}`,
        badge: 'Người chơi',
        badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
        emptyText: 'Đang đợi thêm người vào phòng...',
        joinBtnText: 'Ngồi ghế này',
      };
    }
    if (index === 0) {
      return {
        title: 'Kỳ thủ Đỏ (Đi trước)',
        badge: '🔴 Quân Đỏ',
        badgeColor: 'bg-red-950 text-red-300 border-red-800',
        emptyText: 'Chưa có kỳ thủ Đỏ (cần 1 người vào vị trí)',
        joinBtnText: 'Ngồi ghế Đỏ 🔴',
      };
    }
    if (index === 1) {
      return {
        title: 'Kỳ thủ Đen (Đi sau)',
        badge: '⚫ Quân Đen',
        badgeColor: 'bg-stone-900 text-stone-200 border-stone-700',
        emptyText: 'Chưa có kỳ thủ Đen (cần 1 người vào vị trí)',
        joinBtnText: 'Ngồi ghế Đen ⚫',
      };
    }
    return {
      title: `Slot theo dõi #${index - 1} (Khán giả)`,
      badge: '👁️ Khán giả',
      badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
      emptyText: 'Slot theo dõi đang trống',
      joinBtnText: `Ngồi theo dõi #${index - 1} 👁️`,
    };
  };

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
              className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition cursor-pointer"
              title="Sao chép mã phòng"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              roomState.rule === 'TIEN_LEN_MIEN_NAM'
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                : roomState.rule === 'SAM_LOC'
                ? 'bg-amber-950/60 border-amber-700 text-amber-300'
                : 'bg-red-950/60 border-red-700 text-red-300'
            }`}
          >
            {roomState.rule === 'TIEN_LEN_MIEN_NAM' && '♠ Tiến Lên Miền Nam'}
            {roomState.rule === 'SAM_LOC' && '🔥 Sâm Lốc (10 lá)'}
            {roomState.rule === 'CO_TUONG' && '🏆 Cờ Tướng Cờ Chớp (5 phút)'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRuleModalOpen(true)}
            id="btn-open-rules"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật chơi</span>
          </button>

          <button
            onClick={onLeaveRoom}
            id="btn-leave-room-header"
            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời phòng</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col lg:flex-row items-start gap-4 sm:gap-6">
        {/* Mobile Tab Switcher */}
        <div className="w-full flex lg:hidden bg-slate-900/90 border border-slate-800 p-1 rounded-2xl text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('SEATS')}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer touch-manipulation ${
              mobileTab === 'SEATS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Phòng Chờ ({roomState.players.length}/{totalSlots})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('CHAT')}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer touch-manipulation ${
              mobileTab === 'CHAT' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Trò Chuyện {chatMessages.length > 0 && `(${chatMessages.length})`}</span>
          </button>
        </div>

        {/* Left Side: Waiting Room Slots & Controls */}
        <div className={`flex-1 w-full flex-col space-y-4 sm:space-y-5 ${mobileTab === 'SEATS' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Instructions banner */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <h2 className="text-white font-extrabold text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                {isCoTuong ? 'Phòng Chờ Cờ Tướng (2 Kỳ Thủ + 2 Khán Giả)' : `Phòng chờ (${roomState.players.length}/4 người chơi)`}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCoTuong
                  ? 'Cần đủ 2 kỳ thủ ở ghế Đỏ và Đen để bắt đầu trận đấu. Chủ phòng có thể chọn thể thức Tiêu Chuẩn hoặc Cờ Chớp.'
                  : `Cần tối thiểu 2 người để bắt đầu ván. Chia sẻ mã ${roomState.code} để mời bạn bè cùng vào sòng!`}
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

          {/* Cờ Tướng Time Mode Configuration Banner */}
          {isCoTuong && (
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Chế Độ Thời Gian Thi Đấu
                    </span>
                    {isHost ? (
                      <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-bold">
                        Chủ phòng tùy chọn
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        Quyết định bởi Chủ phòng
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {roomState.xiangqiTimeMode === 'STANDARD'
                      ? '🏆 Cờ Tiêu Chuẩn Quốc Tế: 60 phút mỗi bên + 30 giây tích lũy cho mỗi nước đi (theo chuẩn Liên Đoàn Cờ Tướng Quốc Tế WXF).'
                      : '⚡ Cờ Chớp: 5 phút mỗi bên + 3 giây tích lũy cho mỗi nước đi.'}
                  </p>
                </div>

                {isHost ? (
                  <div className="flex items-center gap-2 shrink-0 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      id="btn-time-mode-standard"
                      onClick={() => handleSetXiangqiTimeMode('STANDARD')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        roomState.xiangqiTimeMode === 'STANDARD'
                          ? 'bg-amber-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Cờ Tiêu Chuẩn (60p + 30s)</span>
                    </button>
                    <button
                      type="button"
                      id="btn-time-mode-blitz"
                      onClick={() => handleSetXiangqiTimeMode('BLITZ_5M')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        roomState.xiangqiTimeMode !== 'STANDARD'
                          ? 'bg-red-700 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Cờ Chớp (5p + 3s)</span>
                    </button>
                  </div>
                ) : (
                  <div className="shrink-0">
                    {roomState.xiangqiTimeMode === 'STANDARD' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/60 border border-amber-800 text-amber-300 text-xs font-bold rounded-xl">
                        <Award className="w-3.5 h-3.5" />
                        <span>Cờ Tiêu Chuẩn (60p + 30s WXF)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-950/60 border border-red-800 text-red-300 text-xs font-bold rounded-xl">
                        <Flame className="w-3.5 h-3.5" />
                        <span>Cờ Chớp (5p + 3s)</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4 Slots Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {seats.map((player, index) => {
              const seatConf = getSeatConfig(index);
              const isMe = player?.id === myPlayerId;
              const isMyCurrentSeat = me?.seatIndex === index;

              if (player) {
                return (
                  <div
                    key={player.id}
                    className={`relative p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between min-h-[150px] ${
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

                    {/* Role badge top right */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${seatConf.badgeColor}`}>
                        {seatConf.badge}
                      </span>
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

                    {/* Player Info */}
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
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {seatConf.title}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons on card */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      {/* Host transfer action */}
                      {isHost && !player.isHost && player.isConnected && (
                        <button
                          type="button"
                          onClick={() => handleTransferHost(player.id)}
                          className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 hover:underline transition cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Chuyển chủ phòng</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              // Empty Slot
              return (
                <div
                  key={`empty-${index}`}
                  className="border-2 border-dashed border-slate-800/80 rounded-2xl p-5 min-h-[150px] flex flex-col items-center justify-center text-center bg-slate-950/20 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${seatConf.badgeColor}`}>
                      {seatConf.badge}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">Trống</span>
                  </div>

                  <span className="text-xs font-bold text-slate-300 mt-1">
                    {seatConf.title}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                    {seatConf.emptyText}
                  </p>

                  {/* Switch to this seat button */}
                  {!isMyCurrentSeat && (
                    <button
                      type="button"
                      onClick={() => handleSwitchSeat(index)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{seatConf.joinBtnText}</span>
                    </button>
                  )}
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
                !canStart ? (
                  <span className="text-amber-400 font-medium">
                    {isCoTuong
                      ? '⏳ Cần có đủ 2 kỳ thủ ở ghế Đỏ và ghế Đen để bắt đầu trận cờ chớp.'
                      : '⏳ Cần tối thiểu 2 người chơi để bắt đầu ván bài.'}
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    {isCoTuong
                      ? '✅ Đã đủ 2 kỳ thủ Đỏ và Đen. Bạn có thể bấm bắt đầu trận đấu ngay!'
                      : '✅ Đã đủ điều kiện. Bạn có thể bắt đầu ván chơi bất cứ lúc nào!'}
                  </span>
                )
              ) : (
                <span className="italic text-slate-400">
                  ⏳ Đang chờ chủ phòng bấm bắt đầu trận đấu...
                </span>
              )}
            </div>

            {isHost && (
              <button
                type="button"
                id="btn-start-game"
                disabled={!canStart}
                onClick={handleStartGame}
                className={`w-full sm:w-auto min-h-[46px] px-8 py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer touch-manipulation ${
                  canStart
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-700/30 active:scale-95 animate-pulse'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isCoTuong ? 'Bắt Đầu Trận Cờ Chớp' : 'Bắt Đầu Ván Chơi'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Chat */}
        <div className={`w-full lg:w-80 xl:w-[340px] shrink-0 h-[480px] lg:h-[500px] ${mobileTab === 'CHAT' ? 'block' : 'hidden lg:block'}`}>
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
