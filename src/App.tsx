import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getOrCreatePlayerProfile,
  saveLastRoomCode,
  getLastRoomCode,
  clearLastRoomCode,
  savePlayerScore,
  socket,
} from './socket';
import {
  GameRule,
  RoomPublicState,
  Card,
  ChatMessage,
  XiangqiTimeMode,
} from './types';
import { TrangDatTen } from './components/TrangDatTen';
import { Lobby } from './components/Lobby';
import { PhongChoi } from './components/PhongChoi';
import { BanChoi } from './components/BanChoi';
import { BanCoTuong } from './components/BanCoTuong';
import { BanCaro } from './components/BanCaro';
import { VoiceChatProvider } from './context/VoiceChatContext';
import { VoiceChatWidget } from './components/VoiceChatWidget';
import { WifiOff, AlertTriangle } from 'lucide-react';

export default function App() {
  const [profile, setProfile] = useState(() => getOrCreatePlayerProfile());
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const [currentScreen, setCurrentScreen] = useState<'NAME_INPUT' | 'LOBBY' | 'ROOM'>(
    () => (profile.name ? 'LOBBY' : 'NAME_INPUT')
  );

  const [roomState, setRoomState] = useState<RoomPublicState | null>(null);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [showDisconnectBanner, setShowDisconnectBanner] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const isReconnectingRef = useRef(false);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-reconnect attempt on load
  const attemptReconnect = useCallback((roomCode: string) => {
    if (isReconnectingRef.current) return;
    const prof = profileRef.current;
    if (!prof.name) return;

    isReconnectingRef.current = true;
    socket.emit(
      'ROOM_JOIN',
      {
        roomCode,
        playerId: prof.id,
        playerName: prof.name,
        playerAvatar: prof.avatar,
        reconnectToken: prof.reconnectToken,
        initialScore: prof.score,
      },
      (res: { success: boolean; message?: string }) => {
        isReconnectingRef.current = false;
        if (!res.success) {
          clearLastRoomCode();
          setRoomState(null);
          setCurrentScreen('LOBBY');
        } else {
          saveLastRoomCode(roomCode);
          setCurrentScreen('ROOM');
        }
      }
    );
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      // Khi kết nối (hoặc phục hồi phiên thành công), hủy ngay bộ đếm và tắt banner cảnh báo
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setShowDisconnectBanner(false);

      // If we were in a room before disconnecting, attempt to rejoin
      const lastRoom = getLastRoomCode();
      if (lastRoom && profileRef.current.name) {
        attemptReconnect(lastRoom);
      }
    };

    const onDisconnect = () => {
      setIsConnected(false);
      // Chỉ kích hoạt banner nếu ngắt kết nối kéo dài quá 4.5 giây (tránh giật lag/báo đỏ khi hết session rồi nối lại tức thì)
      if (!disconnectTimerRef.current) {
        disconnectTimerRef.current = setTimeout(() => {
          setShowDisconnectBanner(true);
        }, 4500);
      }
    };

    const onRoomState = (state: RoomPublicState) => {
      const currentProf = profileRef.current;
      const me = state.players.find((p) => p.id === currentProf.id);

      // Nếu người chơi này không còn trong danh sách players (đã rời phòng), chuyển về LOBBY ngay
      if (!me) {
        clearLastRoomCode();
        setRoomState(null);
        setPlayerCards([]);
        setChatMessages([]);
        setCurrentScreen('LOBBY');
        return;
      }

      setRoomState(state);
      setCurrentScreen('ROOM');
      saveLastRoomCode(state.code);

      // Đồng bộ số xu ví từ server về client
      if (typeof me.score === 'number' && me.score !== currentProf.score) {
        savePlayerScore(me.score);
        setProfile((prev) => (prev.score === me.score ? prev : { ...prev, score: me.score }));
      }

      if (state.status === 'PLAYING' && currentProf.id) {
        socket.emit('GAME_GET_MY_CARDS', {
          roomCode: state.code,
          playerId: currentProf.id,
        });
      }
    };

    const onPlayerCards = (cards: Card[]) => {
      setPlayerCards(cards || []);
    };

    const onChatHistory = (messages: ChatMessage[]) => {
      setChatMessages(messages || []);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('ROOM_STATE', onRoomState);
    socket.on('PLAYER_CARDS', onPlayerCards);
    socket.on('CHAT_HISTORY', onChatHistory);

    // Initial check: if socket is already connected and last room exists
    const lastRoom = getLastRoomCode();
    if (lastRoom && profileRef.current.name && socket.connected) {
      attemptReconnect(lastRoom);
    }

    return () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ROOM_STATE', onRoomState);
      socket.off('PLAYER_CARDS', onPlayerCards);
      socket.off('CHAT_HISTORY', onChatHistory);
    };
  }, [attemptReconnect]);

  // Handler: Set name
  const handleProfileComplete = (name: string, avatar: string) => {
    const updated = { ...profile, name, avatar };
    setProfile(updated);
    setCurrentScreen('LOBBY');
  };

  // Handler: Create room
  const handleCreateRoom = (rule: GameRule, xiangqiTimeMode?: XiangqiTimeMode) => {
    setGlobalError(null);
    socket.emit(
      'ROOM_CREATE',
      {
        playerId: profile.id,
        playerName: profile.name,
        playerAvatar: profile.avatar,
        rule,
        reconnectToken: profile.reconnectToken,
        initialScore: profile.score,
        xiangqiTimeMode,
      },
      (res: { success: boolean; roomCode?: string; message?: string }) => {
        if (!res.success) {
          setGlobalError(res.message || 'Không thể tạo phòng');
        } else if (res.roomCode) {
          saveLastRoomCode(res.roomCode);
          setCurrentScreen('ROOM');
        }
      }
    );
  };

  // Handler: Join room by code
  const handleJoinRoom = (code: string) => {
    setGlobalError(null);
    socket.emit(
      'ROOM_JOIN',
      {
        roomCode: code,
        playerId: profile.id,
        playerName: profile.name,
        playerAvatar: profile.avatar,
        reconnectToken: profile.reconnectToken,
        initialScore: profile.score,
      },
      (res: { success: boolean; roomCode?: string; message?: string }) => {
        if (!res.success) {
          setGlobalError(res.message || 'Không thể vào phòng');
        } else if (res.roomCode) {
          saveLastRoomCode(res.roomCode);
          setCurrentScreen('ROOM');
        }
      }
    );
  };

  // Handler: Leave room
  const handleLeaveRoom = () => {
    const code = roomState?.code || getLastRoomCode();
    clearLastRoomCode();
    setRoomState(null);
    setPlayerCards([]);
    setChatMessages([]);
    setCurrentScreen('LOBBY');
    if (code) {
      socket.emit('ROOM_LEAVE', {
        roomCode: code,
        playerId: profile.id,
      });
    }
  };

  // Handler: Điều chỉnh số xu (cho lệnh ẩn bí mật)
  const handleAdjustScore = (delta: number) => {
    setProfile((prev) => {
      const current = typeof prev.score === 'number' ? prev.score : 1000;
      const newScore = Math.max(0, current + delta);
      savePlayerScore(newScore);
      return { ...prev, score: newScore };
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Reconnection / Offline Banner - Chỉ hiển thị khi mất kết nối kéo dài không thể kết nối lại */}
      {showDisconnectBanner && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md animate-pulse">
          <WifiOff className="w-4 h-4" />
          <span>Mất kết nối với máy chủ. Đang tự động kết nối lại...</span>
        </div>
      )}

      {/* Global Error Banner */}
      {globalError && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{globalError}</span>
          </div>
          <button
            onClick={() => setGlobalError(null)}
            className="px-2 py-0.5 rounded bg-slate-950/20 hover:bg-slate-950/30 text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Screen Router */}
      {currentScreen === 'NAME_INPUT' && (
        <TrangDatTen
          initialName={profile.name}
          initialAvatar={profile.avatar}
          onComplete={handleProfileComplete}
        />
      )}

      {currentScreen === 'LOBBY' && (
        <Lobby
          playerName={profile.name}
          playerAvatar={profile.avatar}
          playerScore={profile.score}
          onEditProfile={() => setCurrentScreen('NAME_INPUT')}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onAdjustScore={handleAdjustScore}
        />
      )}

      {currentScreen === 'ROOM' && roomState && (
        <VoiceChatProvider
          roomCode={roomState.code}
          playerId={profile.id}
          playerName={profile.name}
          playerAvatar={profile.avatar}
        >
          {roomState.status === 'WAITING' ? (
            <PhongChoi
              roomState={roomState}
              myPlayerId={profile.id}
              chatMessages={chatMessages}
              onLeaveRoom={handleLeaveRoom}
            />
          ) : roomState.rule === 'CO_TUONG' ? (
            <BanCoTuong
              roomState={roomState}
              myPlayerId={profile.id}
              chatMessages={chatMessages}
              onLeaveRoom={handleLeaveRoom}
            />
          ) : roomState.rule === 'CARO' ? (
            <BanCaro
              roomState={roomState}
              myPlayerId={profile.id}
              chatMessages={chatMessages}
              onLeaveRoom={handleLeaveRoom}
            />
          ) : (
            <BanChoi
              roomState={roomState}
              myPlayerId={profile.id}
              playerCards={playerCards}
              chatMessages={chatMessages}
              onLeaveRoom={handleLeaveRoom}
            />
          )}

          {/* Floating Voice Chat Controls (persistent across waiting and in-game) */}
          <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40">
            <VoiceChatWidget
              roomState={roomState}
              myPlayerId={profile.id}
            />
          </div>
        </VoiceChatProvider>
      )}
    </div>
  );
}
