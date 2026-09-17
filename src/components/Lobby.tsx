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
} from 'lucide-react';
import { GameRule, RoomListItem } from '../types';
import { socket } from '../socket';
import { RuleGuideModal } from './RuleGuideModal';

interface LobbyProps {
  playerName: string;
  playerAvatar: string;
  onEditProfile: () => void;
  onCreateRoom: (rule: GameRule) => void;
  onJoinRoom: (roomCode: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  playerName,
  playerAvatar,
  onEditProfile,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [filterRule, setFilterRule] = useState<GameRule | 'ALL'>('ALL');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<GameRule>('TIEN_LEN_MIEN_NAM');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    };
  }, []);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setJoinError('Vui lòng nhập mã phòng');
      return;
    }
    setJoinError(null);
    onJoinRoom(code);
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRuleModalOpen(true)}
            id="btn-rules-lobby"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật chơi</span>
          </button>

          <div
            onClick={onEditProfile}
            className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl cursor-pointer hover:border-emerald-500/60 transition group"
            title="Bấm để đổi tên hoặc avatar"
          >
            <span className="text-xl group-hover:scale-110 transition">{playerAvatar}</span>
            <div className="text-left">
              <span className="text-xs font-bold text-white block leading-tight">
                {playerName}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <Edit2 className="w-2.5 h-2.5" /> Đổi tên
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Hero Actions Row: Tạo phòng & Nhập mã phòng */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Tạo phòng mới */}
          <div className="bg-gradient-to-br from-slate-900/90 to-emerald-950/60 border border-emerald-500/30 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
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
              className="mt-4 w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-800/30 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo Phòng Chơi</span>
            </button>
          </div>

          {/* Card 2: Nhập mã phòng */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-slate-700/80 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
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
                onChange={(e) => {
                  setRoomCodeInput(e.target.value.toUpperCase());
                  setJoinError(null);
                }}
                placeholder="Nhập mã phòng (vd: TL8888)"
                maxLength={8}
                className="flex-1 uppercase font-bold tracking-wider px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition"
              />
              <button
                type="submit"
                id="btn-join-by-code"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>Vào</span>
                <span className="text-lg leading-none">&rarr;</span>
              </button>
            </form>
            {joinError && (
              <p className="text-rose-400 text-xs mt-1.5 font-semibold">⚠️ {joinError}</p>
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
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex text-xs">
                <button
                  type="button"
                  onClick={() => setFilterRule('ALL')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    filterRule === 'ALL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRule('TIEN_LEN_MIEN_NAM')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    filterRule === 'TIEN_LEN_MIEN_NAM' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tiến Lên
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRule('SAM_LOC')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    filterRule === 'SAM_LOC' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sâm Lốc
                </button>
              </div>

              <button
                onClick={fetchRooms}
                id="btn-refresh-rooms"
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition"
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
                const canJoin = !isFull && !isPlaying;

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
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}
                        >
                          {room.rule === 'TIEN_LEN_MIEN_NAM' ? 'Tiến Lên' : 'Sâm Lốc'}
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
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                          canJoin
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isFull ? 'Đã đầy' : isPlaying ? 'Đang chơi' : 'Vào Chơi'}
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
          <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
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
                  Chọn Luật Chơi
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRule('TIEN_LEN_MIEN_NAM')}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      selectedRule === 'TIEN_LEN_MIEN_NAM'
                        ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">♠</span>
                    <span className="font-black text-sm block text-white">Tiến Lên MN</span>
                    <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                      13 lá, so chất Cơ &gt; Rô &gt; Chuồn &gt; Bích, chặt heo.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRule('SAM_LOC')}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
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
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs text-slate-400">
                &bull; Phòng tối đa <strong>4 người chơi</strong>.
                <br />
                &bull; Bạn sẽ tự động trở thành <strong>Chủ phòng (Host)</strong> và có thể chuyển quyền bất cứ lúc nào.
              </div>

              <button
                type="button"
                id="btn-confirm-create-room"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  onCreateRoom(selectedRule);
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer"
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
