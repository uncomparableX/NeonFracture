// ═══════════════════════════════════════════════════════
// NEON FRACTURE — MAIN v2
// Home background, boot sequence, connection indicator
// ═══════════════════════════════════════════════════════

// ── HOME BACKGROUND (Canvas 2D) ───────────────────────
(function HomeBackground() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Particle network
  const MAX_P = Math.min(90, Math.floor(window.innerWidth * 0.055));
  const particles = Array.from({ length: MAX_P }, () => ({
    x:  Math.random() * window.innerWidth,
    y:  Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.38,
    vy: (Math.random() - 0.5) * 0.38,
    r:  0.6 + Math.random() * 1.6,
    hue: Math.random() > 0.65 ? 20 : 190,
    alpha: 0.25 + Math.random() * 0.5
  }));

  // Decorative spinning hexagons
  const hexes = [
    { rx: 0.08, ry: 0.18, size: 44,  speed: 0.00055, color: '#00d4ff' },
    { rx: 0.92, ry: 0.78, size: 60,  speed: 0.00042, color: '#ff6b35' },
    { rx: 0.88, ry: 0.14, size: 32,  speed: 0.00078, color: '#00d4ff' },
    { rx: 0.12, ry: 0.82, size: 50,  speed: 0.00050, color: '#ff6b35' },
    { rx: 0.50, ry: 0.05, size: 28,  speed: 0.00090, color: '#00d4ff' },
    { rx: 0.50, ry: 0.95, size: 28,  speed: 0.00090, color: '#ff6b35' }
  ];

  // Horizontal scan line
  let scanY = 0;

  function drawFrame(ts) {
    ctx.clearRect(0, 0, W, H);

    // Deep space BG
    const radGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.75);
    radGrad.addColorStop(0.0, 'rgba(0,20,50,0.97)');
    radGrad.addColorStop(0.5, 'rgba(0,8,22,0.98)');
    radGrad.addColorStop(1.0, 'rgba(3,6,14,1)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, W, H);

    // Moving perspective grid
    const gs   = 70;
    const gOff = (ts * 0.014) % gs;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,80,160,0.07)';
    ctx.lineWidth   = 1;
    for (let x = -gs + (gOff % gs); x < W + gs; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - H * 0.25, H); ctx.stroke();
    }
    for (let y = (gOff % gs) - gs; y < H + gs; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    // Horizon glow band
    const hGrad = ctx.createLinearGradient(0, H*0.38, 0, H*0.68);
    hGrad.addColorStop(0,   'rgba(0,120,255,0)');
    hGrad.addColorStop(0.45,'rgba(0,80,200,0.055)');
    hGrad.addColorStop(1,   'rgba(0,50,150,0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, H*0.38, W, H*0.30);

    // Centre radial glow
    const cGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.38);
    cGrad.addColorStop(0, 'rgba(0,90,200,0.07)');
    cGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cGrad;
    ctx.fillRect(0, 0, W, H);

    // Particles + web
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      const flicker = 0.65 + 0.35 * Math.sin(ts * 0.0009 + i * 2.3);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.hue > 100 ? '#00d4ff' : '#ff6b35';
      ctx.globalAlpha = p.alpha * flicker;
      ctx.fill();
      ctx.globalAlpha = 1;

      for (let j = i + 1; j < particles.length; j++) {
        const q   = particles[j];
        const dx  = p.x - q.x, dy = p.y - q.y;
        const d   = Math.sqrt(dx*dx + dy*dy);
        if (d < 110) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = p.hue > 100 ? '#00d4ff' : '#ff6b35';
          ctx.lineWidth   = 0.5;
          ctx.globalAlpha = (1 - d / 110) * 0.09;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    // Spinning hexagons
    hexes.forEach(h => {
      ctx.save();
      ctx.translate(h.rx * W, h.ry * H);
      ctx.rotate(ts * h.speed);
      const pulse = 1 + 0.04 * Math.sin(ts * 0.002);
      const sz    = h.size * pulse;
      drawHex(ctx, 0, 0, sz, h.color, 0.16 + 0.05 * Math.sin(ts * 0.0015));
      drawHex(ctx, 0, 0, sz * 0.62, h.color, 0.09);
      ctx.restore();
    });

    // Horizontal scan line
    scanY = (scanY + 0.6) % H;
    const scanGrad = ctx.createLinearGradient(0, scanY - 6, 0, scanY + 6);
    scanGrad.addColorStop(0,   'rgba(0,212,255,0)');
    scanGrad.addColorStop(0.5, 'rgba(0,212,255,0.06)');
    scanGrad.addColorStop(1,   'rgba(0,212,255,0)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanY - 6, W, 12);

    requestAnimationFrame(drawFrame);
  }

  function drawHex(ctx, x, y, r, color, alpha) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      i === 0 ? ctx.moveTo(x + Math.cos(a)*r, y + Math.sin(a)*r)
              : ctx.lineTo(x + Math.cos(a)*r, y + Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = alpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(drawFrame);
})();

// ── MAIN BOOT ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Init systems
  Audio.init();
  Settings.load();

  // Audio unlock
  const unlockAudio = () => { Audio.resume(); };
  document.addEventListener('click',      unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('keydown',    unlockAudio, { once: true });

  // Button hover sfx (add to new buttons too via delegation)
  document.addEventListener('mouseenter', e => {
    if (e.target.matches('.btn-primary, .btn-secondary, .team-btn')) Audio.play('uiHover');
  }, true);

  // Connection status indicator
  createConnectionBadge();

  // Connect to server
  Network.connect();

  // Boot log
  console.groupCollapsed('%c ⚡ NEON FRACTURE: QUANTUM ARENA ', 'background:#00d4ff;color:#030810;font-weight:900;padding:4px 12px;font-size:14px;');
  console.log('%cv1.0.0 QUANTUM BUILD', 'color:#00d4ff;font-weight:700;');
  console.log('%cStack: Three.js r157 · Socket.io 4 · Web Audio API', 'color:#888;');
  console.log('%cPress [ESC] to release pointer lock | [TAB] scoreboard', 'color:#888;');
  console.groupEnd();

  // URL room code support — ?room=XXXXXX
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode  = urlParams.get('room');
  if (roomCode) {
    const joinRoomInput = document.getElementById('join-room-id');
    if (joinRoomInput) joinRoomInput.value = roomCode.toUpperCase();
    UI.toastMessage(`Room code ${roomCode} detected! Enter your name and join.`);
    setTimeout(() => UI.showScreen('screen-multiplayer'), 800);
  }
});

