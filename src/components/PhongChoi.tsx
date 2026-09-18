import React, { useState, useEffect } from 'react';
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
  Mic,
  MicOff,
  Radio,
  Headphones,
} from 'lucide-react';
import { RoomPublicState, PlayerPublicInfo, ChatMessage } from '../types';
import { socket } from '../socket';
import { KhungChat } from './KhungChat';
import { RuleGuideModal } from './RuleGuideModal';
import { useVoiceChat } from '../context/VoiceChatContext';

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
  const [lastReadMessageCount, setLastReadMessageCount] = useState(chatMessages.length);

  const { participants: voiceParticipants, speakingMap } = useVoiceChat();

  useEffect(() => {
    if (mobileTab === 'CHAT') {
      setLastReadMessageCount(chatMessages.length);
    }
  }, [mobileTab, chatMessages.length]);

  const unreadChatCount = mobileTab === 'CHAT' ? 0 : Math.max(0, chatMessages.length - lastReadMessageCount);

  const me = roomState.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost || false;
  const isCoTuong = roomState.rule === 'CO_TUONG';
  const isCaro = roomState.rule === 'CARO';
  const isPhom = roomState.rule === 'PHOM';
  const isBoardGame = isCoTuong || isCaro;
  const activePlayers = roomState.players.filter((p) => p.isConnected);

  // Slots representation strictly indexed by seatIndex (0..3 for cards, 0..7 for Xiangqi and Caro)
  const totalSlots = isBoardGame ? 8 : 4;
  const seats: (PlayerPublicInfo | null)[] = Array(totalSlots).fill(null);
  roomState.players.forEach((p) => {
    if (typeof p.seatIndex === 'number' && p.seatIndex >= 0 && p.seatIndex < totalSlots) {
      seats[p.seatIndex] = p;
    }
  });

  // Start criteria: For board games, both Seat 0 and Seat 1 must be filled. For Phỏm, exactly 4 players.
  const canStart = isBoardGame
    ? isHost && !!seats[0]?.isConnected && !!seats[1]?.isConnected
    : isPhom
    ? isHost && activePlayers.length === 4
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

  // Seat metadata for Cờ Tướng và Cờ Caro
  const getSeatConfig = (index: number) => {
    if (isCaro) {
      if (index === 0) {
        return {
          title: 'Kỳ thủ X (Đi trước)',
          badge: '❌ Quân X',
          badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
          emptyText: 'Chưa có kỳ thủ X (cần 1 người vào vị trí)',
          joinBtnText: 'Ngồi ghế X ❌',
        };
      }
      if (index === 1) {
        return {
          title: 'Kỳ thủ O (Đi sau)',
          badge: '⭕ Quân O',
          badgeColor: 'bg-blue-950 text-blue-300 border-blue-800',
          emptyText: 'Chưa có kỳ thủ O (cần 1 người vào vị trí)',
          joinBtnText: 'Ngồi ghế O ⭕',
        };
      }
      return {
        title: `Slot theo dõi #${index - 1} (Khán giả)`,
        badge: '👁️ Khán giả',
        badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
        emptyText: 'Slot theo dõi đang trống',
        joinBtnText: `Ngồi theo dõi #${index - 1} 👁️`,
      };
    }
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
                : roomState.rule === 'CO_TUONG'
                ? 'bg-red-950/60 border-red-700 text-red-300'
                : 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
            }`}
          >
            {roomState.rule === 'TIEN_LEN_MIEN_NAM' && '♠ Tiến Lên Miền Nam'}
            {roomState.rule === 'SAM_LOC' && '🔥 Sâm Lốc (10 lá)'}
            {roomState.rule === 'CO_TUONG' && '🏆 Cờ Tướng Cờ Chớp (5 phút)'}
            {roomState.rule === 'CARO' && '⚡ Cờ Caro (5 phút/bên - Ăn 5 chặn 2 đầu win)'}
            {roomState.rule === 'PHOM' && '🎴 Phỏm (Tá Lả - Chuẩn 4 người)'}
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
            id="btn-waiting-tab-chat"
            onClick={() => {
              setMobileTab('CHAT');
              setLastReadMessageCount(chatMessages.length);
            }}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer touch-manipulation ${
              mobileTab === 'CHAT' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Trò Chuyện</span>
            {unreadChatCount > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow">
                +{unreadChatCount}
              </span>
            )}
          </button>
        </div>

        {/* Left Side: Waiting Room Slots & Controls */}
        <div className={`flex-1 w-full flex-col space-y-4 sm:space-y-5 ${mobileTab === 'SEATS' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Instructions banner */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <h2 className="text-white font-extrabold text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                {isCaro
                  ? 'Phòng Chờ Cờ Caro (2 Kỳ Thủ + Slot Khán Giả)'
                  : isCoTuong
                  ? 'Phòng Chờ Cờ Tướng (2 Kỳ Thủ + 2 Khán Giả)'
                  : isPhom
                  ? 'Phòng Chờ Đánh Phỏm (Chuẩn 4 Người Chơi)'
                  : `Phòng chờ (${roomState.players.length}/4 người chơi)`}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCaro
                  ? 'Cần đủ 2 kỳ thủ ở ghế X và O để bắt đầu. Luật: Ăn 5 chặn 2 đầu vẫn THẮNG. Thời gian 5 phút/bên!'
                  : isCoTuong
                  ? 'Cần đủ 2 kỳ thủ ở ghế Đỏ và Đen để bắt đầu trận đấu. Chủ phòng có thể chọn thể thức Tiêu Chuẩn hoặc Cờ Chớp.'
                  : isPhom
                  ? 'Game Phỏm yêu cầu đúng 4 người chơi và mỗi người có tối thiểu 200 xu để bắt đầu ván!'
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

          {/* Phỏm Information Banner */}
          {isPhom && (
            <div className="bg-purple-950/40 border border-purple-800/60 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  Luật Chơi Phỏm (Tá Lả)
                </span>
                <span className="text-[10px] bg-purple-900/60 text-purple-200 border border-purple-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  Bắt buộc 4 người • Tối thiểu 200 xu
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                🎴 Mỗi người 9 lá, 1 lá mở màn. Lượt gồm 2 bước: <strong>(1) Bốc nọc hoặc Ăn bài</strong> rác của người trước (ghép hạ phỏm), <strong>(2) Đánh 1 lá rác</strong>.
                Đặc biệt: Khi có người đánh bài, mọi người có <strong>5 giây để CHẶT bài</strong> nếu có 2 lá tạo phỏm! Ván kết thúc khi có người Ù (hoặc Ù trắng x2 xu) hoặc hết nọc.
              </p>
            </div>
          )}

          {/* Cờ Caro Information Banner */}
          {isCaro && (
            <div className="bg-cyan-950/40 border border-cyan-800/60 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Thể Thức Cờ Caro (5 Phút Blitz)
                </span>
                <span className="text-[10px] bg-cyan-900/60 text-cyan-200 border border-cyan-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  Ăn 5 chặn 2 đầu vẫn THẮNG
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                ⚡ Mỗi bên có <strong>5 phút</strong> tổng thời gian suy nghĩ. Ai hết giờ trước sẽ bị xử thua (Timeout).
                Tạo chuỗi 5 quân liên tiếp hàng ngang, dọc hoặc chéo (kể cả bị chặn 2 đầu) sẽ giành chiến thắng ngay lập tức!
              </p>
            </div>
          )}

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
                    {(() => {
                      const voiceUser = voiceParticipants.find((vp) => vp.playerId === player.id);
                      const isSpeaking = speakingMap[player.id] || voiceUser?.isSpeaking;

                      return (
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <span
                                className={`text-4xl filter drop-shadow inline-block transition-all rounded-full p-1 ${
                                  isSpeaking
                                    ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-900 animate-pulse bg-emerald-500/20'
                                    : ''
                                }`}
                              >
                                {player.avatar}
                              </span>

                              {/* Voice badge */}
                              {voiceUser && (
                                <div
                                  className={`absolute -bottom-1 -right-1 p-1 rounded-full border shadow-sm ${
                                    voiceUser.hasMic === false
                                      ? 'bg-sky-950 border-sky-700 text-sky-400'
                                      : voiceUser.isMuted
                                      ? 'bg-slate-900 border-slate-700 text-slate-400'
                                      : isSpeaking
                                      ? 'bg-emerald-500 border-emerald-300 text-slate-950 animate-bounce'
                                      : 'bg-emerald-950 border-emerald-700 text-emerald-400'
                                  }`}
                                  title={
                                    voiceUser.hasMic === false
                                      ? 'Đang nghe phòng 🎧'
                                      : voiceUser.isMuted
                                      ? 'Đã tắt mic'
                                      : isSpeaking
                                      ? 'Đang nói...'
                                      : 'Đang bật mic'
                                  }
                                >
                                  {voiceUser.hasMic === false ? (
                                    <Headphones className="w-3 h-3" />
                                  ) : voiceUser.isMuted ? (
                                    <MicOff className="w-3 h-3" />
                                  ) : isSpeaking ? (
                                    <Radio className="w-3 h-3" />
                                  ) : (
                                    <Mic className="w-3 h-3" />
                                  )}
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-sm sm:text-base">
                                  {player.name}
                                </span>
                                {isMe && (
                                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                    Bạn
                                  </span>
                                )}
                                {isSpeaking && (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-bold animate-pulse">
                                    Đang nói 🎙️
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
                      );
                    })()}

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
                    {isCaro
                      ? '⏳ Cần có đủ 2 kỳ thủ ở ghế X và ghế O để bắt đầu trận cờ Caro 5 phút.'
                      : isCoTuong
                      ? '⏳ Cần có đủ 2 kỳ thủ ở ghế Đỏ và ghế Đen để bắt đầu trận cờ chớp.'
                      : isPhom
                      ? '⏳ Cần có đủ 4 người chơi để bắt đầu ván Phỏm (hiện có ' + roomState.players.length + '/4).'
                      : '⏳ Cần tối thiểu 2 người chơi để bắt đầu ván bài.'}
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    {isCaro
                      ? '✅ Đã đủ 2 kỳ thủ X và O. Bạn có thể bấm bắt đầu trận đấu ngay!'
                      : isCoTuong
                      ? '✅ Đã đủ 2 kỳ thủ Đỏ và Đen. Bạn có thể bấm bắt đầu trận đấu ngay!'
                      : isPhom
                      ? '✅ Đã đủ 4 người chơi! Bạn có thể bấm bắt đầu ván Phỏm ngay!'
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
                <span>{isCaro ? 'Bắt Đầu Trận Cờ Caro' : isCoTuong ? 'Bắt Đầu Trận Cờ Chớp' : 'Bắt Đầu Ván Chơi'}</span>
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
            onReadAll={() => setLastReadMessageCount(chatMessages.length)}
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
