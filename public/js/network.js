// ═══════════════════════════════════════════════════════
//  NEON FRACTURE — NETWORK  (Complete v4)
//  Uses io() without URL — auto-detects Render/localhost.
//  All events emit safely. All callbacks guarded.
// ═══════════════════════════════════════════════════════
const Network = (() => {
  let socket        = null;
  let connected     = false;
  let myPlayerId    = null;
  let currentRoomId = null;
  let isHost        = false;
  let pendingTeam   = 'A';
  let reconnAttempts = 0;

  function _ui(fn, ...a) {
    try { if (typeof UI !== 'undefined' && typeof UI[fn] === 'function') UI[fn](...a); } catch(e) {}
  }
  function _game(fn, ...a) {
    try { if (typeof Game !== 'undefined' && typeof Game[fn] === 'function') Game[fn](...a); } catch(e) {}
  }
  function _audio(n) {
    try { if (typeof Audio !== 'undefined' && typeof Audio.play === 'function') Audio.play(n); } catch(e) {}
  }

  // ── CONNECT ───────────────────────────────────────────
  function connect() {
    // NO url arg — socket.io uses current page origin automatically
    // This is the correct approach for single-server Render deploys
    socket = io({
      transports:          ['websocket', 'polling'],
      reconnection:        true,
      reconnectionDelay:   1500,
      reconnectionDelayMax: 6000,
      reconnectionAttempts: 10
    });

    socket.on('connect', () => {
      connected      = true;
      myPlayerId     = socket.id;
      reconnAttempts = 0;
      console.log('[NET] connected:', socket.id);
    });

    socket.on('disconnect', reason => {
      connected = false;
      console.log('[NET] disconnected:', reason);
      if (typeof Game !== 'undefined' && Game.isRunning?.()) {
        _ui('toastMessage', 'Connection lost — reconnecting...');
      }
    });

    socket.on('reconnect', () => {
      connected = true; _ui('toastMessage', 'Reconnected!');
    });

    socket.on('connect_error', e => {
      reconnAttempts++;
      console.warn('[NET] connect_error:', e.message);
      if (reconnAttempts === 1) _ui('showError', 'Cannot reach server');
    });

    socket.on('error', data => {
      _ui('showError', (data&&data.msg) ? data.msg : 'Server error');
    });

    // ── Lobby ────────────────────────────────────────────
    socket.on('roomCreated', ({ roomId, roomName, player }) => {
      currentRoomId = roomId; isHost = true; myPlayerId = player.id;
      _ui('showRoomScreen', roomId, roomName, true);
    });

    socket.on('roomJoined', ({ roomId, roomName, player }) => {
      currentRoomId = roomId; isHost = false; myPlayerId = player.id;
      _ui('showRoomScreen', roomId, roomName, false);
    });

    socket.on('lobbyUpdate', data => _ui('updateLobby', data));
    socket.on('playerLeft',  ()   => _ui('toastMessage', 'A player disconnected'));

    // ── Game flow ─────────────────────────────────────────
    socket.on('countdown', ({ count }) => {
      _ui('showCountdown', count); _audio('countdown');
    });

    socket.on('gameStart', () => {
      _audio('countdownGo'); _ui('startGame', myPlayerId);
    });

    socket.on('gameState',    state => _game('onGameState', state));
    socket.on('playerHit',    data  => _game('onPlayerHit', data));
    socket.on('playerKilled', data  => _game('onPlayerKilled', data));

    socket.on('playerRespawn', ({ playerId }) => {
      if (playerId === myPlayerId) {
        _game('resetCooldowns');
        _game('announce', 'BACK IN THE FIGHT', 'green');
      }
    });

    socket.on('coreCaptured',  data => _game('onCoreCaptured', data));
    socket.on('coreRespawned', ()   => {});

    socket.on('abilityUsed',   data => _game('onAbilityUsed', data));
    socket.on('powerupSpawned',()   => {});

    socket.on('powerupPickup', data => {
      if (data.playerId === myPlayerId) _game('onPowerupPickup', data);
    });

    socket.on('announcer', ({ text, style }) => {
      try { if (Game.isRunning?.()) Game.announce(text, style||'cyan'); } catch(e) {}
    });

    socket.on('gameEnd', data => {
      _ui('showGameEnd', data, myPlayerId); _game('stop');
    });
  }

  // ── Room actions ──────────────────────────────────────
  function createRoom() {
    const name     = (document.getElementById('create-name')?.value||'').trim()||'OPERATOR';
    const roomName = (document.getElementById('create-room-name')?.value||'').trim()||'';
    if (!connected) return _ui('showError', 'Not connected to server');
    _audio('uiClick');
    socket.emit('createRoom', { playerName: name, roomName });
  }

  function joinRoom() {
    const name   = (document.getElementById('join-name')?.value||'').trim()||'OPERATOR';
    const roomId = (document.getElementById('join-room-id')?.value||'').trim().toUpperCase();
    if (!roomId)    return _ui('showError', 'Enter a room code');
    if (!connected) return _ui('showError', 'Not connected to server');
    _audio('uiClick');
    socket.emit('joinRoom', { roomId, playerName: name, team: pendingTeam });
  }

  function switchTeam() { socket?.emit('switchTeam'); }

  function startGame() {
    if (!isHost) return; _audio('uiClick'); socket?.emit('startGame');
  }

  // ── In-game emits ─────────────────────────────────────
  function sendInput(input) {
    if (!socket || !connected) return;
    socket.volatile.emit('playerInput', input);
  }

  function shoot(dx, dz) {
    if (!socket || !connected) return;
    socket.emit('shoot', { dx, dz });
  }

  function useAbility(ability) {
    if (!socket || !connected) return;
    socket.emit('useAbility', { ability });
  }

  // ── Leave / return ────────────────────────────────────
  function leaveRoom() {
    if (socket) socket.disconnect();
    setTimeout(() => {
      socket = null; connected = false; currentRoomId = null;
      connect(); _ui('showScreen', 'screen-home');
    }, 180);
  }

  function returnToLobby() {
    leaveRoom(); setTimeout(() => _ui('showScreen', 'screen-multiplayer'), 260);
  }

  // ── Queries ───────────────────────────────────────────
  function setPendingTeam(t) { pendingTeam = t; }
  function getMyId()         { return myPlayerId; }
  function isConnected()     { return connected; }

  return {
    connect, createRoom, joinRoom, switchTeam, startGame,
    sendInput, shoot, useAbility,
    leaveRoom, returnToLobby,
    setPendingTeam, getMyId, isConnected
  };
})();
