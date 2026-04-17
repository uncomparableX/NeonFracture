// ═══════════════════════════════════════════════════════
//  NEON FRACTURE — INPUT HANDLER  (Complete v4)
//  Single send path: only Network.sendInput() called here.
//  Game.sendInput() is a no-op stub in game.js.
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

  // Safe wrappers
  function _g(fn, ...a) {
    try { if (typeof Game !== 'undefined' && typeof Game[fn] === 'function') Game[fn](...a); }
    catch(e) { console.warn('[Input] Game.' + fn + ':', e.message); }
  }
  function _n(fn, ...a) {
    try { if (typeof Network !== 'undefined' && typeof Network[fn] === 'function') Network[fn](...a); }
    catch(e) { console.warn('[Input] Network.' + fn + ':', e.message); }
  }

  // ── ENABLE ────────────────────────────────────────────
  function enable() {
    enabled = true;
    canvas  = document.getElementById('game-canvas');

    window.addEventListener('keydown',  _keyDown,  { passive: false });
    window.addEventListener('keyup',    _keyUp);
    canvas?.addEventListener('mousemove',   _mouseMove);
    canvas?.addEventListener('mousedown',   _mouseDown);
    canvas?.addEventListener('mouseup',     _mouseUp);
    canvas?.addEventListener('contextmenu', e => e.preventDefault());
    canvas?.addEventListener('click',       tryLock);
    document.addEventListener('pointerlockchange', _lockChange);

    if (inputTick) clearInterval(inputTick);
    inputTick = setInterval(_sendState, 40); // 25 Hz
  }

  function disable() {
    enabled = false;
    window.removeEventListener('keydown',  _keyDown);
    window.removeEventListener('keyup',    _keyUp);
    canvas?.removeEventListener('mousemove',   _mouseMove);
    canvas?.removeEventListener('mousedown',   _mouseDown);
    canvas?.removeEventListener('mouseup',     _mouseUp);
    document.removeEventListener('pointerlockchange', _lockChange);
    if (inputTick) { clearInterval(inputTick); inputTick = null; }
    _g('stopFiring');
  }

  // ── POINTER LOCK ──────────────────────────────────────
  function tryLock() {
    try { if (!locked && canvas?.requestPointerLock) canvas.requestPointerLock(); } catch(e) {}
  }
  function _lockChange() { locked = document.pointerLockElement === canvas; }

  // ── KEYBOARD ──────────────────────────────────────────
  function _keyDown(e) {
    if (!enabled) return;
    const k = e.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
    if (keys[k]) return; // already held
    keys[k] = true;

    if (k === 'q') _g('useAbility', 'dash');
    if (k === 'e') _g('useAbility', 'freeze');
    if (k === 'r') _g('useAbility', 'pulse');
    if (k === 'f') _g('useAbility', 'shield');
    if (k === ' ') _g('startFiring');
    if (k === 'escape') { try { document.exitPointerLock(); } catch(e) {} }

    if (k === 'tab') {
      e.preventDefault();
      if (!scoreboardOpen) {
        scoreboardOpen = true;
        document.getElementById('scoreboard')?.classList.remove('hidden');
        _g('updateScoreboard');
      }
    }
  }

  function _keyUp(e) {
    if (!enabled) return;
    const k = e.key.toLowerCase();
    keys[k] = false;
    if (k === ' ') _g('stopFiring');
    if (k === 'tab') {
      scoreboardOpen = false;
      document.getElementById('scoreboard')?.classList.add('hidden');
    }
  }

  // ── MOUSE ─────────────────────────────────────────────
  function _mouseMove(e) {
    if (!enabled) return;
    if (locked && e.movementX !== undefined) {
      rotY -= e.movementX * 0.0022;
      _g('setAim', Math.sin(rotY), Math.cos(rotY));
    } else {
      const rect = canvas?.getBoundingClientRect() || { left:0, top:0 };
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      _calcAim();
    }
  }

  function _calcAim() {
    const dx = mouseX - window.innerWidth  / 2;
    const dy = mouseY - window.innerHeight / 2;
    rotY = Math.atan2(dx, dy);
    _g('setAim', Math.sin(rotY), Math.cos(rotY));
  }

  function _mouseDown(e) {
    if (!enabled) return;
    if (e.button === 0) { if (!locked) _calcAim(); _g('startFiring'); }
  }

  function _mouseUp(e) {
    if (!enabled) return;
    if (e.button === 0) _g('stopFiring');
  }

  // ── SEND STATE ────────────────────────────────────────
  function _sendState() {
    if (!enabled) return;
    const inp = {
      w:     !!(keys['w']         || keys['arrowup']),
      s:     !!(keys['s']         || keys['arrowdown']),
      a:     !!(keys['a']         || keys['arrowleft']),
      d:     !!(keys['d']         || keys['arrowright']),
      shift: !!keys['shift'],
      rotY
    };
    _n('sendInput', inp);
  }

  function buildInput() {
    return {
      w: !!(keys['w']||keys['arrowup']),
      s: !!(keys['s']||keys['arrowdown']),
      a: !!(keys['a']||keys['arrowleft']),
      d: !!(keys['d']||keys['arrowright']),
      shift: !!keys['shift'], rotY
    };
  }

  return { enable, disable, buildInput, tryLock };
})();
