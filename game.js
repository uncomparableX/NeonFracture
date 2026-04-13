// ═══════════════════════════════════════════════════════
// NEON FRACTURE — GAME LOGIC v2
// Kill feed, XP popups, announcer, powerups, full HUD
// ═══════════════════════════════════════════════════════
const Game = (() => {
  let myId = null, myPlayer = null;
  let gameRunning = false;
  let animFrame = null;
  let lastState = null;

  const cooldowns = { dash: 0, freeze: 0, pulse: 0, shield: 0 };
  const COOLDOWN_DURATIONS = { dash: 3000, freeze: 8000, pulse: 5000, shield: 6000 };
  const ABILITY_ENERGY_COST = { dash: 20, freeze: 35, pulse: 30, shield: 25 };

  let isFiring = false;
  let fireInterval = null;
  let aimTarget = { x: 0, z: 1 };
  let rotY = 0;
  let respawnCountdown = null;
  let killfeedEntries = [];
  let announcerQueue = [];
  let announcerBusy = false;
  let xpBarEl = null;
  let prevLevel = 1;
  let prevScores = { A: 0, B: 0 };
  let lastInputSent = 0;
  let pendingInput = null;

  // ─── START / STOP ──────────────────────────────────────
  function start(playerId) {
    myId = playerId;
    gameRunning = true;
    cooldowns.dash = cooldowns.freeze = cooldowns.pulse = cooldowns.shield = 0;
    prevLevel = 1;
    prevScores = { A: 0, B: 0 };
    Audio.startMusic();
    setupXPBar();
    announce('MATCH START — CAPTURE ENERGY CORES', 'cyan');
    loop();
  }

  function stop() {
    gameRunning = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    stopFiring();
    Renderer.clear();
    myId = null; myPlayer = null; lastState = null;
  }

  function loop() {
    if (!gameRunning) return;
    Renderer.render();
    updateHUD();
    flushInput();
    animFrame = requestAnimationFrame(loop);
  }

  // ─── STATE SYNC ────────────────────────────────────────
  function onGameState(state) {
    lastState = state;
    if (!myId) return;
    const p = state.players.find(p => p.id === myId);
    if (p) {
      // Level up detection
      if (p.level > prevLevel) {
        onLevelUp(p);
        prevLevel = p.level;
      }
      myPlayer = p;
    }
    // Score change detection
    if (state.teamScores) {
      if (state.teamScores.A > prevScores.A) prevScores.A = state.teamScores.A;
      if (state.teamScores.B > prevScores.B) prevScores.B = state.teamScores.B;
    }
    Renderer.syncGameState(state, myId);
    // Update name HUD once
    if (myPlayer) {
      const nh = document.getElementById('player-name-hud');
      if (nh && !nh.dataset.set) { nh.textContent = myPlayer.name; nh.dataset.set = '1'; }
    }
  }

  // ─── HUD UPDATE ────────────────────────────────────────
  function updateHUD() {
    if (!myPlayer) return;
    const hp = Math.max(0, myPlayer.health);
    const en = Math.max(0, myPlayer.energy);
    const now = Date.now();

    // Bars
    setBar('bar-health', hp, 100);
    setBar('bar-energy', en, 100);
    setVal('val-health', Math.ceil(hp));
    setVal('val-energy', Math.ceil(en));

    // Critical health warning
    const hudBottom = document.querySelector('.hud-bottom');
    if (hudBottom) hudBottom.style.borderTop = hp < 30 ? '1px solid rgba(255,34,68,0.4)' : '';

    // Level & XP
    document.getElementById('level-badge').textContent = 'LVL ' + (myPlayer.level || 1);
    updateXPBar();

    // Match time
    if (lastState) {
      const t = Math.max(0, lastState.matchTime || 0);
      const m = Math.floor(t / 60), s = t % 60;
      const timeEl = document.getElementById('match-time');
      if (timeEl) {
        timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        timeEl.style.color = t < 30 ? '#ff2244' : '#fff';
      }
      setVal('score-a', lastState.teamScores?.A || 0);
      setVal('score-b', lastState.teamScores?.B || 0);

      // Score bar fill (out of 100)
      const pctA = Math.min(100, (lastState.teamScores?.A || 0));
      const pctB = Math.min(100, (lastState.teamScores?.B || 0));
      const barSA = document.getElementById('score-bar-a');
      const barSB = document.getElementById('score-bar-b');
      if (barSA) barSA.style.width = pctA + '%';
      if (barSB) barSB.style.width = pctB + '%';
    }

    // Cooldowns
    ['dash','freeze','pulse','shield'].forEach(ab => {
      const remaining = Math.max(0, cooldowns[ab] - now);
      const ovEl = document.getElementById(`ov-${ab}`);
      const cdEl = document.getElementById(`cd-${ab}`);
      const slot  = document.getElementById(`ab-${ab}`);
      const enoughEnergy = (myPlayer?.energy || 0) >= ABILITY_ENERGY_COST[ab];
      if (remaining > 0) {
        const pct = remaining / COOLDOWN_DURATIONS[ab];
        if (ovEl) ovEl.style.clipPath = `inset(${(1-pct)*100}% 0 0 0)`;
        if (cdEl) cdEl.textContent = (remaining/1000).toFixed(1);
        slot?.classList.add('on-cooldown'); slot?.classList.remove('no-energy');
      } else {
        if (ovEl) ovEl.style.clipPath = 'inset(100% 0 0 0)';
        if (cdEl) cdEl.textContent = '';
        slot?.classList.remove('on-cooldown');
        if (!enoughEnergy) slot?.classList.add('no-energy');
        else slot?.classList.remove('no-energy');
      }
    });

    // Freeze overlay
    const isFrozen = (myPlayer.frozenUntil || 0) > now;
    document.getElementById('freeze-overlay')?.classList.toggle('hidden', !isFrozen);

    // Shield ring pulse
    if (myPlayer.shieldActive) {
      document.getElementById('ab-shield')?.classList.add('shield-active');
    } else {
      document.getElementById('ab-shield')?.classList.remove('shield-active');
    }

    updateMinimap();
    processAnnouncerQueue();
  }

  function setBar(id, val, max) {
    const el = document.getElementById(id);
    if (el) el.style.width = (val / max * 100) + '%';
  }
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── XP BAR ────────────────────────────────────────────
  function setupXPBar() {
    xpBarEl = document.getElementById('xp-bar-fill');
  }
  function updateXPBar() {
    if (!myPlayer || !xpBarEl) return;
    const needed = myPlayer.level * 100;
    const pct = ((myPlayer.xp || 0) / needed * 100);
    xpBarEl.style.width = Math.min(100, pct) + '%';
  }
  function onLevelUp(p) {
    announce(`LEVEL UP! YOU ARE NOW LEVEL ${p.level}`, 'gold');
    Audio.play('coreCapture');
    Renderer.spawnLevelUpEffect(p.x, p.z);
    showFloatText(`⬆ LEVEL ${p.level}`, 'gold', true);
  }

  // ─── MINIMAP ───────────────────────────────────────────
  function updateMinimap() {
    const canvas = document.getElementById('minimap');
    if (!canvas || !lastState) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, MAP = 100;
    ctx.clearRect(0, 0, W, H);

    // BG
    ctx.fillStyle = 'rgba(0,8,20,0.9)'; ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(0,50,100,0.3)'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i*W/4,0); ctx.lineTo(i*W/4,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*H/4); ctx.lineTo(W,i*H/4); ctx.stroke();
    }

    const mm = (wx, wz) => ({ x: (wx/MAP+0.5)*W, y: (wz/MAP+0.5)*H });

    // Team zones
    ctx.fillStyle = 'rgba(0,100,200,0.06)'; ctx.fillRect(0, 0, W*0.31, H);
    ctx.fillStyle = 'rgba(200,80,0,0.06)';  ctx.fillRect(W*0.69, 0, W*0.31, H);

    // Center ring
    ctx.beginPath(); ctx.arc(W/2,H/2,W*0.1,0,Math.PI*2);
    ctx.strokeStyle='rgba(0,200,255,0.25)'; ctx.lineWidth=1; ctx.stroke();

    // Cores
    lastState.cores?.forEach(c => {
      if (!c.active) return;
      const p = mm(c.x, c.z);
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
      ctx.fillStyle = '#ffaa00';
      ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 6;
      ctx.fill(); ctx.shadowBlur = 0;
    });

    // Players
    lastState.players?.forEach(p => {
      if (!p.alive) return;
      const mp = mm(p.x, p.z);
      const isMe = p.id === myId;
      const color = p.team === 'A' ? '#00d4ff' : '#ff6b35';
      ctx.beginPath();
      if (isMe) {
        // Arrow for my player
        ctx.save();
        ctx.translate(mp.x, mp.y);
        ctx.rotate(-p.rotY || 0);
        ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 3); ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.restore();
      } else {
        ctx.arc(mp.x, mp.y, 3, 0, Math.PI*2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    });

    // Border
    ctx.strokeStyle = 'rgba(0,212,255,0.25)'; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);
  }

  // ─── SCOREBOARD ────────────────────────────────────────
  function updateScoreboard() {
    if (!lastState) return;
    const sbA = document.getElementById('sb-team-a');
    const sbB = document.getElementById('sb-team-b');
    if (!sbA||!sbB) return;
    sbA.innerHTML=''; sbB.innerHTML='';
    const sorted = [...(lastState.players||[])].sort((a,b)=>b.score-a.score);
    sorted.forEach(p => {
      const row = document.createElement('div');
      row.className = 'sb-player-row' + (p.id===myId?' sb-me':'');
      row.innerHTML = `
        <span class="sb-name">${p.name}</span>
        <span title="Kills">${p.kills}</span>
        <span title="Deaths">${p.deaths}</span>
        <span title="Score" class="sb-score">${p.score}</span>
        <span class="sb-level">Lv${p.level}</span>
      `;
      (p.team==='A'?sbA:sbB).appendChild(row);
    });
  }

  // ─── KILL FEED ─────────────────────────────────────────
  function addKillfeed(killerName, targetName, killerTeam, ability) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;
    const el = document.createElement('div');
    el.className = 'kill-entry';
    const kc = killerTeam==='A'?'#00d4ff':'#ff6b35';
    const tc = killerTeam==='A'?'#ff6b35':'#00d4ff';
    const icon = ability==='pulse'?'◎':ability==='freeze'?'❄':ability==='dash'?'⚡':'▶';
    el.innerHTML = `<span style="color:${kc}">${killerName}</span> <span class="kf-icon">${icon}</span> <span style="color:${tc}">${targetName}</span>`;
    feed.prepend(el);
    killfeedEntries.push(el);
    if (killfeedEntries.length > 6) { killfeedEntries.shift()?.remove(); }
    setTimeout(()=>{ el.classList.add('fading'); setTimeout(()=>el.remove(),600); }, 5000);
  }

  // ─── ANNOUNCER ─────────────────────────────────────────
  function announce(text, style='cyan', duration=2800) {
    announcerQueue.push({ text, style, duration });
  }

  function processAnnouncerQueue() {
    if (announcerBusy || announcerQueue.length===0) return;
    const item = announcerQueue.shift();
    showAnnouncer(item.text, item.style, item.duration);
  }

  function showAnnouncer(text, style='cyan', duration=2800) {
    announcerBusy = true;
    let el = document.getElementById('announcer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'announcer'; el.className = 'announcer-msg';
      document.getElementById('hud')?.appendChild(el);
    }
    const colors = { cyan:'#00d4ff', gold:'#ffd700', red:'#ff2244', orange:'#ff6b35', green:'#39ff14' };
    el.textContent = text;
    el.style.color = colors[style]||colors.cyan;
    el.style.textShadow = `0 0 20px ${colors[style]||colors.cyan}, 0 0 40px ${colors[style]||colors.cyan}`;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0) scale(1)';
    el.style.display = 'block';
    setTimeout(()=>{
      el.style.opacity='0';
      el.style.transform='translateY(-20px) scale(0.9)';
      setTimeout(()=>{ el.style.display='none'; announcerBusy=false; }, 400);
    }, duration);
  }

  // ─── INPUT ─────────────────────────────────────────────
  function sendInput(input) {
    pendingInput = input;
  }

  function flushInput() {
    if (!pendingInput) return;
    const now = Date.now();
    if (now - lastInputSent < 40) return; // 25 Hz cap
    lastInputSent = now;
    Network.sendInput(pendingInput);
    pendingInput = null;
  }

  // ─── FIRING ────────────────────────────────────────────
  function startFiring() {
    if (isFiring) return;
    isFiring = true;
    doShoot();
    fireInterval = setInterval(doShoot, 175);
  }

  function stopFiring() {
    isFiring = false;
    if (fireInterval) { clearInterval(fireInterval); fireInterval = null; }
  }

  function doShoot() {
    if (!myPlayer?.alive) return;
    Network.shoot(aimTarget.x, aimTarget.z);
    Audio.play('shoot');
    // Muzzle flash particle
    Renderer.spawnExplosion(myPlayer.x, 0.6, myPlayer.z, myPlayer.team==='A'?0x00d4ff:0xff6b35, 3);
  }

  function setAim(dx, dz) {
    const mag = Math.sqrt(dx*dx+dz*dz);
    if (mag > 0.01) { aimTarget.x = dx/mag; aimTarget.z = dz/mag; }
  }
  function setRotY(r) { rotY = r; }

  // ─── ABILITIES ─────────────────────────────────────────
  function useAbility(ability) {
    const now = Date.now();
    if (cooldowns[ability] > now) {
      const r = ((cooldowns[ability]-now)/1000).toFixed(1);
      showFloatText(`${ability.toUpperCase()} ${r}s`, 'gray');
      return;
    }
    if (!myPlayer?.alive) return;
    if ((myPlayer.energy||0) < ABILITY_ENERGY_COST[ability]) {
      showFloatText('LOW ENERGY', 'orange');
      Audio.play('uiClick');
      return;
    }
    cooldowns[ability] = now + COOLDOWN_DURATIONS[ability];
    Network.useAbility(ability);
    Audio.play(ability);
    const p = myPlayer;
    switch (ability) {
      case 'dash':
        Renderer.spawnDashTrail(p.x, 0, p.z, p.team);
        showFloatText('QUANTUM DASH', 'cyan');
        break;
      case 'freeze':
        Renderer.spawnFreezeEffect(p.x, p.z);
        showFloatText('TIME FREEZE', 'blue');
        break;
      case 'pulse':
        Renderer.spawnExplosion(p.x, 0.5, p.z, 0xff6600, 20);
        showFloatText('ENERGY PULSE', 'orange');
        break;
      case 'shield':
        showFloatText('SHIELD ACTIVE', 'cyan');
        break;
    }
  }

  // ─── EVENT HANDLERS ────────────────────────────────────
  function onPlayerHit(data) {
    if (data.targetId === myId) {
      const flash = document.getElementById('hit-flash');
      if (flash) { flash.style.opacity='1'; setTimeout(()=>flash.style.opacity='0',120); }
      Renderer.shake(0.35);
      Audio.play('hit');
    }
    Renderer.spawnExplosion(data.x, 0.5, data.z, 0xff2244, 8);
    if (data.targetId === myId || data.sourceId === myId) {
      showDamageNumber(data.damage, data.x, data.z);
    }
  }

  function onPlayerKilled(data) {
    // Find names from last state
    const victim  = lastState?.players?.find(p=>p.id===data.playerId);
    const killer  = lastState?.players?.find(p=>p.id===data.killerId);
    const vName   = victim?.name  || 'OPERATOR';
    const kName   = killer?.name  || 'OPERATOR';
    const kTeam   = killer?.team  || 'A';
    const ability = data.ability  || null;

    if (data.playerId === myId) {
      Audio.play('death');
      Renderer.shake(0.9);
      showRespawnOverlay();
      if (killer) announce(`ELIMINATED BY ${kName.toUpperCase()}`, 'red');
    }
    if (data.killerId === myId) {
      announce(`${vName.toUpperCase()} ELIMINATED`, 'green');
      showFloatText(`+25 XP  KILL`, 'green', true);
    }

    addKillfeed(kName, vName, kTeam, ability);
    Renderer.spawnExplosion(data.x, 0.5, data.z, 0xff4400, 30);
  }

  function onCoreCaptured(data) {
    const core = lastState?.cores?.find(c=>c.id===data.coreId);
    if (core) Renderer.spawnCaptureEffect(core.x, core.z);
    Audio.play('coreCapture');
    const teamName = data.team==='A' ? 'ALPHA' : 'OMEGA';
    announce(`TEAM ${teamName} CAPTURED A CORE  +10`, data.team==='A'?'cyan':'orange');
    if (myPlayer?.team===data.team) showFloatText('+10 CORE CAPTURE', 'cyan', true);
  }

  function onAbilityUsed(data) {
    if (data.playerId === myId) return; // own effects handled locally
    const color = data.ability==='freeze'?0x00aaff:data.ability==='pulse'?0xff6600:data.ability==='shield'?0x00ffff:0x00ff88;
    Renderer.spawnExplosion(data.x, 0.5, data.z, color, 10);
    if (data.ability==='freeze') Renderer.spawnFreezeEffect(data.x, data.z);
    if (data.ability==='shield') Renderer.spawnShieldBreak(data.x, data.z, data.team||'A');
  }

  function onPowerupPickup(data) {
    const msg = data.type==='health'?'HEALTH RESTORED':data.type==='speed'?'SPEED BOOST':'AMMO BOOST';
    showFloatText(`⬆ ${msg}`, 'green', true);
    Renderer.spawnCaptureEffect(data.x || 0, data.z || 0);
    Audio.play('coreCapture');
  }

  // ─── RESPAWN OVERLAY ───────────────────────────────────
  function showRespawnOverlay() {
    const overlay = document.getElementById('respawn-overlay');
    const timerEl = document.getElementById('respawn-timer');
    overlay?.classList.remove('hidden');
    let t = 4;
    if (timerEl) timerEl.textContent = t;
    if (respawnCountdown) clearInterval(respawnCountdown);
    respawnCountdown = setInterval(() => {
      t--;
      if (timerEl) timerEl.textContent = Math.max(0, t);
      if (t <= 0) { clearInterval(respawnCountdown); overlay?.classList.add('hidden'); }
    }, 1000);
  }

  // ─── DAMAGE NUMBERS ────────────────────────────────────
  function showDamageNumber(dmg, wx, wz) {
    const el = document.createElement('div');
    el.className = 'damage-number';
    el.textContent = '-' + dmg;
    // Rough world-to-screen projection
    const cx = window.innerWidth/2, cy = window.innerHeight*0.5;
    const offX = (wx-(myPlayer?.x||0)) * 13;
    const offY = (wz-(myPlayer?.z||0)) * 9;
    el.style.left = Math.max(50, Math.min(window.innerWidth-50, cx + offX)) + 'px';
    el.style.top  = Math.max(50, Math.min(window.innerHeight-100, cy + offY - 30)) + 'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 900);
  }

  // ─── FLOAT TEXT ────────────────────────────────────────
  function showFloatText(text, style='cyan', centered=false) {
    const el = document.createElement('div');
    el.className = 'float-text';
    const colors = { cyan:'#00d4ff', gold:'#ffd700', red:'#ff2244', orange:'#ff6b35', green:'#39ff14', blue:'#88eeff', gray:'#666' };
    el.textContent = text;
    el.style.color = colors[style]||colors.cyan;
    el.style.textShadow = `0 0 10px ${colors[style]||colors.cyan}`;
    if (centered) {
      el.style.left = (window.innerWidth/2-100)+'px';
      el.style.top  = (window.innerHeight*0.65)+'px';
      el.style.fontSize = '1.1rem';
      el.style.fontWeight = '700';
    } else {
      el.style.left = (20+Math.random()*160)+'px';
      el.style.top  = (window.innerHeight-250+Math.random()*60)+'px';
    }
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1600);
  }

  // ─── RESET ─────────────────────────────────────────────
  function resetCooldowns() {
    Object.keys(cooldowns).forEach(k=>cooldowns[k]=0);
  }

  return {
    start, stop, onGameState,
    updateScoreboard, addKillfeed,
    sendInput, startFiring, stopFiring, setAim, setRotY,
    useAbility,
    onPlayerHit, onPlayerKilled, onCoreCaptured,
    onAbilityUsed, onPowerupPickup,
    resetCooldowns, announce, showFloatText,
    getMyPlayer: ()=>myPlayer,
    isRunning: ()=>gameRunning,
    getLastState: ()=>lastState
  };
})();
