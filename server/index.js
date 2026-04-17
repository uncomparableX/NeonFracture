// ═══════════════════════════════════════════════════════
//  NEON FRACTURE — SERVER  (Complete v4)
//  Fixed: combat, hit detection, timer, abilities, bounds
// ═══════════════════════════════════════════════════════
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  pingTimeout: 10000,
  pingInterval: 5000
});

app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// ── Constants ─────────────────────────────────────────
const TICK_RATE      = 20;           // server ticks per second
const TICK_MS        = 1000 / TICK_RATE;
const MAP_HALF       = 46;           // hard boundary ±46 units
const PLAYER_RADIUS  = 1.0;          // collision radius
const BULLET_RADIUS  = 0.25;
const PLAYER_SPD     = 0.30;         // units per tick
const BULLET_SPD     = 1.5;          // units per tick
const HEALTH_MAX     = 100;
const ENERGY_MAX     = 100;
const ENERGY_REGEN   = 0.20;         // per tick
const BULLET_DAMAGE  = 15;
const AMMO_DMG_BOOST = 22;
const SCORE_WIN      = 100;
const MATCH_SEC      = 300;
const RESPAWN_MS     = 4000;
const POWERUP_SPAWN_INTERVAL = 20000;

const ABILITY_CD   = { dash: 3000, freeze: 8000, pulse: 5000, shield: 6000 };
const ABILITY_COST = { dash: 20,   freeze: 35,   pulse: 30,   shield: 25  };
const POWERUP_TYPES = ['health', 'speed', 'ammo'];

// ── State ─────────────────────────────────────────────
const rooms       = new Map();
const playerRooms = new Map();

// ── Player factory ────────────────────────────────────
function createPlayer(id, name, team) {
  const spawn = _spawnPos(team);
  return {
    id,
    name: name.substring(0, 16).trim() || 'OPERATOR',
    team,
    x: spawn.x, y: 0, z: spawn.z,
    rotY: team === 'A' ? 0 : Math.PI,
    health: HEALTH_MAX,
    energy: ENERGY_MAX,
    alive: true,
    shieldActive: false,
    frozenUntil: 0,
    speedBoost: 0,   // timestamp until active
    ammoBoost: 0,    // timestamp until active
    kills: 0, deaths: 0, score: 0, xp: 0, level: 1,
    abilityCooldowns: { dash: 0, freeze: 0, pulse: 0, shield: 0 },
    inputQueue: []
  };
}

function _spawnPos(team) {
  return {
    x: team === 'A' ? -28 + Math.random() * 10 : 18 + Math.random() * 10,
    z: -10 + Math.random() * 20
  };
}

// ── Room factory ──────────────────────────────────────
function createRoom(hostId, roomName) {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  return {
    id,
    name: roomName || `Arena-${id}`,
    host: hostId,
    state: 'lobby',
    players:    new Map(),
    bullets:    new Map(),
    powerups:   new Map(),
    cores:      _spawnCores(),
    teamScores: { A: 0, B: 0 },
    matchTime:  MATCH_SEC,
    tickInterval:  null,
    matchInterval: null,
    powerupTimer:  null,
    startTime:     null
  };
}

function _spawnCores() {
  const positions = [
    [-20, 0], [-10, -14], [-10, 14],
    [0, 0],
    [10, -14], [10, 14], [20, 0],
    [0, -20], [0, 20]
  ];
  return positions.sort(() => Math.random() - 0.5).slice(0, 5).map(([x, z]) => ({
    id: uuidv4(), x, z, active: true, capturedBy: null, respawnAt: 0
  }));
}

