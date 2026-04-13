// ═══════════════════════════════════════════════════════
// NEON FRACTURE — INPUT HANDLER v2
// Keyboard, mouse (free + pointer lock), gamepad
// ═══════════════════════════════════════════════════════
const Input = (() => {
  const keys = {};
  let enabled = false;
  let canvas  = null;
  let inputTick = null;
  let rotY    = 0;
  let mouseX  = 0, mouseY = 0;
  let locked  = false;
  let scoreboardOpen = false;
  let lastTabState   = false;

  // ─── ENABLE / DISABLE ──────────────────────────────
  function enable() {
    enabled = true;
    canvas  = document.getElementById('game-canvas');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    canvas?.addEventListener('mousemove',  onMouseMove);
    canvas?.addEventListener('mousedown',  onMouseDown);
    canvas?.addEventListener('mouseup',    onMouseUp);
    canvas?.addEventListener('contextmenu', e => e.preventDefault());
    canvas?.addEventListener('click', tryLock);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    inputTick = setInterval(sendState, 40); // 25 Hz
  }

  function disable() {
    enabled = false;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup',   onKeyUp);
    if (canvas) {
      canvas.removeEventListener('mousemove',  onMouseMove);
      canvas.removeEventListener('mousedown',  onMouseDown);
      canvas.removeEventListener('mouseup',    onMouseUp);
    }
    if (inputTick) { clearInterval(inputTick); inputTick = null; }
    Game.stopFiring();
  }

  // ─── POINTER LOCK ──────────────────────────────────
  function tryLock() {
    if (!locked && canvas) canvas.requestPointerLock?.();
  }
  function onPointerLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  // ─── KEY HANDLERS ──────────────────────────────────
  function onKeyDown(e) {
    if (!enabled) return;
    const k = e.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
    keys[k] = true;

    // Abilities
    if (k === 'q') Game.useAbility('dash');
    if (k === 'e') Game.useAbility('freeze');
    if (k === 'r') Game.useAbility('pulse');
    if (k === 'f') Game.useAbility('shield');
    // Fire
    if (k === ' ') Game.startFiring();
    // Scoreboard
    if (k === 'tab') {
      e.preventDefault();
      if (!scoreboardOpen) {
        scoreboardOpen = true;
        document.getElementById('scoreboard')?.classList.remove('hidden');
        Game.updateScoreboard();
        // Update scoreboard team scores
        const ls = Game.getLastState();
        if (ls) {
          const sa = document.getElementById('sb-ts-a');
          const sb = document.getElementById('sb-ts-b');
          if (sa) sa.textContent = `ALPHA: ${ls.teamScores?.A||0}`;
          if (sb) sb.textContent = `OMEGA: ${ls.teamScores?.B||0}`;
        }
      }
    }
    // Escape to unlock pointer
    if (k === 'escape') {
      document.exitPointerLock?.();
    }
  }

  function onKeyUp(e) {
    if (!enabled) return;
    const k = e.key.toLowerCase();
    keys[k] = false;
    if (k === ' ') Game.stopFiring();
    if (k === 'tab') {
      scoreboardOpen = false;
      document.getElementById('scoreboard')?.classList.add('hidden');
    }
  }

  // ─── MOUSE HANDLERS ────────────────────────────────
  function onMouseMove(e) {
    if (!enabled) return;
    if (locked) {
      // Pointer lock — accumulate rotation
      rotY -= e.movementX * 0.0022;
      Game.setAim(Math.sin(rotY), Math.cos(rotY));
      Game.setRotY(rotY);
    } else {
      // Free mouse — project to world
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      calcAimFromMouse();
    }
  }

  function calcAimFromMouse() {
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const dx = mouseX - cx, dy = mouseY - cy;
    rotY = Math.atan2(dx, dy);
    Game.setAim(Math.sin(rotY), Math.cos(rotY));
    Game.setRotY(rotY);
  }

  function onMouseDown(e) {
    if (!enabled) return;
    if (e.button === 0) {
      if (!locked) calcAimFromMouse();
      Game.startFiring();
    }
  }

  function onMouseUp(e) {
    if (!enabled) return;
    if (e.button === 0) Game.stopFiring();
  }

  // ─── INPUT STATE ───────────────────────────────────
  function buildInput() {
    return {
      w: !!(keys['w'] || keys['arrowup']),
      s: !!(keys['s'] || keys['arrowdown']),
      a: !!(keys['a'] || keys['arrowleft']),
      d: !!(keys['d'] || keys['arrowright']),
      shift: !!keys['shift'],
      rotY
    };
  }

  function sendState() {
    if (!enabled) return;
    const inp = buildInput();
    Game.sendInput(inp);
    Network.sendInput(inp);
  }

  return { enable, disable, buildInput, tryLock };
})();
