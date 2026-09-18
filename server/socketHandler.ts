import { Server, Socket } from 'socket.io';
import { RoomManager } from './roomManager';
import { GameRule, XiangqiTimeMode } from './types';

export function setupSocketHandlers(io: Server, roomManager: RoomManager) {
  // Broadcast helper
  const broadcastRoomUpdate = (roomCode: string) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const publicState = room.getPublicState();
    io.to(roomCode).emit('ROOM_STATE', publicState);

    // Send individual secret cards to each player's socket
    room.players.forEach((player) => {
      if (player.socketId) {
        io.to(player.socketId).emit('PLAYER_CARDS', room.getPlayerCards(player.id));
      }
    });

    // Send chat messages
    io.to(roomCode).emit('CHAT_HISTORY', room.chatMessages);

    // Update lobby lists
    io.emit('LOBBY_ROOMS_UPDATE', roomManager.getOpenRoomsList());
  };

  io.on('connection', (socket: Socket) => {
    // 1. Tạo phòng mới
    socket.on(
      'ROOM_CREATE',
      (data: {
        playerId: string;
        playerName: string;
        playerAvatar: string;
        rule: GameRule;
        reconnectToken: string;
        initialScore?: number;
        xiangqiTimeMode?: XiangqiTimeMode;
      }, callback) => {
        try {
          const room = roomManager.createRoom(
            data.rule,
            (code) => broadcastRoomUpdate(code),
            data.xiangqiTimeMode
          );
          const addRes = room.addPlayer(
            data.playerId,
            socket.id,
            data.playerName,
            data.playerAvatar,
            data.reconnectToken,
            data.initialScore
          );

          if (!addRes.success) {
            callback?.({ success: false, message: addRes.message });
            return;
          }

          roomManager.registerPlayerRoom(data.playerId, room.code);
          socket.join(room.code);

          callback?.({ success: true, roomCode: room.code });
          broadcastRoomUpdate(room.code);
        } catch (err: any) {
          callback?.({ success: false, message: err.message || 'Lỗi khi tạo phòng' });
        }
      }
    );

    // 1.5. Đổi chế độ thời gian Cờ Tướng (Chỉ chủ phòng)
    socket.on(
      'ROOM_SET_XIANGQI_TIME_MODE',
      (
        data: { roomCode: string; playerId: string; timeMode: XiangqiTimeMode },
        callback
      ) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.setXiangqiTimeMode(data.playerId, data.timeMode);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 2. Tham gia phòng đã có (hoặc Reconnect)
    socket.on(
      'ROOM_JOIN',
      (data: {
        roomCode: string;
        playerId: string;
        playerName: string;
        playerAvatar: string;
        reconnectToken: string;
        initialScore?: number;
      }, callback) => {
        try {
          const code = (data.roomCode || '').toUpperCase().trim();
          const room = roomManager.getRoom(code);

          if (!room) {
            callback?.({ success: false, message: `Mã phòng "${code}" không tồn tại hoặc đã giải tán` });
            return;
          }

          const addRes = room.addPlayer(
            data.playerId,
            socket.id,
            data.playerName,
            data.playerAvatar,
            data.reconnectToken,
            data.initialScore
          );

          if (!addRes.success) {
            callback?.({ success: false, message: addRes.message });
            return;
          }

          roomManager.registerPlayerRoom(data.playerId, code);
          socket.join(code);

          callback?.({ success: true, roomCode: code });
          broadcastRoomUpdate(code);
        } catch (err: any) {
          callback?.({ success: false, message: err.message || 'Lỗi khi vào phòng' });
        }
      }
    );

    // 3. Rời phòng
    socket.on(
      'ROOM_LEAVE',
      (data: { roomCode: string; playerId: string }, callback) => {
        // Socket rời phòng roomCode TRƯỚC để không nhận broadcast ROOM_STATE kéo ngược lại phòng
        socket.leave(data.roomCode);
        socket.leave(`voice_${data.roomCode}`);
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          const voiceLeft = room.leaveVoice(socket.id);
          if (voiceLeft) {
            io.to(`voice_${room.code}`).emit('VOICE_USER_LEFT', {
              socketId: socket.id,
              playerId: voiceLeft.playerId,
            });
          }
          roomManager.unregisterPlayer(data.playerId);
          const isEmpty = room.removePlayer(data.playerId);

          if (isEmpty) {
            roomManager.deleteRoom(data.roomCode);
          } else {
            broadcastRoomUpdate(data.roomCode);
          }
        }
        callback?.({ success: true });
        io.emit('LOBBY_ROOMS_UPDATE', roomManager.getOpenRoomsList());
      }
    );

    // 4. Chuyển quyền chủ phòng
    socket.on(
      'ROOM_TRANSFER_HOST',
      (data: { roomCode: string; targetPlayerId: string; requestedByPlayerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }

        const success = room.transferHost(data.targetPlayerId, data.requestedByPlayerId);
        if (success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: 'Không thể chuyển quyền chủ phòng' });
        }
      }
    );

    // 5. Bắt đầu ván chơi
    socket.on(
      'ROOM_START_GAME',
      (data: { roomCode: string; requestedByPlayerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }

        // Đảm bảo socket của người bấm bắt đầu luôn cập nhật mới nhất
        const requester = room.players.find((p) => p.id === data.requestedByPlayerId);
        if (requester) {
          requester.socketId = socket.id;
          requester.disconnectedAt = null;
          socket.join(data.roomCode);
        }

        const startRes = room.startGame(data.requestedByPlayerId);
        if (startRes.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: startRes.message });
        }
      }
    );

    // 5.1. Đưa phòng về trạng thái phòng chờ (WAITING)
    socket.on(
      'ROOM_RESET_TO_WAITING',
      (data: { roomCode: string; requestedByPlayerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }

        const resetRes = room.resetToWaitingRoom(data.requestedByPlayerId);
        if (resetRes.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: resetRes.message });
        }
      }
    );

    // 5.2. Lấy bài của tôi (fallback/đồng bộ bài chủ động)
    socket.on(
      'GAME_GET_MY_CARDS',
      (data: { roomCode: string; playerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, cards: [] });
          return;
        }

        const player = room.players.find((p) => p.id === data.playerId);
        if (player) {
          player.socketId = socket.id;
          player.disconnectedAt = null;
          socket.join(data.roomCode);
          callback?.({ success: true, cards: player.cards });
          socket.emit('PLAYER_CARDS', player.cards);
        } else {
          callback?.({ success: false, cards: [] });
        }
      }
    );

    // 6. Đánh bài
    socket.on(
      'GAME_PLAY_HAND',
      (data: { roomCode: string; playerId: string; cardIds: string[] }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }

        const player = room.players.find((p) => p.id === data.playerId);
        if (player) {
          player.socketId = socket.id;
          player.disconnectedAt = null;
        }

        const playRes = room.playHand(data.playerId, data.cardIds);
        if (playRes.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: playRes.message });
        }
      }
    );

    // 7. Bỏ lượt
    socket.on(
      'GAME_PASS_TURN',
      (data: { roomCode: string; playerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }

        const player = room.players.find((p) => p.id === data.playerId);
        if (player) {
          player.socketId = socket.id;
          player.disconnectedAt = null;
        }

        const passRes = room.passTurn(data.playerId);
        if (passRes.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: passRes.message });
        }
      }
    );

    // 8. Báo Sâm (Xâm Lốc)
    socket.on(
      'GAME_BAO_SAM',
      (data: { roomCode: string; playerId: string; wantsBaoSam: boolean }) => {
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          const player = room.players.find((p) => p.id === data.playerId);
          if (player) {
            player.socketId = socket.id;
            player.disconnectedAt = null;
          }
          room.reportBaoSam(data.playerId, data.wantsBaoSam);
          broadcastRoomUpdate(data.roomCode);
        }
      }
    );

    // 8.1. Đổi vị trí ghế trong phòng (cho Cờ Tướng hoặc Sảnh)
    socket.on(
      'ROOM_SWITCH_SEAT',
      (data: { roomCode: string; playerId: string; targetSeatIndex: number }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.switchSeat(data.playerId, data.targetSeatIndex);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.2. Đi nước cờ tướng (Cờ Chớp)
    socket.on(
      'GAME_XIANGQI_MOVE',
      (
        data: {
          roomCode: string;
          playerId: string;
          from: { x: number; y: number };
          to: { x: number; y: number };
        },
        callback
      ) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.playXiangqiMove(data.playerId, data.from, data.to);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.3. Đầu hàng cờ tướng
    socket.on('GAME_XIANGQI_RESIGN', (data: { roomCode: string; playerId: string }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        callback?.({ success: false, message: 'Phòng không tồn tại' });
        return;
      }
      const res = room.resignXiangqi(data.playerId);
      if (res.success) {
        broadcastRoomUpdate(data.roomCode);
      }
      callback?.(res);
    });

    // 8.4. Đề nghị hòa cờ tướng
    socket.on('GAME_XIANGQI_OFFER_DRAW', (data: { roomCode: string; playerId: string }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        callback?.({ success: false, message: 'Phòng không tồn tại' });
        return;
      }
      const res = room.offerXiangqiDraw(data.playerId);
      if (res.success) {
        broadcastRoomUpdate(data.roomCode);
      }
      callback?.(res);
    });

    // 8.5. Phản hồi lời mời hòa cờ tướng
    socket.on(
      'GAME_XIANGQI_RESPOND_DRAW',
      (data: { roomCode: string; playerId: string; accept: boolean }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.respondXiangqiDraw(data.playerId, data.accept);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.6. Đánh nước cờ Caro (Ăn 5 chặn 2 đầu vẫn win, 5 phút/bên)
    socket.on(
      'GAME_CARO_MOVE',
      (
        data: {
          roomCode: string;
          playerId: string;
          x: number;
          y: number;
        },
        callback
      ) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.playCaroMove(data.playerId, data.x, data.y);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.7. Đầu hàng cờ Caro
    socket.on('GAME_CARO_RESIGN', (data: { roomCode: string; playerId: string }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        callback?.({ success: false, message: 'Phòng không tồn tại' });
        return;
      }
      const res = room.resignCaro(data.playerId);
      if (res.success) {
        broadcastRoomUpdate(data.roomCode);
      }
      callback?.(res);
    });

    // 8.8. Đề nghị hòa cờ Caro
    socket.on('GAME_CARO_OFFER_DRAW', (data: { roomCode: string; playerId: string }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        callback?.({ success: false, message: 'Phòng không tồn tại' });
        return;
      }
      const res = room.offerCaroDraw(data.playerId);
      if (res.success) {
        broadcastRoomUpdate(data.roomCode);
      }
      callback?.(res);
    });

    // 8.9. Phản hồi lời mời hòa cờ Caro
    socket.on(
      'GAME_CARO_RESPOND_DRAW',
      (data: { roomCode: string; playerId: string; accept: boolean }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.respondCaroDraw(data.playerId, data.accept);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 9. Gửi tin nhắn chat
    socket.on('CHAT_MESSAGE', (data: { roomCode: string; playerId: string; text: string }) => {
      const room = roomManager.getRoom(data.roomCode);
      if (room && data.text?.trim()) {
        room.addChat(data.playerId, data.text.trim());
        io.to(data.roomCode).emit('CHAT_HISTORY', room.chatMessages);
      }
    });

    // 9.1. Tham gia phòng Voice Chat (Mặc định hỗ trợ chế độ Nghe cho người không có mic)
    socket.on(
      'VOICE_JOIN',
      (
        data: {
          roomCode: string;
          playerId: string;
          playerName: string;
          playerAvatar: string;
          isMuted?: boolean;
          hasMic?: boolean;
        },
        callback
      ) => {
        try {
          const room = roomManager.getRoom(data.roomCode);
          if (!room) {
            callback?.({ success: false, message: 'Phòng không tồn tại' });
            return;
          }

          const participant = room.joinVoice(
            socket.id,
            data.playerId,
            data.playerName,
            data.playerAvatar,
            !!data.isMuted,
            !!data.hasMic
          );

          socket.join(`voice_${room.code}`);

          // Trả về danh sách tất cả người tham gia hiện tại cho người mới vào
          const allParticipants = room.getVoiceParticipants();
          callback?.({ success: true, participants: allParticipants });

          // Báo cho các người khác trong phòng voice
          socket.to(`voice_${room.code}`).emit('VOICE_USER_JOINED', participant);
          broadcastRoomUpdate(room.code);
        } catch (err: any) {
          callback?.({ success: false, message: err.message || 'Không thể tham gia voice' });
        }
      }
    );

    // 9.2. WebRTC Signaling (Offer / Answer / ICE Candidate)
    socket.on(
      'VOICE_SIGNAL',
      (data: {
        roomCode: string;
        targetSocketId: string;
        signal: any;
      }) => {
        if (!data.targetSocketId || !data.signal) return;
        io.to(data.targetSocketId).emit('VOICE_SIGNAL', {
          senderSocketId: socket.id,
          signal: data.signal,
          roomCode: data.roomCode,
        });
      }
    );

    // 9.3. Cập nhật trạng thái Mic / Speaking / hasMic
    socket.on(
      'VOICE_STATUS_UPDATE',
      (data: { roomCode: string; isMuted?: boolean; isSpeaking?: boolean; hasMic?: boolean }) => {
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          const updated = room.updateVoiceStatus(socket.id, data.isMuted, data.isSpeaking, data.hasMic);
          if (updated) {
            io.to(`voice_${room.code}`).emit('VOICE_STATUS_UPDATE', updated);
          }
        }
      }
    );

    // 9.4. Rời phòng Voice Chat
    socket.on('VOICE_LEAVE', (data: { roomCode: string }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (room) {
        const left = room.leaveVoice(socket.id);
        socket.leave(`voice_${room.code}`);
        if (left) {
          io.to(`voice_${room.code}`).emit('VOICE_USER_LEFT', {
            socketId: socket.id,
            playerId: left.playerId,
          });
          broadcastRoomUpdate(room.code);
        }
      }
      callback?.({ success: true });
    });

    // 10. Lấy danh sách phòng sảnh
    socket.on('LOBBY_GET_ROOMS', (callback) => {
      callback?.(roomManager.getOpenRoomsList());
    });

    // 11. Ngắt kết nối socket
    socket.on('disconnect', () => {
      // Tìm xem socket này thuộc phòng nào
      let foundRoomCode: string | null = null;
      const rooms = roomManager.getOpenRoomsList();
      for (const r of rooms) {
        const room = roomManager.getRoom(r.code);
        if (room) {
          const voiceLeft = room.leaveVoice(socket.id);
          if (voiceLeft) {
            io.to(`voice_${room.code}`).emit('VOICE_USER_LEFT', {
              socketId: socket.id,
              playerId: voiceLeft.playerId,
            });
          }
          const p = room.players.find((player) => player.socketId === socket.id);
          if (p) {
            foundRoomCode = room.code;
            room.handleDisconnect(socket.id);
            break;
          }
        }
      }

      if (foundRoomCode) {
        broadcastRoomUpdate(foundRoomCode);
      }
    });
  });
}
