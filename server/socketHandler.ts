import { Server, Socket } from 'socket.io';
import { RoomManager } from './roomManager';
import { GameRule, XiangqiTimeMode, PlacedShip } from './types';

export function setupSocketHandlers(io: Server, roomManager: RoomManager) {
  // Broadcast helper
  const broadcastRoomUpdate = (roomCode: string) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    // Send individual state, secret cards, and filtered chat to each player's socket
    room.players.forEach((player) => {
      if (player.socketId) {
        const playerState = room.getPublicState(player.id);
        io.to(player.socketId).emit('ROOM_STATE', playerState);
        io.to(player.socketId).emit('PLAYER_CARDS', room.getPlayerCards(player.id));
        if (room.rule === 'BAN_TAU') {
          io.to(player.socketId).emit('BAN_TAU_MY_SHIPS', room.getPlayerShips(player.id));
        }

        // Lọc tin nhắn bình luận: chỉ khán giả (isSpectator) mới nhận được phân tích chuyên môn
        const playerChat = player.isSpectator
          ? room.chatMessages
          : room.chatMessages.filter((m) => !m.isSpectatorOnly);
        io.to(player.socketId).emit('CHAT_HISTORY', playerChat);
      }
    });

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
          if (!data || !data.playerId) {
            callback?.({ success: false, message: 'Thông tin người chơi không hợp lệ' });
            return;
          }
          const pName = (data.playerName && data.playerName.trim()) || 'Người chơi';
          const pAvatar = data.playerAvatar || '🤠';
          const pRule: GameRule = data.rule || 'TIEN_LEN_MIEN_NAM';

          const room = roomManager.createRoom(
            pRule,
            (code) => broadcastRoomUpdate(code),
            data.xiangqiTimeMode
          );
          const addRes = room.addPlayer(
            data.playerId,
            socket.id,
            pName,
            pAvatar,
            data.reconnectToken || 'tok_' + Math.random().toString(36).substring(2, 10),
            data.initialScore
          );

          if (!addRes.success) {
            callback?.({ success: false, message: addRes.message });
            return;
          }

          roomManager.registerPlayerRoom(data.playerId, room.code);
          socket.join(room.code);

          const roomState = room.getPublicState(data.playerId);
          callback?.({ success: true, roomCode: room.code, roomState });
          broadcastRoomUpdate(room.code);
        } catch (err: any) {
          console.error('Error in ROOM_CREATE:', err);
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

          const roomState = room.getPublicState(data.playerId);
          callback?.({ success: true, roomCode: code, roomState });
          broadcastRoomUpdate(code);
        } catch (err: any) {
          callback?.({ success: false, message: err.message || 'Lỗi khi vào phòng' });
        }
      }
    );

    // 2.5 Lấy trạng thái phòng tức thời
    socket.on('ROOM_GET_STATE', (data: { roomCode: string; playerId: string }, callback) => {
      const room = roomManager.getRoom(data?.roomCode);
      if (!room) {
        callback?.({ success: false, message: 'Phòng không tồn tại' });
        return;
      }
      callback?.({ success: true, roomState: room.getPublicState(data.playerId) });
    });

    // 3. Rời phòng
    socket.on(
      'ROOM_LEAVE',
      (data: { roomCode: string; playerId: string }, callback) => {
        socket.leave(data.roomCode);
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          roomManager.unregisterPlayer(data.playerId);
          room.removePlayer(data.playerId);

          if (room.players.length === 0) {
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

        const res = room.transferHost(data.targetPlayerId, data.requestedByPlayerId);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: res.message || 'Không thể chuyển quyền chủ phòng' });
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

        const resetRes = room.resetToWaiting(data.requestedByPlayerId);
        if (resetRes.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: resetRes.message });
        }
      }
    );

    // 5.1b. Cá nhân người chơi quay về phòng chờ
    socket.on(
      'PLAYER_RETURN_TO_WAITING',
      (data: { roomCode: string; playerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }

        const res = room.playerReturnToWaiting(data.playerId);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: res.message });
        }
      }
    );

    // 5.1c. Cờ Cá Ngựa: Gieo xúc xắc
    socket.on(
      'CO_CA_NGUA_ROLL_DICE',
      (data: { roomCode: string; playerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }

        const rollRes = room.coCaNguaRollDice(data.playerId);
        if (rollRes.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true, dice: rollRes.dice });
        } else {
          callback?.({ success: false, message: rollRes.message });
        }
      }
    );

    // 5.1d. Cờ Cá Ngựa: Di chuyển ngựa
    socket.on(
      'CO_CA_NGUA_MOVE_HORSE',
      (data: { roomCode: string; playerId: string; horseId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }

        const moveRes = room.coCaNguaMoveHorse(data.playerId, data.horseId);
        if (moveRes.success) {
          broadcastRoomUpdate(data.roomCode);
          callback?.({ success: true });
        } else {
          callback?.({ success: false, message: moveRes.message });
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
      (data: { roomCode: string; playerId: string; wantsBaoSam: boolean }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          const player = room.players.find((p) => p.id === data.playerId);
          if (player) {
            player.socketId = socket.id;
            player.disconnectedAt = null;
          }
          const res = room.respondBaoSam(data.playerId, data.wantsBaoSam);
          broadcastRoomUpdate(data.roomCode);
          callback?.(res);
        }
      }
    );

    // 8.1. Đổi vị trí ghế trong phòng (cho Cờ Tướng, Cờ Caro, Bắn Tàu hoặc Sảnh)
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

    // 8.2. Đi nước cờ tướng
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
        const res = room.xiangqiMove(data.playerId, data.from, data.to);
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
      const res = room.xiangqiResign(data.playerId);
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
      const res = room.xiangqiOfferDraw(data.playerId);
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
        const res = room.xiangqiRespondDraw(data.playerId, data.accept);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.6. Đánh nước cờ Caro
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
        const res = room.caroMove(data.playerId, data.x, data.y);
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
      const res = room.caroResign(data.playerId);
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
      const res = room.caroOfferDraw(data.playerId);
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
        const res = room.caroRespondDraw(data.playerId, data.accept);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // --- BẮN TÀU (BATTLESHIP) SOCKET EVENTS ---
    // 8.10. Bố trí đội tàu
    socket.on(
      'BAN_TAU_PLACE_SHIPS',
      (data: { roomCode: string; playerId: string; ships: PlacedShip[] }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.banTauPlaceShips(data.playerId, data.ships);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.11. Bố trí tàu tự động ngẫu nhiên
    socket.on(
      'BAN_TAU_AUTO_PLACE',
      (data: { roomCode: string; playerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.banTauAutoPlace(data.playerId);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.12. Sẵn sàng chiến đấu
    socket.on(
      'BAN_TAU_READY',
      (data: { roomCode: string; playerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.banTauReady(data.playerId);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.13. Khai hỏa bắn tàu
    socket.on(
      'BAN_TAU_FIRE',
      (data: { roomCode: string; playerId: string; x: number; y: number }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.banTauFire(data.playerId, data.x, data.y);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.14. Thuyền trưởng xin đầu hàng
    socket.on(
      'BAN_TAU_RESIGN',
      (data: { roomCode: string; playerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.banTauResign(data.playerId);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.15. Lấy hạm đội của tôi
    socket.on(
      'BAN_TAU_GET_MY_SHIPS',
      (data: { roomCode: string; playerId: string }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, ships: [] });
          return;
        }
        const ships = room.getPlayerShips(data.playerId);
        callback?.({ success: true, ships });
        socket.emit('BAN_TAU_MY_SHIPS', ships);
      }
    );

    // 8.16. Đi nước cờ vua
    socket.on(
      'GAME_CHESS_MOVE',
      (
        data: {
          roomCode: string;
          playerId: string;
          from: string;
          to: string;
          promotion?: string;
        },
        callback
      ) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }

        const res = room.chessMove(data.playerId, data.from, data.to, data.promotion);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 8.17. Đầu hàng cờ vua
    socket.on('GAME_CHESS_RESIGN', (data: { roomCode: string; playerId: string }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        callback?.({ success: false, message: 'Phòng không tồn tại' });
        return;
      }
      const res = room.chessResign(data.playerId);
      if (res.success) {
        broadcastRoomUpdate(data.roomCode);
      }
      callback?.(res);
    });

    // 8.18. Đề nghị hòa cờ vua
    socket.on('GAME_CHESS_OFFER_DRAW', (data: { roomCode: string; playerId: string }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        callback?.({ success: false, message: 'Phòng không tồn tại' });
        return;
      }
      const res = room.chessOfferDraw(data.playerId);
      if (res.success) {
        broadcastRoomUpdate(data.roomCode);
      }
      callback?.(res);
    });

    // 8.19. Phản hồi đề nghị hòa cờ vua
    socket.on(
      'GAME_CHESS_RESPOND_DRAW',
      (data: { roomCode: string; playerId: string; accept: boolean }, callback) => {
        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          callback?.({ success: false, message: 'Phòng không tồn tại' });
          return;
        }
        const res = room.chessRespondDraw(data.playerId, data.accept);
        if (res.success) {
          broadcastRoomUpdate(data.roomCode);
        }
        callback?.(res);
      }
    );

    // 9. Gửi tin nhắn chat
    socket.on('CHAT_MESSAGE', (data: { roomCode: string; playerId: string; text: string }) => {
      const code = (data.roomCode || '').toUpperCase().trim();
      const room = roomManager.getRoom(code);
      if (room && data.text?.trim()) {
        socket.join(code);
        room.addChatMessage(data.playerId, data.text.trim());
        broadcastRoomUpdate(code);
      }
    });

    // 10. Lấy danh sách phòng sảnh
    socket.on('LOBBY_GET_ROOMS', (callback) => {
      callback?.(roomManager.getOpenRoomsList());
    });

    // 11. Ngắt kết nối socket
    socket.on('disconnect', () => {
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
