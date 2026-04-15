// ═══════════════════════════════════════════════════════
// NEON FRACTURE — MAIN v3 (FINAL STABLE)
// Crash-proof boot + safe audio + connection fix
// ═══════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {

  console.log('⚡ Booting NEON FRACTURE...');

  // ── AUDIO INIT (SAFE) ───────────────────────────────
  try {
    if (typeof Audio !== 'undefined' && Audio.init) {
      Audio.init();
    }
  } catch (e) {
    console.warn('Audio init failed:', e);
  }

  // ── SETTINGS LOAD (SAFE) ────────────────────────────
  try {
    if (typeof Settings !== 'undefined' && Settings.load) {
      Settings.load();
    }
  } catch (e) {
    console.warn('Settings load failed:', e);
  }

  // ── AUDIO UNLOCK (REQUIRED FOR BROWSERS) ────────────
  const unlockAudio = () => {
    try {
      Audio?.resume?.();
    } catch {}
  };

  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  // ── HOVER SOUND (SAFE FIX) ──────────────────────────
  document.addEventListener('mouseover', e => {
    try {
      if (
        e.target &&
        e.target.matches &&
        e.target.matches('.btn-primary, .btn-secondary, .team-btn')
      ) {
        Audio?.play?.('uiHover');
      }
    } catch {}
  });

  // ── CONNECTION BADGE ────────────────────────────────
  try {
    createConnectionBadge();
  } catch (e) {
    console.warn('Connection badge failed:', e);
  }

  // ── NETWORK CONNECT (CRITICAL) ──────────────────────
  try {
    if (typeof Network !== 'undefined' && Network.connect) {
      Network.connect();
    } else {
      console.error('❌ Network module missing');
    }
  } catch (e) {
    console.error('❌ Network connect failed:', e);
  }

  console.log('⚡ NEON FRACTURE READY');

  // ── AUTO JOIN VIA URL (?room=XXXX) ──────────────────
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');

    if (roomCode) {
      const joinInput = document.getElementById('join-room-id');

      if (joinInput) {
        joinInput.value = roomCode.toUpperCase();
      }

      UI?.toastMessage?.(`Room ${roomCode} detected`);

      setTimeout(() => {
        UI?.showScreen?.('screen-multiplayer');
      }, 800);
    }
  } catch (e) {
    console.warn('URL room join failed:', e);
  }

});


// ── CONNECTION STATUS BADGE (FIXED) ───────────────────
function createConnectionBadge() {
  const badge = document.createElement('div');
  badge.id = 'conn-badge';

  badge.innerHTML = `
    <span class="conn-dot"></span>
    <span class="conn-text">CONNECTING</span>
  `;

  badge.style.cssText = `
    position:fixed;
    bottom:12px;
    left:12px;
    z-index:9999;
    display:flex;
    align-items:center;
    gap:6px;
    font-family:monospace;
    font-size:10px;
    color:#ffcc00;
    pointer-events:none;
  `;

  document.body.appendChild(badge);

  const dot = badge.querySelector('.conn-dot');
  const text = badge.querySelector('.conn-text');

  dot.style.cssText = `
    width:6px;
    height:6px;
    border-radius:50%;
    background:#ffcc00;
    box-shadow:0 0 6px #ffcc00;
  `;

  // 🔁 LIVE STATUS CHECK
  setInterval(() => {
    try {
      const ok = Network?.isConnected?.();

      if (ok) {
        dot.style.background = '#39ff14';
        dot.style.boxShadow = '0 0 6px #39ff14';
        text.textContent = 'CONNECTED';
        badge.style.color = '#39ff14';
      } else {
        dot.style.background = '#ff2244';
        dot.style.boxShadow = '0 0 6px #ff2244';
        text.textContent = 'OFFLINE';
        badge.style.color = '#ff2244';
      }
    } catch {}
  }, 1500);
}
