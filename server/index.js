// ═══════════════════════════════════════════════════════
// NEON FRACTURE — SERVER v4 (LOBBY + START FIX)
// ═══════════════════════════════════════════════════════

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path     = require('path');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] },
  transports: ["websocket","polling"]
});

app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const rooms = new Map();
const playerRooms = new Map();

// ── PLAYER ─────────────────────────────
function createPlayer(id, name, team) {
  return {
    id,
    name: name.substring(0,16),
    team
  };
}

// ── ROOM ───────────────────────────────
function createRoom(hostId, hostName, roomName) {
  const id = Math.random().toString(36).substring(2,8).toUpperCase();

  return {
    id,
    name: roomName || `Arena-${id}`,
    host: hostId,
    players: new Map()
  };
}

// ── SEND LOBBY UPDATE ──────────────────
function sendLobby(room) {
  const players = Array.from(room.players.values());

  io.to(room.id).emit('lobbyUpdate', {
    players
  });
}

// ── SOCKET ─────────────────────────────
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

    sendLobby(room); // 🔥 IMPORTANT
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
      player
    });

    sendLobby(room); // 🔥 IMPORTANT
  });

  // 🔥 SWITCH TEAM
  socket.on('switchTeam', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    const player = room.players.get(socket.id);

    player.team = player.team === 'A' ? 'B' : 'A';

    sendLobby(room);
  });

  // 🔥 START GAME FIX
  socket.on('startGame', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);

    if (room.host !== socket.id) return;

    if (room.players.size < 2) {
      return socket.emit('error', { msg: 'Need at least 2 players' });
    }

    io.to(room.id).emit('countdown', { count: 3 });

    setTimeout(() => {
      io.to(room.id).emit('gameStart');
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

// ── START ──────────────────────────────
server.setTimeout(0);

// Render provides PORT dynamically
const PORT = process.env.PORT || 10000;

// IMPORTANT: bind to 0.0.0.0 for Render
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on ${PORT}`);
});
