// ═══════════════════════════════════════════════════════
// NEON FRACTURE — SERVER v4 (FULL WORKING)
// ═══════════════════════════════════════════════════════

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"]
});

// ─────────────────────────────────────────────────────
// SERVE FRONTEND
// ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────
const rooms = new Map();
const playerRooms = new Map();

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────
function createPlayer(id, name, team) {
  return {
    id,
    name: name.substring(0, 16),
    team
  };
}

function createRoom(hostId, roomName) {
  const id = Math.random().toString(36).substring(2,8).toUpperCase();

  return {
    id,
    name: roomName || `Arena-${id}`,
    host: hostId,
    state: 'lobby',
    players: new Map()
  };
}

function emitLobby(room) {
  io.to(room.id).emit('lobbyUpdate', {
    players: Array.from(room.players.values()),
    host: room.host
  });
}

// ─────────────────────────────────────────────────────
// SOCKET HANDLERS
// ─────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log('✅ Connected:', socket.id);

  // ── CREATE ROOM ─────────────────────────────────────
  socket.on('createRoom', ({ playerName, roomName }) => {
    if (!playerName) return;

    const room = createRoom(socket.id, roomName);
    rooms.set(room.id, room);

    socket.join(room.id);

    const player = createPlayer(socket.id, playerName, 'A');
    room.players.set(socket.id, player);
    playerRooms.set(socket.id, room.id);

    socket.emit('roomCreated', {
      roomId: room.id,
      roomName: room.name,
      player
    });

    emitLobby(room); // 🔥 FIX
  });

  // ── JOIN ROOM ───────────────────────────────────────
  socket.on('joinRoom', ({ roomId, playerName, team }) => {
    const room = rooms.get(roomId);

    if (!room) return socket.emit('error', { msg: 'Room not found' });

    socket.join(room.id);

    const player = createPlayer(socket.id, playerName, team || 'A');
    room.players.set(socket.id, player);
    playerRooms.set(socket.id, room.id);

    socket.emit('roomJoined', {
      roomId: room.id,
      roomName: room.name,
      player
    });

    emitLobby(room); // 🔥 FIX
  });

  // ── SWITCH TEAM ─────────────────────────────────────
  socket.on('switchTeam', () => {
    const roomId = playerRooms.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.team = player.team === 'A' ? 'B' : 'A';

    emitLobby(room);
  });

  // ── START GAME (🔥 MAIN FIX) ────────────────────────
  socket.on('startGame', () => {
    const roomId = playerRooms.get(socket.id);
    const room = rooms.get(roomId);

    if (!room) return;

    if (room.host !== socket.id) return;

    if (room.players.size < 2) {
      return socket.emit('error', { msg: 'Need at least 2 players' });
    }

    room.state = 'playing';

    io.to(room.id).emit('countdown', { count: 3 });

    setTimeout(() => {
      io.to(room.id).emit('gameStart');
    }, 3000);
  });

  // ── DISCONNECT ──────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);

    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players.delete(socket.id);
    playerRooms.delete(socket.id);

    if (room.players.size === 0) {
      rooms.delete(roomId);
    } else {
      if (room.host === socket.id) {
        room.host = room.players.keys().next().value;
      }
      emitLobby(room);
    }
  });
});

// ─────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────
server.setTimeout(0);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
