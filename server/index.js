// ═══════════════════════════════════════════════════════
// NEON FRACTURE — SERVER v3 (FINAL FIXED)
// Render + Socket.io stable version
// ═══════════════════════════════════════════════════════

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path     = require('path');

const app    = express();
const server = http.createServer(app);

// ✅ FIXED SOCKET.IO CONFIG (IMPORTANT)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"],
  allowEIO3: true
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const TICK_RATE   = 20;
const MAP_HALF    = 48;
const PLAYER_SPD  = 0.28;
const BULLET_SPD  = 1.3;
const HEALTH_MAX  = 100;
const ENERGY_MAX  = 100;
const ENERGY_REGEN= 0.18;
const SCORE_WIN   = 100;
const MATCH_SEC   = 300;

const ABILITY_CD   = { dash:3000, freeze:8000, pulse:5000, shield:6000 };
const ABILITY_COST = { dash:20, freeze:35, pulse:30, shield:25 };
const POWERUP_TYPES= ['health','speed','ammo'];
const POWERUP_SPAWN_INTERVAL = 18000;

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const rooms       = new Map();
const playerRooms = new Map();

// ═══════════════════════════════════════════════════════
// PLAYER / ROOM HELPERS
// ═══════════════════════════════════════════════════════
function createPlayer(id, name, team) {
  const sx = team==='A' ? -22+Math.random()*8 : 14+Math.random()*8;
  return {
    id, name: name.substring(0,16), team,
    x: sx, y:0, z: -8+Math.random()*16,
    rotY: team==='A'?0:Math.PI,
    health: HEALTH_MAX, energy: ENERGY_MAX,
    alive: true, shieldActive: false,
    frozenUntil: 0, speedBoost: 0, ammoBoost: 0,
    kills:0, deaths:0, score:0, xp:0, level:1,
    abilityCooldowns: { dash:0, freeze:0, pulse:0, shield:0 },
    inputQueue: []
  };
}

function createRoom(hostId, hostName, roomName) {
  const id = Math.random().toString(36).substring(2,8).toUpperCase();
  return {
    id,
    name: roomName || `Arena-${id}`,
    host: hostId,
    state: 'lobby',
    players: new Map(),
    bullets: new Map(),
    cores: spawnCores(),
    powerups: new Map(),
    teamScores: { A:0, B:0 },
    matchTime: MATCH_SEC,
    tickInterval:null,
    matchTimer:null,
    powerupTimer:null
  };
}

function spawnCores() {
  const base = [[-20,0],[-10,-12],[-10,12],[10,-12],[10,12],[20,0],[0,0],[0,-18],[0,18]];
  return base.sort(()=>Math.random()-0.5).slice(0,5).map(([x,z])=>({
    id:uuidv4(), x, z, active:true, respawnAt:0
  }));
}

// ═══════════════════════════════════════════════════════
// SOCKET HANDLERS
// ═══════════════════════════════════════════════════════
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
      player: { id: player.id, name: player.name, team: player.team }
    });
  });

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
      player: { id: player.id, name: player.name, team: player.team }
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);

    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players.delete(socket.id);
    playerRooms.delete(socket.id);
  });
});

// ═══════════════════════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════════════════════

// ✅ IMPORTANT FOR RENDER (prevents timeout issues)
server.setTimeout(0);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 NEON FRACTURE running on port ${PORT}`);
});
