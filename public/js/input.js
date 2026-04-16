// ═══════════════════════════════════════════════════════
// NEON FRACTURE — INPUT HANDLER v3  (BUG-FIXED)
// KEY FIXES:
//  - sendState() calls ONLY Network.sendInput() directly.
//    Game.sendInput() is intentionally NOT called here to
//    avoid double-sending. game.js sendInput() is a no-op
//    stub kept only so mobile.js doesn't error.
//  - All Game.* calls are guarded with typeof checks so a
//    load-order problem won't throw.
//  - tryLock / pointerLock wrapped safely for browsers that
//    don't support it.
// ═══════════════════════════════════════════════════════
const Input = (() => {
  const keys = {};
  let enabled       = false;
  let canvas        = null;
  let inputTick     = null;
  let rotY          = 0;
  let mouseX        = 0, mouseY = 0;
  let locked        = false;
  let scoreboardOpen = false;

  // ── SAFE CALLER HELPERS ───────────────────────────────
  // Prevents "X is not a function" from crashing everything
  function _game(fn, ...args) {
    try {
      if (typeof Game !== 'undefined' && typeof Game[fn] === 'function') Game[fn](...args);
    } catch(e) { console.warn('[Input] Game.' + fn + '():', e.message); }
  }
  function _net(fn, ...args) {
    try {
      if (typeof Network !== 'undefined' && typeof Network[fn] === 'function') Network[fn](...args);
    } catch(e) { console.warn('[Input] Network.' + fn + '():', e.message); }
  }

  // ── ENABLE ────────────────────────────────────────────
  function enable() {
    enabled = true;
    canvas  = document.getElementById('game-canvas');

    window.addEventListener('keydown',  _onKeyDown);
    window.addEventListener('keyup',    _onKeyUp);
    canvas?.addEventListener('mousemove',   _onMouseMove);
    canvas?.addEventListener('mousedown',   _onMouseDown);
    canvas?.addEventListener('mouseup',     _onMouseUp);
    canvas?.addEventListener('contextmenu', e => e.preventDefault());
    canvas?.addEventListener('click', tryLock);
    document.addEventListener('pointerlockchange', _onLockChange);

    if (inputTick) clearInterval(inputTick);
    inputTick = setInterval(_sendState, 40);   // 25 Hz to server
  }

  function disable() {
    enabled = false;
    window.removeEventListener('keydown',  _onKeyDown);
    window.removeEventListener('keyup',    _onKeyUp);
    canvas?.removeEventListener('mousemove',   _onMouseMove);
    canvas?.removeEventListener('mousedown',   _onMouseDown);
    canvas?.removeEventListener('mouseup',     _onMouseUp);
    document.removeEventListener('pointerlockchange', _onLockChange);
    if (inputTick) { clearInterval(inputTick); inputTick = null; }
    _game('stopFiring');
  }

  // ── POINTER LOCK ──────────────────────────────────────
  function tryLock() {
    try {
      if (!locked && canvas && canvas.requestPointerLock) canvas.requestPointerLock();
    } catch(e) {}
  }
  function _onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  // ── KEYBOARD ──────────────────────────────────────────
  function _onKeyDown(e) {
    if (!enabled) return;
    const k = e.key.toLowerCase();

    // Prevent default scroll on movement/space keys
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) {
      e.preventDefault();
    }

    if (keys[k]) return;   // already held — don't re-trigger
    keys[k] = true;

    // Abilities
    if (k === 'q') _game('useAbility', 'dash');
    if (k === 'e') _game('useAbility', 'freeze');
    if (k === 'r') _game('useAbility', 'pulse');
    if (k === 'f') _game('useAbility', 'shield');

    // Fire (space)
    if (k === ' ') _game('startFiring');

    // Scoreboard (tab)
    if (k === 'tab') {
      e.preventDefault();
      if (!scoreboardOpen) {
        scoreboardOpen = true;
        document.getElementById('scoreboard')?.classList.remove('hidden');
        _game('updateScoreboard');
      }
    }

    // Unlock pointer (escape)
    if (k === 'escape') {
      try { document.exitPointerLock(); } catch(err) {}
    }
  }

  function _onKeyUp(e) {
    if (!enabled) return;
    const k = e.key.toLowerCase();
    keys[k] = false;

    if (k === ' ') _game('stopFiring');

    if (k === 'tab') {
      scoreboardOpen = false;
      document.getElementById('scoreboard')?.classList.add('hidden');
    }
  }

  // ── MOUSE ─────────────────────────────────────────────
  function _onMouseMove(e) {
    if (!enabled) return;
    if (locked && e.movementX !== undefined) {
      // Pointer-locked: accumulate rotY from movement delta
      rotY -= e.movementX * 0.0022;
      _game('setAim', Math.sin(rotY), Math.cos(rotY));
      _game('setRotY', rotY);
    } else {
      // Free mouse: project screen position to aim vector
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      _calcAimFromMouse();
    }
  }

  function _calcAimFromMouse() {
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    rotY = Math.atan2(dx, dy);
    _game('setAim', Math.sin(rotY), Math.cos(rotY));
    _game('setRotY', rotY);
  }

  function _onMouseDown(e) {
    if (!enabled) return;
    if (e.button === 0) {
      if (!locked) _calcAimFromMouse();
      _game('startFiring');
    }
  }

  function _onMouseUp(e) {
    if (!enabled) return;
    if (e.button === 0) _game('stopFiring');
  }

  // ── BUILD + SEND INPUT ────────────────────────────────
  function buildInput() {
    return {
      w:     !!(keys['w']         || keys['arrowup']),
      s:     !!(keys['s']         || keys['arrowdown']),
      a:     !!(keys['a']         || keys['arrowleft']),
      d:     !!(keys['d']         || keys['arrowright']),
      shift: !!keys['shift'],
      rotY
    };
  }

  function _sendState() {
    if (!enabled) return;
    const inp = buildInput();
    // Single send path — directly to Network (no double-send)
    _net('sendInput', inp);
  }

  // ── PUBLIC API ────────────────────────────────────────
  return { enable, disable, buildInput, tryLock };
})();
