import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  LogIn,
  RefreshCw,
  BookOpen,
  Users,
  Search,
  Sparkles,
  Edit2,
  X,
  Flame,
  Award,
} from 'lucide-react';
import { GameRule, RoomListItem, XiangqiTimeMode } from '../types';
import { socket } from '../socket';
import { RuleGuideModal } from './RuleGuideModal';

interface LobbyProps {
  playerName: string;
  playerAvatar: string;
  playerScore?: number;
  onEditProfile: () => void;
  onCreateRoom: (rule: GameRule, xiangqiTimeMode?: XiangqiTimeMode) => void;
  onJoinRoom: (roomCode: string) => void;
  onAdjustScore?: (delta: number) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  playerName,
  playerAvatar,
  playerScore,
  onEditProfile,
  onCreateRoom,
  onJoinRoom,
  onAdjustScore,
}) => {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [filterRule, setFilterRule] = useState<GameRule | 'ALL'>('ALL');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [secretFeedback, setSecretFeedback] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<GameRule>('TIEN_LEN_MIEN_NAM');
  const [selectedTimeMode, setSelectedTimeMode] = useState<XiangqiTimeMode>('STANDARD');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const feedbackTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const showSecretFeedback = (text: string, type: 'success' | 'info') => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setSecretFeedback({ text, type });
    feedbackTimerRef.current = setTimeout(() => {
      setSecretFeedback(null);
      feedbackTimerRef.current = null;
    }, 3500);
  };

  const checkAndExecuteSecretCommand = (val: string): boolean => {
    const clean = val.trim().toLowerCase();
    if (clean === 'johanforcehandsome') {
      onAdjustScore?.(1000);
      setRoomCodeInput('');
      setJoinError(null);
      showSecretFeedback('✨ Đã cộng thêm 1.000 xu thành công!', 'success');
      return true;
    }
    if (clean === 'johanforcebadboy') {
      onAdjustScore?.(-1000);
      setRoomCodeInput('');
      setJoinError(null);
      showSecretFeedback('⚡ Đã trừ 1.000 xu khỏi tài khoản.', 'info');
      return true;
    }
    return false;
  };

  const fetchRooms = () => {
    setIsRefreshing(true);
    socket.emit('LOBBY_GET_ROOMS', (roomList: RoomListItem[]) => {
      setRooms(roomList || []);
      setIsRefreshing(false);
    });
  };

  useEffect(() => {
    fetchRooms();

    const handleRoomsUpdate = (updatedRooms: RoomListItem[]) => {
      setRooms(updatedRooms || []);
    };

    socket.on('LOBBY_ROOMS_UPDATE', handleRoomsUpdate);
    return () => {
      socket.off('LOBBY_ROOMS_UPDATE', handleRoomsUpdate);
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkAndExecuteSecretCommand(roomCodeInput)) {
      return;
    }
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setJoinError('Vui lòng nhập mã phòng');
      return;
    }
    setJoinError(null);
    onJoinRoom(code);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (checkAndExecuteSecretCommand(val)) {
      return;
    }
    setRoomCodeInput(val.toUpperCase());
    setJoinError(null);
  };

  const filteredRooms = rooms.filter((r) => {
    if (filterRule === 'ALL') return true;
    return r.rule === filterRule;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 text-white flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-emerald-900/40 bg-slate-950/70 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xl shadow-md border border-emerald-400/30">
            ♠♥
          </div>
          <div>
            <h1 className="font-black text-base sm:text-lg tracking-tight leading-tight">
              Sảnh Đánh Bài Realtime
            </h1>
            <p className="text-[11px] text-emerald-300/80 font-medium">
              Tiến Lên Miền Nam &bull; Sâm Lốc
            </p>
          </div>
        </div>

        {/* User profile capsule & rule button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsRuleModalOpen(true)}
            id="btn-rules-lobby"
            className="p-2 sm:px-3 sm:py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition touch-manipulation cursor-pointer"
            title="Luật & Mức Phạt"
          >
            <BookOpen className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật & Mức Phạt</span>
          </button>

          <div
            onClick={onEditProfile}
            className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-2.5 sm:px-3 py-1.5 rounded-xl cursor-pointer hover:border-emerald-500/60 transition group touch-manipulation"
            title="Bấm để đổi tên hoặc avatar"
          >
            <span className="text-lg sm:text-xl group-hover:scale-110 transition shrink-0">{playerAvatar}</span>
            <div className="text-left min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-white leading-tight max-w-[70px] xs:max-w-[90px] sm:max-w-[120px] truncate block">
                  {playerName}
                </span>
                <Edit2 className="w-2.5 h-2.5 text-slate-400 group-hover:text-emerald-400 shrink-0" />
              </div>
              <span className="text-[10px] sm:text-[11px] text-amber-400 font-extrabold flex items-center gap-0.5 whitespace-nowrap">
                💰 {playerScore !== undefined ? playerScore.toLocaleString('vi-VN') : '1.000'} xu
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6 space-y-5 sm:space-y-6">
        {/* Hero Actions Row: Tạo phòng & Nhập mã phòng */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Tạo phòng mới */}
          <div className="bg-gradient-to-br from-slate-900/90 to-emerald-950/60 border border-emerald-500/30 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Khởi tạo bàn chơi
                </span>
                <span className="text-[11px] text-slate-400">Tối đa 4 người</span>
              </div>
              <h2 className="text-lg font-black text-white">Tạo Phòng Mới</h2>
              <p className="text-xs text-slate-300 mt-1">
                Tạo sòng riêng, mời bạn bè bằng mã 6 ký tự hoặc mở sảnh để đón người chơi khác.
              </p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              id="btn-open-create-room"
              className="mt-4 w-full min-h-[46px] py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-800/30 flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo Phòng Chơi</span>
            </button>
          </div>

          {/* Card 2: Nhập mã phòng */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-slate-700/80 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1 mb-2">
                <LogIn className="w-3.5 h-3.5" /> Tham gia nhanh
              </span>
              <h2 className="text-lg font-black text-white">Vào Bằng Mã Phòng</h2>
              <p className="text-xs text-slate-300 mt-1">
                Nhập mã 6 ký tự (ví dụ: <code className="text-amber-300">TL1234</code>, <code className="text-amber-300">SL5678</code>) bạn bè đã gửi cho bạn.
              </p>
            </div>

            <form onSubmit={handleJoinByCode} className="mt-4 flex gap-2">
              <input
                type="text"
                id="input-room-code"
                value={roomCodeInput}
                onChange={handleInputChange}
                placeholder="Nhập mã phòng (vd: TL8888)"
                maxLength={100}
                className="flex-1 uppercase font-bold tracking-wider px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-base sm:text-sm text-white placeholder-slate-500 outline-none transition"
              />
              <button
                type="submit"
                id="btn-join-by-code"
                className="min-h-[44px] px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer shrink-0 touch-manipulation"
              >
                <span>Vào</span>
                <span className="text-lg leading-none">&rarr;</span>
              </button>
            </form>
            {joinError && (
              <p className="text-rose-400 text-xs mt-1.5 font-semibold">⚠️ {joinError}</p>
            )}
            {secretFeedback && (
              <p
                className={`text-xs mt-1.5 font-bold flex items-center gap-1.5 animate-pulse ${
                  secretFeedback.type === 'success' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {secretFeedback.text}
              </p>
            )}
          </div>
        </div>

        {/* Room List Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Danh sách phòng đang mở
              </h2>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                {filteredRooms.length}
              </span>
            </div>

            {/* Filter Buttons & Refresh */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end overflow-hidden">
              <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex text-xs overflow-x-auto [scrollbar-width:none] touch-pan-x shrink">
                <button
                  type="button"
                  onClick={() => setFilterRule('ALL')}
                  className={`px-3 py-1.5 min-h-[36px] whitespace-nowrap rounded-lg font-bold transition cursor-pointer touch-manipulation ${
                    filterRule === 'ALL' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRule('TIEN_LEN_MIEN_NAM')}
                  className={`px-3 py-1.5 min-h-[36px] whitespace-nowrap rounded-lg font-bold transition cursor-pointer touch-manipulation ${
                    filterRule === 'TIEN_LEN_MIEN_NAM' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tiến Lên
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRule('SAM_LOC')}
                  className={`px-3 py-1.5 min-h-[36px] whitespace-nowrap rounded-lg font-bold transition cursor-pointer touch-manipulation ${
                    filterRule === 'SAM_LOC' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sâm Lốc
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRule('CO_TUONG')}
                  className={`px-3 py-1.5 min-h-[36px] whitespace-nowrap rounded-lg font-bold transition cursor-pointer touch-manipulation ${
                    filterRule === 'CO_TUONG' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cờ Tướng
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRule('CARO')}
                  className={`px-3 py-1.5 min-h-[36px] whitespace-nowrap rounded-lg font-bold transition cursor-pointer touch-manipulation ${
                    filterRule === 'CARO' ? 'bg-cyan-700 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cờ Caro
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRule('PHOM')}
                  className={`px-3 py-1.5 min-h-[36px] whitespace-nowrap rounded-lg font-bold transition cursor-pointer touch-manipulation ${
                    filterRule === 'PHOM' ? 'bg-purple-700 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Phỏm
                </button>
              </div>

              <button
                onClick={fetchRooms}
                id="btn-refresh-rooms"
                className="min-w-[38px] min-h-[38px] p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition flex items-center justify-center shrink-0 cursor-pointer touch-manipulation"
                title="Làm mới danh sách"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Room Cards Grid */}
          {filteredRooms.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Chưa có phòng nào đang mở</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Hãy là người đầu tiên tạo phòng mới và rủ bạn bè vào chơi nhé!
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
              >
                + Tạo Phòng Ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredRooms.map((room) => {
                const isFull = room.playerCount >= room.maxPlayers;
                const isPlaying = room.status === 'PLAYING';
                const isCoTuong = room.rule === 'CO_TUONG';
                const isCaro = room.rule === 'CARO';
                // For Cờ Tướng and Cờ Caro, spectators can join even if match is in progress as long as room is not full (max 4 or 8)
                const canJoin = !isFull && (!isPlaying || isCoTuong || isCaro);

                return (
                  <div
                    key={room.code}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl transition shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-extrabold text-base text-amber-400 tracking-wider">
                          {room.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            room.rule === 'TIEN_LEN_MIEN_NAM'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : room.rule === 'SAM_LOC'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : room.rule === 'CO_TUONG'
                              ? 'bg-red-950 text-red-300 border-red-800'
                              : room.rule === 'CARO'
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                              : 'bg-purple-950 text-purple-300 border-purple-800'
                          }`}
                        >
                          {room.rule === 'TIEN_LEN_MIEN_NAM'
                            ? '♠ Tiến Lên'
                            : room.rule === 'SAM_LOC'
                            ? '🔥 Sâm Lốc'
                            : room.rule === 'CARO'
                            ? '⚡ Cờ Caro (5p)'
                            : room.rule === 'PHOM'
                            ? '🎴 Phỏm (Tá Lả)'
                            : room.xiangqiTimeMode === 'STANDARD'
                            ? '🏆 Cờ Tướng (Tiêu chuẩn)'
                            : '⚡ Cờ Tướng (Chớp 5p)'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 flex items-center justify-between mb-3">
                        <span>
                          Chủ phòng: <strong className="text-white">{room.hostName}</strong>
                        </span>
                        <span
                          className={`font-semibold text-xs ${
                            isFull ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {room.playerCount}/{room.maxPlayers} người
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPlaying
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                            : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                        }`}
                      >
                        {isPlaying ? 'Đang chơi' : 'Đang chờ'}
                      </span>

                      <button
                        type="button"
                        id={`btn-join-${room.code}`}
                        disabled={!canJoin}
                        onClick={() => onJoinRoom(room.code)}
                        className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition touch-manipulation ${
                          canJoin
                            ? isPlaying && isCoTuong
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isFull
                          ? 'Đã đầy'
                          : isPlaying
                          ? isCoTuong
                            ? 'Xem Trực Tiếp 👁️'
                            : 'Đang chơi'
                          : 'Vào Chơi'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* CREATE ROOM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                Tạo Phòng Chơi Mới
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Chọn Thể Loại Chơi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRule('TIEN_LEN_MIEN_NAM')}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      selectedRule === 'TIEN_LEN_MIEN_NAM'
                        ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">♠</span>
                    <span className="font-black text-sm block text-white">Tiến Lên MN</span>
                    <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                      13 lá, so chất Cơ &gt; Rô &gt; Tép &gt; Bích, chặt heo.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRule('SAM_LOC')}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      selectedRule === 'SAM_LOC'
                        ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">🔥</span>
                    <span className="font-black text-sm block text-white">Sâm Lốc</span>
                    <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                      10 lá, không so chất, có Báo Sâm, phạt thối 2.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRule('CO_TUONG')}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      selectedRule === 'CO_TUONG'
                        ? 'bg-red-950/60 border-red-500 ring-2 ring-red-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">🏆</span>
                    <span className="font-black text-sm block text-white">Cờ Tướng</span>
                    <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                      Tiêu chuẩn (60p + 30s) hoặc Cờ chớp (5p + 3s).
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRule('CARO')}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      selectedRule === 'CARO'
                        ? 'bg-cyan-950/60 border-cyan-500 ring-2 ring-cyan-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">❌⭕</span>
                    <span className="font-black text-sm block text-white">Cờ Caro</span>
                    <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                      Ăn 5 chặn 2 đầu vẫn THẮNG. Thời gian 5 phút/bên.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRule('PHOM')}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer sm:col-span-2 ${
                      selectedRule === 'PHOM'
                        ? 'bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">🎴</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm block text-white">Đánh Phỏm (Tá Lả)</span>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">
                        HOT MỚI
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                      4 người, 9 lá, ăn bài / bốc nọc, cửa sổ chặt bài 5s kịch tính, tính xu phạt ăn cây &amp; Ù. (Tối thiểu 200 xu để vào bàn).
                    </span>
                  </button>
                </div>
              </div>

              {selectedRule === 'CO_TUONG' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Chế Độ Thời Gian Cờ Tướng
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      id="btn-select-standard-time"
                      onClick={() => setSelectedTimeMode('STANDARD')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-3 ${
                        selectedTimeMode === 'STANDARD'
                          ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/30 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Cờ Tiêu Chuẩn Quốc Tế</span>
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded">WXF</span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          60 phút + 30s tích lũy/nước
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      id="btn-select-blitz-time"
                      onClick={() => setSelectedTimeMode('BLITZ_5M')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-3 ${
                        selectedTimeMode === 'BLITZ_5M'
                          ? 'bg-red-950/60 border-red-500 ring-2 ring-red-500/30 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Flame className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Cờ Chớp 5 Phút</div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          5 phút + 3s tích lũy/nước
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs text-slate-400">
                &bull; Phòng tối đa <strong>4 người</strong> {selectedRule === 'CO_TUONG' ? '(2 kỳ thủ Đỏ/Đen + 2 slot theo dõi)' : selectedRule === 'CARO' ? '(2 kỳ thủ X/O + slot theo dõi)' : '(4 người chơi)'}.
                <br />
                &bull; Bạn sẽ tự động trở thành <strong>Chủ phòng (Host)</strong> và có quyền bắt đầu ván đấu.
              </div>

              <button
                type="button"
                id="btn-confirm-create-room"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  onCreateRoom(selectedRule, selectedRule === 'CO_TUONG' ? selectedTimeMode : undefined);
                }}
                className="w-full min-h-[46px] py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer touch-manipulation"
              >
                Khởi Tạo &amp; Vào Phòng Ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules modal */}
      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        defaultRule={filterRule === 'SAM_LOC' ? 'SAM_LOC' : 'TIEN_LEN_MIEN_NAM'}
      />
    </div>
  );
};
