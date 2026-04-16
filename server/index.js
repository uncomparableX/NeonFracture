// ═══════════════════════════════════════════════════════
// NEON FRACTURE — SERVER v7 (FULL GAMEPLAY FIX)
// Movement + Timer + Shooting + Abilities (basic)
// ═══════════════════════════════════════════════════════

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"]
});

app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── STATE ─────────────────────────────────────────────
const rooms = new Map();
const playerRooms = new Map();
const gameStates = new Map();

// ── HELPERS ───────────────────────────────────────────
function createPlayer(id, name, team) {
  return { id, name: name.substring(0, 16), team };
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

function sendLobby(room) {
  io.to(room.id).emit('lobbyUpdate', {
    players: Array.from(room.players.values())
  });
}

// ── GAME ENGINE ───────────────────────────────────────
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
      input: {},
      cooldowns: {}
    });
  });

  gameStates.set(room.id, state);

  setInterval(() => {
    const now = Date.now();
    const dt = (now - state.lastUpdate) / 1000;
    state.lastUpdate = now;

    // ⏱ FIXED TIMER
    state.matchTime = Math.max(0, state.matchTime - dt);

    state.players.forEach(p => {
      const inp = p.input || {};
      const speed = 12;

      if (inp.w) p.z -= speed * dt;
      if (inp.s) p.z += speed * dt;
      if (inp.a) p.x -= speed * dt;
      if (inp.d) p.x += speed * dt;

      p.rotY = inp.rotY || 0;
    });

    // BULLETS
    state.bullets.forEach(b => {
      b.x += b.dx * 25 * dt;
      b.z += b.dz * 25 * dt;
    });

    io.to(room.id).emit('gameState', state);

  }, 50);
}

// ── SOCKET ────────────────────────────────────────────
io.on('connection', socket => {

  console.log('✅ Connected:', socket.id);

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

    sendLobby(room);
  });

  socket.on('joinRoom', ({ roomId, playerName, team }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    socket.join(room.id);

    const player = createPlayer(socket.id, playerName, team || 'A');
    room.players.set(socket.id, player);
    playerRooms.set(socket.id, room.id);

    socket.emit('roomJoined', {
      roomId: room.id,
      roomName: room.name,
      player
    });

    sendLobby(room);
  });

  // INPUT
  socket.on('playerInput', input => {
    const roomId = playerRooms.get(socket.id);
    const state = gameStates.get(roomId);
    if (!state) return;

    const p = state.players.find(x => x.id === socket.id);
    if (p) p.input = input;
  });

  // SHOOT
  socket.on('shoot', ({ dx, dz }) => {
    const roomId = playerRooms.get(socket.id);
    const state = gameStates.get(roomId);
    if (!state) return;

    const p = state.players.find(x => x.id === socket.id);
    if (!p) return;

    state.bullets.push({
      id: Math.random(),
      x: p.x,
      z: p.z,
      dx,
      dz,
      team: p.team
    });
  });

  // ABILITIES (BASIC FIX)
  socket.on('useAbility', ({ ability }) => {
    const roomId = playerRooms.get(socket.id);
    const state = gameStates.get(roomId);
    if (!state) return;

    const p = state.players.find(x => x.id === socket.id);
    if (!p) return;

    if (ability === 'dash') {
      p.x += Math.sin(p.rotY) * 5;
      p.z += Math.cos(p.rotY) * 5;
    }

    io.to(roomId).emit('abilityUsed', {
      playerId: p.id,
      ability,
      x: p.x,
      z: p.z,
      team: p.team
    });
  });

  // START GAME
  socket.on('startGame', () => {
    const roomId = playerRooms.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.host !== socket.id) return;

    io.to(room.id).emit('countdown', { count: 3 });

    setTimeout(() => {
      io.to(room.id).emit('gameStart');
      startGameLoop(room);
    }, 3000);
  });

  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players.delete(socket.id);
    playerRooms.delete(socket.id);

    sendLobby(room);
  });

});

// ── START ─────────────────────────────────────────────
server.setTimeout(0);
const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on ${PORT}`);
});
