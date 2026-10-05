import React, { useState, useEffect } from 'react';
import {
  RoomPublicState,
  ChatMessage,
  PlacedShip,
  ShipOrientation,
  ShipDefinition,
} from '../types';
import { socket } from '../socket';
import { KhungChat } from './KhungChat';
import {
  BAN_TAU_BOARD_SIZE,
  BAN_TAU_SHIPS,
  calculateShipCells,
  validateShipPlacement,
} from '../../server/banTauLogic';
import {
  Anchor,
  Crosshair,
  RotateCw,
  LogOut,
  Trophy,
  Volume2,
  VolumeX,
  MessageSquare,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface BanTauProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
}

export const BanTau: React.FC<BanTauProps> = ({
  roomState,
  myPlayerId,
  chatMessages,
  onLeaveRoom,
}) => {
  const banTau = roomState.banTauState;
  const isSpectator = banTau ? !([banTau.player1Id, banTau.player2Id].includes(myPlayerId)) : true;
  const isPlayer1 = banTau?.player1Id === myPlayerId;
  const myState = isPlayer1 ? banTau?.player1 : banTau?.player2;
  const opponentState = isPlayer1 ? banTau?.player2 : banTau?.player1;
  const isMyTurn = banTau?.phase === 'BATTLE' && banTau.currentTurnPlayerId === myPlayerId;

  // Placement phase state
  const [placedShips, setPlacedShips] = useState<PlacedShip[]>([]);
  const [selectedShipDef, setSelectedShipDef] = useState<ShipDefinition>(BAN_TAU_SHIPS[0]);
  const [orientation, setOrientation] = useState<ShipOrientation>('HORIZONTAL');
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Victory effect
  useEffect(() => {
    if (banTau?.winnerPlayerId && banTau.winnerPlayerId === myPlayerId) {
      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch {
        // ignore
      }
    }
  }, [banTau?.winnerPlayerId, myPlayerId]);

  // Handle cell click during placement
  const handlePlacementCellClick = (x: number, y: number) => {
    if (isReady || banTau?.phase !== 'PLACEMENT') return;
    setActionError(null);

    // Check if ship is already placed, remove existing one first
    const filtered = placedShips.filter((s) => s.shipId !== selectedShipDef.id);
    const validation = validateShipPlacement(
      selectedShipDef.id,
      x,
      y,
      orientation,
      filtered
    );

    if (!validation.valid || !validation.cells) {
      setActionError(validation.reason || 'Vị trí không hợp lệ');
      return;
    }

    const newShip: PlacedShip = {
      shipId: selectedShipDef.id,
      name: selectedShipDef.name,
      size: selectedShipDef.size,
      originX: x,
      originY: y,
      orientation,
      cells: validation.cells,
      hits: 0,
      isSunk: false,
    };

    const nextPlaced = [...filtered, newShip];
    setPlacedShips(nextPlaced);

    // Auto-select next unplaced ship
    const remaining = BAN_TAU_SHIPS.find((s) => !nextPlaced.some((p) => p.shipId === s.id));
    if (remaining) {
      setSelectedShipDef(remaining);
    }
  };

  // Submit fleet
  const handleConfirmFleet = () => {
    if (placedShips.length !== BAN_TAU_SHIPS.length) {
      setActionError('Bạn phải đặt đủ 5 chiến hạm trước khi sẵn sàng!');
      return;
    }
    setActionError(null);
    setIsReady(true);
    socket.emit(
      'BAN_TAU_PLACE_FLEET',
      { roomCode: roomState.code, playerId: myPlayerId, ships: placedShips },
      (res: { success: boolean; message?: string }) => {
        if (!res?.success) {
          setIsReady(false);
          setActionError(res?.message || 'Lỗi gửi đội hình');
        }
      }
    );
  };

  // Random auto placement
  const handleRandomPlacement = () => {
    if (isReady) return;
    const ships: PlacedShip[] = [];
    for (const def of BAN_TAU_SHIPS) {
      let placed = false;
      let tries = 0;
      while (!placed && tries < 200) {
        tries++;
        const ori: ShipOrientation = Math.random() > 0.5 ? 'HORIZONTAL' : 'VERTICAL';
        const rx = Math.floor(Math.random() * (ori === 'HORIZONTAL' ? BAN_TAU_BOARD_SIZE - def.size : BAN_TAU_BOARD_SIZE));
        const ry = Math.floor(Math.random() * (ori === 'VERTICAL' ? BAN_TAU_BOARD_SIZE - def.size : BAN_TAU_BOARD_SIZE));
        const v = validateShipPlacement(def.id, rx, ry, ori, ships);
        if (v.valid && v.cells) {
          ships.push({
            shipId: def.id,
            name: def.name,
            size: def.size,
            originX: rx,
            originY: ry,
            orientation: ori,
            cells: v.cells,
            hits: 0,
            isSunk: false,
          });
          placed = true;
        }
      }
    }
    setPlacedShips(ships);
  };

  // Fire shot
  const handleFire = (x: number, y: number) => {
    if (!isMyTurn || banTau?.phase !== 'BATTLE') return;
    const alreadyFired = myState?.shotsFired.some((s) => s.x === x && s.y === y);
    if (alreadyFired) return;

    setActionError(null);
    socket.emit(
      'BAN_TAU_FIRE',
      { roomCode: roomState.code, playerId: myPlayerId, x, y },
      (res: { success: boolean; message?: string }) => {
        if (!res?.success) {
          setActionError(res?.message || 'Không thể bắn ô này');
        }
      }
    );
  };

  // Play again
  const handleReturnToWaiting = () => {
    socket.emit('PLAYER_RETURN_TO_WAITING', { roomCode: roomState.code, playerId: myPlayerId });
  };

  const isGameOver = banTau?.phase === 'FINISHED' || !!banTau?.winnerPlayerId;
  const isWinner = banTau?.winnerPlayerId === myPlayerId;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Navbar */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-cyan-900/40 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
            <Anchor className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-cyan-300">BẮN TÀU CHIẾN (BATTLESHIP)</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                Phòng {roomState.code}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {banTau?.phase === 'PLACEMENT'
                ? `Giai đoạn xếp đội hình (${banTau.placementTimeRemaining}s)`
                : isGameOver
                ? 'Trận hải chiến kết thúc!'
                : isMyTurn
                ? 'ĐẾN LƯỢT BẠN BẮN!'
                : 'Chờ đối phương khai hỏa...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white relative"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={onLeaveRoom}
            className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 hover:bg-rose-900/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời Phòng</span>
          </button>
        </div>
      </header>

      {/* Action Error Banner */}
      {actionError && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 px-4 py-1.5 text-xs text-rose-300 text-center font-bold">
          {actionError}
        </div>
      )}

      {/* Main Grid Arena */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 flex flex-col gap-6">
        {banTau?.phase === 'PLACEMENT' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Controls: Ships to Place */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Hạm Đội Của Bạn
                </h2>
                <button
                  onClick={() => setOrientation(orientation === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL')}
                  className="px-2.5 py-1 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-300 text-xs font-bold flex items-center gap-1 hover:bg-cyan-900"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{orientation === 'HORIZONTAL' ? 'Ngang' : 'Dọc'}</span>
                </button>
              </div>

              <div className="space-y-2">
                {BAN_TAU_SHIPS.map((ship) => {
                  const isPlaced = placedShips.some((p) => p.shipId === ship.id);
                  const isSelected = selectedShipDef.id === ship.id;
                  return (
                    <button
                      key={ship.id}
                      onClick={() => setSelectedShipDef(ship)}
                      className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-400'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{ship.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-white">{ship.name}</p>
                          <p className="text-[10px] text-slate-400">{ship.size} ô</p>
                        </div>
                      </div>
                      {isPlaced && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleRandomPlacement}
                  disabled={isReady}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition"
                >
                  Tự Động Xếp
                </button>
                <button
                  onClick={handleConfirmFleet}
                  disabled={isReady || placedShips.length !== BAN_TAU_SHIPS.length}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                    isReady
                      ? 'bg-emerald-600 text-white cursor-default'
                      : placedShips.length === BAN_TAU_SHIPS.length
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 hover:brightness-110 cursor-pointer shadow-lg shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isReady ? 'Đã Sẵn Sàng!' : 'Sẵn Sàng'}
                </button>
              </div>
            </div>

            {/* Placement Board Grid */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
              <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
                Bản đồ bố trí hạm đội (10x10)
              </h3>
              <div
                className="grid gap-1 bg-cyan-950/40 p-2 rounded-2xl border border-cyan-900/60 shadow-inner"
                style={{
                  gridTemplateColumns: `repeat(${BAN_TAU_BOARD_SIZE}, minmax(24px, 42px))`,
                  gridTemplateRows: `repeat(${BAN_TAU_BOARD_SIZE}, minmax(24px, 42px))`,
                }}
              >
                {Array.from({ length: BAN_TAU_BOARD_SIZE * BAN_TAU_BOARD_SIZE }).map((_, i) => {
                  const x = i % BAN_TAU_BOARD_SIZE;
                  const y = Math.floor(i / BAN_TAU_BOARD_SIZE);
                  const placedShipOnCell = placedShips.find((s) =>
                    s.cells.some((c) => c.x === x && c.y === y)
                  );
                  const isHoverPreview =
                    hoverCell &&
                    calculateShipCells(
                      hoverCell.x,
                      hoverCell.y,
                      selectedShipDef.size,
                      orientation
                    ).some((c) => c.x === x && c.y === y);

                  return (
                    <div
                      key={i}
                      onClick={() => handlePlacementCellClick(x, y)}
                      onMouseEnter={() => setHoverCell({ x, y })}
                      onMouseLeave={() => setHoverCell(null)}
                      className={`w-full h-full aspect-square rounded-lg flex items-center justify-center border transition-all cursor-pointer select-none ${
                        placedShipOnCell
                          ? 'bg-cyan-600/80 border-cyan-400 text-white shadow-md'
                          : isHoverPreview
                          ? 'bg-cyan-400/40 border-cyan-300'
                          : 'bg-slate-900/80 border-cyan-950/60 hover:border-cyan-700/60'
                      }`}
                    >
                      {placedShipOnCell && <span className="text-xs">⚓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* BATTLE PHASE */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Enemy Radar Grid (Target to Shoot) */}
            <div className="bg-slate-900/90 border border-red-950/50 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
              <div className="flex items-center justify-between w-full mb-3 px-1">
                <div className="flex items-center gap-2 text-rose-400 font-black text-sm uppercase tracking-wider">
                  <Crosshair className="w-4 h-4" />
                  <span>Ra-đa Bắn Địch ({opponentState?.playerName || 'Đối thủ'})</span>
                </div>
                {isMyTurn && (
                  <span className="text-[10px] font-bold bg-rose-500/20 border border-rose-500/50 text-rose-300 px-2 py-0.5 rounded-full animate-pulse">
                    ĐẾN LƯỢT BẮN
                  </span>
                )}
              </div>

              <div
                className="grid gap-1 bg-slate-950 p-2 rounded-2xl border border-rose-950/80 shadow-inner"
                style={{
                  gridTemplateColumns: `repeat(${BAN_TAU_BOARD_SIZE}, minmax(24px, 42px))`,
                  gridTemplateRows: `repeat(${BAN_TAU_BOARD_SIZE}, minmax(24px, 42px))`,
                }}
              >
                {Array.from({ length: BAN_TAU_BOARD_SIZE * BAN_TAU_BOARD_SIZE }).map((_, i) => {
                  const x = i % BAN_TAU_BOARD_SIZE;
                  const y = Math.floor(i / BAN_TAU_BOARD_SIZE);
                  const shot = myState?.shotsFired.find((s) => s.x === x && s.y === y);

                  return (
                    <div
                      key={i}
                      onClick={() => handleFire(x, y)}
                      className={`w-full h-full aspect-square rounded-lg flex items-center justify-center border transition select-none ${
                        shot?.isHit
                          ? 'bg-rose-600 border-rose-400 text-white font-black shadow-lg shadow-rose-600/50'
                          : shot
                          ? 'bg-slate-800/80 border-slate-700 text-slate-500'
                          : isMyTurn
                          ? 'bg-slate-900/90 border-slate-800 hover:border-rose-500 hover:bg-rose-950/40 cursor-crosshair'
                          : 'bg-slate-900/60 border-slate-800/60 cursor-default'
                      }`}
                    >
                      {shot?.isHit ? '💥' : shot ? '💧' : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* My Fleet Grid (Defense / Incoming Hits) */}
            <div className="bg-slate-900/90 border border-cyan-950/50 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
              <div className="flex items-center justify-between w-full mb-3 px-1">
                <div className="flex items-center gap-2 text-cyan-400 font-black text-sm uppercase tracking-wider">
                  <Shield className="w-4 h-4" />
                  <span>Hạm Đội Của Bạn (Phòng Thủ)</span>
                </div>
                <span className="text-[10px] text-cyan-300 font-mono">
                  Bị bắn trúng: {myState?.shotsReceived.filter((s) => s.isHit).length || 0}/17
                </span>
              </div>

              <div
                className="grid gap-1 bg-slate-950 p-2 rounded-2xl border border-cyan-950/80 shadow-inner"
                style={{
                  gridTemplateColumns: `repeat(${BAN_TAU_BOARD_SIZE}, minmax(24px, 42px))`,
                  gridTemplateRows: `repeat(${BAN_TAU_BOARD_SIZE}, minmax(24px, 42px))`,
                }}
              >
                {Array.from({ length: BAN_TAU_BOARD_SIZE * BAN_TAU_BOARD_SIZE }).map((_, i) => {
                  const x = i % BAN_TAU_BOARD_SIZE;
                  const y = Math.floor(i / BAN_TAU_BOARD_SIZE);
                  const isMyShip = placedShips.some((s) => s.cells.some((c) => c.x === x && c.y === y));
                  const shotReceived = myState?.shotsReceived.find((s) => s.x === x && s.y === y);

                  return (
                    <div
                      key={i}
                      className={`w-full h-full aspect-square rounded-lg flex items-center justify-center border transition select-none ${
                        shotReceived?.isHit
                          ? 'bg-rose-600/90 border-rose-400 text-white shadow-inner animate-pulse'
                          : shotReceived
                          ? 'bg-slate-800/90 border-slate-700 text-slate-500'
                          : isMyShip
                          ? 'bg-cyan-600/50 border-cyan-500 text-cyan-200'
                          : 'bg-slate-900/60 border-slate-800/60'
                      }`}
                    >
                      {shotReceived?.isHit ? '💥' : shotReceived ? '💧' : isMyShip ? '⚓' : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Game Finished Modal */}
        {isGameOver && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/40">
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide">
                {isWinner ? '🎉 CHIẾN THẮNG!' : 'TRẬN ĐẤU KẾT THÚC'}
              </h2>
              <p className="text-xs text-slate-300 mt-2">
                {isWinner
                  ? 'Bạn đã tiêu diệt toàn bộ hạm đội đối phương!'
                  : 'Đối phương đã đánh chìm hạm đội của bạn!'}
              </p>
              <button
                onClick={handleReturnToWaiting}
                className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black uppercase text-xs tracking-wider shadow-lg shadow-amber-500/30 transition cursor-pointer"
              >
                Về Phòng Chờ
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Chat */}
      {isChatOpen && (
        <KhungChat
          roomCode={roomState.code}
          playerId={myPlayerId}
          chatMessages={chatMessages}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
};
