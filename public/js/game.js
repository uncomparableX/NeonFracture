// ═══════════════════════════════════════════════════════
//  NEON FRACTURE — GAME LOGIC  (Complete v4)
//  FIXED: timer sync, combat feedback, all ability events,
//         HUD, minimap, announcer, float text
// ═══════════════════════════════════════════════════════
const Game = (() => {
  let myId       = null;
  let myPlayer   = null;
  let gameRunning = false;
  let animFrame  = null;
  let lastState  = null;

  // Ability cooldowns (CLIENT-SIDE DISPLAY ONLY — server is authoritative)
  const cdDisplay   = { dash: 0, freeze: 0, pulse: 0, shield: 0 };
  const CD_MS       = { dash: 3000, freeze: 8000, pulse: 5000, shield: 6000 };
  const ENERGY_COST = { dash: 20,   freeze: 35,   pulse: 30,   shield: 25  };

  let isFiring     = false;
  let fireInterval = null;
  let aimDir       = { x: 0, z: 1 };  // normalised aim vector

  let respawnTimer    = null;
  let killfeedEntries = [];
  let announceQueue   = [];
  let announceBusy    = false;

  let prevLevel  = 1;
  let _xpBarEl   = null;

  // ── Safe call helpers ─────────────────────────────────
  function _vfx(fn, ...args) {
    try {
      if (typeof Renderer !== 'undefined' && typeof Renderer[fn] === 'function') Renderer[fn](...args);
    } catch(e) { /* non-fatal */ }
  }
  function _audio(name) {
    try { if (typeof Audio !== 'undefined' && typeof Audio.play === 'function') Audio.play(name); } catch(e) {}
  }

  // ── START ─────────────────────────────────────────────
  function start(playerId) {
    myId         = playerId;
    gameRunning  = true;
    prevLevel    = 1;
    isFiring     = false;
    cdDisplay.dash = cdDisplay.freeze = cdDisplay.pulse = cdDisplay.shield = 0;

    _xpBarEl = document.getElementById('xp-bar-fill');
    try { Audio.startMusic(); } catch(e) {}
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

  // ── RENDER LOOP ───────────────────────────────────────
  function _loop() {
    if (!gameRunning) return;
    try { Renderer.render(); } catch(e) { console.warn('[Game] render skip:', e.message); }
    _updateHUD();
    _processAnnounceQueue();
    animFrame = requestAnimationFrame(_loop);
  }

  // ── SERVER STATE SYNC ─────────────────────────────────
  function onGameState(state) {
    lastState = state;
    if (!myId) return;

    const me = (state.players || []).find(p => p.id === myId);
    if (me) {
      if (me.level > prevLevel) { _onLevelUp(me); prevLevel = me.level; }
      myPlayer = me;

      // Sync server cooldowns to display (server tells us real remaining time)
      if (me.cooldowns) {
        const now = Date.now();
        Object.keys(cdDisplay).forEach(ab => {
          const serverCD = me.cooldowns[ab] || 0;
          // Only update display if server says it's longer than local
          if (serverCD > cdDisplay[ab]) cdDisplay[ab] = serverCD;
        });
      }
    }

    try { Renderer.syncGameState(state, myId); } catch(e) {
      console.warn('[Game] syncGameState err:', e.message);
    }

    // Update player name HUD once
    if (myPlayer) {
      const nh = document.getElementById('player-name-hud');
      if (nh && !nh.dataset.set) { nh.textContent = myPlayer.name; nh.dataset.set = '1'; }
    }
  }

  // ── HUD UPDATE ────────────────────────────────────────
  function _updateHUD() {
    if (!myPlayer) return;
    const hp  = Math.max(0, myPlayer.health);
    const en  = Math.max(0, myPlayer.energy);
    const now = Date.now();

    // Health / energy bars
    _pct('bar-health', hp / 100);
    _pct('bar-energy', en / 100);
    _text('val-health', Math.ceil(hp));
    _text('val-energy', Math.ceil(en));

    // Critical health pulse
    const hudBtm = document.querySelector('.hud-bottom');
    if (hudBtm) hudBtm.style.boxShadow = hp < 30 ? '0 0 20px rgba(255,34,68,0.4) inset' : '';

    // Level badge + XP bar
    _text('level-badge', 'LVL ' + (myPlayer.level || 1));
    if (_xpBarEl) {
      const pct = ((myPlayer.xp || 0) / ((myPlayer.level || 1) * 100)) * 100;
      _xpBarEl.style.width = Math.min(100, pct) + '%';
    }

    // Match timer — read directly from server state so it's always accurate
    if (lastState) {
      const t  = Math.max(0, lastState.matchTime || 0);
      const m  = Math.floor(t / 60);
      const s  = t % 60;
      const el = document.getElementById('match-time');
      if (el) {
        el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        el.style.color = t <= 30 ? '#ff2244' : '#ffffff';
      }

      // Team scores
      _text('score-a', lastState.teamScores?.A || 0);
      _text('score-b', lastState.teamScores?.B || 0);
      const barA = document.getElementById('score-bar-a');
      const barB = document.getElementById('score-bar-b');
      if (barA) barA.style.width = Math.min(100, lastState.teamScores?.A || 0) + '%';
      if (barB) barB.style.width = Math.min(100, lastState.teamScores?.B || 0) + '%';
    }

    // Ability cooldown display
    ['dash', 'freeze', 'pulse', 'shield'].forEach(ab => {
      const remaining    = Math.max(0, cdDisplay[ab] - now);
      const ovEl         = document.getElementById('ov-' + ab);
      const cdEl         = document.getElementById('cd-' + ab);
      const slot         = document.getElementById('ab-' + ab);
      const hasEnergy    = (myPlayer?.energy || 0) >= ENERGY_COST[ab];

      if (remaining > 0) {
        const pct = remaining / CD_MS[ab];
        if (ovEl) ovEl.style.clipPath = `inset(${(1-pct)*100}% 0 0 0)`;
        if (cdEl) cdEl.textContent = (remaining / 1000).toFixed(1);
        slot?.classList.add('on-cooldown');
        slot?.classList.remove('no-energy');
      } else {
        if (ovEl) ovEl.style.clipPath = 'inset(100% 0 0 0)';
        if (cdEl) cdEl.textContent = '';
        slot?.classList.remove('on-cooldown');
        if (!hasEnergy) slot?.classList.add('no-energy');
        else slot?.classList.remove('no-energy');
      }
    });

    // Freeze overlay
    document.getElementById('freeze-overlay')
      ?.classList.toggle('hidden', !((myPlayer.frozenUntil || 0) > now));

    // Shield glow on button
    document.getElementById('ab-shield')
      ?.classList.toggle('shield-active', !!myPlayer.shieldActive);

    _updateMinimap();
  }

  function _pct(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, Math.min(1, pct)) * 100 + '%';
  }
  function _text(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── MINIMAP ───────────────────────────────────────────
  function _updateMinimap() {
    const canvas = document.getElementById('minimap');
    if (!canvas || !lastState) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, MAP = 96;
    ctx.clearRect(0, 0, W, H);

    // BG
    ctx.fillStyle = 'rgba(0,6,18,0.92)'; ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(0,50,100,0.35)'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i*W/4,0); ctx.lineTo(i*W/4,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*H/4); ctx.lineTo(W,i*H/4); ctx.stroke();
    }

    // Team zones
    ctx.fillStyle = 'rgba(0,100,200,0.07)'; ctx.fillRect(0, 0, W*0.3, H);
    ctx.fillStyle = 'rgba(200,80,0,0.07)';  ctx.fillRect(W*0.7, 0, W*0.3, H);

    const mm = (wx, wz) => ({ x: (wx / MAP + 0.5) * W, y: (wz / MAP + 0.5) * H });

    // Centre ring
    ctx.beginPath(); ctx.arc(W/2, H/2, W*0.08, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(0,200,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();

    // Boundary box
    ctx.strokeStyle = 'rgba(0,150,255,0.4)'; ctx.lineWidth = 1.5;
    const bx = mm(-46, -46), bx2 = mm(46, 46);
    ctx.strokeRect(bx.x, bx.y, bx2.x - bx.x, bx2.y - bx.y);

    // Cores
    (lastState.cores || []).forEach(c => {
      if (!c.active) return;
      const p = mm(c.x, c.z);
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
      ctx.fillStyle = '#ffaa00'; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 6;
      ctx.fill(); ctx.shadowBlur = 0;
    });

    // Players
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
        ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
        ctx.closePath();
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 14;
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(mp.x, mp.y, 3, 0, Math.PI*2);
        ctx.fillStyle = color; ctx.fill();
      }
    });

    // Border
    ctx.strokeStyle = 'rgba(0,212,255,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);
  }

  // ── SCOREBOARD ────────────────────────────────────────
  function updateScoreboard() {
    if (!lastState) return;
    const sbA = document.getElementById('sb-team-a');
    const sbB = document.getElementById('sb-team-b');
    if (!sbA || !sbB) return;
    sbA.innerHTML = ''; sbB.innerHTML = '';

    const sorted = [...(lastState.players||[])].sort((a,b)=>b.score-a.score);
    sorted.forEach(p => {
      const row = document.createElement('div');
      row.className = 'sb-player-row' + (p.id===myId?' sb-me':'');
      row.innerHTML = `<span class="sb-name">${p.name}</span><span>${p.kills}</span><span>${p.deaths}</span><span class="sb-score">${p.score}</span><span class="sb-level">Lv${p.level}</span>`;
      (p.team === 'A' ? sbA : sbB).appendChild(row);
    });

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
    setTimeout(() => { el.classList.add('fading'); setTimeout(()=>el.remove(),600); }, 5000);
  }

  // ── ANNOUNCER ─────────────────────────────────────────
  function announce(text, style, duration) {
    announceQueue.push({ text, style: style||'cyan', duration: duration||2800 });
  }

  function _processAnnounceQueue() {
    if (announceBusy || announceQueue.length === 0) return;
    const item = announceQueue.shift();
    announceBusy = true;

    let el = document.getElementById('announcer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'announcer'; el.className = 'announcer-msg';
      document.getElementById('hud')?.appendChild(el);
    }
    const COLS = { cyan:'#00d4ff', gold:'#ffd700', red:'#ff2244', orange:'#ff6b35', green:'#39ff14' };
    const c    = COLS[item.style] || COLS.cyan;
    el.textContent = item.text;
    el.style.color = c;
    el.style.textShadow = `0 0 20px ${c}, 0 0 40px ${c}`;
    el.style.opacity = '1'; el.style.display = 'block';
    el.style.transform = 'translateY(0) scale(1)';
    setTimeout(() => {
      el.style.opacity = '0'; el.style.transform = 'translateY(-16px) scale(0.9)';
      setTimeout(() => { el.style.display = 'none'; announceBusy = false; }, 400);
    }, item.duration);
  }

  // ── INPUT (stub kept for compatibility) ───────────────
  // input.js calls Network.sendInput() directly — this is fine
  function sendInput(input) { /* intentional no-op */ }

  // ── AIM ───────────────────────────────────────────────
  function setAim(dx, dz) {
    const mag = Math.sqrt(dx*dx + dz*dz);
    if (mag > 0.01) { aimDir.x = dx/mag; aimDir.z = dz/mag; }
  }

  function setRotY(r) { /* rotY stored in input.js — no extra state needed */ }

  // ── FIRING ────────────────────────────────────────────
  function startFiring() {
    if (isFiring) return;
    isFiring = true;
    _doShoot();
    fireInterval = setInterval(_doShoot, 170);
  }

  function stopFiring() {
    isFiring = false;
    if (fireInterval) { clearInterval(fireInterval); fireInterval = null; }
  }

  function _doShoot() {
    if (!myPlayer?.alive) return;
    try { Network.shoot(aimDir.x, aimDir.z); } catch(e) {}
    _audio('shoot');
    // Local muzzle flash
    _vfx('spawnExplosion', myPlayer.x, 0.6, myPlayer.z,
      myPlayer.team === 'A' ? 0x00aaff : 0xff6600, 4);
  }

  // ── ABILITIES ─────────────────────────────────────────
  function useAbility(ability) {
    const now = Date.now();

    // Check local cooldown display first (fast feedback)
    if (cdDisplay[ability] > now) {
      showFloatText(ability.toUpperCase() + ' ' + ((cdDisplay[ability]-now)/1000).toFixed(1) + 's', 'gray');
      return;
    }
    if (!myPlayer?.alive) return;
    if ((myPlayer.energy || 0) < ENERGY_COST[ability]) {
      showFloatText('LOW ENERGY', 'orange'); _audio('uiClick'); return;
    }

    // Optimistic local cooldown (server will confirm)
    cdDisplay[ability] = now + CD_MS[ability];

    try { Network.useAbility(ability); } catch(e) {}
    _audio(ability);

    // Local visual feedback
    if (!myPlayer) return;
    switch (ability) {
      case 'dash':
        _vfx('spawnDashTrail', myPlayer.x, 0, myPlayer.z, myPlayer.team);
        showFloatText('QUANTUM DASH', 'cyan'); break;
      case 'freeze':
        _vfx('spawnFreezeEffect', myPlayer.x, myPlayer.z);
        showFloatText('TIME FREEZE', 'blue'); break;
      case 'pulse':
        _vfx('spawnExplosion', myPlayer.x, 0.5, myPlayer.z, 0xff6600, 22);
        showFloatText('ENERGY PULSE', 'orange'); break;
      case 'shield':
        showFloatText('SHIELD ACTIVE', 'cyan'); break;
    }
  }

  // ── SERVER EVENTS ─────────────────────────────────────
  function onPlayerHit(data) {
    if (data.targetId === myId) {
      const flash = document.getElementById('hit-flash');
      if (flash) { flash.style.opacity = '1'; setTimeout(()=>flash.style.opacity='0', 130); }
      _vfx('shake', data.shielded ? 0.15 : 0.4);
      _audio('hit');
    }
    _vfx('spawnExplosion', data.x, 0.5, data.z, data.shielded ? 0x0088ff : 0xff2244, 8);
    if (data.targetId === myId || data.sourceId === myId) {
      _showDmgNumber(data.damage, data.x, data.z, data.shielded);
    }
  }

  function onPlayerKilled(data) {
    const victim = (lastState?.players||[]).find(p=>p.id===data.playerId);
    const killer = (lastState?.players||[]).find(p=>p.id===data.killerId);
    const vName  = victim?.name || 'OPERATOR';
    const kName  = killer?.name || 'OPERATOR';
    const kTeam  = killer?.team || 'A';

    if (data.playerId === myId) {
      _audio('death'); _vfx('shake', 1.0);
      _showRespawnOverlay();
      if (killer) announce(`ELIMINATED BY ${kName.toUpperCase()}`, 'red');
    }
    if (data.killerId === myId) {
      announce(`${vName.toUpperCase()} ELIMINATED`, 'green');
      showFloatText('+25 XP   KILL!', 'green', true);
    }

    addKillfeed(kName, vName, kTeam, data.ability);
    _vfx('spawnExplosion', data.x, 0.5, data.z, 0xff4400, 32);
  }

  function onCoreCaptured(data) {
    const core = (lastState?.cores||[]).find(c=>c.id===data.coreId);
    if (core) _vfx('spawnCaptureEffect', core.x, core.z);
    _audio('coreCapture');
    const tName = data.team==='A' ? 'ALPHA' : 'OMEGA';
    announce(`TEAM ${tName} CAPTURED A CORE  +10`, data.team==='A'?'cyan':'orange');
    if (myPlayer?.team === data.team) showFloatText('+10 CORE CAPTURED', 'cyan', true);
  }

  function onAbilityUsed(data) {
    if (data.playerId === myId) return; // own effects done locally
    const color = data.ability==='freeze'?0x00aaff : data.ability==='pulse'?0xff6600 :
                  data.ability==='shield'?0x00ffff : 0x00ff88;
    _vfx('spawnExplosion', data.x, 0.5, data.z, color, 12);
    if (data.ability==='freeze') _vfx('spawnFreezeEffect', data.x, data.z);
    if (data.ability==='shield') _vfx('spawnShieldBreak', data.x, data.z);
  }

  function onPowerupPickup(data) {
    const msgs = { health: 'HEALTH RESTORED +45', speed: 'SPEED BOOST  7s', ammo: 'AMMO BOOST  8s' };
    showFloatText('⬆ ' + (msgs[data.type] || 'PICKUP'), 'green', true);
    _vfx('spawnCaptureEffect', data.x||0, data.z||0);
    _audio('powerup');
  }

  // ── RESPAWN OVERLAY ───────────────────────────────────
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
  function _showDmgNumber(dmg, wx, wz, shielded) {
    const el  = document.createElement('div');
    el.className = 'damage-number';
    el.textContent = (shielded ? '🛡' : '-') + dmg;
    el.style.color = shielded ? '#00ffff' : dmg > 18 ? '#ff4444' : '#ffaa00';
    const cx  = window.innerWidth / 2, cy = window.innerHeight * 0.5;
    const ox  = (wx - (myPlayer?.x||0)) * 14;
    const oy  = (wz - (myPlayer?.z||0)) * 10;
    el.style.left = Math.max(50, Math.min(window.innerWidth-50, cx+ox)) + 'px';
    el.style.top  = Math.max(50, Math.min(window.innerHeight-100, cy+oy-30)) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ── FLOAT TEXT ────────────────────────────────────────
  function showFloatText(text, style, centered) {
    const el   = document.createElement('div');
    el.className = 'float-text';
    const COLS = { cyan:'#00d4ff', gold:'#ffd700', red:'#ff2244', orange:'#ff6b35',
                   green:'#39ff14', blue:'#88eeff', gray:'#888', purple:'#cc00ff' };
    const c    = COLS[style] || COLS.cyan;
    el.textContent = text; el.style.color = c;
    el.style.textShadow = `0 0 10px ${c}`;
    if (centered) {
      el.style.left     = (window.innerWidth/2 - 110) + 'px';
      el.style.top      = (window.innerHeight * 0.64) + 'px';
      el.style.fontSize = '1.15rem';
      el.style.fontWeight = '700';
    } else {
      el.style.left = (20 + Math.random()*180) + 'px';
      el.style.top  = (window.innerHeight - 260 + Math.random()*60) + 'px';
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // ── LEVEL UP ──────────────────────────────────────────
  function _onLevelUp(p) {
    announce(`LEVEL UP!  NOW LEVEL ${p.level}`, 'gold', 3200);
    _audio('levelUp');
    _vfx('spawnLevelUpEffect', p.x, p.z);
    showFloatText('⬆ LEVEL ' + p.level, 'gold', true);
  }

  // ── RESET ─────────────────────────────────────────────
  function resetCooldowns() {
    cdDisplay.dash = cdDisplay.freeze = cdDisplay.pulse = cdDisplay.shield = 0;
  }

  // ── PUBLIC API ────────────────────────────────────────
  return {
    start, stop,
    onGameState, onPlayerHit, onPlayerKilled,
    onCoreCaptured, onAbilityUsed, onPowerupPickup,
    sendInput,       // no-op — kept for compatibility
    setAim, setRotY,
    startFiring, stopFiring,
    useAbility,
    updateScoreboard, addKillfeed,
    announce, showFloatText,
    resetCooldowns,
    getMyPlayer:  () => myPlayer,
    getLastState: () => lastState,
    isRunning:    () => gameRunning
  };
})();
