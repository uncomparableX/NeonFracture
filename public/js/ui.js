// ═══════════════════════════════════════════════════════
// NEON FRACTURE — UI MANAGER v4 (FINAL)
// Clean, stable, multiplayer-ready
// ═══════════════════════════════════════════════════════

const UI = (() => {
  let selectedTeam = 'A';
  let currentRoomId = '';
  let isHost = false;
  let toastTimer = null;

  // ─────────────────────────────────────────────────────
  // SCREEN MANAGEMENT
  // ─────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const el = document.getElementById(id);
    if (el) el.classList.add('active');

    Audio?.play?.('uiClick');
  }

  // ─────────────────────────────────────────────────────
  // ROOM SCREEN
  // ─────────────────────────────────────────────────────
  function showRoomScreen(roomId, roomName, host) {
    currentRoomId = roomId;
    isHost = host;

    const nameEl = document.getElementById('room-name-display');
    const codeEl = document.getElementById('room-code-text');
    const startBtn = document.getElementById('btn-start');
    const waitingMsg = document.getElementById('waiting-msg');

    if (nameEl) nameEl.textContent = roomName;
    if (codeEl) codeEl.textContent = roomId;

    if (startBtn) startBtn.style.display = host ? 'block' : 'none';
    if (waitingMsg) waitingMsg.style.display = host ? 'none' : 'block';

    showScreen('screen-room');
  }

  // ─────────────────────────────────────────────────────
  // 🔥 LOBBY UPDATE (FINAL FIXED)
  // ─────────────────────────────────────────────────────
  function updateLobby(data) {
    const elA = document.getElementById('team-a-list');
    const elB = document.getElementById('team-b-list');

    if (!elA || !elB) return;

    elA.innerHTML = '';
    elB.innerHTML = '';

    if (!data || !data.players) return;

    const myId = Network.getMyId();

    data.players.forEach(p => {
      const el = document.createElement('div');
      el.className = `player-entry ${p.team === 'A' ? 'team-a' : 'team-b'}`;

      let tags = '';
      if (p.id === data.host) tags += ' 👑 HOST';
      if (p.id === myId) tags += ' (YOU)';

      el.innerHTML = `<span class="pe-name">${p.name}${tags}</span>`;

      if (p.team === 'A') elA.appendChild(el);
      else elB.appendChild(el);
    });
  }

  // ─────────────────────────────────────────────────────
  // COUNTDOWN
  // ─────────────────────────────────────────────────────
  function showCountdown(count) {
    const el = document.getElementById('countdown-num');

    if (el) el.textContent = count > 0 ? count : 'GO!';

    showScreen('screen-countdown');
    Audio?.play?.('countdown');
  }

  // ─────────────────────────────────────────────────────
  // GAME START
  // ─────────────────────────────────────────────────────
  function startGame(myId) {
    const canvas = document.getElementById('game-canvas');

    Renderer.init(canvas);

    showScreen('screen-game');

    Game.start(myId);
    Input.enable();
    Mobile.setup();
  }

  // ─────────────────────────────────────────────────────
  // GAME END
  // ─────────────────────────────────────────────────────
  function showGameEnd(data, myId) {
    showScreen('screen-end');

    const result = document.getElementById('end-result');
    const team   = document.getElementById('end-team');
    const reason = document.getElementById('end-reason');

    if (!data) return;

    if (data.winner === 'DRAW') {
      if (result) result.textContent = 'DRAW';
      if (team) team.textContent = 'NO WINNER';
    } else {
      const isWin = data.winner === (Game.getMyTeam?.() || '');
      if (result) result.textContent = isWin ? 'VICTORY' : 'DEFEAT';
      if (team) team.textContent = `TEAM ${data.winner} WINS`;
    }

    if (reason) reason.textContent = data.reason || '';
  }

  // ─────────────────────────────────────────────────────
  // TEAM SELECT
  // ─────────────────────────────────────────────────────
  function selectTeam(team) {
    selectedTeam = team;
    Network.setPendingTeam(team);

    document.getElementById('team-btn-a')?.classList.toggle('active', team === 'A');
    document.getElementById('team-btn-b')?.classList.toggle('active', team === 'B');

    Audio?.play?.('uiClick');
  }

  // ─────────────────────────────────────────────────────
  // COPY ROOM CODE
  // ─────────────────────────────────────────────────────
  function copyRoomCode() {
    if (!currentRoomId) return;

    navigator.clipboard.writeText(currentRoomId);
    toastMessage(`Copied: ${currentRoomId}`);
  }

  // ─────────────────────────────────────────────────────
  // TOAST SYSTEM
  // ─────────────────────────────────────────────────────
  function toastMessage(msg, duration = 2500) {
    const el = document.getElementById('toast');
    if (!el) return;

    el.textContent = msg;
    el.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      el.classList.add('hidden');
    }, duration);
  }

  function showError(msg) {
    toastMessage('⚠ ' + msg, 3000);
  }

  // ─────────────────────────────────────────────────────
  // ONLINE COUNT
  // ─────────────────────────────────────────────────────
  function updateOnlineCount(n) {
    const el = document.getElementById('online-count');
    if (el) el.textContent = `${n} OPERATORS ONLINE`;
  }

  // ─────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────
  return {
    showScreen,
    showRoomScreen,
    updateLobby,
    showCountdown,
    startGame,
    showGameEnd,
    selectTeam,
    copyRoomCode,
    toastMessage,
    showError,
    updateOnlineCount
  };
})();
