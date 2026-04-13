const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path     = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  pingTimeout: 10000, pingInterval: 5000
});

app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req,res) => res.sendFile(path.join(__dirname,'../public/index.html')));

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
const POWERUP_SPAWN_INTERVAL = 18000; // ms

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const rooms       = new Map();
const playerRooms = new Map();

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
    inputQueue: [], lastAbility: null
  };
}

function createRoom(hostId, hostName, roomName) {
  const id = Math.random().toString(36).substring(2,8).toUpperCase();
  return {
    id, name: roomName||`Arena-${id}`,
    host: hostId, state:'lobby',
    players: new Map(), bullets: new Map(),
    cores: spawnCores(), powerups: new Map(),
    teamScores: {A:0,B:0}, matchTime: MATCH_SEC,
    tickInterval:null, matchTimer:null, powerupTimer:null,
    startTime:null, totalPlayers:0
  };
}

function spawnCores() {
  const corePositions = [
    [-20,0],[-10,-12],[-10,12],[10,-12],[10,12],[20,0],[0,0],[0,-18],[0,18]
  ];
  // Pick 5 random
  const shuffled = corePositions.sort(()=>Math.random()-0.5).slice(0,5);
  return shuffled.map(([x,z]) => ({
    id: uuidv4(), x, z, active:true, capturedBy:null, respawnAt:0
  }));
}

function spawnPowerup(room) {
  const type = POWERUP_TYPES[Math.floor(Math.random()*POWERUP_TYPES.length)];
  const angle = Math.random()*Math.PI*2, r = 8+Math.random()*28;
  const pu = { id:uuidv4(), type, x:Math.cos(angle)*r, z:Math.sin(angle)*r, active:true };
  room.powerups.set(pu.id, pu);
  io.to(room.id).emit('powerupSpawned', pu);
}

// ═══════════════════════════════════════════════════════
// GAME LIFECYCLE
// ═══════════════════════════════════════════════════════
function startGame(room) {
  room.state = 'playing';
  room.startTime = Date.now();

  // Reset positions
  room.players.forEach(p => {
    const sx = p.team==='A' ? -22+Math.random()*8 : 14+Math.random()*8;
    p.x=sx; p.z=-8+Math.random()*16;
    p.health=HEALTH_MAX; p.energy=ENERGY_MAX; p.alive=true;
  });

  io.to(room.id).emit('gameStart', { cores: room.cores, powerups: [...room.powerups.values()] });

  room.tickInterval   = setInterval(()=>gameTick(room), 1000/TICK_RATE);
  room.matchTimer     = setInterval(()=>matchCountdown(room), 1000);
  room.powerupTimer   = setInterval(()=>spawnPowerup(room), POWERUP_SPAWN_INTERVAL);
  // Spawn initial powerups
  spawnPowerup(room); spawnPowerup(room);
}

function matchCountdown(room) {
  room.matchTime--;
  // Announcements at key moments
  if ([60,30,10].includes(room.matchTime)) {
    io.to(room.id).emit('announcer', { text:`${room.matchTime} SECONDS REMAINING`, style:'red' });
  }
  if (room.matchTime<=0) endGame(room,'time');
}

function endGame(room, reason) {
  if (room.state==='ended') return;
  room.state='ended';
  clearInterval(room.tickInterval);
  clearInterval(room.matchTimer);
  clearInterval(room.powerupTimer);

  const winner = room.teamScores.A>room.teamScores.B?'A':
                 room.teamScores.B>room.teamScores.A?'B':'DRAW';
  const stats = [];
  room.players.forEach(p=>stats.push({ id:p.id,name:p.name,team:p.team,kills:p.kills,deaths:p.deaths,score:p.score,level:p.level }));
  stats.sort((a,b)=>b.score-a.score);
  io.to(room.id).emit('gameEnd', { winner,reason,teamScores:room.teamScores,stats });

  setTimeout(()=>{
    rooms.delete(room.id);
    room.players.forEach((_,pid)=>playerRooms.delete(pid));
  }, 60000);
}

