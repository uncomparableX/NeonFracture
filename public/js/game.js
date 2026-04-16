
// ═══════════════════════════════════════════════════════
// NEON FRACTURE — GAME LOGIC v3 (FINAL STABLE)
// FREEZE FIX + SAFE RENDER + CRASH PROTECTION
// ═══════════════════════════════════════════════════════

const Game = (() => {
  let myId = null, myPlayer = null;
  let gameRunning = false;
  let animFrame = null;
  let lastState = null;

  const cooldowns = { dash: 0, freeze: 0, pulse: 0, shield: 0 };

  // ─── START / STOP ──────────────────────────────────────
  function start(playerId) {
    myId = playerId;
    gameRunning = true;

    try { Audio.startMusic(); } catch {}

    console.log('🎮 GAME STARTED');
    loop();
  }

  function stop() {
    gameRunning = false;
    if (animFrame) cancelAnimationFrame(animFrame);

    try { Renderer.clear(); } catch {}

    myId = null;
    myPlayer = null;
    lastState = null;
  }

  // ─── GAME LOOP (FIXED) ─────────────────────────────────
  function loop() {
    if (!gameRunning) return;

    try {
      // ✅ SAFE RENDER FIX
      if (Renderer && Renderer.renderer && Renderer.scene && Renderer.camera) {
        Renderer.renderer.render(Renderer.scene, Renderer.camera);
      }

      updateHUD();

    } catch (e) {
      console.error('❌ GAME LOOP ERROR:', e);
    }

    animFrame = requestAnimationFrame(loop);
  }

  // ─── STATE SYNC ────────────────────────────────────────
  function onGameState(state) {
    lastState = state;
    if (!myId) return;

    const p = state.players?.find(p => p.id === myId);
    if (p) myPlayer = p;

    try {
      Renderer.syncGameState(state, myId);
    } catch (e) {
      console.warn('Renderer sync error:', e);
    }
  }

  // ─── HUD ───────────────────────────────────────────────
  function updateHUD() {
    if (!myPlayer) return;

    try {
      const hp = Math.max(0, myPlayer.health || 0);
      const en = Math.max(0, myPlayer.energy || 0);

      setBar('bar-health', hp, 100);
      setBar('bar-energy', en, 100);

      setVal('val-health', Math.ceil(hp));
      setVal('val-energy', Math.ceil(en));

    } catch (e) {
      console.warn('HUD error:', e);
    }
  }

  function setBar(id, val, max) {
    const el = document.getElementById(id);
    if (el) el.style.width = (val / max * 100) + '%';
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── INPUT ─────────────────────────────────────────────
  function sendInput(input) {
    try { Network.sendInput(input); } catch {}
  }

  function shoot(dx, dz) {
    try { Network.shoot(dx, dz); } catch {}
  }

  function useAbility(ability) {
    try { Network.useAbility(ability); } catch {}
  }

  return {
    start,
    stop,
    onGameState,
    sendInput,
    shoot,
    useAbility,
    isRunning: () => gameRunning
  };
})();

