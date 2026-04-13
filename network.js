// ═══════════════════════════════════════════════════════
// NEON FRACTURE — NETWORK v2
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
    socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      connected = true;
      myPlayerId = socket.id;
      reconnectAttempts = 0;
      console.log('[NET] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      connected = false;
      console.log('[NET] Disconnected:', reason);
      if (Game.isRunning()) UI.toastMessage('Connection lost — reconnecting...', 4000);
    });

    socket.on('reconnect', () => {
      connected = true;
      UI.toastMessage('Reconnected!');
    });

    socket.on('connect_error', (e) => {
      reconnectAttempts++;
      if (reconnectAttempts === 1) UI.showError('Cannot reach server — check your connection');
    });

    socket.on('error', ({ msg }) => UI.showError(msg));

    // ── LOBBY ──────────────────────────────────────────
    socket.on('roomCreated', ({ roomId, roomName, player }) => {
      currentRoomId = roomId; isHost = true;
      myPlayerId = player.id;
      UI.showRoomScreen(roomId, roomName, true);
    });

    socket.on('roomJoined', ({ roomId, roomName, player }) => {
      currentRoomId = roomId; isHost = false;
      myPlayerId = player.id;
      UI.showRoomScreen(roomId, roomName, false);
    });

    socket.on('lobbyUpdate', data => UI.updateLobby(data));
    socket.on('playerLeft', ({ playerId }) => UI.toastMessage('A player disconnected'));

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

    socket.on('playerRespawn', ({ playerId, x, z }) => {
      if (playerId === myPlayerId) {
        Game.resetCooldowns();
        Game.announce('BACK IN THE FIGHT', 'green');
      }
    });

    socket.on('coreCaptured', data => Game.onCoreCaptured(data));
    socket.on('coreRespawned', ({ coreId }) => {
      // Core respawn handled by server state broadcast
    });

    socket.on('abilityUsed', data => Game.onAbilityUsed(data));

    socket.on('powerupSpawned', () => {
      // handled in game state
    });

    socket.on('powerupPickup', data => {
      if (data.playerId === myPlayerId) Game.onPowerupPickup(data);
    });

    socket.on('announcer', ({ text, style }) => {
      if (Game.isRunning()) Game.announce(text, style || 'cyan');
    });

    socket.on('gameEnd', data => {
      UI.showGameEnd(data, myPlayerId);
      Game.stop();
    });
  }

  // ── EMIT ───────────────────────────────────────────────
  function createRoom() {
    const name     = document.getElementById('create-name')?.value.trim() || 'OPERATOR';
    const roomName = document.getElementById('create-room-name')?.value.trim() || '';
    if (!name) return UI.showError('Enter your callsign');
    if (!connected) return UI.showError('Not connected to server');
    Audio.play('uiClick');
    socket.emit('createRoom', { playerName: name, roomName });
  }

  function joinRoom() {
    const name   = document.getElementById('join-name')?.value.trim() || 'OPERATOR';
    const roomId = document.getElementById('join-room-id')?.value.trim().toUpperCase();
    if (!name)   return UI.showError('Enter your callsign');
    if (!roomId) return UI.showError('Enter a room code');
    if (!connected) return UI.showError('Not connected to server');
    Audio.play('uiClick');
    socket.emit('joinRoom', { roomId, playerName: name, team: pendingTeam });
  }

  function switchTeam() { socket?.emit('switchTeam'); }

  function startGame() {
    if (!isHost) return;
    Audio.play('uiClick');
    socket?.emit('startGame');
  }

  function sendInput(input) { socket?.volatile.emit('playerInput', input); }
  function shoot(dx, dz) { socket?.emit('shoot', { dx, dz }); }
  function useAbility(ability) { socket?.emit('useAbility', { ability }); }

  function leaveRoom() {
    if (socket) { socket.disconnect(); }
    setTimeout(() => { socket = null; connected = false; connect(); UI.showScreen('screen-home'); }, 150);
  }

  function returnToLobby() {
    leaveRoom();
    setTimeout(() => UI.showScreen('screen-multiplayer'), 200);
  }

  function setPendingTeam(t) { pendingTeam = t; }
  function getMyId() { return myPlayerId; }
  function isConnected() { return connected; }

  return {
    connect, createRoom, joinRoom, switchTeam, startGame,
    sendInput, shoot, useAbility, leaveRoom, returnToLobby,
    setPendingTeam, getMyId, isConnected
  };
})();
