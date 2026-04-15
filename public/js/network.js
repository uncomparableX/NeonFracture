// ═══════════════════════════════════════════════════════
// NEON FRACTURE — NETWORK v6 (ULTRA STABLE FINAL)
// Render-safe + auto-recovery + glitch protection
// ═══════════════════════════════════════════════════════

const Network = (() => {
  let socket = null;
  let connected = false;
  let myPlayerId = null;
  let currentRoomId = null;
  let isHost = false;
  let pendingTeam = 'A';
  let reconnectAttempts = 0;
  let connecting = false;

  // ── CONNECT ──────────────────────────────────────────
  function connect() {
    if (connecting) return;
    connecting = true;

    // 🔥 Force correct Render connection
    socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket'], // no polling (prevents flicker)
      secure: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    // ✅ CONNECTED
    socket.on('connect', () => {
      connected = true;
      connecting = false;
      myPlayerId = socket.id;
      reconnectAttempts = 0;

      console.log('✅ CONNECTED:', socket.id);
      UI.toastMessage('Connected to server', 1200);
    });

    // ❌ DISCONNECTED
    socket.on('disconnect', (reason) => {
      connected = false;
      connecting = false;

      console.warn('❌ DISCONNECTED:', reason);

      if (reason !== 'io client disconnect') {
        UI.toastMessage('Reconnecting...', 2500);
      }
    });

    // ❌ ERROR
    socket.on('connect_error', (err) => {
      connected = false;
      connecting = false;
      reconnectAttempts++;

      console.error('❌ CONNECT ERROR:', err.message);

      if (reconnectAttempts === 1) {
        UI.showError('Server unreachable');
      }
    });

    // 🔁 RECONNECTED
    socket.on('reconnect', () => {
      connected = true;
      reconnectAttempts = 0;

      console.log('🔁 RECONNECTED');
      UI.toastMessage('Reconnected!', 1500);
    });

    socket.on('error', ({ msg }) => {
      console.error('❌ SERVER ERROR:', msg);
      UI.showError(msg);
    });

    // ── LOBBY ──────────────────────────────────────────
    socket.on('roomCreated', ({ roomId, roomName, player }) => {
      currentRoomId = roomId;
      isHost = true;
      myPlayerId = player.id;

      UI.showRoomScreen(roomId, roomName, true);
    });

    socket.on('roomJoined', ({ roomId, roomName, player }) => {
      currentRoomId = roomId;
      isHost = false;
      myPlayerId = player.id;

      UI.showRoomScreen(roomId, roomName, false);
    });

    socket.on('lobbyUpdate', data => {
      if (!data || !data.players) return;
      UI.updateLobby(data);
    });

    socket.on('playerLeft', () => {
      UI.toastMessage('Player disconnected');
    });

    // ── GAME FLOW ──────────────────────────────────────
    socket.on('countdown', ({ count }) => {
      UI.showCountdown(count);
      Audio.play('countdown');
    });

    socket.on('gameStart', () => {
      Audio.play('countdownGo');
      UI.startGame(myPlayerId);
    });

    socket.on('gameState', state => Game?.onGameState(state));
    socket.on('playerHit', data => Game?.onPlayerHit(data));
    socket.on('playerKilled', data => Game?.onPlayerKilled(data));

    socket.on('playerRespawn', ({ playerId }) => {
      if (playerId === myPlayerId) {
        Game?.resetCooldowns();
        Game?.announce('BACK IN THE FIGHT', 'green');
      }
    });

    socket.on('coreCaptured', data => Game?.onCoreCaptured(data));
    socket.on('abilityUsed', data => Game?.onAbilityUsed(data));

    socket.on('powerupPickup', data => {
      if (data.playerId === myPlayerId) {
        Game?.onPowerupPickup(data);
      }
    });

    socket.on('announcer', ({ text, style }) => {
      if (Game?.isRunning()) {
        Game.announce(text, style || 'cyan');
      }
    });

    socket.on('gameEnd', data => {
      UI.showGameEnd(data, myPlayerId);
      Game?.stop();
    });
  }

  // ── SAFE EMIT WRAPPER ───────────────────────────────
  function safeEmit(event, data) {
    if (!socket || !connected) {
      UI.showError('Not connected to server');
      return;
    }
    socket.emit(event, data);
  }

  // ── ACTIONS ─────────────────────────────────────────
  function createRoom() {
    const name = document.getElementById('create-name')?.value.trim() || 'OPERATOR';
    const roomName = document.getElementById('create-room-name')?.value.trim() || '';

    Audio.play('uiClick');
    safeEmit('createRoom', { playerName: name, roomName });
  }

  function joinRoom() {
    const name = document.getElementById('join-name')?.value.trim() || 'OPERATOR';
    const roomId = document.getElementById('join-room-id')?.value.trim().toUpperCase();

    if (!roomId) return UI.showError('Enter room code');

    Audio.play('uiClick');
    safeEmit('joinRoom', { roomId, playerName: name, team: pendingTeam });
  }

  function switchTeam() {
    safeEmit('switchTeam');
  }

  function startGame() {
    if (!isHost) return UI.showError('Only host can start');
    safeEmit('startGame');
  }

  function sendInput(input) {
    socket?.volatile.emit('playerInput', input);
  }

  function shoot(dx, dz) {
    safeEmit('shoot', { dx, dz });
  }

  function useAbility(ability) {
    safeEmit('useAbility', { ability });
  }

  function leaveRoom() {
    if (socket) {
      socket.disconnect();
    }

    setTimeout(() => {
      socket = null;
      connected = false;
      connecting = false;
      connect();
      UI.showScreen('screen-home');
    }, 200);
  }

  function returnToLobby() {
    leaveRoom();
    setTimeout(() => UI.showScreen('screen-multiplayer'), 250);
  }

  function setPendingTeam(t) {
    pendingTeam = t;
  }

  function isConnected() {
    return connected;
  }

  // ── EXPORT ──────────────────────────────────────────
  return {
    connect,
    createRoom,
    joinRoom,
    switchTeam,
    startGame,
    sendInput,
    shoot,
    useAbility,
    leaveRoom,
    returnToLobby,
    setPendingTeam,
    isConnected
  };
})();