// ═══════════════════════════════════════════════════════
// GAME TICK
// ═══════════════════════════════════════════════════════
function gameTick(room) {
  const now = Date.now();

  // ── Process inputs ────────────────────────────────────
  room.players.forEach(player => {
    if (!player.alive || player.frozenUntil>now) return;
    const inputs = player.inputQueue.splice(0);
    if (!inputs.length) {
      // Regen energy anyway
      if (player.energy<ENERGY_MAX) player.energy=Math.min(ENERGY_MAX,player.energy+ENERGY_REGEN);
      return;
    }
    const inp = inputs[inputs.length-1];
    let dx=0,dz=0;
    const spd = PLAYER_SPD * (player.speedBoost>now?1.7:1);
    if (inp.w) dz-=spd; if (inp.s) dz+=spd;
    if (inp.a) dx-=spd; if (inp.d) dx+=spd;
    if (dx!==0&&dz!==0) { dx*=0.707; dz*=0.707; }
    player.x = clamp(player.x+dx,-MAP_HALF,MAP_HALF);
    player.z = clamp(player.z+dz,-MAP_HALF,MAP_HALF);
    player.rotY = inp.rotY!==undefined?inp.rotY:player.rotY;
    player.energy = Math.min(ENERGY_MAX, player.energy+ENERGY_REGEN);
  });

  // ── Bullets ───────────────────────────────────────────
  const deadBullets = [];
  room.bullets.forEach((b,bid) => {
    b.x += b.dx*BULLET_SPD; b.z += b.dz*BULLET_SPD; b.life--;
    if (b.life<=0||Math.abs(b.x)>MAP_HALF+5||Math.abs(b.z)>MAP_HALF+5) { deadBullets.push(bid); return; }
    room.players.forEach(target => {
      if (!target.alive||target.team===b.team) return;
      const dx=target.x-b.x, dz=target.z-b.z;
      if (Math.sqrt(dx*dx+dz*dz)<1.25) {
        deadBullets.push(bid);
        let dmg = b.damage;
        if (target.shieldActive) dmg=Math.max(1,Math.floor(dmg*0.2));
        target.health -= dmg;
        io.to(room.id).emit('playerHit', { targetId:target.id,sourceId:b.owner,damage:dmg,x:target.x,z:target.z });
        if (target.health<=0) killPlayer(room,target,b.owner,b.sourceAbility||null);
      }
    });
  });
  deadBullets.forEach(bid=>room.bullets.delete(bid));

  // ── Cores ─────────────────────────────────────────────
  room.cores.forEach(core => {
    if (!core.active&&now>core.respawnAt) {
      core.active=true; core.capturedBy=null;
      io.to(room.id).emit('coreRespawned', { coreId:core.id });
    }
    if (!core.active) return;
    room.players.forEach(p => {
      if (!p.alive) return;
      const dx=p.x-core.x, dz=p.z-core.z;
      if (Math.sqrt(dx*dx+dz*dz)<2.2) {
        core.active=false; core.capturedBy=p.team;
        core.respawnAt=now+15000;
        room.teamScores[p.team]+=10;
        p.score+=10; p.xp+=20; awardXP(p,20);
        io.to(room.id).emit('coreCaptured', { coreId:core.id,team:p.team,scores:room.teamScores });
        checkWin(room);
      }
    });
  });

  // ── Powerups ──────────────────────────────────────────
  room.powerups.forEach((pu,pid) => {
    if (!pu.active) return;
    room.players.forEach(p => {
      if (!p.alive) return;
      const dx=p.x-pu.x, dz=p.z-pu.z;
      if (Math.sqrt(dx*dx+dz*dz)<1.6) {
        applyPowerup(p,pu,now);
        pu.active=false;
        room.powerups.delete(pid);
        io.to(room.id).emit('powerupPickup', { puId:pid,playerId:p.id,type:pu.type,x:pu.x,z:pu.z });
      }
    });
  });

  // ── Broadcast state ───────────────────────────────────
  const state = buildState(room);
  io.to(room.id).emit('gameState', state);
}

function applyPowerup(player,pu,now) {
  if (pu.type==='health')  player.health=Math.min(HEALTH_MAX,player.health+40);
  if (pu.type==='speed')   player.speedBoost=now+6000;
  if (pu.type==='ammo')    player.ammoBoost=now+8000;
}

