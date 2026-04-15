// ═══════════════════════════════════════════════════════
// NEON FRACTURE — SERVER v5 (FINAL STABLE)
// Works with Render + Socket.io + Lobby + Start Game
// ═══════════════════════════════════════════════════════

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ✅ SOCKET.IO (Render-safe config)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const rooms = new Map();
const playerRooms = new Map();

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

// Create player
function createPlayer(id, name, team) {
  return {
    id,
    name: (name || 'OPERATOR').substring(0, 16),
    team: team || 'A'
  };
}

// Create room
function createRoom(hostId, hostName, roomName) {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();

  return {
    id,
    name: roomName || `Arena-${id}`,
    host: hostId,
    players: new Map()
  };
}

// 🔥 BROADCAST LOBBY (CRITICAL)
function broadcastLobby(room) {
  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    team: p.team
  }));

  io.to(room.id).emit('lobbyUpdate', { players });
}

// ═══════════════════════════════════════════════════════
// SOCKET EVENTS
// ═══════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log('✅ Connected:', socket.id);

  // ── CREATE ROOM ─────────────────────────
  socket.on('createRoom', ({ playerName, roomName }) => {
    const room = createRoom(socket.id, playerName, roomName);

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

    broadcastLobby(room); // 🔥 IMPORTANT
  });

  // ── JOIN ROOM ─────────────────────────
  socket.on('joinRoom', ({ roomId, playerName, team }) => {
    const room = rooms.get(roomId);

    if (!room) {
      return socket.emit('error', { msg: 'Room not found' });
    }

    socket.join(room.id);

    const player = createPlayer(socket.id, playerName, team);

    room.players.set(socket.id, player);
    playerRooms.set(socket.id, room.id);

    socket.emit('roomJoined', {
      roomId: room.id,
      roomName: room.name,
      player
    });

    broadcastLobby(room); // 🔥 IMPORTANT
  });

  // ── SWITCH TEAM ─────────────────────────
  socket.on('switchTeam', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.team = player.team === 'A' ? 'B' : 'A';

    broadcastLobby(room);
  });

  // ── START GAME (FINAL FIX) ─────────────
  socket.on('startGame', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // Only host can start
    if (room.host !== socket.id) {
      return socket.emit('error', { msg: 'Only host can start' });
    }

    // Need at least 2 players
    if (room.players.size < 2) {
      return socket.emit('error', { msg: 'Need at least 2 players' });
    }

    console.log('🚀 GAME START:', room.id);

    io.to(room.id).emit('countdown', { count: 3 });

    setTimeout(() => {
      io.to(room.id).emit('gameStart');
    }, 3000);
  });

  // ── DISCONNECT ─────────────────────────
  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);

    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players.delete(socket.id);
    playerRooms.delete(socket.id);

    broadcastLobby(room);
  });

});

// ═══════════════════════════════════════════════════════
// SERVER START (RENDER SAFE)
// ═══════════════════════════════════════════════════════

// Prevent timeout (important for Render)
server.setTimeout(0);

// Use Render PORT
const PORT = process.env.PORT || 10000;

// Bind to 0.0.0.0 (CRITICAL for Render)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
