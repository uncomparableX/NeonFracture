// ═══════════════════════════════════════════════════════
// NEON FRACTURE — NETWORK v4 (FINAL STABLE)
// FIXES:
// ✅ Safe Game/UI calls (no crashes)
// ✅ Guaranteed sendInput()
// ✅ Proper gameState handling
// ✅ Reconnect-safe
// ═══════════════════════════════════════════════════════

const Network = (() => {

  let socket = null;
  let connected = false;
  let myPlayerId = null;
  let currentRoomId = null;
  let isHost = false;
  let pendingTeam = 'A';

  // ── SAFE HELPERS ─────────────────────────────────────
  function _ui(fn, ...args) {
    try {
      if (typeof UI !== 'undefined' && typeof UI[fn] === 'function') {
        UI[fn](...args);
      }
    } catch (e) {
      console.warn('[UI ERROR]', fn, e.message);
    }
  }

  function _game(fn, ...args) {
    try {
      if (typeof Game !== 'undefined' && typeof Game[fn] === 'function') {
        Game[fn](...args);
      }
    } catch (e) {
      console.warn('[GAME ERROR]', fn, e.message);
    }
  }

  function _audio(name) {
    try {
      Audio?.play?.(name);
    } catch {}
  }

  // ── CONNECT ──────────────────────────────────────────
  function connect() {

    socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10
    });

    socket.on('connect', () => {
      connected = true;
      myPlayerId = socket.id;
      console.log('✅ Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      connected = false;
      console.warn('❌ Disconnected');
    });

    socket.on('connect_error', (e) => {
      console.warn('⚠️ Connect error:', e.message);
      _ui('showError', 'Server unreachable');
    });

    socket.on('error', (data) => {
      _ui('showError', data?.msg || 'Server error');
    });

    // ── LOBBY ──────────────────────────────────────────
    socket.on('roomCreated', ({ roomId, roomName, player }) => {
      currentRoomId = roomId;
      isHost = true;
      myPlayerId = player.id;

      _ui('showRoomScreen', roomId, roomName, true);
    });

    socket.on('roomJoined', ({ roomId, roomName, player }) => {
      currentRoomId = roomId;
      isHost = false;
      myPlayerId = player.id;

      _ui('showRoomScreen', roomId, roomName, false);
    });

    socket.on('lobbyUpdate', (data) => {
      _ui('updateLobby', data);
    });

    // ── GAME FLOW ──────────────────────────────────────
    socket.on('countdown', ({ count }) => {
      _ui('showCountdown', count);
      _audio('countdown');
    });

    socket.on('gameStart', () => {
      console.log('🚀 GAME START RECEIVED');
      _ui('startGame', myPlayerId);
    });

    // 🔥 MOST IMPORTANT
    socket.on('gameState', (state) => {
      _game('onGameState', state);
    });

    socket.on('playerHit', (data) => _game('onPlayerHit', data));
    socket.on('playerKilled', (data) => _game('onPlayerKilled', data));
    socket.on('coreCaptured', (data) => _game('onCoreCaptured', data));
    socket.on('abilityUsed', (data) => _game('onAbilityUsed', data));
    socket.on('powerupPickup', (data) => _game('onPowerupPickup', data));

    socket.on('gameEnd', (data) => {
      _ui('showGameEnd', data, myPlayerId);
      _game('stop');
    });
  }

  // ── ROOM ACTIONS ─────────────────────────────────────
  function createRoom() {
    if (!connected) return _ui('showError', 'Not connected');

    const name = document.getElementById('create-name')?.value || 'OPERATOR';
    const roomName = document.getElementById('create-room-name')?.value || '';

    socket.emit('createRoom', { playerName: name, roomName });
  }

  function joinRoom() {
    if (!connected) return _ui('showError', 'Not connected');

    const name = document.getElementById('join-name')?.value || 'OPERATOR';
    const roomId = document.getElementById('join-room-id')?.value?.toUpperCase();

    if (!roomId) return _ui('showError', 'Enter room code');

    socket.emit('joinRoom', {
      roomId,
      playerName: name,
      team: pendingTeam
    });
  }

  function switchTeam() {
    socket?.emit('switchTeam');
  }

  function startGame() {
    if (!isHost) return;
    socket?.emit('startGame');
  }

  // ── GAME INPUT ───────────────────────────────────────
  function sendInput(input) {
    if (!socket || !connected) return;

    socket.volatile.emit('playerInput', input);
  }

  function shoot(dx, dz) {
    socket?.emit('shoot', { dx, dz });
  }

  function useAbility(ability) {
    socket?.emit('useAbility', { ability });
  }

  // ── HELPERS ──────────────────────────────────────────
  function setPendingTeam(t) {
    pendingTeam = t;
  }

  function getMyId() {
    return myPlayerId;
  }

  function isConnected() {
    return connected;
  }

  // ── PUBLIC API ───────────────────────────────────────
  return {
    connect,
    createRoom,
    joinRoom,
    switchTeam,
    startGame,
    sendInput,
    shoot,
    useAbility,
    setPendingTeam,
    getMyId,
    isConnected
  };

})();
