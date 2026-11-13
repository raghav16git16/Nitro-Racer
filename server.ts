import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomPlayer {
  uid: string;
  name: string;
  carId: string;
  primaryColor: number;
  neonColor: number;
  logoText: string;
  livery: string;
  spoiler: string;
  x: number;
  dist: number;
  kmh: number;
  finished: boolean;
  finishTime: number;
  updatedAt: number;
  isAi?: boolean;
}

interface RoomRecord {
  code: string;
  hostId: string;
  status: 'LOBBY' | 'RACING';
  startedAt: number;
  raceDistance: number;
  players: Record<string, RoomPlayer>;
  updatedAt: number;
}

const rooms = new Map<string, RoomRecord>();

function pruneOldRooms() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.updatedAt < cutoff) {
      rooms.delete(code);
    }
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 25; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/rooms', (req, res) => {
    pruneOldRooms();
    const { player, raceDistance } = req.body as {
      player?: RoomPlayer;
      raceDistance?: number;
    };
    if (!player?.uid) {
      res.status(400).json({ error: 'Missing player payload' });
      return;
    }
    const code = generateRoomCode();
    const now = Date.now();
    const room: RoomRecord = {
      code,
      hostId: player.uid,
      status: 'LOBBY',
      startedAt: 0,
      raceDistance: raceDistance || 3600,
      updatedAt: now,
      players: {
        [player.uid]: {
          ...player,
          x: 0,
          dist: 0,
          kmh: 30,
          finished: false,
          finishTime: 0,
          updatedAt: now,
        },
      },
    };
    rooms.set(code, room);
    res.json(room);
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json(room);
  });

  app.post('/api/rooms/:code/join', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: `Room ${code} not found` });
      return;
    }
    const { player } = req.body as { player?: RoomPlayer };
    if (!player?.uid) {
      res.status(400).json({ error: 'Missing player payload' });
      return;
    }
    const now = Date.now();
    room.players[player.uid] = {
      ...player,
      x: 0,
      dist: 0,
      kmh: 30,
      finished: false,
      finishTime: 0,
      updatedAt: now,
    };
    room.updatedAt = now;
    res.json(room);
  });

  app.post('/api/rooms/:code/start', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const now = Date.now();
    room.status = 'RACING';
    room.startedAt = now;
    room.updatedAt = now;
    for (const uid of Object.keys(room.players)) {
      room.players[uid].dist = 0;
      room.players[uid].x = room.players[uid].isAi ? (Math.random() > 0.5 ? -3.5 : 3.5) : 0;
      room.players[uid].finished = false;
      room.players[uid].finishTime = 0;
    }
    res.json(room);
  });

  app.post('/api/rooms/:code/reset', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    room.status = 'LOBBY';
    room.updatedAt = Date.now();
    res.json(room);
  });

  app.post('/api/rooms/:code/sync', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const { uid, x, dist, kmh, finished, finishTime, carId, primaryColor, neonColor, logoText, livery, spoiler } = req.body as Partial<RoomPlayer> & { uid?: string };
    if (uid && room.players[uid]) {
      const p = room.players[uid];
      if (typeof x === 'number') p.x = x;
      if (typeof dist === 'number') p.dist = dist;
      if (typeof kmh === 'number') p.kmh = kmh;
      if (typeof finished === 'boolean') p.finished = finished;
      if (typeof finishTime === 'number') p.finishTime = finishTime;
      if (carId) p.carId = carId;
      if (typeof primaryColor === 'number') p.primaryColor = primaryColor;
      if (typeof neonColor === 'number') p.neonColor = neonColor;
      if (logoText) p.logoText = logoText;
      if (livery) p.livery = livery;
      if (spoiler) p.spoiler = spoiler;
      p.updatedAt = Date.now();
      room.updatedAt = Date.now();
    }
    res.json(room);
  });

  app.post('/api/rooms/:code/leave', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.json({ ok: true });
      return;
    }
    const { uid } = req.body as { uid?: string };
    if (uid && room.players[uid]) {
      delete room.players[uid];
    }
    const realPlayers = Object.values(room.players).filter((p) => !p.isAi);
    if (realPlayers.length === 0) {
      rooms.delete(code);
    } else if (room.hostId === uid) {
      room.hostId = realPlayers[0].uid;
    }
    res.json({ ok: true });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.join(__dirname, 'dist');

  if (!isProd && fs.existsSync(path.join(__dirname, 'vite.config.ts'))) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nitro Rush 3D server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