function killPlayer(room,player,killerId,ability) {
  player.alive=false; player.health=0; player.deaths++;
  const killer = room.players.get(killerId);
  if (killer) {
    killer.kills++; killer.score+=25;
    awardXP(killer,50);
    room.teamScores[killer.team]+=5;
  }
  io.to(room.id).emit('playerKilled', { playerId:player.id,killerId,ability,x:player.x,z:player.z });
  setTimeout(()=>{
    if (!room.players.has(player.id)||room.state!=='playing') return;
    const sx=player.team==='A'?-22+Math.random()*8:14+Math.random()*8;
    player.x=sx; player.z=-8+Math.random()*16;
    player.health=HEALTH_MAX; player.energy=ENERGY_MAX;
    player.alive=true; player.shieldActive=false;
    io.to(room.id).emit('playerRespawn',{playerId:player.id,x:player.x,z:player.z});
  }, 4000);
}

function awardXP(player,amount) {
  player.xp=(player.xp||0)+amount;
  const needed=player.level*100;
  if (player.xp>=needed) { player.xp-=needed; player.level++; }
}

function checkWin(room) {
  if (room.teamScores.A>=SCORE_WIN) endGame(room,'score');
  else if (room.teamScores.B>=SCORE_WIN) endGame(room,'score');
}

function buildState(room) {
  const players=[], bullets=[], powerups=[];
  room.players.forEach(p=>players.push({
    id:p.id,name:p.name,team:p.team,x:p.x,y:0,z:p.z,rotY:p.rotY,
    health:p.health,energy:p.energy,alive:p.alive,
    kills:p.kills,deaths:p.deaths,score:p.score,level:p.level,xp:p.xp,
    shieldActive:p.shieldActive,frozenUntil:p.frozenUntil,
    speedBoost:p.speedBoost>Date.now(), cooldowns:p.abilityCooldowns
  }));
  room.bullets.forEach(b=>bullets.push({id:b.id,x:b.x,z:b.z,team:b.team}));
  room.powerups.forEach(pu=>{ if (pu.active) powerups.push(pu); });
  return {
    players, bullets,
    cores: room.cores.map(c=>({id:c.id,x:c.x,z:c.z,active:c.active})),
    powerups, teamScores:room.teamScores, matchTime:room.matchTime
  };
}

function clamp(v,min,max) { return Math.max(min,Math.min(max,v)); }

