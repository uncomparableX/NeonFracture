// ═══════════════════════════════════════════════════════
// NEON FRACTURE — SERVER FINAL (LOBBY + GAME LOOP)
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

// Serve frontend
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// STATE
const rooms = new Map();
const playerRooms = new Map();

// PLAYER
function createPlayer(id, name, team) {
  return {
    id,
    name: (name || 'OPERATOR').substring(0, 16),
    team: team || 'A',
    x: Math.random() * 10,
    z: Math.random() * 10
  };
}

// ROOM
function createRoom(hostId, roomName) {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();

  return {
    id,
    name: roomName || `Arena-${id}`,
    host: hostId,
    players: new Map(),
    tick: null
  };
}

// LOBBY UPDATE
function updateLobby(room) {
  io.to(room.id).emit('lobbyUpdate', {
    players: Array.from(room.players.values())
  });
}

// SOCKET
io.on('connection', (socket) => {
  console.log('✅ Connected:', socket.id);

  // CREATE
  socket.on('createRoom', ({ playerName, roomName }) => {
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

    updateLobby(room);
  });

  // JOIN
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

    updateLobby(room);
  });

  // SWITCH TEAM
  socket.on('switchTeam', () => {
    const room = rooms.get(playerRooms.get(socket.id));
    if (!room) return;

    const p = room.players.get(socket.id);
    if (!p) return;

    p.team = p.team === 'A' ? 'B' : 'A';
    updateLobby(room);
  });

  // START GAME
  socket.on('startGame', () => {
    const room = rooms.get(playerRooms.get(socket.id));
    if (!room) return;

    if (room.host !== socket.id)
      return socket.emit('error', { msg: 'Only host can start' });

    if (room.players.size < 2)
      return socket.emit('error', { msg: 'Need 2 players' });

    io.to(room.id).emit('countdown', { count: 3 });

    setTimeout(() => {
      io.to(room.id).emit('gameStart');

      // GAME LOOP
      room.tick = setInterval(() => {
        const state = {
          players: Array.from(room.players.values())
        };

        io.to(room.id).emit('gameState', state);
      }, 50);

    }, 3000);
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const room = rooms.get(playerRooms.get(socket.id));
    if (!room) return;

    room.players.delete(socket.id);
    playerRooms.delete(socket.id);

    if (room.players.size === 0) {
      clearInterval(room.tick);
      rooms.delete(room.id);
    } else {
      updateLobby(room);
    }
  });
});

// START
server.setTimeout(0);
const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on ${PORT}`);
});
