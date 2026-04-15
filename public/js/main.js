// ── MAIN BOOT ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {

  Audio.init();

  // ✅ SAFE SETTINGS LOAD (prevents crash)
  if (typeof Settings !== 'undefined' && Settings.load) {
    Settings.load();
  }

  // Audio unlock
  const unlockAudio = () => { Audio.resume(); };
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  // Hover SFX
  document.addEventListener('mouseenter', e => {
    if (e.target.matches('.btn-primary, .btn-secondary, .team-btn')) {
      Audio.play('uiHover');
    }
  }, true);

  createConnectionBadge();

  // 🔥 CONNECT
  Network.connect();

  console.log('⚡ NEON FRACTURE BOOTED');

  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');

  if (roomCode) {
    const joinInput = document.getElementById('join-room-id');
    if (joinInput) joinInput.value = roomCode.toUpperCase();

    UI.toastMessage(`Room ${roomCode} detected`);
    setTimeout(() => UI.showScreen('screen-multiplayer'), 800);
  }
});