// ═══════════════════════════════════════════════════════
// SOCKET HANDLERS
// ═══════════════════════════════════════════════════════
io.on('connection', socket => {
  console.log(`[+] ${socket.id}`);

  socket.on('createRoom', ({playerName,roomName}) => {
    const room = createRoom(socket.id, playerName, roomName);
    rooms.set(room.id,room);
    socket.join(room.id);
    const player = createPlayer(socket.id,playerName,'A');
    room.players.set(socket.id,player);
    playerRooms.set(socket.id,room.id);
    socket.emit('roomCreated',{roomId:room.id,roomName:room.name,player:sanitize(player)});
    io.to(room.id).emit('lobbyUpdate',getLobby(room));
  });

  socket.on('joinRoom',({roomId,playerName,team})=>{
    const room=rooms.get(roomId.toUpperCase());
    if (!room) return socket.emit('error',{msg:'Room not found'});
    if (room.state!=='lobby') return socket.emit('error',{msg:'Match already in progress'});
    if (room.players.size>=10) return socket.emit('error',{msg:'Room is full'});
    const chosenTeam=team||(teamCount(room,'A')<=teamCount(room,'B')?'A':'B');
    socket.join(room.id);
    const player=createPlayer(socket.id,playerName,chosenTeam);
    room.players.set(socket.id,player);
    playerRooms.set(socket.id,room.id);
    socket.emit('roomJoined',{roomId:room.id,roomName:room.name,player:sanitize(player)});
    io.to(room.id).emit('lobbyUpdate',getLobby(room));
  });

  socket.on('switchTeam',()=>{
    const room=rooms.get(playerRooms.get(socket.id));
    if (!room||room.state!=='lobby') return;
    const p=room.players.get(socket.id);
    if (!p) return;
    p.team=p.team==='A'?'B':'A';
    io.to(room.id).emit('lobbyUpdate',getLobby(room));
  });

  socket.on('startGame',()=>{
    const room=rooms.get(playerRooms.get(socket.id));
    if (!room||room.host!==socket.id||room.state!=='lobby') return;
    if (room.players.size<2) return socket.emit('error',{msg:'Need at least 2 players to start'});
    room.state='countdown';
    let count=5;
    io.to(room.id).emit('countdown',{count});
    const cd=setInterval(()=>{
      count--;
      if (count>0) io.to(room.id).emit('countdown',{count});
      else { clearInterval(cd); startGame(room); }
    },1000);
  });

  socket.on('playerInput',(input)=>{
    const room=rooms.get(playerRooms.get(socket.id));
    if (!room||room.state!=='playing') return;
    const p=room.players.get(socket.id);
    if (!p||!p.alive) return;
    p.inputQueue.push(input);
    if (p.inputQueue.length>6) p.inputQueue.shift();
  });

  socket.on('shoot',({dx,dz})=>{
    const room=rooms.get(playerRooms.get(socket.id));
    if (!room||room.state!=='playing') return;
    const p=room.players.get(socket.id);
    if (!p||!p.alive||p.frozenUntil>Date.now()) return;
    const mag=Math.sqrt(dx*dx+dz*dz)||1;
    const dmg=p.ammoBoost>Date.now()?22:15;
    room.bullets.set(uuidv4(),{
      id:uuidv4(), owner:socket.id, team:p.team,
      x:p.x, z:p.z, dx:dx/mag, dz:dz/mag,
      damage:dmg, life:44, sourceAbility:null
    });
  });

  socket.on('useAbility',({ability})=>{
    const room=rooms.get(playerRooms.get(socket.id));
    if (!room||room.state!=='playing') return;
    const p=room.players.get(socket.id);
    if (!p||!p.alive) return;
    const now=Date.now();
    if ((p.abilityCooldowns[ability]||0)>now) return;
    if (p.energy<ABILITY_COST[ability]) return;
    p.energy-=ABILITY_COST[ability];
    p.abilityCooldowns[ability]=now+ABILITY_CD[ability];
    p.lastAbility=ability;

    switch(ability) {
      case 'dash': {
        const dist=9;
        p.x=clamp(p.x+Math.sin(p.rotY)*dist,-MAP_HALF,MAP_HALF);
        p.z=clamp(p.z+Math.cos(p.rotY)*dist,-MAP_HALF,MAP_HALF);
        break;
      }
      case 'freeze': {
        room.players.forEach(t=>{
          if (t.team!==p.team&&t.alive) {
            const dx=t.x-p.x,dz=t.z-p.z;
            if (Math.sqrt(dx*dx+dz*dz)<14) t.frozenUntil=now+3000;
          }
        });
        break;
      }
      case 'pulse': {
        for (let a=0;a<8;a++) {
          const ang=(a/8)*Math.PI*2;
          const bid=uuidv4();
          room.bullets.set(bid,{ id:bid,owner:socket.id,team:p.team,x:p.x,z:p.z,dx:Math.sin(ang),dz:Math.cos(ang),damage:12,life:22,sourceAbility:'pulse' });
        }
        break;
      }
      case 'shield': {
        p.shieldActive=true;
        setTimeout(()=>{ const fp=room.players.get(socket.id); if (fp) fp.shieldActive=false; },4200);
        break;
      }
    }
    io.to(room.id).emit('abilityUsed',{playerId:socket.id,ability,x:p.x,z:p.z,team:p.team});
  });

  socket.on('disconnect',()=>{
    const roomId=playerRooms.get(socket.id);
    if (!roomId) return;
    const room=rooms.get(roomId);
    if (!room) return;
    room.players.delete(socket.id);
    playerRooms.delete(socket.id);
    if (room.players.size===0) {
      clearInterval(room.tickInterval); clearInterval(room.matchTimer); clearInterval(room.powerupTimer);
      rooms.delete(roomId);
    } else {
      if (room.host===socket.id) room.host=room.players.keys().next().value;
      io.to(roomId).emit('playerLeft',{playerId:socket.id});
      io.to(roomId).emit('lobbyUpdate',getLobby(room));
    }
    console.log(`[-] ${socket.id}`);
  });
});

function teamCount(room,team) { let c=0; room.players.forEach(p=>{if(p.team===team)c++;}); return c; }
function sanitize(p) { return {id:p.id,name:p.name,team:p.team,level:p.level}; }
function getLobby(room) {
  const players=[];
  room.players.forEach(p=>players.push({id:p.id,name:p.name,team:p.team,level:p.level}));
  return {roomId:room.id,roomName:room.name,host:room.host,players};
}

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`🚀 NEON FRACTURE running on port ${PORT}`));
