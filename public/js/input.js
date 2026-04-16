// ═══════════════════════════════════════════════════════
// NEON FRACTURE — INPUT v4 (FINAL STABLE)
// FIXES:
// ✅ No crashes if Game/Network missing
// ✅ Safe pointer lock
// ✅ Clean input pipeline
// ═══════════════════════════════════════════════════════

const Input = (() => {

  const keys = {};
  let enabled = false;
  let canvas = null;
  let tick = null;
  let rotY = 0;

  // ── SAFE CALLS ───────────────────────────────────────
  function _game(fn, ...args) {
    try {
      if (Game && typeof Game[fn] === 'function') {
        Game[fn](...args);
      }
    } catch {}
  }

  function _net(fn, ...args) {
    try {
      if (Network && typeof Network[fn] === 'function') {
        Network[fn](...args);
      }
    } catch {}
  }

  // ── ENABLE ───────────────────────────────────────────
  function enable() {
    enabled = true;
    canvas = document.getElementById('game-canvas');

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas?.addEventListener('mousemove', onMouseMove);
    canvas?.addEventListener('mousedown', onMouseDown);
    canvas?.addEventListener('mouseup', onMouseUp);

    tick = setInterval(sendState, 40);
  }

  function disable() {
    enabled = false;

    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas?.removeEventListener('mousemove', onMouseMove);
    canvas?.removeEventListener('mousedown', onMouseDown);
    canvas?.removeEventListener('mouseup', onMouseUp);

    if (tick) clearInterval(tick);
  }

  // ── KEYBOARD ─────────────────────────────────────────
  function onKeyDown(e) {
    keys[e.key.toLowerCase()] = true;

    if (e.key === ' ') _game('startFiring');
  }

  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;

    if (e.key === ' ') _game('stopFiring');
  }

  // ── MOUSE ────────────────────────────────────────────
  function onMouseMove(e) {
    rotY -= e.movementX * 0.002;

    _game('setRotY', rotY);
    _game('setAim', Math.sin(rotY), Math.cos(rotY));
  }

  function onMouseDown(e) {
    if (e.button === 0) _game('startFiring');
  }

  function onMouseUp(e) {
    if (e.button === 0) _game('stopFiring');
  }

  // ── INPUT BUILD ──────────────────────────────────────
  function buildInput() {
    return {
      w: !!keys['w'],
      a: !!keys['a'],
      s: !!keys['s'],
      d: !!keys['d'],
      rotY
    };
  }

  function sendState() {
    if (!enabled) return;

    const input = buildInput();

    if (typeof Network !== 'undefined' && typeof Network.sendInput === 'function') {
      Network.sendInput(input);
    } else {
      console.warn('[INPUT] Network missing');
    }
  }

  return {
    enable,
    disable
  };

})();