// ── CONNECTION STATUS BADGE ────────────────────────────
function createConnectionBadge() {
  const badge = document.createElement('div');
  badge.id = 'conn-badge';
  badge.innerHTML = `<span class="conn-dot"></span><span class="conn-text">CONNECTING</span>`;
  badge.style.cssText = `
    position:fixed;bottom:12px;left:12px;z-index:9999;
    display:flex;align-items:center;gap:6px;
    font-family:'Orbitron',monospace;font-size:0.5rem;letter-spacing:0.12em;
    color:rgba(255,200,0,0.7);pointer-events:none;
  `;
  document.body.appendChild(badge);

  // Poll socket state
  const dot  = badge.querySelector('.conn-dot');
  const text = badge.querySelector('.conn-text');
  dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#ffcc00;box-shadow:0 0 6px #ffcc00;animation:pulse-dot 1.2s infinite;';

  setInterval(() => {
    const ok = Network.isConnected();
    dot.style.background    = ok ? '#39ff14' : '#ff2244';
    dot.style.boxShadow     = ok ? '0 0 6px #39ff14' : '0 0 6px #ff2244';
    text.textContent        = ok ? 'CONNECTED'    : 'OFFLINE';
    badge.style.color       = ok ? 'rgba(57,255,20,0.6)' : 'rgba(255,34,68,0.6)';
  }, 1500);
}
