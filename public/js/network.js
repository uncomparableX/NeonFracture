// ═══════════════════════════════════════════════════════
// NEON FRACTURE — NETWORK v3 (FINAL FIXED)
// ═══════════════════════════════════════════════════════
const Network = (() => {
  let socket = null;
  let connected = false;
  let myPlayerId = null;
  let currentRoomId = null;
  let isHost = false;
  let pendingTeam = 'A';
  let reconnectAttempts = 0;

  function connect() {
    // ✅ FIX: DO NOT pass window.location.origin
    socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    // ── CONNECTION ─────────────────────────────────────
    socket.on('connect', () => {
      connected = true;
      myPlayerId = socket.id;
      reconnectAttempts = 0;

      console.log('✅ CONNECTED TO SERVER:', socket.id);
      UI.toastMessage('Connected to server', 2000);
    });

    socket.on('disconnect', (reason) => {
      connected = false;
      console.log('❌ DISCONNECTED:', reason);

      UI.toastMessage('Connection lost — reconnecting...', 4000);
    });

    socket.on('connect_error', (err) => {
      reconnectAttempts++;
      console.error('❌ CONNECTION ERROR:', err.message);

      if (reconnectAttempts === 1) {
        UI.showError('Cannot reach server');
      }
    });

    socket.on('reconnect', () => {
      connected = true;
      UI.toastMessage('Reconnected!');
    });

    socket.on('error', ({ msg }) => UI.showError(msg));

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

    socket.on('lobbyUpdate', data => UI.updateLobby(data));
    socket.on('playerLeft', () => UI.toastMessage('A player disconnected'));

    // ── GAME FLOW ──────────────────────────────────────
    socket.on('countdown', ({ count }) => {
      UI.showCountdown(count);
      Audio.play('countdown');
    });

    socket.on('gameStart', () => {
      Audio.play('countdownGo');
      UI.startGame(myPlayerId);
    });

    socket.on('gameState', state => Game.onGameState(state));

    socket.on('playerHit', data => Game.onPlayerHit(data));
    socket.on('playerKilled', data => Game.onPlayerKilled(data));

    socket.on('playerRespawn', ({ playerId }) => {
      if (playerId === myPlayerId) {
        Game.resetCooldowns();
        Game.announce('BACK IN THE FIGHT', 'green');
      }
    });

    socket.on('coreCaptured', data => Game.onCoreCaptured(data));
    socket.on('abilityUsed', data => Game.onAbilityUsed(data));

    socket.on('powerupPickup', data => {
      if (data.playerId === myPlayerId) {
        Game.onPowerupPickup(data);
      }
    });

    socket.on('announcer', ({ text, style }) => {
      if (Game.isRunning()) Game.announce(text, style || 'cyan');
    });

    socket.on('gameEnd', data => {
      UI.showGameEnd(data, myPlayerId);
      Game.stop();
    });
  }

  // ── EMIT ─────────────────────────────────────────────
  function createRoom() {
    const name = document.getElementById('create-name')?.value.trim() || 'OPERATOR';
    const roomName = document.getElementById('create-room-name')?.value.trim() || '';

    if (!connected) return UI.showError('Not connected to server');

    Audio.play('uiClick');
    socket.emit('createRoom', { playerName: name, roomName });
  }

  function joinRoom() {
    const name = document.getElementById('join-name')?.value.trim() || 'OPERATOR';
    const roomId = document.getElementById('join-room-id')?.value.trim().toUpperCase();

    if (!roomId) return UI.showError('Enter a room code');
    if (!connected) return UI.showError('Not connected to server');

    Audio.play('uiClick');
    socket.emit('joinRoom', { roomId, playerName: name, team: pendingTeam });
  }

  function switchTeam() { socket?.emit('switchTeam'); }
  function startGame() { if (isHost) socket?.emit('startGame'); }

  function sendInput(input) { socket?.volatile.emit('playerInput', input); }
  function shoot(dx, dz) { socket?.emit('shoot', { dx, dz }); }
  function useAbility(ability) { socket?.emit('useAbility', { ability }); }

  function leaveRoom() {
    socket?.disconnect();
    setTimeout(() => {
      socket = null;
      connected = false;
      connect();
      UI.showScreen('screen-home');
    }, 150);
  }

  function returnToLobby() {
    leaveRoom();
    setTimeout(() => UI.showScreen('screen-multiplayer'), 200);
  }

  function setPendingTeam(t) { pendingTeam = t; }

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
    setPendingTeam
  };
})();
