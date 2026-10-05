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
  Anchor,
  Crosshair,
  Shield,
  Sparkles,
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
  const [lastReadMessageCount, setLastReadMessageCount] = useState(chatMessages.length);

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
  const isBanTau = roomState.rule === 'BAN_TAU';
  const isCoCaNgua = roomState.rule === 'CO_CA_NGUA';
  const isCoVua = roomState.rule === 'CO_VUA';
  const isBoardGame = isCoTuong || isCaro || isBanTau || isCoCaNgua || isCoVua;
  const activePlayers = roomState.players.filter((p) => p.isConnected);

  // Slots representation: 0..3 for Card games, 0..5 for Chess (2 players + 4 spectators), 0..7 for other Board games
  const totalSlots = isCoVua ? 6 : isBoardGame ? 8 : 4;
  const seats: (PlayerPublicInfo | null)[] = Array(totalSlots).fill(null);
  roomState.players.forEach((p) => {
    if (typeof p.seatIndex === 'number' && p.seatIndex >= 0 && p.seatIndex < totalSlots) {
      seats[p.seatIndex] = p;
    }
  });

  // Check if all seated playing participants have returned to waiting room
  const playingSeats = isCoCaNgua
    ? [seats[0], seats[1], seats[2], seats[3]].filter((s): s is PlayerPublicInfo => !!s && !s.isSpectator)
    : isCoTuong || isCaro || isBanTau || isCoVua
    ? [seats[0], seats[1]].filter((s): s is PlayerPublicInfo => !!s && !s.isSpectator)
    : activePlayers;

  const stillReviewingPlayers = playingSeats.filter(
    (p) => roomState.status === 'FINISHED' && p.returnedToWaiting === false
  );
  const allReturnedToWaiting = stillReviewingPlayers.length === 0;

  // Start criteria
  const canStart =
    isHost &&
    allReturnedToWaiting &&
    (isCoCaNgua
      ? playingSeats.filter((p) => p.isConnected).length >= 2
      : isCoTuong || isCaro || isBanTau || isCoVua
      ? !!seats[0]?.isConnected && !!seats[1]?.isConnected
      : activePlayers.length >= 2);

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

  const handleTransferHost = (targetPlayerId: string) => {
    setErrorMsg(null);
    socket.emit(
      'ROOM_TRANSFER_HOST',
      {
        roomCode: roomState.code,
        targetPlayerId,
        requestedByPlayerId: myPlayerId,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setErrorMsg(res.message || 'Không thể chuyển quyền chủ phòng');
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

  // Seat metadata for Cờ Tướng, Cờ Caro, Bắn Tàu, Cờ Cá Ngựa, and Card Games
  const getSeatConfig = (index: number) => {
    if (isCoCaNgua) {
      if (index === 0) {
        return {
          title: 'Đội Đỏ (Ghế 1)',
          badge: '🔴 Ngựa Đỏ',
          badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
          emptyText: 'Chưa có người chơi Đội Đỏ',
          joinBtnText: 'Chơi Đội Đỏ 🔴',
        };
      }
      if (index === 1) {
        return {
          title: 'Đội Xanh Dương (Ghế 2)',
          badge: '🔵 Ngựa Xanh',
          badgeColor: 'bg-blue-950 text-blue-300 border-blue-800',
          emptyText: 'Chưa có người chơi Đội Xanh Dương',
          joinBtnText: 'Chơi Đội Xanh Dương 🔵',
        };
      }
      if (index === 2) {
        return {
          title: 'Đội Vàng (Ghế 3)',
          badge: '🟡 Ngựa Vàng',
          badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
          emptyText: 'Chưa có người chơi Đội Vàng',
          joinBtnText: 'Chơi Đội Vàng 🟡',
        };
      }
      if (index === 3) {
        return {
          title: 'Đội Xanh Lá (Ghế 4)',
          badge: '🟢 Ngựa Lá',
          badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
          emptyText: 'Chưa có người chơi Đội Xanh Lá',
          joinBtnText: 'Chơi Đội Xanh Lá 🟢',
        };
      }
      return {
        title: `Khán giả #${index - 3}`,
        badge: '👁️ Khách theo dõi',
        badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
        emptyText: 'Vị trí theo dõi cờ cá ngựa (tối đa 4 người)',
        joinBtnText: `Ngồi theo dõi #${index - 3} 👁️`,
      };
    }

    if (isBanTau) {
      if (index === 0) {
        return {
          title: 'Hạm Đội 1 (Chỉ huy)',
          badge: '⚓ Chỉ huy 1',
          badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-800',
          emptyText: 'Chưa có Thuyền trưởng Hạm đội 1',
          joinBtnText: 'Chỉ huy Hạm Đội 1 ⚓',
        };
      }
      if (index === 1) {
        return {
          title: 'Hạm Đội 2 (Chỉ huy)',
          badge: '🚀 Chỉ huy 2',
          badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
          emptyText: 'Chưa có Thuyền trưởng Hạm đội 2',
          joinBtnText: 'Chỉ huy Hạm Đội 2 🚀',
        };
      }
      return {
        title: `Khán giả #${index - 1}`,
        badge: '👁️ Khán giả',
        badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
        emptyText: 'Vị trí quan sát chiến hạm đang trống',
        joinBtnText: `Quan sát #${index - 1} 👁️`,
      };
    }

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
        title: `Khán giả #${index - 1}`,
        badge: '👁️ Khán giả',
        badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
        emptyText: 'Vị trí theo dõi đang trống',
        joinBtnText: `Ngồi theo dõi #${index - 1} 👁️`,
      };
    }

    if (isCoTuong) {
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
        title: `Khán giả #${index - 1}`,
        badge: '👁️ Khán giả',
        badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
        emptyText: 'Vị trí theo dõi đang trống',
        joinBtnText: `Ngồi theo dõi #${index - 1} 👁️`,
      };
    }

    if (isCoVua) {
      if (index === 0) {
        return {
          title: 'Kỳ thủ Trắng (Đi trước)',
          badge: '⚪ Quân Trắng',
          badgeColor: 'bg-slate-100 text-slate-900 border-slate-300 font-bold',
          emptyText: 'Chưa có kỳ thủ Trắng (cần 1 người vào vị trí)',
          joinBtnText: 'Cầm quân Trắng ⚪',
        };
      }
      if (index === 1) {
        return {
          title: 'Kỳ thủ Đen (Đi sau)',
          badge: '⚫ Quân Đen',
          badgeColor: 'bg-zinc-900 text-zinc-100 border-zinc-700 font-bold',
          emptyText: 'Chưa có kỳ thủ Đen (cần 1 người vào vị trí)',
          joinBtnText: 'Cầm quân Đen ⚫',
        };
      }
      return {
        title: `Khán giả #${index - 1}`,
        badge: '👁️ Khán giả (Có AI)',
        badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
        emptyText: 'Vị trí theo dõi & nhận định AI (tối đa 4 người)',
        joinBtnText: `Ngồi theo dõi #${index - 1} 👁️`,
      };
    }

    return {
      title: `Ghế #${index + 1}`,
      badge: 'Người chơi',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      emptyText: 'Đang đợi thêm người vào phòng...',
      joinBtnText: 'Ngồi ghế này',
    };
  };

  const renderSeatSlot = (index: number) => {
    const player = seats[index];
    const seatConf = getSeatConfig(index);
    const isMe = player?.id === myPlayerId;
    const isMyCurrentSeat = me?.seatIndex === index;

    if (player) {
      return (
        <div
          key={`seat-${index}`}
          className={`relative border rounded-2xl p-4 transition-all shadow-md flex flex-col justify-between ${
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
                !player.isConnected
                  ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                  : roomState.status === 'FINISHED' && player.returnedToWaiting === false
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60 animate-pulse'
                  : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
              }`}
            >
              {!player.isConnected
                ? 'Mất kết nối'
                : roomState.status === 'FINISHED' && player.returnedToWaiting === false
                ? '⏳ Đang xem lại ván'
                : 'Sẵn sàng'}
            </span>
          </div>

          {/* Player Info */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="text-4xl filter drop-shadow inline-block transition-all rounded-full p-1">
                  {player.avatar}
                </span>
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
                </div>
                <div className="text-xs text-amber-400 font-semibold mt-0.5">
                  {player.score} xu
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {seatConf.title}
                </div>
              </div>
            </div>

            {/* Actions for this player */}
            <div className="flex flex-col items-end gap-1.5">
              {isHost && !isMe && player.isConnected && (
                <button
                  type="button"
                  onClick={() => handleTransferHost(player.id)}
                  title="Chuyển quyền chủ phòng"
                  className="px-2 py-1 bg-slate-800 hover:bg-amber-950/80 hover:text-amber-300 text-slate-400 text-[10px] font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                >
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>Trao quyền</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Empty Slot
    return (
      <div
        key={`empty-${index}`}
        className="border-2 border-dashed border-slate-800/80 rounded-2xl p-4 min-h-[130px] flex flex-col items-center justify-center text-center bg-slate-950/20 hover:border-slate-700 transition"
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
        <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Phòng:
            </span>
            <button
              onClick={handleCopyCode}
              id="btn-copy-room-code"
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl font-mono text-base sm:text-lg font-black text-amber-400 tracking-wider flex items-center gap-2 transition cursor-pointer group"
              title="Sao chép mã phòng"
            >
              <span>{roomState.code}</span>
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
              )}
            </button>
          </div>

          <div
            className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
              roomState.rule === 'TIEN_LEN_MIEN_NAM'
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                : roomState.rule === 'SAM_LOC'
                ? 'bg-amber-950/60 border-amber-700 text-amber-300'
                : roomState.rule === 'CO_TUONG'
                ? 'bg-red-950/60 border-red-700 text-red-300'
                : roomState.rule === 'CARO'
                ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
                : roomState.rule === 'BAN_TAU'
                ? 'bg-blue-950/60 border-blue-700 text-blue-300'
                : roomState.rule === 'CO_VUA'
                ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                : 'bg-purple-950/60 border-purple-700 text-purple-300'
            }`}
          >
            {roomState.rule === 'TIEN_LEN_MIEN_NAM' && '♠ Tiến Lên Miền Nam'}
            {roomState.rule === 'SAM_LOC' && '🔥 Sâm Lốc (10 lá)'}
            {roomState.rule === 'CO_TUONG' && '🏆 Cờ Tướng (2 kỳ thủ + 6 khách)'}
            {roomState.rule === 'CARO' && '⚡ Cờ Caro (2 kỳ thủ + 6 khách)'}
            {roomState.rule === 'BAN_TAU' && '🚢 Bắn Tàu (2 chỉ huy + 6 khách)'}
            {roomState.rule === 'CO_CA_NGUA' && '🎲 Cờ Cá Ngựa (2-4 kỳ thủ + 4 khách)'}
            {roomState.rule === 'CO_VUA' && '♟️ Cờ Vua (2 kỳ thủ + 4 khách)'}
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

      {/* Mobile Tab Toggle */}
      <div className="lg:hidden flex border-b border-slate-800 bg-slate-950/80 px-4 pt-2">
        <button
          onClick={() => setMobileTab('SEATS')}
          className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 ${
            mobileTab === 'SEATS'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Vị Trí ({roomState.players.length}/{totalSlots})</span>
        </button>
        <button
          onClick={() => setMobileTab('CHAT')}
          className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 relative ${
            mobileTab === 'CHAT'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Trò Chuyện</span>
          {unreadChatCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
        {/* Left Side: Room Info & Slots */}
        <div className={`flex-1 flex flex-col gap-5 ${mobileTab === 'SEATS' ? 'block' : 'hidden lg:flex'}`}>
          {/* Instructions banner */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <h2 className="text-white font-extrabold text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                {isCoVua
                  ? `Phòng Cờ Vua (${roomState.players.length}/6 - 2 Kỳ thủ + 4 Khán giả)`
                  : isBanTau
                  ? `Phòng Chiến Hạm Bắn Tàu (${roomState.players.length}/8 - 2 Chỉ huy + 6 Khán giả)`
                  : isCaro
                  ? `Phòng Cờ Caro (${roomState.players.length}/8 - 2 Kỳ thủ + 6 Khán giả)`
                  : isCoTuong
                  ? `Phòng Cờ Tướng (${roomState.players.length}/8 - 2 Kỳ thủ + 6 Khán giả)`
                  : `Phòng Chờ (${roomState.players.length}/4 người chơi)`}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCoVua
                  ? 'Cần đủ 2 kỳ thủ ở ghế Trắng và Đen để bắt đầu (15 phút/bên, +10s mỗi nước). Tối đa 4 khán giả theo dõi ván đấu.'
                  : isBanTau
                  ? 'Cần 2 Thuyền trưởng ở Hạm đội 1 và Hạm đội 2 để khai chiến. Tối đa 6 khách theo dõi chiến trận!'
                  : isCaro
                  ? 'Cần đủ 2 kỳ thủ ở ghế X và O để bắt đầu. Luật: Ăn 5 chặn 2 đầu vẫn THẮNG. Thời gian 5 phút/bên!'
                  : isCoTuong
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

          {/* Battleship Information Banner */}
          {isBanTau && (
            <div className="bg-cyan-950/40 border border-cyan-800/60 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Hải Chiến Bắn Tàu (Battleship 10x10)
                </span>
                <span className="text-[10px] bg-cyan-900/60 text-cyan-200 border border-cyan-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  2 Chỉ huy • 6 Khán giả
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                🚢 Mỗi bên sở hữu hạm đội gồm 5 chiến hạm: <strong>Tàu sân bay (5 ô)</strong>, <strong>Thiết giáp hạm (4 ô)</strong>, <strong>Tàu tuần dương (3 ô)</strong>, <strong>Tàu ngầm (3 ô)</strong>, <strong>Tàu khu trục (2 ô)</strong>.
                Bố trí tàu bí mật trên lưới 10x10. Khi bắt đầu, lần lượt xả đạn bắn phá tọa độ đối phương. Bên nào đánh chìm toàn bộ hạm đội đối phương trước sẽ giành chiến thắng!
              </p>
            </div>
          )}

          {/* Cờ Tướng Time Mode Selector */}
          {isCoTuong && (
            <div className="bg-stone-900/90 border border-amber-700/50 p-4 rounded-2xl shadow-sm">
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

          {/* Main Slots Section */}
          {isCoCaNgua ? (
            <div className="space-y-4">
              {/* 4 Main Player Slots (Đỏ, Xanh Dương, Vàng, Xanh Lá) */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-amber-400" />
                    <span>4 Vị Trí Đua Ngựa (2 đến 4 Người Chơi)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {seats.slice(0, 4).filter((s) => !!s && !s.isSpectator).length}/4 kỳ thủ
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((seatIdx) => renderSeatSlot(seatIdx))}
                </div>
              </div>

              {/* 4 Spectator Slots */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    <span>Khán Giả Theo Dõi (Tối đa 4 khách xem)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {seats.slice(4, 8).filter((s) => !!s).length}/4 khán giả
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[4, 5, 6, 7].map((seatIdx) => renderSeatSlot(seatIdx))}
                </div>
              </div>
            </div>
          ) : isCoVua ? (
            <div className="space-y-4">
              {/* 2 Main Player Duel Slots (Trắng & Đen) */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-amber-400" />
                  <span>2 Vị Trí Kỳ Thủ Cờ Vua</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderSeatSlot(0)}
                  {renderSeatSlot(1)}
                </div>
              </div>

              {/* 4 Spectator Slots for Chess */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    <span>4 Khán Giả Theo Dõi &amp; Nhận Định AI</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {seats.slice(2, 6).filter((s) => !!s).length}/4 khán giả
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[2, 3, 4, 5].map((seatIdx) => renderSeatSlot(seatIdx))}
                </div>
              </div>
            </div>
          ) : isBoardGame ? (
            <div className="space-y-4">
              {/* 2 Main Player Duel Slots */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-amber-400" />
                  <span>2 Vị Trí Tranh Đấu Chính</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderSeatSlot(0)}
                  {renderSeatSlot(1)}
                </div>
              </div>

              {/* 6 Spectator Slots */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    <span>Khán Giả Theo Dõi (Tối đa 6 khách xem)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {seats.slice(2).filter((s) => !!s).length}/6 khán giả
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[2, 3, 4, 5, 6, 7].map((seatIdx) => renderSeatSlot(seatIdx))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((seatIdx) => renderSeatSlot(seatIdx))}
            </div>
          )}

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
                !allReturnedToWaiting ? (
                  <span className="text-amber-400 font-medium">
                    ⏳ Đang chờ người chơi quay về phòng chờ: {stillReviewingPlayers.map((p) => p.name).join(', ')}
                  </span>
                ) : !canStart ? (
                  <span className="text-amber-400 font-medium">
                    {isCoVua
                      ? '⏳ Cần có đủ 2 kỳ thủ ở ghế Trắng và ghế Đen để bắt đầu trận cờ vua 15+10.'
                      : isCoCaNgua
                      ? '⏳ Cần có ít nhất 2 người chơi ở các ghế đua ngựa để bắt đầu.'
                      : isBanTau
                      ? '⏳ Cần có đủ 2 Thuyền trưởng ở Hạm đội 1 và Hạm đội 2 để khai hỏa.'
                      : isCaro
                      ? '⏳ Cần có đủ 2 kỳ thủ ở ghế X và ghế O để bắt đầu trận cờ Caro 5 phút.'
                      : isCoTuong
                      ? '⏳ Cần có đủ 2 kỳ thủ ở ghế Đỏ và ghế Đen để bắt đầu trận cờ chớp.'
                      : '⏳ Cần tối thiểu 2 người chơi để bắt đầu ván bài.'}
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    {isCoVua
                      ? '✅ Đã đủ 2 kỳ thủ Trắng và Đen! Bạn có thể bấm bắt đầu ván cờ vua ngay!'
                      : isCoCaNgua
                      ? '✅ Đã đủ kỳ thủ đua ngựa! Bạn có thể bấm bắt đầu ván cờ cá ngựa ngay!'
                      : isBanTau
                      ? '✅ Đã sẵn sàng 2 Hạm đội! Thuyền trưởng có thể bấm bắt đầu hải chiến ngay!'
                      : isCaro
                      ? '✅ Đã đủ 2 kỳ thủ X và O. Bạn có thể bấm bắt đầu trận đấu ngay!'
                      : isCoTuong
                      ? '✅ Đã đủ 2 kỳ thủ Đỏ và Đen. Bạn có thể bấm bắt đầu trận đấu ngay!'
                      : '✅ Đã đủ điều kiện. Bạn có thể bắt đầu ván chơi bất cứ lúc nào!'}
                  </span>
                )
              ) : (
                <span className="italic text-slate-400">
                  {!allReturnedToWaiting
                    ? `⏳ Đang chờ người chơi (${stillReviewingPlayers.map((p) => p.name).join(', ')}) ra phòng chờ...`
                    : '⏳ Đang chờ chủ phòng bấm bắt đầu trận đấu...'}
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
                <span>
                  {isCoCaNgua
                    ? 'Bắt Đầu Cờ Cá Ngựa'
                    : isBanTau
                    ? 'Bắt Đầu Hải Chiến'
                    : isCaro
                    ? 'Bắt Đầu Trận Cờ Caro'
                    : isCoTuong
                    ? 'Bắt Đầu Trận Cờ Chớp'
                    : 'Bắt Đầu Ván Chơi'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Chat */}
        <div className={`w-full lg:w-80 xl:w-[340px] shrink-0 h-[480px] lg:h-[520px] ${mobileTab === 'CHAT' ? 'block' : 'hidden lg:block'}`}>
          <KhungChat
            chatMessages={chatMessages}
            myPlayerId={myPlayerId}
            roomCode={roomState.code}
          />
        </div>
      </main>

      {/* Rule Guide Modal */}
      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        initialRule={roomState.rule}
      />
    </div>
  );
};
