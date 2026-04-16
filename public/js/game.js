// ═══════════════════════════════════════════════════════
// NEON FRACTURE — GAME LOGIC v3  (BUG-FIXED)
// KEY FIXES:
//  - loop() wraps Renderer.render() in try/catch so a
//    single frame error never kills the entire rAF chain
//  - All Renderer.spawn*() calls guarded with _safeRenderer()
//  - sendInput / setAim / setRotY all exported correctly
//  - flushInput() sends via Network.sendInput() (single path)
//  - Input tick in input.js calls ONLY Network.sendInput()
//    directly, so there's no double-send confusion
// ═══════════════════════════════════════════════════════
const Game = (() => {
  // ── State ─────────────────────────────────────────────
  let myId       = null;
  let myPlayer   = null;
  let gameRunning = false;
  let animFrame  = null;
  let lastState  = null;

  const cooldowns = { dash: 0, freeze: 0, pulse: 0, shield: 0 };
  const COOLDOWN_MS   = { dash: 3000, freeze: 8000, pulse: 5000, shield: 6000 };
  const ENERGY_COST   = { dash: 20,   freeze: 35,   pulse: 30,   shield: 25   };

  let isFiring      = false;
  let fireInterval  = null;
  let aimTarget     = { x: 0, z: 1 };  // normalised aim direction
  let rotY          = 0;

  let respawnTimer    = null;
  let killfeedEntries = [];
  let announcerQueue  = [];
  let announcerBusy   = false;
  let prevLevel       = 1;
  let prevScores      = { A: 0, B: 0 };

  // ── Safe renderer wrapper ─────────────────────────────
  // Calls Renderer.fn() only when Renderer exists and is ready.
  function _vfx(fn, ...args) {
    try {
      if (typeof Renderer !== 'undefined' && typeof Renderer[fn] === 'function') {
        Renderer[fn](...args);
      }
    } catch(e) {
      console.warn('[Game] Renderer.' + fn + '() error:', e.message);
    }
  }

  // ── START ─────────────────────────────────────────────
  function start(playerId) {
    myId        = playerId;
    gameRunning = true;
    cooldowns.dash = cooldowns.freeze = cooldowns.pulse = cooldowns.shield = 0;
    prevLevel  = 1;
    prevScores = { A: 0, B: 0 };
    isFiring   = false;

    try { Audio.startMusic(); } catch(e) {}
    _setupXPBar();
    announce('MATCH START — CAPTURE ENERGY CORES', 'cyan');
    _loop();
  }

  // ── STOP ──────────────────────────────────────────────
  function stop() {
    gameRunning = false;
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    stopFiring();
    try { Renderer.clear(); } catch(e) {}
    myId = null; myPlayer = null; lastState = null;
  }

  // ── GAME LOOP ─────────────────────────────────────────
  function _loop() {
    if (!gameRunning) return;

    // Render — wrapped so a THREE error never breaks the loop
    try { Renderer.render(); } catch(e) {
      console.warn('[Game] render error (non-fatal):', e.message);
    }

    _updateHUD();
    _processAnnouncerQueue();
    animFrame = requestAnimationFrame(_loop);
  }

  // ── GAME STATE (from server) ──────────────────────────
  function onGameState(state) {
    lastState = state;
    if (!myId) return;

    const p = (state.players || []).find(p => p.id === myId);
    if (p) {
      if (p.level > prevLevel) { _onLevelUp(p); prevLevel = p.level; }
      myPlayer = p;
    }

    try { Renderer.syncGameState(state, myId); } catch(e) {
      console.warn('[Game] syncGameState error:', e.message);
    }

    // Update name tag once
    if (myPlayer) {
      const nh = document.getElementById('player-name-hud');
      if (nh && !nh.dataset.set) { nh.textContent = myPlayer.name; nh.dataset.set = '1'; }
    }
  }

  // ── HUD ───────────────────────────────────────────────
  function _updateHUD() {
    if (!myPlayer) return;
    const hp  = Math.max(0, myPlayer.health);
    const en  = Math.max(0, myPlayer.energy);
    const now = Date.now();

    _setBar('bar-health', hp, 100);
    _setBar('bar-energy', en, 100);
    _setText('val-health', Math.ceil(hp));
    _setText('val-energy', Math.ceil(en));

    const hudBottom = document.querySelector('.hud-bottom');
    if (hudBottom) hudBottom.style.borderTop = hp < 30 ? '1px solid rgba(255,34,68,0.4)' : '';

    _setText('level-badge', 'LVL ' + (myPlayer.level || 1));
    _updateXPBar();

    if (lastState) {
      const t = Math.max(0, lastState.matchTime || 0);
      const timeEl = document.getElementById('match-time');
      if (timeEl) {
        timeEl.textContent = `${Math.floor(t/60)}:${(t%60).toString().padStart(2,'0')}`;
        timeEl.style.color = t < 30 ? '#ff2244' : '#fff';
      }
      _setText('score-a', lastState.teamScores?.A || 0);
      _setText('score-b', lastState.teamScores?.B || 0);

      const barSA = document.getElementById('score-bar-a');
      const barSB = document.getElementById('score-bar-b');
      if (barSA) barSA.style.width = Math.min(100, lastState.teamScores?.A || 0) + '%';
      if (barSB) barSB.style.width = Math.min(100, lastState.teamScores?.B || 0) + '%';
    }

    // Ability cooldowns
    ['dash','freeze','pulse','shield'].forEach(ab => {
      const remaining    = Math.max(0, cooldowns[ab] - now);
      const ovEl         = document.getElementById('ov-' + ab);
      const cdEl         = document.getElementById('cd-' + ab);
      const slot         = document.getElementById('ab-' + ab);
      const enoughEnergy = (myPlayer?.energy || 0) >= ENERGY_COST[ab];
      if (remaining > 0) {
        const pct = remaining / COOLDOWN_MS[ab];
        if (ovEl) ovEl.style.clipPath = `inset(${(1-pct)*100}% 0 0 0)`;
        if (cdEl) cdEl.textContent = (remaining/1000).toFixed(1);
        slot?.classList.add('on-cooldown');
        slot?.classList.remove('no-energy');
      } else {
        if (ovEl) ovEl.style.clipPath = 'inset(100% 0 0 0)';
        if (cdEl) cdEl.textContent = '';
        slot?.classList.remove('on-cooldown');
        if (!enoughEnergy) slot?.classList.add('no-energy');
        else slot?.classList.remove('no-energy');
      }
    });

    // Freeze overlay
    document.getElementById('freeze-overlay')
      ?.classList.toggle('hidden', !((myPlayer.frozenUntil || 0) > now));

    // Shield glow
    document.getElementById('ab-shield')
      ?.classList.toggle('shield-active', !!myPlayer.shieldActive);

    _updateMinimap();
  }

  function _setBar(id, val, max) {
    const el = document.getElementById(id);
    if (el) el.style.width = (val / max * 100) + '%';
  }
  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── XP BAR ────────────────────────────────────────────
  let _xpBarEl = null;
  function _setupXPBar() { _xpBarEl = document.getElementById('xp-bar-fill'); }
  function _updateXPBar() {
    if (!myPlayer || !_xpBarEl) return;
    const pct = ((myPlayer.xp || 0) / (myPlayer.level * 100)) * 100;
    _xpBarEl.style.width = Math.min(100, pct) + '%';
  }
  function _onLevelUp(p) {
    announce(`LEVEL UP! NOW LEVEL ${p.level}`, 'gold');
    try { Audio.play('levelUp'); } catch(e) {}
    _vfx('spawnLevelUpEffect', p.x, p.z);
    showFloatText('⬆ LEVEL ' + p.level, 'gold', true);
  }

  // ── MINIMAP ───────────────────────────────────────────
  function _updateMinimap() {
    const canvas = document.getElementById('minimap');
    if (!canvas || !lastState) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, MAP = 100;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,8,20,0.9)'; ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = 'rgba(0,50,100,0.3)'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i*W/4,0); ctx.lineTo(i*W/4,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*H/4); ctx.lineTo(W,i*H/4); ctx.stroke();
    }

    const mm = (wx, wz) => ({ x: (wx/MAP + 0.5)*W, y: (wz/MAP + 0.5)*H });

    ctx.fillStyle = 'rgba(0,100,200,0.06)'; ctx.fillRect(0,0,W*0.31,H);
    ctx.fillStyle = 'rgba(200,80,0,0.06)';  ctx.fillRect(W*0.69,0,W*0.31,H);
    ctx.beginPath(); ctx.arc(W/2,H/2,W*0.1,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(0,200,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();

    (lastState.cores || []).forEach(c => {
      if (!c.active) return;
      const p = mm(c.x, c.z);
      ctx.beginPath(); ctx.arc(p.x,p.y,3.5,0,Math.PI*2);
      ctx.fillStyle = '#ffaa00';
      ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 6;
      ctx.fill(); ctx.shadowBlur = 0;
    });

    (lastState.players || []).forEach(p => {
      if (!p.alive) return;
      const mp    = mm(p.x, p.z);
      const isMe  = p.id === myId;
      const color = p.team === 'A' ? '#00d4ff' : '#ff6b35';
      if (isMe) {
        ctx.save();
        ctx.translate(mp.x, mp.y);
        ctx.rotate(-p.rotY || 0);
        ctx.beginPath();
        ctx.moveTo(0,-6); ctx.lineTo(4,5); ctx.lineTo(0,3); ctx.lineTo(-4,5);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(mp.x,mp.y,3,0,Math.PI*2);
        ctx.fillStyle = color; ctx.fill();
      }
    });

    ctx.strokeStyle = 'rgba(0,212,255,0.25)'; ctx.lineWidth = 1;
    ctx.strokeRect(0,0,W,H);
  }

  // ── SCOREBOARD ────────────────────────────────────────
  function updateScoreboard() {
    if (!lastState) return;
    const sbA = document.getElementById('sb-team-a');
    const sbB = document.getElementById('sb-team-b');
    if (!sbA || !sbB) return;
    sbA.innerHTML = ''; sbB.innerHTML = '';
    const sorted = [...(lastState.players||[])].sort((a,b) => b.score - a.score);
    sorted.forEach(p => {
      const row = document.createElement('div');
      row.className = 'sb-player-row' + (p.id === myId ? ' sb-me' : '');
      row.innerHTML = `<span class="sb-name">${p.name}</span><span>${p.kills}</span><span>${p.deaths}</span><span class="sb-score">${p.score}</span><span class="sb-level">Lv${p.level}</span>`;
      (p.team === 'A' ? sbA : sbB).appendChild(row);
    });
    // Team scores in header
    if (lastState.teamScores) {
      const sa = document.getElementById('sb-ts-a');
      const sb = document.getElementById('sb-ts-b');
      if (sa) sa.textContent = 'ALPHA: ' + (lastState.teamScores.A || 0);
      if (sb) sb.textContent = 'OMEGA: ' + (lastState.teamScores.B || 0);
    }
  }

  // ── KILL FEED ─────────────────────────────────────────
  function addKillfeed(killerName, targetName, killerTeam, ability) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;
    const el   = document.createElement('div');
    el.className = 'kill-entry';
    const kc   = killerTeam === 'A' ? '#00d4ff' : '#ff6b35';
    const tc   = killerTeam === 'A' ? '#ff6b35' : '#00d4ff';
    const icon = ability === 'pulse' ? '◎' : ability === 'freeze' ? '❄' : ability === 'dash' ? '⚡' : '▶';
    el.innerHTML = `<span style="color:${kc}">${killerName}</span> <span class="kf-icon">${icon}</span> <span style="color:${tc}">${targetName}</span>`;
    feed.prepend(el);
    killfeedEntries.push(el);
    if (killfeedEntries.length > 6) killfeedEntries.shift()?.remove();
    setTimeout(() => { el.classList.add('fading'); setTimeout(() => el.remove(), 600); }, 5000);
  }

  // ── ANNOUNCER ─────────────────────────────────────────
  function announce(text, style, duration) {
    announcerQueue.push({ text, style: style || 'cyan', duration: duration || 2800 });
  }
  function _processAnnouncerQueue() {
    if (announcerBusy || announcerQueue.length === 0) return;
    const item = announcerQueue.shift();
    announcerBusy = true;
    let el = document.getElementById('announcer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'announcer'; el.className = 'announcer-msg';
      document.getElementById('hud')?.appendChild(el);
    }
    const cols = { cyan:'#00d4ff', gold:'#ffd700', red:'#ff2244', orange:'#ff6b35', green:'#39ff14' };
    const c    = cols[item.style] || cols.cyan;
    el.textContent = item.text;
    el.style.color = c;
    el.style.textShadow = `0 0 20px ${c}, 0 0 40px ${c}`;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0) scale(1)';
    el.style.display = 'block';
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-20px) scale(0.9)';
      setTimeout(() => { el.style.display = 'none'; announcerBusy = false; }, 400);
    }, item.duration);
  }

  // ── INPUT (buffering layer) ───────────────────────────
  // input.js sends directly via Network.sendInput() on its own
  // 40 ms tick. Game.sendInput() is kept for compatibility but
  // is a no-op pass-through — avoids double-sends.
  function sendInput(input) {
    // intentional no-op — input.js owns the send loop
    // kept so callers don't get "not a function" errors
  }

  // ── FIRING ────────────────────────────────────────────
  function startFiring() {
    if (isFiring) return;
    isFiring = true;
    _doShoot();
    fireInterval = setInterval(_doShoot, 175);
  }

  function stopFiring() {
    isFiring = false;
    if (fireInterval) { clearInterval(fireInterval); fireInterval = null; }
  }

  function _doShoot() {
    if (!myPlayer?.alive) return;
    try { Network.shoot(aimTarget.x, aimTarget.z); } catch(e) {}
    try { Audio.play('shoot'); } catch(e) {}
    _vfx('spawnExplosion', myPlayer.x, 0.6, myPlayer.z,
      myPlayer.team === 'A' ? 0x00d4ff : 0xff6b35, 3);
  }

  // ── AIM ───────────────────────────────────────────────
  function setAim(dx, dz) {
    const mag = Math.sqrt(dx*dx + dz*dz);
    if (mag > 0.01) { aimTarget.x = dx / mag; aimTarget.z = dz / mag; }
  }

  function setRotY(r) { rotY = r; }

  // ── ABILITIES ─────────────────────────────────────────
  function useAbility(ability) {
    const now = Date.now();
    if (cooldowns[ability] > now) {
      showFloatText(ability.toUpperCase() + ' ' + ((cooldowns[ability]-now)/1000).toFixed(1) + 's', 'gray');
      return;
    }
    if (!myPlayer?.alive) return;
    if ((myPlayer.energy || 0) < ENERGY_COST[ability]) {
      showFloatText('LOW ENERGY', 'orange');
      try { Audio.play('uiClick'); } catch(e) {}
      return;
    }
    cooldowns[ability] = now + COOLDOWN_MS[ability];
    try { Network.useAbility(ability); } catch(e) {}
    try { Audio.play(ability); }        catch(e) {}

    const p = myPlayer;
    switch (ability) {
      case 'dash':   _vfx('spawnDashTrail', p.x, 0, p.z, p.team); showFloatText('QUANTUM DASH', 'cyan'); break;
      case 'freeze': _vfx('spawnFreezeEffect', p.x, p.z);          showFloatText('TIME FREEZE', 'blue'); break;
      case 'pulse':  _vfx('spawnExplosion', p.x, 0.5, p.z, 0xff6600, 20); showFloatText('ENERGY PULSE', 'orange'); break;
      case 'shield': showFloatText('SHIELD ACTIVE', 'cyan'); break;
    }
  }

  // ── EVENT HANDLERS (from Network) ─────────────────────
  function onPlayerHit(data) {
    if (data.targetId === myId) {
      const flash = document.getElementById('hit-flash');
      if (flash) { flash.style.opacity = '1'; setTimeout(() => flash.style.opacity = '0', 120); }
      _vfx('shake', 0.35);
      try { Audio.play('hit'); } catch(e) {}
    }
    _vfx('spawnExplosion', data.x, 0.5, data.z, 0xff2244, 8);
    if (data.targetId === myId || data.sourceId === myId) {
      _showDamageNumber(data.damage, data.x, data.z);
    }
  }

  function onPlayerKilled(data) {
    const victim = (lastState?.players || []).find(p => p.id === data.playerId);
    const killer = (lastState?.players || []).find(p => p.id === data.killerId);
    const vName  = victim?.name || 'OPERATOR';
    const kName  = killer?.name || 'OPERATOR';
    const kTeam  = killer?.team || 'A';

    if (data.playerId === myId) {
      try { Audio.play('death'); } catch(e) {}
      _vfx('shake', 0.9);
      _showRespawnOverlay();
      if (killer) announce('ELIMINATED BY ' + kName.toUpperCase(), 'red');
    }
    if (data.killerId === myId) {
      announce(vName.toUpperCase() + ' ELIMINATED', 'green');
      showFloatText('+25 XP  KILL', 'green', true);
    }

    addKillfeed(kName, vName, kTeam, data.ability || null);
    _vfx('spawnExplosion', data.x, 0.5, data.z, 0xff4400, 30);
  }

  function onCoreCaptured(data) {
    const core = (lastState?.cores || []).find(c => c.id === data.coreId);
    if (core) _vfx('spawnCaptureEffect', core.x, core.z);
    try { Audio.play('coreCapture'); } catch(e) {}
    const teamName = data.team === 'A' ? 'ALPHA' : 'OMEGA';
    announce('TEAM ' + teamName + ' CAPTURED A CORE  +10', data.team === 'A' ? 'cyan' : 'orange');
    if (myPlayer?.team === data.team) showFloatText('+10 CORE CAPTURE', 'cyan', true);
  }

  function onAbilityUsed(data) {
    if (data.playerId === myId) return;
    const color = data.ability==='freeze'?0x00aaff:data.ability==='pulse'?0xff6600:data.ability==='shield'?0x00ffff:0x00ff88;
    _vfx('spawnExplosion', data.x, 0.5, data.z, color, 10);
    if (data.ability === 'freeze') _vfx('spawnFreezeEffect', data.x, data.z);
    if (data.ability === 'shield') _vfx('spawnShieldBreak', data.x, data.z, data.team || 'A');
  }

  function onPowerupPickup(data) {
    const msg = data.type==='health'?'HEALTH RESTORED':data.type==='speed'?'SPEED BOOST':'AMMO BOOST';
    showFloatText('⬆ ' + msg, 'green', true);
    _vfx('spawnCaptureEffect', data.x || 0, data.z || 0);
    try { Audio.play('powerup'); } catch(e) {}
  }

  // ── RESPAWN ───────────────────────────────────────────
  function _showRespawnOverlay() {
    const overlay = document.getElementById('respawn-overlay');
    const timerEl = document.getElementById('respawn-timer');
    overlay?.classList.remove('hidden');
    let t = 4;
    if (timerEl) timerEl.textContent = t;
    if (respawnTimer) clearInterval(respawnTimer);
    respawnTimer = setInterval(() => {
      t--;
      if (timerEl) timerEl.textContent = Math.max(0, t);
      if (t <= 0) { clearInterval(respawnTimer); overlay?.classList.add('hidden'); }
    }, 1000);
  }

  // ── DAMAGE NUMBERS ────────────────────────────────────
  function _showDamageNumber(dmg, wx, wz) {
    const el  = document.createElement('div');
    el.className = 'damage-number';
    el.textContent = '-' + dmg;
    const cx  = window.innerWidth / 2, cy = window.innerHeight * 0.5;
    const offX = (wx - (myPlayer?.x || 0)) * 13;
    const offY = (wz - (myPlayer?.z || 0)) * 9;
    el.style.left = Math.max(50, Math.min(window.innerWidth-50, cx+offX)) + 'px';
    el.style.top  = Math.max(50, Math.min(window.innerHeight-100, cy+offY-30)) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ── FLOAT TEXT ────────────────────────────────────────
  function showFloatText(text, style, centered) {
    const el   = document.createElement('div');
    el.className = 'float-text';
    const cols = { cyan:'#00d4ff', gold:'#ffd700', red:'#ff2244', orange:'#ff6b35', green:'#39ff14', blue:'#88eeff', gray:'#888' };
    const c    = cols[style] || cols.cyan;
    el.textContent = text;
    el.style.color = c;
    el.style.textShadow = '0 0 10px ' + c;
    if (centered) {
      el.style.left     = (window.innerWidth/2 - 100) + 'px';
      el.style.top      = (window.innerHeight * 0.65) + 'px';
      el.style.fontSize = '1.1rem';
      el.style.fontWeight = '700';
    } else {
      el.style.left = (20 + Math.random() * 160) + 'px';
      el.style.top  = (window.innerHeight - 250 + Math.random() * 60) + 'px';
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // ── RESET COOLDOWNS ───────────────────────────────────
  function resetCooldowns() {
    Object.keys(cooldowns).forEach(k => cooldowns[k] = 0);
  }

  // ── PUBLIC API ────────────────────────────────────────
  return {
    // Lifecycle
    start,
    stop,

    // Server events
    onGameState,
    onPlayerHit,
    onPlayerKilled,
    onCoreCaptured,
    onAbilityUsed,
    onPowerupPickup,

    // Input interface — ALL required by input.js and mobile.js
    sendInput,       // no-op but exported to prevent "not a function"
    setAim,          // called by input.js mouse handler
    setRotY,         // called by input.js and mobile.js
    startFiring,
    stopFiring,
    useAbility,

    // HUD
    updateScoreboard,
    addKillfeed,
    announce,
    showFloatText,

    // Queries
    getMyPlayer:  () => myPlayer,
    getLastState: () => lastState,
    isRunning:    () => gameRunning,

    // Utility
    resetCooldowns
  };
})();
