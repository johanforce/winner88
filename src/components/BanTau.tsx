import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RoomPublicState,
  ChatMessage,
  BanTauState,
  PlacedShip,
  ShipOrientation,
  ShipDefinition,
} from '../types';
import { socket } from '../socket';
import { KhungChat } from './KhungChat';
import { RuleGuideModal } from './RuleGuideModal';
import {
  Anchor,
  Crosshair,
  RotateCw,
  Shuffle,
  CheckCircle2,
  AlertTriangle,
  Flag,
  Volume2,
  VolumeX,
  BookOpen,
  LogOut,
  Crown,
  Shield,
  Award,
  Clock,
  Sparkles,
  MessageSquare,
  Users,
  RotateCcw,
} from 'lucide-react';

const BOARD_SIZE = 10;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const BAN_TAU_SHIPS: ShipDefinition[] = [
  { id: 'carrier', name: 'Tàu Sân Bay', size: 5, color: '#38bdf8', icon: '🚢' },
  { id: 'battleship', name: 'Thiết Giáp Hạm', size: 4, color: '#818cf8', icon: '⚔️' },
  { id: 'cruiser', name: 'Tàu Tuần Dương', size: 3, color: '#34d399', icon: '🛡️' },
  { id: 'submarine', name: 'Tàu Ngầm', size: 3, color: '#fbbf24', icon: '🌊' },
  { id: 'destroyer', name: 'Tàu Khu Trục', size: 2, color: '#f87171', icon: '⚡' },
];

interface BanTauProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
}

// Built-in Web Audio API sound generator - zero external URL dependencies
class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playMiss() {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio safety
    }
  }

  playHit() {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio safety
    }
  }

  playSink() {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      [200, 150, 100, 60].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.18, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.2);
      });
    } catch {
      // Audio safety
    }
  }

  playVictory() {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);
        gain.gain.setValueAtTime(0.2, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.14 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.3);
      });
    } catch {
      // Audio safety
    }
  }
}

const sfx = new SoundFX();