// ── Game lifecycle ────────────────────────────────────
function startGame(room) {
  room.state     = 'playing';
  room.startTime = Date.now();
  room.matchTime = MATCH_SEC;

  // Reset all players to spawn positions
  room.players.forEach(p => {
    const spawn = _spawnPos(p.team);
    p.x = spawn.x; p.z = spawn.z;
    p.health = HEALTH_MAX; p.energy = ENERGY_MAX;
    p.alive = true; p.shieldActive = false;
    p.frozenUntil = 0;
  });

  io.to(room.id).emit('gameStart', {
    cores:    room.cores,
    powerups: [...room.powerups.values()]
  });

  // Game tick — physics, bullets, collisions
  room.tickInterval = setInterval(() => _gameTick(room), TICK_MS);

  // Match timer — decrement every real second
  room.matchInterval = setInterval(() => {
    if (room.state !== 'playing') return;
    room.matchTime--;
    if (room.matchTime <= 60 && room.matchTime % 30 === 0 || room.matchTime <= 10) {
      io.to(room.id).emit('announcer', { text: `${room.matchTime} SECONDS REMAINING`, style: 'red' });
    }
    if (room.matchTime <= 0) _endGame(room, 'time');
  }, 1000);

  // Powerup spawner
  room.powerupTimer = setInterval(() => {
    if (room.state === 'playing') _spawnPowerup(room);
  }, POWERUP_SPAWN_INTERVAL);
  _spawnPowerup(room);
  _spawnPowerup(room);
}

function _endGame(room, reason) {
  if (room.state === 'ended') return;
  room.state = 'ended';
  clearInterval(room.tickInterval);
  clearInterval(room.matchInterval);
  clearInterval(room.powerupTimer);

  const { A, B } = room.teamScores;
  const winner = A > B ? 'A' : B > A ? 'B' : 'DRAW';

  const stats = [];
  room.players.forEach(p => stats.push({
    id: p.id, name: p.name, team: p.team,
    kills: p.kills, deaths: p.deaths, score: p.score, level: p.level
  }));
  stats.sort((a, b) => b.score - a.score);

  io.to(room.id).emit('gameEnd', { winner, reason, teamScores: room.teamScores, stats });

  setTimeout(() => {
    rooms.delete(room.id);
    room.players.forEach((_, pid) => playerRooms.delete(pid));
  }, 60000);
}

// ── Core game tick ────────────────────────────────────
function _gameTick(room) {
  const now = Date.now();

  // 1. Process player movement inputs
  room.players.forEach(player => {
    if (!player.alive) return;

    const frozen = player.frozenUntil > now;
    if (frozen) {
      // Regen energy even while frozen, just can't move
      player.energy = Math.min(ENERGY_MAX, player.energy + ENERGY_REGEN);
      return;
    }

    const inputs = player.inputQueue.splice(0);
    player.energy = Math.min(ENERGY_MAX, player.energy + ENERGY_REGEN);

    if (!inputs.length) return;
    const inp = inputs[inputs.length - 1]; // use most recent input

    let dx = 0, dz = 0;
    const spd = PLAYER_SPD * (player.speedBoost > now ? 1.75 : 1.0);
    if (inp.w) dz -= spd;
    if (inp.s) dz += spd;
    if (inp.a) dx -= spd;
    if (inp.d) dx += spd;

    // Diagonal normalisation
    if (dx !== 0 && dz !== 0) { dx *= 0.707; dz *= 0.707; }

    // Apply with hard boundary clamp — this is what keeps players IN the arena
    player.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, player.x + dx));
    player.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, player.z + dz));
    player.rotY = (inp.rotY !== undefined) ? inp.rotY : player.rotY;
  });

  // 2. Move bullets + collision detection
  const deadBullets = [];
  room.bullets.forEach((b, bid) => {
    // Move bullet
    b.x += b.dx * BULLET_SPD;
    b.z += b.dz * BULLET_SPD;
    b.life--;

    // Expire if out of bounds or too old
    if (b.life <= 0 || Math.abs(b.x) > MAP_HALF + 4 || Math.abs(b.z) > MAP_HALF + 4) {
      deadBullets.push(bid);
      return;
    }

    // Hit detection against all living enemies
    room.players.forEach(target => {
      if (!target.alive || target.team === b.team || target.id === b.owner) return;
      if (deadBullets.includes(bid)) return; // already hit something

      const dx = target.x - b.x;
      const dz = target.z - b.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < PLAYER_RADIUS + BULLET_RADIUS) {
        deadBullets.push(bid);

        let dmg = b.damage;
        if (target.shieldActive) dmg = Math.max(1, Math.floor(dmg * 0.15)); // shield = 85% reduction

        target.health = Math.max(0, target.health - dmg);

        // Broadcast hit to all players in room
        io.to(room.id).emit('playerHit', {
          targetId: target.id,
          sourceId: b.owner,
          damage:   dmg,
          x:        target.x,
          z:        target.z,
          shielded: target.shieldActive
        });

        if (target.health <= 0) {
          _killPlayer(room, target, b.owner, b.sourceAbility || 'bullet');
        }
      }
    });
  });
  deadBullets.forEach(bid => room.bullets.delete(bid));

  // 3. Energy core capture
  room.cores.forEach(core => {
    // Respawn inactive cores
    if (!core.active && now > core.respawnAt) {
      core.active = true;
      core.capturedBy = null;
      io.to(room.id).emit('coreRespawned', { coreId: core.id });
    }
    if (!core.active) return;

    room.players.forEach(p => {
      if (!p.alive) return;
      const dx = p.x - core.x, dz = p.z - core.z;
      if (Math.sqrt(dx * dx + dz * dz) < 2.5) {
        core.active    = false;
        core.capturedBy = p.team;
        core.respawnAt = now + 15000;
        room.teamScores[p.team] += 10;
        p.score += 10;
        _awardXP(p, 25);
        io.to(room.id).emit('coreCaptured', {
          coreId: core.id,
          team:   p.team,
          scores: room.teamScores
        });
        _checkWin(room);
      }
    });
  });

  // 4. Powerup pickup
  room.powerups.forEach((pu, pid) => {
    if (!pu.active) return;
    room.players.forEach(p => {
      if (!p.alive) return;
      const dx = p.x - pu.x, dz = p.z - pu.z;
      if (Math.sqrt(dx * dx + dz * dz) < 1.8) {
        _applyPowerup(p, pu, now);
        pu.active = false;
        room.powerups.delete(pid);
        io.to(room.id).emit('powerupPickup', {
          puId:     pid,
          playerId: p.id,
          type:     pu.type,
          x:        pu.x,
          z:        pu.z
        });
      }
    });
  });

  // 5. Broadcast authoritative game state to all clients
  io.to(room.id).emit('gameState', _buildState(room, now));
}

