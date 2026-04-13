// ═══════════════════════════════════════════════════════
// NEON FRACTURE — MOBILE CONTROLS v2
// Dual-stick with aim visualizer + haptic feedback
// ═══════════════════════════════════════════════════════
const Mobile = (() => {
  // Left stick (move)
  let moveId    = null;
  let moveOriX  = 0, moveOriY = 0;
  let moveJX    = 0, moveJZ   = 0;
  const MOVE_R  = 52;

  // Right stick (aim + fire)
  let aimId     = null;
  let aimOriX   = 0, aimOriY = 0;
  let aimJX     = 0, aimJZ   = 0;
  const AIM_R   = 52;
  let isFiringTouch = false;

  let inputTick  = null;
  let setupDone  = false;
  let rotY       = 0;

  function setup() {
    if (setupDone) return;
    setupDone = true;

    const canvas = document.getElementById('game-canvas');
    const zone   = document.getElementById('joystick-zone');
    const base   = document.getElementById('joystick-base');
    const stick  = document.getElementById('joystick-stick');

    // ── MOVE STICK ─────────────────────────────────────
    zone?.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      moveId = t.identifier;
      const r = base.getBoundingClientRect();
      moveOriX = r.left + r.width / 2;
      moveOriY = r.top  + r.height / 2;
    }, { passive: false });

    // ── CANVAS TOUCH (right half = aim) ─────────────────
    canvas?.addEventListener('touchstart', e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX > window.innerWidth / 2 && t.identifier !== moveId) {
          aimId   = t.identifier;
          aimOriX = t.clientX;
          aimOriY = t.clientY;
          isFiringTouch = true;
          Game.startFiring();
          haptic(20);
        }
      }
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        // Move stick
        if (t.identifier === moveId) {
          e.preventDefault();
          let dx = t.clientX - moveOriX;
          let dy = t.clientY - moveOriY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const ratio = Math.min(dist, MOVE_R) / MOVE_R;
          moveJX = (dx / dist || 0) * ratio;
          moveJZ = (dy / dist || 0) * ratio;
          // Clamp stick knob
          const nx = (dx / dist || 0) * Math.min(dist, MOVE_R);
          const ny = (dy / dist || 0) * Math.min(dist, MOVE_R);
          if (stick) stick.style.transform = `translate(${nx}px, ${ny}px)`;
        }

        // Aim stick (relative swipe)
        if (t.identifier === aimId) {
          const ddx = t.clientX - aimOriX;
          const ddy = t.clientY - aimOriY;
          const mag = Math.sqrt(ddx*ddx + ddy*ddy);
          if (mag > 5) {
            rotY = Math.atan2(ddx, ddy);
            Game.setAim(Math.sin(rotY), Math.cos(rotY));
            Game.setRotY(rotY);
          }
        }
      }
    }, { passive: false });

    document.addEventListener('touchend', e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === moveId) {
          moveId = null; moveJX = 0; moveJZ = 0;
          if (stick) stick.style.transform = 'translate(0,0)';
        }
        if (t.identifier === aimId) {
          aimId = null;
          if (isFiringTouch) { Game.stopFiring(); isFiringTouch = false; }
        }
      }
    });

    // ── FIRE BUTTON ─────────────────────────────────────
    const fireBtn = document.getElementById('mobile-fire');
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        Game.startFiring();
        haptic(15);
        fireBtn.style.transform = 'scale(0.9)';
      }, { passive: false });
      fireBtn.addEventListener('touchend', e => {
        e.preventDefault();
        Game.stopFiring();
        fireBtn.style.transform = '';
      }, { passive: false });
    }

    // ── ABILITY BUTTONS ─────────────────────────────────
    document.querySelectorAll('.mob-ab').forEach(btn => {
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        const ab = btn.dataset.ability;
        if (ab) { Game.useAbility(ab); haptic(30); }
        btn.style.opacity = '0.6';
      }, { passive: false });
      btn.addEventListener('touchend', () => { btn.style.opacity = ''; });
    });

    // ── INPUT SEND LOOP ──────────────────────────────────
    if (inputTick) clearInterval(inputTick);
    inputTick = setInterval(sendMobileInput, 40);
  }

  function sendMobileInput() {
    if (Math.abs(moveJX) < 0.05 && Math.abs(moveJZ) < 0.05) return;
    const DEADZONE = 0.12;
    const inp = {
      w: moveJZ < -DEADZONE,
      s: moveJZ >  DEADZONE,
      a: moveJX < -DEADZONE,
      d: moveJX >  DEADZONE,
      shift: false,
      rotY
    };
    Game.sendInput(inp);
    Network.sendInput(inp);
  }

  function haptic(ms = 20) {
    try { navigator.vibrate?.(ms); } catch(e) {}
  }

  function teardown() {
    setupDone = false;
    if (inputTick) { clearInterval(inputTick); inputTick = null; }
    Game.stopFiring();
  }

  return { setup, teardown, haptic };
})();
