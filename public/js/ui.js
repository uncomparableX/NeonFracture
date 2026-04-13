// ═══════════════════════════════════════════════════════
// NEON FRACTURE — UI MANAGER v2
// ═══════════════════════════════════════════════════════
const UI = (() => {
  let selectedTeam = 'A';
  let currentRoomId = '';
  let isHost = false;
  let toastTimer = null;
  let prevScoreA = 0, prevScoreB = 0;
  let countdownTimer = null;

  // ── SCREEN MANAGEMENT ───────────────────────────────
  function showScreen(id) {
    const current = document.querySelector('.screen.active');
    const next    = document.getElementById(id);
    if (!next || next === current) return;
    // Fade out current
    if (current) {
      current.style.opacity = '0';
      setTimeout(() => {
        current.classList.remove('active');
        current.style.opacity = '';
      }, 220);
    }
    // Fade in next
    next.style.opacity = '0';
    next.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        next.style.transition = 'opacity 0.22s ease';
        next.style.opacity = '1';
        setTimeout(() => next.style.transition = '', 250);
      });
    });
    Audio.play('uiClick');
  }

  // ── ROOM SCREEN ─────────────────────────────────────
  function showRoomScreen(roomId, roomName, host) {
    currentRoomId = roomId;
    isHost = host;
    document.getElementById('room-name-display').textContent = roomName;
    document.getElementById('room-code-text').textContent  = roomId;
    const startBtn   = document.getElementById('btn-start');
    const waitingMsg = document.getElementById('waiting-msg');
    if (startBtn)   startBtn.style.display   = host ? 'block' : 'none';
    if (waitingMsg) waitingMsg.style.display = host ? 'none'  : 'block';
    showScreen('screen-room');
    toastMessage(`Room code: ${roomId} — share with friends!`);
  }

  // ── LOBBY UPDATE ─────────────────────────────────────
  function updateLobby(data) {
    const elA = document.getElementById('team-a-list');
    const elB = document.getElementById('team-b-list');
    if (!elA || !elB) return;
    elA.innerHTML = ''; elB.innerHTML = '';
    const countA = data.players.filter(p => p.team === 'A').length;
    const countB = data.players.filter(p => p.team === 'B').length;
    // Team headers with count
    const hA = document.querySelector('.team-a-header');
    const hB = document.querySelector('.team-b-header');
    if (hA) hA.textContent = `⚡ TEAM ALPHA (${countA})`;
    if (hB) hB.textContent = `◎ TEAM OMEGA (${countB})`;
    data.players.forEach(p => {
      const el = document.createElement('div');
      el.className = `player-entry ${p.team === 'A' ? 'team-a' : 'team-b'}`;
      el.innerHTML = `
        <span class="pe-name">${p.name}</span>
        ${p.id === data.host ? '<span class="host-badge">HOST</span>' : ''}
        <span class="level-tag">LVL ${p.level}</span>
      `;
      (p.team === 'A' ? elA : elB).appendChild(el);
    });
  }

  // ── COUNTDOWN ────────────────────────────────────────
  function showCountdown(count) {
    const el = document.getElementById('countdown-num');
    if (el) {
      el.textContent = count > 0 ? count : 'GO!';
      el.style.animation = 'none';
      void el.offsetHeight;
      el.style.animation = 'countPulse 0.9s ease-out';
      el.style.color = count <= 1 ? 'var(--neon-orange)' : 'var(--neon-cyan)';
    }
    showScreen('screen-countdown');
  }

  // ── GAME START ───────────────────────────────────────
  function startGame(myId) {
    // Build renderer
    const canvas = document.getElementById('game-canvas');
    Renderer.init(canvas);

    // Hit-flash overlay
    if (!document.getElementById('hit-flash')) {
      const f = document.createElement('div');
      f.id = 'hit-flash';
      document.body.appendChild(f);
    }

    // Speed-boost vignette
    if (!document.getElementById('speed-vignette')) {
      const sv = document.createElement('div');
      sv.id = 'speed-vignette';
      sv.className = 'speed-vignette';
      document.body.appendChild(sv);
    }

    showScreen('screen-game');

    // Reset score display
    prevScoreA = 0; prevScoreB = 0;
    setEl('score-a', '0'); setEl('score-b', '0');
    setEl('match-time', '5:00');
    document.getElementById('bar-health').style.width = '100%';
    document.getElementById('bar-energy').style.width = '100%';
    document.getElementById('kill-feed').innerHTML   = '';
    // Clear any old announcer
    const ann = document.getElementById('announcer');
    if (ann) ann.style.display = 'none';

    Game.start(myId);
    Input.enable();
    Mobile.setup();

    // Mobile detection
    const mob = 'ontouchstart' in window || /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 900;
    document.getElementById('mobile-controls').style.display = mob ? 'flex' : 'none';
  }

  // ── SCORE PULSE ──────────────────────────────────────
  function pulseScore(team) {
    const el = document.getElementById(`score-${team.toLowerCase()}`);
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetHeight;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 500);
  }

  // ── GAME END ─────────────────────────────────────────
  function showGameEnd(data, myId) {
    const myTeam  = data.stats?.find(s => s.id === myId)?.team;
    const won     = data.winner === myTeam;
    const isDraw  = data.winner === 'DRAW';

    // Audio fanfare
    if (won)    { Audio.play('levelUp'); Audio.play('coreCapture'); }
    else if (!isDraw) { Audio.play('death'); }

    const resultEl = document.getElementById('end-result');
    const teamEl   = document.getElementById('end-team');
    const subtitleEl = document.getElementById('end-reason');

    if (resultEl) {
      resultEl.textContent = isDraw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
      resultEl.className   = `end-result ${isDraw ? 'draw' : won ? 'victory' : 'defeat'}`;
    }
    if (teamEl) {
      teamEl.textContent = isDraw
        ? 'BOTH TEAMS HELD THEIR GROUND'
        : `TEAM ${data.winner === 'A' ? 'ALPHA' : 'OMEGA'} WINS THE ARENA`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = data.reason === 'score'
        ? 'REACHED 100 POINTS FIRST'
        : 'TIME EXPIRED — HIGHEST SCORE WINS';
    }

    setEl('end-score-a', data.teamScores?.A || 0);
    setEl('end-score-b', data.teamScores?.B || 0);

    const tbody = document.getElementById('stats-tbody');
    if (tbody && data.stats) {
      tbody.innerHTML = '';
      data.stats.forEach((p, i) => {
        const tr = document.createElement('tr');
        tr.className = p.team === 'A' ? 'team-a-row' : 'team-b-row';
        if (p.id === myId) tr.classList.add('my-row');
        const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills;
        tr.innerHTML = `
          <td>${i === 0 ? '🏆 ' : ''}${p.name}</td>
          <td>${p.team === 'A' ? 'ALPHA' : 'OMEGA'}</td>
          <td>${p.kills}</td>
          <td>${p.deaths}</td>
          <td>${kd}</td>
          <td class="end-score-td">${p.score}</td>
          <td>Lv${p.level}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    showScreen('screen-end');
  }

  // ── LOBBY UTILITIES ──────────────────────────────────
  function selectTeam(team) {
    selectedTeam = team;
    Network.setPendingTeam(team);
    document.getElementById('team-btn-a')?.classList.toggle('active', team === 'A');
    document.getElementById('team-btn-b')?.classList.toggle('active', team === 'B');
    Audio.play('uiClick');
  }

  function copyRoomCode() {
    if (!currentRoomId) return;
    try { navigator.clipboard.writeText(currentRoomId); } catch(e) {}
    toastMessage(`Room code ${currentRoomId} copied!`);
  }

  // ── TOAST ────────────────────────────────────────────
  function toastMessage(msg, duration = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.classList.add('hidden'), 300);
    }, duration);
  }

  function showError(msg) {
    Audio.play('error');
    // Show in form error slot if visible
    const el = document.getElementById('error-msg');
    if (el && !el.closest('.screen').classList.contains('hidden')) {
      el.textContent = '⚠ ' + msg;
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 4000);
    }
    toastMessage('⚠ ' + msg, 3500);
  }

  function updateOnlineCount(n) {
    const el = document.getElementById('online-count');
    if (el) el.textContent = `${n} OPERATORS ONLINE`;
  }

  // ── HELPERS ──────────────────────────────────────────
  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return {
    showScreen, showRoomScreen, updateLobby, showCountdown,
    startGame, showGameEnd, pulseScore, selectTeam,
    copyRoomCode, toastMessage, showError, updateOnlineCount
  };
})();
