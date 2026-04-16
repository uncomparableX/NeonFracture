// FINAL FIXED GAME.JS

const Game = (() => {

  let myId = null;
  let running = false;
  let initialized = false;

  function start(playerId) {
    console.log('[GAME] start()', playerId);

    myId = playerId;
    running = true;

    // ✅ ENSURE RENDERER INIT ALWAYS
    const canvas = document.getElementById('game-canvas');
    if (canvas && typeof Renderer !== 'undefined') {
      try {
        Renderer.init(canvas);
        initialized = true;
      } catch (e) {
        console.error('[GAME] Renderer init failed:', e);
      }
    }

    if (typeof Input !== 'undefined') {
      Input.enable();
    }

    loop();
  }

  function stop() {
    running = false;
    Input?.disable();
    Renderer?.clear();
  }

  function loop() {
    if (!running) return;

    try {
      Renderer?.render();
    } catch (e) {
      console.warn('[GAME LOOP ERROR]', e);
    }

    requestAnimationFrame(loop);
  }

  function onGameState(state) {
    if (!initialized) return;

    try {
      Renderer?.syncGameState(state, myId);
    } catch (e) {
      console.warn('[SYNC ERROR]', e);
    }
  }

  // INPUT INTERFACE (MANDATORY)
  function setAim(x, z) {}
  function setRotY(r) {}

  function startFiring() {}
  function stopFiring() {}

  function useAbility() {}

  function sendInput() {}

  return {
    start,
    stop,
    onGameState,

    setAim,
    setRotY,
    startFiring,
    stopFiring,
    useAbility,
    sendInput
  };

})();