// ── Kill & respawn ────────────────────────────────────
function _killPlayer(room, player, killerId, ability) {
  player.alive        = false;
  player.health       = 0;
  player.shieldActive = false;
  player.deaths++;

  const killer = room.players.get(killerId);
  if (killer) {
    killer.kills++;
    killer.score += 25;
    _awardXP(killer, 50);
    room.teamScores[killer.team] += 5;
  }

  io.to(room.id).emit('playerKilled', {
    playerId: player.id,
    killerId,
    ability,
    x: player.x,
    z: player.z
  });

  // Respawn after delay
  setTimeout(() => {
    if (!room.players.has(player.id) || room.state !== 'playing') return;
    const spawn = _spawnPos(player.team);
    player.x          = spawn.x;
    player.z          = spawn.z;
    player.health      = HEALTH_MAX;
    player.energy      = ENERGY_MAX;
    player.alive       = true;
    player.shieldActive = false;
    player.frozenUntil = 0;
    // Reset ability cooldowns on respawn so player can fight
    player.abilityCooldowns = { dash: 0, freeze: 0, pulse: 0, shield: 0 };
    io.to(room.id).emit('playerRespawn', {
      playerId: player.id,
      x: player.x,
      z: player.z
    });
  }, RESPAWN_MS);
}

// ── Ability helpers ───────────────────────────────────
function _applyPowerup(player, pu, now) {
  if (pu.type === 'health') player.health = Math.min(HEALTH_MAX, player.health + 45);
  if (pu.type === 'speed')  player.speedBoost = now + 7000;
  if (pu.type === 'ammo')   player.ammoBoost  = now + 8000;
}

function _awardXP(player, amount) {
  player.xp = (player.xp || 0) + amount;
  if (player.xp >= player.level * 100) {
    player.xp -= player.level * 100;
    player.level++;
  }
}

function _checkWin(room) {
  if (room.teamScores.A >= SCORE_WIN) _endGame(room, 'score');
  else if (room.teamScores.B >= SCORE_WIN) _endGame(room, 'score');
}

function _spawnPowerup(room) {
  if (room.powerups.size >= 6) return; // cap
  const type  = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  const angle = Math.random() * Math.PI * 2;
  const r     = 6 + Math.random() * 30;
  const pu    = {
    id:     uuidv4(),
    type,
    x:      Math.max(-40, Math.min(40, Math.cos(angle) * r)),
    z:      Math.max(-40, Math.min(40, Math.sin(angle) * r)),
    active: true
  };
  room.powerups.set(pu.id, pu);
  io.to(room.id).emit('powerupSpawned', pu);
}