export const BanTau: React.FC<BanTauProps> = ({
  roomState,
  myPlayerId,
  chatMessages,
  onLeaveRoom,
}) => {
  const banTau = roomState.banTauState;
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const player1Info = roomState.players.find((p) => p.id === banTau?.player1Id);
  const player2Info = roomState.players.find((p) => p.id === banTau?.player2Id);

  const isPlayer1 = banTau?.player1Id === myPlayerId;
  const isPlayer2 = banTau?.player2Id === myPlayerId;
  const isCommander = isPlayer1 || isPlayer2;
  const isSpectator = !isCommander;

  // Sound settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  useEffect(() => {
    sfx.enabled = soundEnabled;
  }, [soundEnabled]);

  // Modals & tabs
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'RADAR' | 'FLEET' | 'CHAT'>('RADAR');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Placement phase state
  const [selectedShipIndex, setSelectedShipIndex] = useState<number>(0);
  const [orientation, setOrientation] = useState<ShipOrientation>('HORIZONTAL');
  const [placedShips, setPlacedShips] = useState<PlacedShip[]>([]);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [isReadySubmitting, setIsReadySubmitting] = useState(false);

  // Audio triggering on shot updates
  const prevShotsLengthRef = useRef(banTau?.shotHistory?.length || 0);
  useEffect(() => {
    if (!banTau?.shotHistory) return;
    const len = banTau.shotHistory.length;
    if (len > prevShotsLengthRef.current) {
      const lastShot = banTau.shotHistory[len - 1];
      if (lastShot.shipSunkName) {
        sfx.playSink();
      } else if (lastShot.isHit) {
        sfx.playHit();
      } else {
        sfx.playMiss();
      }
    }
    prevShotsLengthRef.current = len;
  }, [banTau?.shotHistory]);

  // Audio triggering on victory
  useEffect(() => {
    if (banTau?.winnerPlayerId) {
      sfx.playVictory();
    }
  }, [banTau?.winnerPlayerId]);

  // Listen for my ships sync from server
  useEffect(() => {
    const handleMyShips = (ships: PlacedShip[]) => {
      if (ships && ships.length > 0) {
        setPlacedShips(ships);
      }
    };
    socket.on('BAN_TAU_MY_SHIPS', handleMyShips);

    if (isCommander && roomState.code) {
      socket.emit(
        'BAN_TAU_GET_MY_SHIPS',
        { roomCode: roomState.code, playerId: myPlayerId },
        (res: { success: boolean; ships?: PlacedShip[] }) => {
          if (res.success && res.ships && res.ships.length > 0) {
            setPlacedShips(res.ships);
          }
        }
      );
    }

    return () => {
      socket.off('BAN_TAU_MY_SHIPS', handleMyShips);
    };
  }, [isCommander, roomState.code, myPlayerId]);

  // Placement validation helper
  const checkPlacementValid = (
    def: ShipDefinition,
    originX: number,
    originY: number,
    orient: ShipOrientation,
    excludeShipId: string
  ): { valid: boolean; cells: { x: number; y: number }[] } => {
    const cells: { x: number; y: number }[] = [];
    for (let i = 0; i < def.size; i++) {
      const x = orient === 'HORIZONTAL' ? originX + i : originX;
      const y = orient === 'HORIZONTAL' ? originY : originY + i;
      if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
        return { valid: false, cells: [] };
      }
      cells.push({ x, y });
    }

    // Check collision with other placed ships
    for (const ship of placedShips) {
      if (ship.shipId === excludeShipId) continue;
      for (const shipCell of ship.cells) {
        if (cells.some((c) => c.x === shipCell.x && c.y === shipCell.y)) {
          return { valid: false, cells: [] };
        }
      }
    }

    return { valid: true, cells };
  };

  // Hover preview calculation
  const hoverPreview = useMemo(() => {
    if (!hoverCell || banTau?.phase !== 'PLACEMENT' || !isCommander) return null;
    const isReady = isPlayer1 ? banTau.player1.isReady : banTau.player2.isReady;
    if (isReady) return null;

    const shipDef = BAN_TAU_SHIPS[selectedShipIndex];
    if (!shipDef) return null;

    const { valid, cells } = checkPlacementValid(
      shipDef,
      hoverCell.x,
      hoverCell.y,
      orientation,
      shipDef.id
    );

    const virtualCells: { x: number; y: number }[] = [];
    for (let i = 0; i < shipDef.size; i++) {
      const x = orientation === 'HORIZONTAL' ? hoverCell.x + i : hoverCell.x;
      const y = orientation === 'HORIZONTAL' ? hoverCell.y : hoverCell.y + i;
      if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
        virtualCells.push({ x, y });
      }
    }

    return {
      valid,
      cells: valid ? cells : virtualCells,
    };
  }, [hoverCell, banTau?.phase, isCommander, isPlayer1, banTau, selectedShipIndex, orientation, placedShips]);

  // Handle cell click during placement
  const handlePlacementClick = (x: number, y: number) => {
    if (!isCommander || banTau?.phase !== 'PLACEMENT') return;
    const isReady = isPlayer1 ? banTau.player1.isReady : banTau.player2.isReady;
    if (isReady) return;

    const shipDef = BAN_TAU_SHIPS[selectedShipIndex];
    const { valid, cells } = checkPlacementValid(shipDef, x, y, orientation, shipDef.id);

    if (!valid) {
      setErrorMsg('Vị trí đặt tàu không hợp lệ hoặc va chạm vào tàu khác!');
      return;
    }
    setErrorMsg(null);

    const newPlacedShip: PlacedShip = {
      shipId: shipDef.id,
      name: shipDef.name,
      size: shipDef.size,
      originX: x,
      originY: y,
      orientation,
      cells,
      hits: 0,
      isSunk: false,
    };

    const remainingShips = placedShips.filter((s) => s.shipId !== shipDef.id);
    const updatedFleet = [...remainingShips, newPlacedShip];
    setPlacedShips(updatedFleet);

    // Sync placement to server
    socket.emit('BAN_TAU_PLACE_SHIPS', {
      roomCode: roomState.code,
      playerId: myPlayerId,
      ships: updatedFleet,
    });

    // Move to next unplaced ship
    const nextUnplacedIndex = BAN_TAU_SHIPS.findIndex(
      (s) => !updatedFleet.some((p) => p.shipId === s.id)
    );
    if (nextUnplacedIndex !== -1) {
      setSelectedShipIndex(nextUnplacedIndex);
    }
  };

  // Auto Place button handler
  const handleAutoPlace = () => {
    setErrorMsg(null);
    socket.emit(
      'BAN_TAU_AUTO_PLACE',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
      },
      (res: { success: boolean; ships?: PlacedShip[]; message?: string }) => {
        if (res.success && res.ships) {
          setPlacedShips(res.ships);
        } else {
          setErrorMsg(res.message || 'Không thể tự động xếp tàu');
        }
      }
    );
  };

  // Ready button handler
  const handleReady = () => {
    if (placedShips.length < 5) {
      setErrorMsg('Bạn phải bố trí đủ 5 chiến hạm trước khi tuyên bố sẵn sàng!');
      return;
    }
    setErrorMsg(null);
    setIsReadySubmitting(true);
    socket.emit(
      'BAN_TAU_READY',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
      },
      (res: { success: boolean; message?: string }) => {
        setIsReadySubmitting(false);
        if (!res.success) {
          setErrorMsg(res.message || 'Không thể xác nhận sẵn sàng');
        }
      }
    );
  };

  // Clear all ships
  const handleResetShips = () => {
    setPlacedShips([]);
    setSelectedShipIndex(0);
  };

  // Fire missile handler
  const handleFire = (x: number, y: number) => {
    if (!isCommander || banTau?.phase !== 'BATTLE') return;
    if (banTau.currentTurnPlayerId !== myPlayerId) {
      setErrorMsg('Chưa tới lượt khai hỏa của bạn!');
      return;
    }

    const myPlayerState = isPlayer1 ? banTau.player1 : banTau.player2;
    const alreadyFired = myPlayerState.shotsFired.some((s) => s.x === x && s.y === y);
    if (alreadyFired) return;

    setErrorMsg(null);
    socket.emit(
      'BAN_TAU_FIRE',
      {
        roomCode: roomState.code,
        playerId: myPlayerId,
        x,
        y,
      },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setErrorMsg(res.message || 'Lỗi khai hỏa');
        }
      }
    );
  };

  // Resign button
  const handleResign = () => {
    if (!window.confirm('Bạn có chắc chắn muốn đầu hàng ván hải chiến này không?')) return;
    socket.emit('BAN_TAU_RESIGN', {
      roomCode: roomState.code,
      playerId: myPlayerId,
    });
  };

  // Return player to waiting room
  const handleResetToWaiting = () => {
    setErrorMsg(null);
    socket.emit(
      'PLAYER_RETURN_TO_WAITING',
      { roomCode: roomState.code, playerId: myPlayerId },
      (res: { success: boolean; message?: string }) => {
        if (!res.success) {
          setErrorMsg(res.message || 'Không thể về phòng chờ');
        }
      }
    );
  };

  if (!banTau) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-3">⚓</div>
          <p className="text-slate-400">Đang khởi tạo trận địa hải quân...</p>
        </div>
      </div>
    );
  }

  const isMyTurn = isCommander && banTau.phase === 'BATTLE' && banTau.currentTurnPlayerId === myPlayerId;
  const myPlayerState = isPlayer1 ? banTau.player1 : banTau.player2;
  const oppPlayerState = isPlayer1 ? banTau.player2 : banTau.player1;
  const myReady = isPlayer1 ? banTau.player1.isReady : banTau.player2.isReady;

  // Active ships for my fleet view
  const myActiveFleet = placedShips.length > 0 ? placedShips : myPlayerState?.revealedShips || [];

  // Helper to check if a cell contains one of my ships
  const getMyShipAt = (x: number, y: number): PlacedShip | undefined => {
    return myActiveFleet.find((s) => s.cells.some((c) => c.x === x && c.y === y));
  };

  // Helper to get shot on opponent's waters
  const getMyShotAt = (x: number, y: number) => {
    return myPlayerState?.shotsFired.find((s) => s.x === x && s.y === y);
  };

  // Helper to get shot received on my waters
  const getEnemyShotAt = (x: number, y: number) => {
    return myPlayerState?.shotsReceived.find((s) => s.x === x && s.y === y);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Anchor className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-wide text-white">
                  HẢI CHIẾN BẮN TÀU
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                  {roomState.code}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {banTau.phase === 'PLACEMENT'
                  ? 'Giai đoạn dàn trận hạm đội bí mật'
                  : banTau.phase === 'BATTLE'
                  ? 'Giai đoạn khai hỏa tọa độ'
                  : 'Trận chiến đã kết thúc'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={() => setIsRuleModalOpen(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Luật chơi</span>
          </button>

          {isCommander && banTau.phase === 'BATTLE' && (
            <button
              onClick={handleResign}
              className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1.5 transition"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đầu hàng</span>
            </button>
          )}

          {banTau.phase === 'FINISHED' && (
            <button
              type="button"
              onClick={handleResetToWaiting}
              id="btn-bantau-header-back-waiting"
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Quay Về Phòng Chờ</span>
            </button>
          )}

          <button
            onClick={onLeaveRoom}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rời phòng</span>
          </button>
        </div>
      </header>

      {/* Duel Status Bar */}
      <div className="bg-slate-900/80 border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Commander 1 */}
          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-2xl border transition-all w-full md:w-auto ${
              banTau.currentTurnPlayerId === banTau.player1Id && banTau.phase === 'BATTLE'
                ? 'bg-cyan-950/60 border-cyan-500 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/40'
                : 'bg-slate-950/50 border-slate-800'
            }`}
          >
            <span className="text-3xl p-1 rounded-xl bg-slate-900 border border-slate-800">
              {player1Info?.avatar || '⚓'}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-white">
                  {player1Info?.name || 'Hạm Đội 1'}
                </span>
                {isPlayer1 && (
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.2 rounded font-bold">
                    Bạn
                  </span>
                )}
                {player1Info?.isHost && (
                  <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{player1Info?.score || 0} xu</span>
                {banTau.phase === 'PLACEMENT' ? (
                  <span
                    className={`font-semibold ${
                      banTau.player1.isReady ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {banTau.player1.isReady ? '● Đã sẵn sàng' : '○ Đang bố trí...'}
                  </span>
                ) : (
                  <span className="text-cyan-300 font-mono font-bold">
                    Bắn trúng: {banTau.player1.totalHitsDealt}/17 ô
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Central Turn / Timer */}
          <div className="flex flex-col items-center text-center">
            {banTau.phase === 'PLACEMENT' ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-300">Giai Đoạn Bố Trí Hạm Đội</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono font-bold mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>{roomState.turnTimeRemaining || banTau.placementTimeRemaining || 90}s</span>
                </span>
              </div>
            ) : banTau.phase === 'BATTLE' ? (
              <div className="flex flex-col items-center">
                <div
                  className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wide border flex items-center gap-2 ${
                    isMyTurn
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30 animate-pulse'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5 text-current" />
                  <span>
                    {isMyTurn
                      ? 'LƯỢT CỦA BẠN - HÃY CHỌN Ô BẮN!'
                      : `Đang chờ ${
                          banTau.currentTurnPlayerId === banTau.player1Id
                            ? player1Info?.name
                            : player2Info?.name
                        } khai hỏa...`}
                  </span>
                </div>
                <span className="text-[11px] text-amber-400 font-mono font-bold mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{banTau.turnTimeRemaining}s</span>
                </span>
              </div>
            ) : (
              <div className="px-4 py-1.5 rounded-full bg-amber-950/60 border border-amber-800 text-amber-300 text-xs font-black flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>TRẬN CHIẾN KẾT THÚC</span>
              </div>
            )}
          </div>

          {/* Commander 2 */}
          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-2xl border transition-all w-full md:w-auto justify-end md:justify-start ${
              banTau.currentTurnPlayerId === banTau.player2Id && banTau.phase === 'BATTLE'
                ? 'bg-rose-950/60 border-rose-500 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/40'
                : 'bg-slate-950/50 border-slate-800'
            }`}
          >
            <div className="text-right md:text-left">
              <div className="flex items-center gap-1.5 justify-end md:justify-start">
                {player2Info?.isHost && (
                  <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                )}
                {isPlayer2 && (
                  <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.2 rounded font-bold">
                    Bạn
                  </span>
                )}
                <span className="font-extrabold text-sm text-white">
                  {player2Info?.name || 'Hạm Đội 2'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 justify-end md:justify-start">
                <span>{player2Info?.score || 0} xu</span>
                {banTau.phase === 'PLACEMENT' ? (
                  <span
                    className={`font-semibold ${
                      banTau.player2.isReady ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {banTau.player2.isReady ? '● Đã sẵn sàng' : '○ Đang bố trí...'}
                  </span>
                ) : (
                  <span className="text-rose-300 font-mono font-bold">
                    Bắn trúng: {banTau.player2.totalHitsDealt}/17 ô
                  </span>
                )}
              </div>
            </div>
            <span className="text-3xl p-1 rounded-xl bg-slate-900 border border-slate-800">
              {player2Info?.avatar || '🚀'}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Tab switcher */}
      <div className="lg:hidden flex border-b border-slate-800 bg-slate-950/80 px-4 pt-2">
        <button
          onClick={() => setActiveViewTab('RADAR')}
          className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
            activeViewTab === 'RADAR'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400'
          }`}
        >
          <Crosshair className="w-4 h-4" />
          <span>{isCommander ? 'Bắn Tàu Đối Thủ' : 'Chiến Trường'}</span>
        </button>
        {isCommander && (
          <button
            onClick={() => setActiveViewTab('FLEET')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeViewTab === 'FLEET'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Hạm Đội Của Bạn</span>
          </button>
        )}
        <button
          onClick={() => setActiveViewTab('CHAT')}
          className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
            activeViewTab === 'CHAT'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Trò Chuyện</span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col lg:flex-row gap-6">
        {/* Left Side: Game Boards & Controls */}
        <div className="flex-1 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                {errorMsg}
              </span>
              <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white font-bold ml-2">
                ✕
              </button>
            </div>
          )}

          {/* PHASE 1: PLACEMENT VIEW */}
          {banTau.phase === 'PLACEMENT' && (
            <div className="flex flex-col gap-5">
              {isCommander ? (
                <div className="flex flex-col xl:flex-row gap-6 items-start">
                  {/* Placement Grid */}
                  <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl w-full xl:w-auto">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <h2 className="text-sm font-bold text-white">Bố Trí Hạm Đội Của Bạn</h2>
                      </div>
                      <span className="text-xs text-slate-400">
                        Đã đặt: <strong className="text-cyan-300">{placedShips.length}/5</strong> tàu
                      </span>
                    </div>

                    {/* 10x10 Grid */}
                    <div className="inline-block bg-slate-950 p-2 rounded-xl border border-slate-800 select-none">
                      {/* Column letters */}
                      <div className="flex">
                        <div className="w-6 h-6 sm:w-8 sm:h-8" />
                        {LETTERS.map((letter) => (
                          <div
                            key={letter}
                            className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-[10px] sm:text-xs font-bold text-slate-500 font-mono"
                          >
                            {letter}
                          </div>
                        ))}
                      </div>

                      {/* Rows */}
                      {Array.from({ length: BOARD_SIZE }).map((_, y) => (
                        <div key={y} className="flex">
                          {/* Row number */}
                          <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-[10px] sm:text-xs font-bold text-slate-500 font-mono">
                            {y + 1}
                          </div>

                          {/* 10 cells */}
                          {Array.from({ length: BOARD_SIZE }).map((_, x) => {
                            const shipHere = getMyShipAt(x, y);
                            const isHovered =
                              hoverPreview?.cells.some((c) => c.x === x && c.y === y) || false;
                            const isHoverValid = hoverPreview?.valid;

                            return (
                              <button
                                key={`${x}-${y}`}
                                type="button"
                                disabled={myReady}
                                onMouseEnter={() => setHoverCell({ x, y })}
                                onMouseLeave={() => setHoverCell(null)}
                                onClick={() => handlePlacementClick(x, y)}
                                className={`w-6 h-6 sm:w-8 sm:h-8 border border-slate-800/80 transition-all flex items-center justify-center text-xs cursor-pointer ${
                                  isHovered
                                    ? isHoverValid
                                      ? 'bg-emerald-500/50 border-emerald-400 shadow-inner'
                                      : 'bg-rose-500/50 border-rose-400'
                                    : shipHere
                                    ? 'bg-cyan-700/80 border-cyan-500 text-cyan-200'
                                    : 'bg-slate-900 hover:bg-slate-800/60'
                                }`}
                              >
                                {shipHere && !isHovered && <span className="text-[10px]">⚓</span>}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Rê chuột lên lưới để xem vị trí đặt tàu. Bấm vào ô để đặt.</span>
                    </div>
                  </div>

                  {/* Placement Controls Sidebar */}
                  <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex-1 w-full space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white mb-2">Chọn Chiến Hạm Cần Đặt</h3>
                      <div className="space-y-2">
                        {BAN_TAU_SHIPS.map((ship, idx) => {
                          const isPlaced = placedShips.some((s) => s.shipId === ship.id);
                          const isSelected = selectedShipIndex === idx;

                          return (
                            <button
                              key={ship.id}
                              type="button"
                              disabled={myReady}
                              onClick={() => setSelectedShipIndex(idx)}
                              className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-950/80 border-cyan-500 ring-1 ring-cyan-500/40 text-white'
                                  : isPlaced
                                  ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-xl">{ship.icon}</span>
                                <div>
                                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <span>{ship.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-mono">
                                      {ship.size} ô
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400">
                                    Độ dài: {ship.size} ô trên chiến trường
                                  </span>
                                </div>
                              </div>
                              {isPlaced ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-400">Chưa đặt</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Orientation Toggle */}
                    <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-xs font-semibold text-slate-300">Hướng đặt:</span>
                      <button
                        type="button"
                        disabled={myReady}
                        onClick={() =>
                          setOrientation((prev) => (prev === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL'))
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>{orientation === 'HORIZONTAL' ? 'Ngang (↔)' : 'Dọc (↕)'}</span>
                      </button>
                    </div>

                    {/* Quick Tools */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={myReady}
                        onClick={handleAutoPlace}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Xếp Ngẫu Nhiên</span>
                      </button>
                      <button
                        type="button"
                        disabled={myReady}
                        onClick={handleResetShips}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <span>Đặt Lại Hết</span>
                      </button>
                    </div>

                    {/* Ready Confirmation */}
                    <div>
                      {myReady ? (
                        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-center text-xs font-bold text-emerald-300 flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Đã sẵn sàng! Đang chờ đối thủ hoàn tất...</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isReadySubmitting || placedShips.length < 5}
                          onClick={handleReady}
                          className={`w-full py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                            placedShips.length === 5
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-700/30 active:scale-95 animate-pulse'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>SẴN SÀNG CHIẾN ĐẤU</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Spectator during placement */
                <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-2xl text-center flex flex-col items-center justify-center min-h-[300px]">
                  <div className="text-4xl mb-3 animate-bounce">🚢</div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Hai Thuyền Trưởng Đang Bố Trí Hạm Đội Bí Mật
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md">
                    Chiến trường đang được chuẩn bị kín đáo. Bạn đang trong vai trò khán giả quan sát. Khi cả hai bên hoàn tất đặt tàu, hải chiến sẽ tự động bùng nổ!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PHASE 2 & 3: BATTLE & FINISHED VIEW */}
          {(banTau.phase === 'BATTLE' || banTau.phase === 'FINISHED') && (
            <div className="flex flex-col gap-5">
              {/* Winner Banner if Finished */}
              {banTau.phase === 'FINISHED' && (
                <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 border-2 border-amber-500/60 p-5 rounded-2xl shadow-xl text-center animate-fadeIn">
                  <div className="text-4xl mb-2">🏆</div>
                  <h2 className="text-lg sm:text-xl font-black text-amber-300">
                    {banTau.winnerPlayerId === myPlayerId
                      ? 'CHIẾN THẮNG TUYỆT ĐỐI! BẠN ĐÃ BẮN CHÌM TOÀN BỘ HẠM ĐỘI ĐỐI PHƯƠNG!'
                      : `${
                          banTau.winnerPlayerId === banTau.player1Id
                            ? player1Info?.name
                            : player2Info?.name
                        } ĐÃ GIÀNH CHIẾN THẮNG!`}
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Hải chiến kết thúc. Toàn bộ vị trí tàu của cả hai bên đã được hiển thị công khai trên bản đồ.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleResetToWaiting}
                      id="btn-bantau-back-waiting"
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      <span>Quay Về Phòng Chờ</span>
                    </button>
                    <button
                      type="button"
                      onClick={onLeaveRoom}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Rời Bàn</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Dual Boards (Desktop: Side-by-side, Mobile: Tabbed) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Board 1: Target Grid (Opponent's waters) */}
                <div
                  className={`bg-slate-900/90 border rounded-2xl p-4 shadow-xl transition-all ${
                    activeViewTab === 'RADAR' ? 'block' : 'hidden xl:block'
                  } ${
                    isMyTurn
                      ? 'border-emerald-500/60 shadow-emerald-950/20 ring-2 ring-emerald-500/20'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-rose-400" />
                      <h3 className="text-sm font-extrabold text-white">
                        {isCommander
                          ? 'VÙNG BIỂN ĐỐI THỦ (Mục tiêu ngắm bắn)'
                          : `VÙNG BIỂN ${player2Info?.name || 'Hạm Đội 2'}`}
                      </h3>
                    </div>
                    {isMyTurn && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold animate-pulse">
                        Bấm vào ô để nã đạn 🎯
                      </span>
                    )}
                  </div>

                  {/* 10x10 Target Board */}
                  <div className="inline-block bg-slate-950 p-2 rounded-xl border border-slate-800 select-none">
                    {/* Column letters */}
                    <div className="flex">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                      {LETTERS.map((l) => (
                        <div
                          key={l}
                          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center text-[10px] sm:text-xs font-bold text-slate-500 font-mono"
                        >
                          {l}
                        </div>
                      ))}
                    </div>

                    {/* Rows */}
                    {Array.from({ length: BOARD_SIZE }).map((_, y) => (
                      <div key={y} className="flex">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center text-[10px] sm:text-xs font-bold text-slate-500 font-mono">
                          {y + 1}
                        </div>

                        {Array.from({ length: BOARD_SIZE }).map((_, x) => {
                          const myShot = isCommander
                            ? getMyShotAt(x, y)
                            : banTau.player1.shotsFired.find((s) => s.x === x && s.y === y);

                          const isFinished = banTau.phase === 'FINISHED';
                          const oppRevealedShip = isFinished
                            ? oppPlayerState?.revealedShips?.find((s) =>
                                s.cells.some((c) => c.x === x && c.y === y)
                              )
                            : undefined;

                          const canShoot = isMyTurn && !myShot;

                          return (
                            <button
                              key={`t-${x}-${y}`}
                              type="button"
                              disabled={!canShoot}
                              onClick={() => handleFire(x, y)}
                              className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 border border-slate-800/80 transition-all flex items-center justify-center text-xs ${
                                myShot?.isHit
                                  ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                                  : myShot && !myShot.isHit
                                  ? 'bg-slate-800/80 border-slate-700 text-slate-400'
                                  : isFinished && oppRevealedShip
                                  ? 'bg-cyan-900/60 border-cyan-700 text-cyan-300'
                                  : canShoot
                                  ? 'bg-slate-900 hover:bg-emerald-950/60 hover:border-emerald-500/80 cursor-crosshair active:scale-95'
                                  : 'bg-slate-900/90'
                              }`}
                            >
                              {myShot?.isHit ? (
                                <span className="text-[12px] sm:text-sm filter drop-shadow">💥</span>
                              ) : myShot && !myShot.isHit ? (
                                <span className="text-[10px] sm:text-xs text-sky-300 font-bold">💦</span>
                              ) : isFinished && oppRevealedShip ? (
                                <span className="text-[10px]">⚓</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Sunk ships status list */}
                  <div className="mt-3 grid grid-cols-5 gap-1 text-center">
                    {BAN_TAU_SHIPS.map((conf) => {
                      const isSunk = oppPlayerState?.sunkShips.some(
                        (s) => s.shipId === conf.id || s.name === conf.name
                      );
                      return (
                        <div
                          key={conf.id}
                          className={`p-1 rounded-lg border text-[10px] ${
                            isSunk
                              ? 'bg-rose-950/60 border-rose-800 text-rose-400 line-through'
                              : 'bg-slate-950 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="block text-sm">{conf.icon}</span>
                          <span className="block truncate font-semibold">{conf.name}</span>
                          <span className="font-mono text-[9px]">
                            {isSunk ? 'CHÌM 💀' : `${conf.size} ô`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Board 2: Fleet Grid (My waters / Player 1 waters) */}
                <div
                  className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl ${
                    activeViewTab === 'FLEET' ? 'block' : 'hidden xl:block'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-extrabold text-white">
                        {isCommander
                          ? 'HẠM ĐỘI CỦA BẠN (Phòng thủ)'
                          : `VÙNG BIỂN ${player1Info?.name || 'Hạm Đội 1'}`}
                      </h3>
                    </div>
                    <span className="text-xs text-cyan-400 font-mono">
                      {5 - (myPlayerState?.sunkShips.length || 0)}/5 chiến hạm sống sót
                    </span>
                  </div>

                  {/* 10x10 Fleet Board */}
                  <div className="inline-block bg-slate-950 p-2 rounded-xl border border-slate-800 select-none">
                    {/* Column letters */}
                    <div className="flex">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                      {LETTERS.map((l) => (
                        <div
                          key={l}
                          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center text-[10px] sm:text-xs font-bold text-slate-500 font-mono"
                        >
                          {l}
                        </div>
                      ))}
                    </div>

                    {/* Rows */}
                    {Array.from({ length: BOARD_SIZE }).map((_, y) => (
                      <div key={y} className="flex">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center text-[10px] sm:text-xs font-bold text-slate-500 font-mono">
                          {y + 1}
                        </div>

                        {Array.from({ length: BOARD_SIZE }).map((_, x) => {
                          const enemyShot = isCommander
                            ? getEnemyShotAt(x, y)
                            : banTau.player2.shotsFired.find((s) => s.x === x && s.y === y);

                          const myShip = isCommander
                            ? getMyShipAt(x, y)
                            : banTau.player1.revealedShips?.find((s) =>
                                s.cells.some((c) => c.x === x && c.y === y)
                              );

                          return (
                            <div
                              key={`f-${x}-${y}`}
                              className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 border border-slate-800/80 flex items-center justify-center text-xs ${
                                enemyShot?.isHit
                                  ? 'bg-rose-700 border-rose-500 text-white animate-pulse'
                                  : enemyShot && !enemyShot.isHit
                                  ? 'bg-slate-800/80 border-slate-700 text-slate-400'
                                  : myShip
                                  ? 'bg-cyan-900/80 border-cyan-600 text-cyan-200'
                                  : 'bg-slate-900/90'
                              }`}
                            >
                              {enemyShot?.isHit ? (
                                <span className="text-[12px] sm:text-sm">💥</span>
                              ) : enemyShot && !enemyShot.isHit ? (
                                <span className="text-[10px] sm:text-xs text-sky-300 font-bold">💦</span>
                              ) : myShip ? (
                                <span className="text-[10px]">⚓</span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Sunk status list for my ships */}
                  <div className="mt-3 grid grid-cols-5 gap-1 text-center">
                    {BAN_TAU_SHIPS.map((conf) => {
                      const isSunk = myPlayerState?.sunkShips.some(
                        (s) => s.shipId === conf.id || s.name === conf.name
                      );
                      return (
                        <div
                          key={conf.id}
                          className={`p-1 rounded-lg border text-[10px] ${
                            isSunk
                              ? 'bg-rose-950/60 border-rose-800 text-rose-400 line-through'
                              : 'bg-slate-950 border-slate-800 text-cyan-300'
                          }`}
                        >
                          <span className="block text-sm">{conf.icon}</span>
                          <span className="block truncate font-semibold">{conf.name}</span>
                          <span className="font-mono text-[9px]">
                            {isSunk ? 'CHÌM 💀' : `${conf.size} ô`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Shot Log Feed */}
              {banTau.shotHistory && banTau.shotHistory.length > 0 && (
                <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-2xl">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Nhật Ký Tác Chiến Gần Nhất
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs font-mono">
                    {banTau.shotHistory.slice(-6).reverse().map((shot, idx) => {
                      const isMe = shot.shooterId === myPlayerId;
                      const shooterName =
                        shot.shooterId === banTau.player1Id
                          ? player1Info?.name
                          : player2Info?.name;
                      const coordStr = `${LETTERS[shot.x]}${shot.y + 1}`;

                      return (
                        <div
                          key={idx}
                          className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                            shot.isHit
                              ? 'bg-rose-950/60 border-rose-800 text-rose-300 font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span>{shot.isHit ? '💥' : '💦'}</span>
                          <span>
                            {isMe ? 'Bạn' : shooterName}: {coordStr} (
                            {shot.shipSunkName
                              ? `ĐÁNH CHÌM ${shot.shipSunkName.toUpperCase()}!`
                              : shot.isHit
                              ? 'TRÚNG ĐÍCH'
                              : 'TRƯỢT'}
                            )
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Chat Panel */}
        <div
          className={`w-full lg:w-80 xl:w-[340px] shrink-0 h-[480px] lg:h-[560px] ${
            activeViewTab === 'CHAT' ? 'block' : 'hidden lg:block'
          }`}
        >
          <KhungChat
            chatMessages={chatMessages}
            myPlayerId={myPlayerId}
            roomCode={roomState.code}
          />
        </div>
      </main>

      {/* Rules Modal */}
      <RuleGuideModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        initialRule="BAN_TAU"
      />
    </div>
  );
};
