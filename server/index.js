// ═══════════════════════════════════════════════════════
// NEON FRACTURE — SERVER v6 (FULL GAME WORKING)
// Lobby + Game Engine + Movement + Timer + Shooting
// ═══════════════════════════════════════════════════════

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ── SOCKET.IO ─────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"]
});

// ── STATIC ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const rooms = new Map();
const playerRooms = new Map();
const gameStates = new Map();

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function createPlayer(id, name, team) {
  return {
    id,
    name: (name || 'OPERATOR').substring(0, 16),
    team: team || 'A'
  };
}

function createRoom(hostId, hostName, roomName) {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();

  return {
    id,
    name: roomName || `Arena-${id}`,
    host: hostId,
    players: new Map()
  };
}

function broadcastLobby(room) {
  const players = Array.from(room.players.values());
  io.to(room.id).emit('lobbyUpdate', { players });
}

// ═══════════════════════════════════════════════════════
// GAME ENGINE
// ═══════════════════════════════════════════════════════

function createGameState(room) {
  return {
    players: [],
    bullets: [],
    matchTime: 300,
    lastUpdate: Date.now()
  };
}

function startGameLoop(room) {
  const state = createGameState(room);

  room.players.forEach(p => {
    state.players.push({
      id: p.id,
      name: p.name,
      team: p.team,
      x: Math.random() * 20 - 10,
      z: Math.random() * 20 - 10,
      rotY: 0,
      health: 100,
      energy: 100,
      alive: true,
      input: {}
    });
  });

  gameStates.set(room.id, state);

  console.log('🎮 GAME LOOP STARTED:', room.id);

  const interval = setInterval(() => {
    const now = Date.now();
    const dt = (now - state.lastUpdate) / 1000;
    state.lastUpdate = now;

    // ⏱ TIMER
    state.matchTime -= dt;
    if (state.matchTime <= 0) {
      state.matchTime = 0;
      clearInterval(interval);
      io.to(room.id).emit('gameEnd', {});
      return;
    }

    // 🚶 MOVEMENT
    state.players.forEach(p => {
      const inp = p.input || {};
      const speed = 12;

      if (inp.w) p.z -= speed * dt;
      if (inp.s) p.z += speed * dt;
      if (inp.a) p.x -= speed * dt;
      if (inp.d) p.x += speed * dt;

      p.rotY = inp.rotY || 0;
    });

    // 🔫 BULLETS (simple forward move)
    state.bullets.forEach(b => {
      b.x += b.dx * 25 * dt;
      b.z += b.dz * 25 * dt;
    });

    // 📡 SEND STATE
    io.to(room.id).emit('gameState', state);

  }, 50);
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

    broadcastLobby(room);
  });

  // ── JOIN ROOM ─────────────────────────
  socket.on('joinRoom', ({ roomId, playerName, team }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', { msg: 'Room not found' });

    socket.join(room.id);

    const player = createPlayer(socket.id, playerName, team);

    room.players.set(socket.id, player);
    playerRooms.set(socket.id, room.id);

    socket.emit('roomJoined', {
      roomId: room.id,
      roomName: room.name,
      player
    });

    broadcastLobby(room);
  });

  // ── INPUT ─────────────────────────────
  socket.on('playerInput', (input) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const state = gameStates.get(roomId);
    if (!state) return;

    const player = state.players.find(p => p.id === socket.id);
    if (player) player.input = input;
  });

  // ── SHOOT ─────────────────────────────
  socket.on('shoot', ({ dx, dz }) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const state = gameStates.get(roomId);
    if (!state) return;

    const player = state.players.find(p => p.id === socket.id);
    if (!player) return;

    state.bullets.push({
      id: Math.random(),
      x: player.x,
      z: player.z,
      dx,
      dz,
      team: player.team
    });
  });

  // ── START GAME ────────────────────────
  socket.on('startGame', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (room.host !== socket.id) return;

    io.to(room.id).emit('countdown', { count: 3 });

    setTimeout(() => {
      io.to(room.id).emit('gameStart');

      // 🔥 START GAME ENGINE
      startGameLoop(room);

    }, 3000);
  });

  // ── DISCONNECT ────────────────────────
  socket.on('disconnect', () => {
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
// START SERVER
// ═══════════════════════════════════════════════════════

server.setTimeout(0);

const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
