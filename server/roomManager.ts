import { GameRoom } from './gameRoom';
import { GameRule, RoomListItem, XiangqiTimeMode } from './types';

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRoomMap: Map<string, string> = new Map(); // playerId -> roomCode

  constructor() {
    // Cleanup empty rooms periodically
    setInterval(() => {
      this.cleanupStaleRooms();
    }, 30000);
  }

  public createRoom(
    rule: GameRule,
    onStateChange: (code: string) => void,
    xiangqiTimeMode?: XiangqiTimeMode
  ): GameRoom {
    const code = this.generateRoomCode(rule);
    const room = new GameRoom(
      code,
      rule,
      () => onStateChange(code),
      xiangqiTimeMode,
      (playerId, isEmpty) => {
        this.unregisterPlayer(playerId);
        if (isEmpty) {
          this.deleteRoom(code);
        }
      }
    );
    this.rooms.set(code, room);
    return room;
  }

  public getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  public getRoomByPlayerId(playerId: string): GameRoom | undefined {
    const code = this.playerRoomMap.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  public registerPlayerRoom(playerId: string, roomCode: string) {
    this.playerRoomMap.set(playerId, roomCode.toUpperCase());
  }

  public unregisterPlayer(playerId: string) {
    this.playerRoomMap.delete(playerId);
  }

  public getOpenRoomsList(): RoomListItem[] {
    const list: RoomListItem[] = [];
    this.rooms.forEach((room) => {
      const host = room.players.find((p) => p.isHost);
      list.push({
        code: room.code,
        rule: room.rule,
        xiangqiTimeMode: room.xiangqiTimeMode,
        hostName: host ? host.name : 'Vô danh',
        playerCount: room.players.length,
        maxPlayers: 4,
        status: room.status === 'PLAYING' ? 'PLAYING' : 'WAITING',
      });
    });
    // Sort waiting rooms first
    return list.sort((a, b) => (a.status === 'WAITING' ? -1 : 1));
  }

  public deleteRoom(code: string) {
    const room = this.rooms.get(code);
    if (room) {
      room.cleanup();
      room.players.forEach((p) => this.playerRoomMap.delete(p.id));
      this.rooms.delete(code);
    }
  }

  private cleanupStaleRooms() {
    const now = Date.now();
    const codesToDelete: string[] = [];

    this.rooms.forEach((room, code) => {
      // If room has no players
      if (room.players.length === 0) {
        codesToDelete.push(code);
        return;
      }

      // If all players have been disconnected for over 3 minutes
      const allDisconnected = room.players.every(
        (p) => p.status === 'DISCONNECTED' && p.disconnectedAt && now - p.disconnectedAt > 180000
      );
      if (allDisconnected) {
        codesToDelete.push(code);
      }
    });

    codesToDelete.forEach((code) => this.deleteRoom(code));
  }

  private generateRoomCode(rule: GameRule): string {
    const prefix =
      rule === 'TIEN_LEN_MIEN_NAM'
        ? 'TL'
        : rule === 'SAM_LOC'
        ? 'SL'
        : rule === 'CO_TUONG'
        ? 'CT'
        : 'CR';
    let code = '';
    let attempts = 0;
    do {
      const num = Math.floor(1000 + Math.random() * 9000);
      code = `${prefix}${num}`;
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);
    return code;
  }
}
