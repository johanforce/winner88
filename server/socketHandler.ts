import { Server, Socket } from 'socket.io';
import { RoomManager } from './roomManager';
import { GameRule } from './types';

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
      }, callback) => {
        try {
          const room = roomManager.createRoom(data.rule, (code) => broadcastRoomUpdate(code));
          const addRes = room.addPlayer(
            data.playerId,
            socket.id,
            data.playerName,
            data.playerAvatar,
            data.reconnectToken
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

    // 2. Tham gia phòng đã có (hoặc Reconnect)
    socket.on(
      'ROOM_JOIN',
      (data: {
        roomCode: string;
        playerId: string;
        playerName: string;
        playerAvatar: string;
        reconnectToken: string;
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
            data.reconnectToken
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
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          const isEmpty = room.removePlayer(data.playerId);
          socket.leave(data.roomCode);
          roomManager.unregisterPlayer(data.playerId);

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

        const startRes = room.startGame(data.requestedByPlayerId);
        if (startRes.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: startRes.message });
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
          room.reportBaoSam(data.playerId, data.wantsBaoSam);
          broadcastRoomUpdate(data.roomCode);
        }
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
