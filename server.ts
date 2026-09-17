import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { RoomManager } from './server/roomManager';
import { setupSocketHandlers } from './server/socketHandler';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Socket.io setup attached to the same HTTP server
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  const roomManager = new RoomManager();
  setupSocketHandlers(io, roomManager);

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Tien Len & Sam Loc Online',
      time: new Date().toISOString(),
      activeRooms: roomManager.getOpenRoomsList().length,
    });
  });

  // REST API: Get open rooms
  app.get('/api/rooms', (req, res) => {
    res.json({ rooms: roomManager.getOpenRoomsList() });
  });

  // Vite middleware for development vs Static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Card Game Server running on port ${PORT}`);
  });
}

startServer();
