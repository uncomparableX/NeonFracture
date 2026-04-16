const Network = (() => {
  let socket = null;
  let connected = false;
  let myId = null;
  let isHost = false;
  let pendingTeam = 'A';

  function connect() {
    socket = io({
      transports: ['websocket'],
      reconnection: true
    });

    socket.on('connect', () => {
      connected = true;
      myId = socket.id;
      console.log('✅ Connected:', myId);
      UI.toastMessage('Connected');
    });

    socket.on('disconnect', () => {
      connected = false;
      UI.toastMessage('Disconnected');
    });

    socket.on('error', ({ msg }) => UI.showError(msg));

    socket.on('roomCreated', (d) => {
      isHost = true;
      UI.showRoomScreen(d.roomId, d.roomName, true);
    });

    socket.on('roomJoined', (d) => {
      isHost = false;
      UI.showRoomScreen(d.roomId, d.roomName, false);
    });

    socket.on('lobbyUpdate', d => UI.updateLobby(d));

    socket.on('countdown', ({ count }) => UI.showCountdown(count));

    socket.on('gameStart', () => UI.startGame());

    socket.on('gameState', s => Game.onGameState(s));
  }

  function createRoom() {
    const name = document.getElementById('create-name').value || 'OPERATOR';
    const roomName = document.getElementById('create-room-name').value;

    if (!connected) return UI.showError('Not connected');

    socket.emit('createRoom', { playerName: name, roomName });
  }

  function joinRoom() {
    const name = document.getElementById('join-name').value || 'OPERATOR';
    const roomId = document.getElementById('join-room-id').value.toUpperCase();

    if (!connected) return UI.showError('Not connected');

    socket.emit('joinRoom', { roomId, playerName: name, team: pendingTeam });
  }

  function startGame() {
    if (!isHost) return;
    socket.emit('startGame');
  }

  function switchTeam() {
    socket.emit('switchTeam');
  }

  function setPendingTeam(t) { pendingTeam = t; }

  function isConnected() { return connected; }

  function getMyId() { return myId; } // 🔥 FIX

  return {
    connect,
    createRoom,
    joinRoom,
    startGame,
    switchTeam,
    setPendingTeam,
    isConnected,
    getMyId // 🔥 FIX
  };
})();
