# Corrected `public/js/ui.js`

```javascript
// ═══════════════════════════════════════════════════════
// NEON FRACTURE — UI MANAGER v5
// Production-safe cinematic integration build
// Compatible with original multiplayer architecture
// ═══════════════════════════════════════════════════════

const UI = (() => {

  let selectedTeam = 'A';
  let currentRoomId = '';
  let isHost = false;
  let toastTimer = null;

  // ═════════════════════════════════════════════════════
  // SAFE AUDIO WRAPPER
  // ═════════════════════════════════════════════════════

  function playSound(name) {
    try {
      Audio?.play?.(name);
    } catch (err) {}
  }

  // ═════════════════════════════════════════════════════
  // SCREEN MANAGEMENT
  // ═════════════════════════════════════════════════════

  function showScreen(id) {

    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    const target = document.getElementById(id);

    if (target) {
      target.classList.add('active');
    }

    // trigger mascot visibility updates safely
    try {
      window.dispatchEvent(
        new CustomEvent('nf_screen_change', {
          detail: { screen: id }
        })
      );
    } catch (err) {}

    playSound('uiClick');
  }

  // ═════════════════════════════════════════════════════
  // ROOM SCREEN
  // ═════════════════════════════════════════════════════

  function showRoomScreen(roomId, roomName, host) {

    currentRoomId = roomId;
    isHost = host;

    const roomNameEl = document.getElementById('room-name-display');
    const roomCodeEl = document.getElementById('room-code-text');
    const startBtn = document.getElementById('btn-start');
    const waitingMsg = document.getElementById('waiting-msg');

    if (roomNameEl) {
      roomNameEl.textContent = roomName || 'QUANTUM ARENA';
    }

    if (roomCodeEl) {
      roomCodeEl.textContent = roomId || '------';
    }

    if (startBtn) {
      startBtn.style.display = host ? 'block' : 'none';
    }

    if (waitingMsg) {
      waitingMsg.style.display = host ? 'none' : 'block';
    }

    showScreen('screen-room');
  }

  // ═════════════════════════════════════════════════════
  // LOBBY UPDATE
  // ═════════════════════════════════════════════════════

  function updateLobby({ players = [] }) {

    const teamA = document.getElementById('team-a-list');
    const teamB = document.getElementById('team-b-list');

    const alphaCount = document.getElementById('alpha-count');
    const omegaCount = document.getElementById('omega-count');

    if (!teamA || !teamB) return;

    teamA.innerHTML = '';
    teamB.innerHTML = '';

    const myId = Network?.getMyId?.();

    let aCount = 0;
    let bCount = 0;

    players.forEach(player => {

      const item = document.createElement('div');
      item.className = 'player-item glass-player-item';

      if (player.id === myId) {
        item.classList.add('is-me');
      }

      item.innerHTML = `
        <span class="player-name">${player.name}${player.id === myId ? ' (YOU)' : ''}</span>
      `;

      if (player.team === 'A') {
        teamA.appendChild(item);
        aCount++;
      } else {
        teamB.appendChild(item);
        bCount++;
      }
    });

    if (alphaCount) alphaCount.textContent = `${aCount}/4`;
    if (omegaCount) omegaCount.textContent = `${bCount}/4`;
  }

  // ═════════════════════════════════════════════════════
  // COUNTDOWN
  // ═════════════════════════════════════════════════════

  function showCountdown(count) {

    const countdownEl = document.getElementById('countdown-num');

    if (countdownEl) {
      countdownEl.textContent = count > 0 ? count : 'GO!';
    }

    showScreen('screen-countdown');

    playSound('countdown');
  }

  // ═════════════════════════════════════════════════════
  // GAME START
  // ═════════════════════════════════════════════════════

  function startGame(myId) {

    const canvas = document.getElementById('game-canvas');

    try {
      Renderer?.init?.(canvas);
    } catch (err) {
      console.warn('[UI] Renderer init failed:', err);
    }

    showScreen('screen-game');

    try {
      Game?.start?.(myId);
    } catch (err) {
      console.warn('[UI] Game start failed:', err);
    }

    try {
      Input?.enable?.();
    } catch (err) {}

    try {
      Mobile?.setup?.();
    } catch (err) {}
  }

  // ═════════════════════════════════════════════════════
  // GAME END
  // ═════════════════════════════════════════════════════

  function showGameEnd(data, myId) {

    showScreen('screen-end');

    const resultEl = document.getElementById('end-result');
    const teamEl = document.getElementById('end-team');
    const reasonEl = document.getElementById('end-reason');

    if (!data) return;

    if (data.winner === 'DRAW') {

      if (resultEl) resultEl.textContent = 'DRAW';
      if (teamEl) teamEl.textContent = 'NO WINNER';

    } else {

      const isWin = data.winner === (Game?.getMyTeam?.() || '');

      if (resultEl) {
        resultEl.textContent = isWin ? 'VICTORY' : 'DEFEAT';
      }

      if (teamEl) {
        teamEl.textContent = `TEAM ${data.winner} WINS`;
      }
    }

    if (reasonEl) {
      reasonEl.textContent = data.reason || '';
    }
  }

  // ═════════════════════════════════════════════════════
  // TEAM SELECT
  // ═════════════════════════════════════════════════════

  function selectTeam(team) {

    selectedTeam = team;

    try {
      Network?.setPendingTeam?.(team);
    } catch (err) {}

    document.getElementById('team-btn-a')
      ?.classList.toggle('active', team === 'A');

    document.getElementById('team-btn-b')
      ?.classList.toggle('active', team === 'B');

    playSound('uiClick');
  }

  // ═════════════════════════════════════════════════════
  // COPY ROOM CODE
  // ═════════════════════════════════════════════════════

  async function copyRoomCode() {

    if (!currentRoomId) return;

    try {

      await navigator.clipboard.writeText(currentRoomId);

      toastMessage(`Copied: ${currentRoomId}`);

    } catch (err) {

      toastMessage('Clipboard unavailable');
    }
  }

  // ═════════════════════════════════════════════════════
  // TOAST SYSTEM
  // ═════════════════════════════════════════════════════

  function toastMessage(message, duration = 2500) {

    const toast = document.getElementById('toast');

    if (!toast) return;

    toast.textContent = message;

    toast.classList.remove('hidden');
    toast.classList.add('show');

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hidden');
    }, duration);
  }

  function showError(message) {
    toastMessage('⚠ ' + message, 3200);
  }

  // ═════════════════════════════════════════════════════
  // ONLINE COUNT
  // ═════════════════════════════════════════════════════

  function updateOnlineCount(count) {

    const onlineEl = document.getElementById('online-count');

    if (onlineEl) {
      onlineEl.textContent = `${count} OPERATORS ONLINE`;
    }
  }

  // ═════════════════════════════════════════════════════
  // CINEMATIC HOME FX
  // ═════════════════════════════════════════════════════

  function initHomeFX() {

    const canvas = document.getElementById('bg-canvas');

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const particles = [];

    const PARTICLE_COUNT = Math.min(50, Math.floor(window.innerWidth / 35));

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.3 + 0.05,
        alpha: Math.random() * 0.4 + 0.1
      });
    }

    let running = true;

    function render() {

      if (!running) return;

      ctx.clearRect(0, 0, width, height);

      particles.forEach(p => {

        p.y += p.speed;

        if (p.y > height) {
          p.y = -5;
          p.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${p.alpha})`;
        ctx.fill();
      });

      requestAnimationFrame(render);
    }

    render();

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) render();
    });
  }

  // ═════════════════════════════════════════════════════
  // MASCOT SYSTEM
  // ═════════════════════════════════════════════════════

  function initMascot() {

    const mascot = document.getElementById('mascot');

    if (!mascot) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    let posX = 80;
    let posY = 120;

    document.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function animate() {

      const dx = (mouseX * 0.05 - posX) * 0.02;
      const dy = (mouseY * 0.05 - posY) * 0.02;

      posX += dx;
      posY += dy;

      mascot.style.transform = `translate(${posX}px, ${posY}px)`;

      requestAnimationFrame(animate);
    }

    animate();

    mascot.addEventListener('mouseenter', () => {
      mascot.classList.add('happy');
    });

    mascot.addEventListener('mouseleave', () => {
      mascot.classList.remove('happy');
    });
  }

  // ═════════════════════════════════════════════════════
  // SAFE INITIALIZATION
  // ═════════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', () => {

    try {
      initHomeFX();
    } catch (err) {
      console.warn('[UI] Home FX failed:', err);
    }

    try {
      initMascot();
    } catch (err) {
      console.warn('[UI] Mascot failed:', err);
    }
  });

  // ═════════════════════════════════════════════════════
  // PUBLIC API
  // ═════════════════════════════════════════════════════

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

// expose globally for inline handlers
window.UI = UI;

```
