// ═══════════════════════════════════════════════════════
// NEON FRACTURE — NETWORK v3  (BUG-FIXED)
// KEY FIXES:
//  - io() called WITHOUT window.location.origin argument.
//    On Render, the server and client share the same origin
//    so passing no URL lets socket.io auto-detect. Passing
//    window.location.origin can cause WSS/HTTPS mismatch on
//    some Render deployments.
//  - All Game.* / UI.* callbacks wrapped in try/catch so a
//    missing function never brings down the socket handler.
//  - sendInput() exported correctly and uses volatile emit
//    so dropped packets don't queue up during lag.
//  - isConnected() exported for connection badge in main.js
// ═══════════════════════════════════════════════════════
const Network = (() => {
  let socket           = null;
  let connected        = false;
  let myPlayerId       = null;
  let currentRoomId    = null;
  let isHost           = false;
  let pendingTeam      = 'A';
  let reconnectAttempts = 0;

  // ── Safe callback helpers ─────────────────────────────
  function _ui(fn, ...args) {
    try { if (typeof UI !== 'undefined' && typeof UI[fn] === 'function') UI[fn](...args); }
    catch(e) { console.warn('[Net] UI.' + fn + '():', e.message); }
  }
  function _game(fn, ...args) {
    try { if (typeof Game !== 'undefined' && typeof Game[fn] === 'function') Game[fn](...args); }
    catch(e) { console.warn('[Net] Game.' + fn + '():', e.message); }
  }
  function _audio(name) {
    try { if (typeof Audio !== 'undefined' && typeof Audio.play === 'function') Audio.play(name); }
    catch(e) {}
  }

  // ── CONNECT ───────────────────────────────────────────
  function connect() {
    // No URL argument — lets socket.io use current page origin.
    // This is the safest approach for Render / single-server deploys.
    socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    socket.on('connect', () => {
      connected         = true;
      myPlayerId        = socket.id;
      reconnectAttempts = 0;
      console.log('[NET] Connected:', socket.id);
    });

    socket.on('disconnect', reason => {
      connected = false;
      console.log('[NET] Disconnected:', reason);
      if (_game('isRunning')) {
        _ui('toastMessage', 'Connection lost — reconnecting...');
      }
    });

    socket.on('reconnect', () => {
      connected = true;
      _ui('toastMessage', 'Reconnected!');
    });

    socket.on('connect_error', e => {
      reconnectAttempts++;
      console.warn('[NET] connect_error:', e.message);
      if (reconnectAttempts === 1) {
        _ui('showError', 'Cannot reach server — check your connection');
      }
    });

    socket.on('error', data => {
      const msg = (data && data.msg) ? data.msg : 'Server error';
      _ui('showError', msg);
    });

    // ── LOBBY EVENTS ────────────────────────────────────
    socket.on('roomCreated', ({ roomId, roomName, player }) => {
      currentRoomId = roomId;
      isHost        = true;
      myPlayerId    = player.id;
      _ui('showRoomScreen', roomId, roomName, true);
    });

    socket.on('roomJoined', ({ roomId, roomName, player }) => {
      currentRoomId = roomId;
      isHost        = false;
      myPlayerId    = player.id;
      _ui('showRoomScreen', roomId, roomName, false);
    });

    socket.on('lobbyUpdate', data => _ui('updateLobby', data));

    socket.on('playerLeft', () => _ui('toastMessage', 'A player disconnected'));

    // ── GAME FLOW ────────────────────────────────────────
    socket.on('countdown', ({ count }) => {
      _ui('showCountdown', count);
      _audio('countdown');
    });

    socket.on('gameStart', () => {
      _audio('countdownGo');
      _ui('startGame', myPlayerId);
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
    socket.on('coreRespawned', ()   => {});   // handled via gameState broadcast

    socket.on('abilityUsed', data => _game('onAbilityUsed', data));

    socket.on('powerupSpawned', () => {});    // handled via gameState broadcast

    socket.on('powerupPickup', data => {
      if (data.playerId === myPlayerId) _game('onPowerupPickup', data);
    });

    socket.on('announcer', ({ text, style }) => {
      try {
        if (typeof Game !== 'undefined' && Game.isRunning()) Game.announce(text, style || 'cyan');
      } catch(e) {}
    });

    socket.on('gameEnd', data => {
      _ui('showGameEnd', data, myPlayerId);
      _game('stop');
    });
  }

  // ── ROOM ACTIONS ─────────────────────────────────────
  function createRoom() {
    const name     = (document.getElementById('create-name')?.value || '').trim() || 'OPERATOR';
    const roomName = (document.getElementById('create-room-name')?.value || '').trim() || '';
    if (!connected) return _ui('showError', 'Not connected to server');
    _audio('uiClick');
    socket.emit('createRoom', { playerName: name, roomName });
  }

  function joinRoom() {
    const name   = (document.getElementById('join-name')?.value || '').trim() || 'OPERATOR';
    const roomId = (document.getElementById('join-room-id')?.value || '').trim().toUpperCase();
    if (!roomId)    return _ui('showError', 'Enter a room code');
    if (!connected) return _ui('showError', 'Not connected to server');
    _audio('uiClick');
    socket.emit('joinRoom', { roomId, playerName: name, team: pendingTeam });
  }

  function switchTeam() { socket?.emit('switchTeam'); }

  function startGame() {
    if (!isHost) return;
    _audio('uiClick');
    socket?.emit('startGame');
  }

  // ── GAME EMITS ────────────────────────────────────────
  // volatile = dropped silently if socket is busy (safe for high-freq input)
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

  // ── LEAVE / RETURN ────────────────────────────────────
  function leaveRoom() {
    if (socket) socket.disconnect();
    setTimeout(() => {
      socket       = null;
      connected    = false;
      currentRoomId = null;
      connect();
      _ui('showScreen', 'screen-home');
    }, 150);
  }

  function returnToLobby() {
    leaveRoom();
    setTimeout(() => _ui('showScreen', 'screen-multiplayer'), 250);
  }

  // ── QUERIES ───────────────────────────────────────────
  function setPendingTeam(t) { pendingTeam = t; }
  function getMyId()         { return myPlayerId; }
  function isConnected()     { return connected; }

  // ── PUBLIC API ────────────────────────────────────────
  return {
    connect,
    createRoom,
    joinRoom,
    switchTeam,
    startGame,
    sendInput,        // ← called by input.js every 40ms
    shoot,            // ← called by game.js _doShoot()
    useAbility,       // ← called by game.js useAbility()
    leaveRoom,
    returnToLobby,
    setPendingTeam,
    getMyId,
    isConnected
  };
})();