// ── State snapshot for broadcast ─────────────────────
function _buildState(room, now) {
  const players = [], bullets = [], powerups = [];

  room.players.forEach(p => players.push({
    id:          p.id,
    name:        p.name,
    team:        p.team,
    x:           p.x,
    y:           0,
    z:           p.z,
    rotY:        p.rotY,
    health:      p.health,
    energy:      p.energy,
    alive:       p.alive,
    kills:       p.kills,
    deaths:      p.deaths,
    score:       p.score,
    level:       p.level,
    xp:          p.xp,
    shieldActive: p.shieldActive,
    frozenUntil:  p.frozenUntil,
    speedBoost:  p.speedBoost > now,
    cooldowns:   p.abilityCooldowns
  }));

  room.bullets.forEach(b => bullets.push({
    id:   b.id,
    x:    b.x,
    z:    b.z,
    team: b.team
  }));

  room.powerups.forEach(pu => { if (pu.active) powerups.push(pu); });

  return {
    players,
    bullets,
    powerups,
    cores:      room.cores.map(c => ({ id: c.id, x: c.x, z: c.z, active: c.active })),
    teamScores: room.teamScores,
    matchTime:  room.matchTime   // ← sent every tick so client always has fresh value
  };
}

// ── Socket handlers ───────────────────────────────────
io.on('connection', socket => {
  console.log(`[+] ${socket.id}`);

  socket.on('createRoom', ({ playerName, roomName }) => {
    const room   = createRoom(socket.id, roomName);
    rooms.set(room.id, room);
    socket.join(room.id);
    const player = createPlayer(socket.id, playerName || 'OPERATOR', 'A');
    room.players.set(socket.id, player);
    playerRooms.set(socket.id, room.id);
    socket.emit('roomCreated', { roomId: room.id, roomName: room.name, player: _sanitize(player) });
    io.to(room.id).emit('lobbyUpdate', _getLobby(room));
  });

  socket.on('joinRoom', ({ roomId, playerName, team }) => {
    const room = rooms.get((roomId || '').toUpperCase());
    if (!room) return socket.emit('error', { msg: 'Room not found' });
    if (room.state !== 'lobby') return socket.emit('error', { msg: 'Match already in progress' });
    if (room.players.size >= 10) return socket.emit('error', { msg: 'Room is full' });

    const chosen = team || (_teamCount(room, 'A') <= _teamCount(room, 'B') ? 'A' : 'B');
    socket.join(room.id);
    const player = createPlayer(socket.id, playerName || 'OPERATOR', chosen);
    room.players.set(socket.id, player);
    playerRooms.set(socket.id, room.id);
    socket.emit('roomJoined', { roomId: room.id, roomName: room.name, player: _sanitize(player) });
    io.to(room.id).emit('lobbyUpdate', _getLobby(room));
  });

  socket.on('switchTeam', () => {
    const room = rooms.get(playerRooms.get(socket.id));
    if (!room || room.state !== 'lobby') return;
    const p = room.players.get(socket.id);
    if (p) { p.team = p.team === 'A' ? 'B' : 'A'; }
    io.to(room.id).emit('lobbyUpdate', _getLobby(room));
  });

  socket.on('startGame', () => {
    const room = rooms.get(playerRooms.get(socket.id));
    if (!room || room.host !== socket.id || room.state !== 'lobby') return;
    if (room.players.size < 2) return socket.emit('error', { msg: 'Need at least 2 players to start' });

    room.state = 'countdown';
    let count = 5;
    io.to(room.id).emit('countdown', { count });
    const cd = setInterval(() => {
      count--;
      if (count > 0) io.to(room.id).emit('countdown', { count });
      else { clearInterval(cd); startGame(room); }
    }, 1000);
  });

  // ── In-game events ───────────────────────────────────
  socket.on('playerInput', input => {
    const room = rooms.get(playerRooms.get(socket.id));
    if (!room || room.state !== 'playing') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive) return;
    p.inputQueue.push(input);
    if (p.inputQueue.length > 8) p.inputQueue.shift(); // prevent queue bloat
  });

  socket.on('shoot', ({ dx, dz }) => {
    const room = rooms.get(playerRooms.get(socket.id));
    if (!room || room.state !== 'playing') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || p.frozenUntil > Date.now()) return;

    const mag = Math.sqrt(dx * dx + dz * dz) || 1;
    const dmg = p.ammoBoost > Date.now() ? AMMO_DMG_BOOST : BULLET_DAMAGE;

    const bid = uuidv4();
    room.bullets.set(bid, {
      id:            bid,
      owner:         socket.id,
      team:          p.team,
      x:             p.x,
      z:             p.z,
      dx:            dx / mag,
      dz:            dz / mag,
      damage:        dmg,
      life:          42,   // ~2 second range at BULLET_SPD 1.5
      sourceAbility: null
    });
  });

  socket.on('useAbility', ({ ability }) => {
    const room = rooms.get(playerRooms.get(socket.id));
    if (!room || room.state !== 'playing') return;
    const p   = room.players.get(socket.id);
    if (!p || !p.alive) return;

    const now = Date.now();
    if ((p.abilityCooldowns[ability] || 0) > now) return;  // on cooldown
    if ((p.energy || 0) < ABILITY_COST[ability])  return;  // not enough energy

    // Deduct energy & set cooldown
    p.energy -= ABILITY_COST[ability];
    p.abilityCooldowns[ability] = now + ABILITY_CD[ability];

    switch (ability) {
      // DASH — immediate teleport-dash forward (clamped to arena)
      case 'dash': {
        const dist = 10;
        p.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, p.x + Math.sin(p.rotY) * dist));
        p.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, p.z + Math.cos(p.rotY) * dist));
        break;
      }

      // FREEZE — freeze all enemies within 15 units for 3 seconds
      case 'freeze': {
        let frozeCount = 0;
        room.players.forEach(t => {
          if (t.team !== p.team && t.alive) {
            const dx = t.x - p.x, dz = t.z - p.z;
            if (Math.sqrt(dx * dx + dz * dz) < 15) {
              t.frozenUntil = now + 3000;
              frozeCount++;
            }
          }
        });
        if (frozeCount === 0) {
          // No targets — refund partial energy
          p.energy = Math.min(ENERGY_MAX, p.energy + Math.floor(ABILITY_COST.freeze * 0.5));
        }
        break;
      }

      // PULSE — 8-directional bullet burst, moderate damage
      case 'pulse': {
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const bid = uuidv4();
          room.bullets.set(bid, {
            id:            bid,
            owner:         socket.id,
            team:          p.team,
            x:             p.x,
            z:             p.z,
            dx:            Math.sin(ang),
            dz:            Math.cos(ang),
            damage:        14,
            life:          24,
            sourceAbility: 'pulse'
          });
        }
        break;
      }

      // SHIELD — active for 4.5 seconds, absorbs 85% damage
      case 'shield': {
        p.shieldActive = true;
        setTimeout(() => {
          const fp = room.players.get(socket.id);
          if (fp) fp.shieldActive = false;
        }, 4500);
        break;
      }
    }

    io.to(room.id).emit('abilityUsed', {
      playerId: socket.id,
      ability,
      x:    p.x,
      z:    p.z,
      team: p.team
    });
  });

  // ── Disconnect ───────────────────────────────────────
  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    room.players.delete(socket.id);
    playerRooms.delete(socket.id);

    if (room.players.size === 0) {
      clearInterval(room.tickInterval);
      clearInterval(room.matchInterval);
      clearInterval(room.powerupTimer);
      rooms.delete(roomId);
    } else {
      if (room.host === socket.id) room.host = room.players.keys().next().value;
      io.to(roomId).emit('playerLeft', { playerId: socket.id });
      io.to(roomId).emit('lobbyUpdate', _getLobby(room));
    }
    console.log(`[-] ${socket.id}`);
  });
});

// ── Utility ───────────────────────────────────────────
function _teamCount(room, team) {
  let c = 0;
  room.players.forEach(p => { if (p.team === team) c++; });
  return c;
}

function _sanitize(p) {
  return { id: p.id, name: p.name, team: p.team, level: p.level };
}

function _getLobby(room) {
  const players = [];
  room.players.forEach(p => players.push({ id: p.id, name: p.name, team: p.team, level: p.level }));
  return { roomId: room.id, roomName: room.name, host: room.host, players };
}

// ── Listen ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NEON FRACTURE: Quantum Arena — port ${PORT}`);
});
