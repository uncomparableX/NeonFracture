/**
 * NEON FRACTURE: Quantum Arena
 * AAA Frontend Enhancement Layer — Production
 *
 * RULES:
 * - Does NOT override existing globals (showScreen, createRoom, etc.)
 * - Does NOT replace existing HUD, toast, scoreboard, minimap systems
 * - Does NOT replace networking or gameplay logic
 * - Provides namespaced visual enhancements only
 * - Pauses expensive animations when not visible
 * - Optimized for mid-range mobile GPUs
 */

(function() {
  'use strict';

  /* ─────────────────────────────────────────
     NAMESPACE: NeonEnhancements
     ───────────────────────────────────────── */
  const NE = window.NeonEnhancements = {
    version: '2.0.0',
    enabled: true,
    debug: false
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const on = (el, evt, fn) => el && el.addEventListener(evt, fn);

  /* ─────────────────────────────────────────
     MASCOT AI DRONE
     ───────────────────────────────────────── */
  NE.Mascot = class Mascot {
    constructor() {
      this.el = document.getElementById('mascot');
      if (!this.el) return;

      this.x = window.innerWidth - 100;
      this.y = window.innerHeight - 120;
      this.vx = 0;
      this.vy = 0;
      this.mouse = { x: this.x, y: this.y };
      this.state = 'idle';
      this.idleTime = 0;
      this.visible = true;
      this.inGame = false;
      this.paused = false;
      this.lastFrame = 0;
      this.frameSkip = 0;

      this._bindEvents();
      this._loop();
    }

    _bindEvents() {
      on(document, 'mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.idleTime = 0;
        if (this.state === 'sleep') this._wake();
      });

      on(document, 'click', (e) => {
        if (!this.visible || this.inGame || this.paused) return;
        const dx = e.clientX - this.x;
        const dy = e.clientY - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) this._react('poke');
        else this._react('click');
      });

      // Observe screen changes
      const screens = $$('.screen');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          if (m.type === 'attributes' && m.attributeName === 'class') {
            const screen = m.target;
            if (screen.id === 'screen-game' && screen.classList.contains('active')) {
              this.inGame = true;
              this.hide();
            } else if (screen.classList.contains('active')) {
              this.inGame = false;
              this.show();
            }
          }
        });
      });
      screens.forEach(s => observer.observe(s, { attributes: true }));

      // Pause when tab hidden
      on(document, 'visibilitychange', () => {
        this.paused = document.hidden;
      });
    }

    _wake() {
      if (this.state === 'sleep') {
        this.state = 'idle';
        this.el.classList.remove('sleeping');
        this._react('wake');
      }
    }

    hide() {
      this.visible = false;
      this.el.classList.add('hidden');
    }

    show() {
      this.visible = true;
      this.el.classList.remove('hidden');
      this.idleTime = 0;
    }

    _react(type) {
      if (!this.visible || this.inGame || this.paused) return;
      this.idleTime = 0;
      switch(type) {
        case 'click':
          this.vy = -4;
          this.el.classList.remove('excited', 'celebrating', 'tripping');
          void this.el.offsetWidth;
          this.el.classList.add('excited');
          setTimeout(() => this.el.classList.remove('excited'), 700);
          break;
        case 'poke':
          this.vx = (Math.random() - 0.5) * 8;
          this.vy = -6;
          this.el.classList.add('excited');
          setTimeout(() => this.el.classList.remove('excited'), 500);
          break;
        case 'wake':
          this.vy = -3;
          break;
      }
    }

    celebrate() {
      if (!this.visible || this.inGame || this.paused) return;
      this.state = 'celebrate';
      this.idleTime = 0;
      this.el.classList.remove('sleeping');
      this.el.classList.add('celebrating');
      setTimeout(() => {
        this.el.classList.remove('celebrating');
        if (this.state === 'celebrate') this.state = 'idle';
      }, 2500);
    }

    _trip() {
      if (!this.visible || this.inGame || this.paused || this.state === 'sleep' || this.state === 'celebrate') return;
      this.state = 'trip';
      this.vx = (Math.random() - 0.5) * 12;
      this.vy = -4;
      this.el.classList.add('tripping');
      setTimeout(() => {
        this.el.classList.remove('tripping');
        if (this.state === 'trip') this.state = 'idle';
      }, 900);
    }

    update(dt) {
      if (!this.visible || this.paused) return;

      // Frame skip for performance (30fps physics)
      this.frameSkip++;
      if (this.frameSkip % 2 !== 0) return;

      this.idleTime += dt * 2;

      if (this.idleTime > 25 && this.state !== 'sleep' && this.state !== 'celebrate') {
        this.state = 'sleep';
        this.el.classList.add('sleeping');
      }

      if (this.state === 'idle' && Math.random() < 0.0008) {
        this._trip();
      }

      const followStrength = this.state === 'sleep' ? 0.005 : 0.025;
      const maxSpeed = this.state === 'trip' ? 8 : (this.state === 'celebrate' ? 5 : 3);

      const dx = this.mouse.x - this.x;
      const dy = this.mouse.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist > 80 && this.state !== 'trip') {
        this.vx += (dx / dist) * followStrength;
        this.vy += (dy / dist) * followStrength;
      }

      this.vx *= 0.94;
      this.vy *= 0.94;

      const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
      if (speed > maxSpeed) {
        this.vx = (this.vx / speed) * maxSpeed;
        this.vy = (this.vy / speed) * maxSpeed;
      }

      if (this.state === 'trip') this.vy += 0.25;
      if (this.state === 'celebrate') {
        this.vy = Math.sin(Date.now() * 0.012) * 3;
        this.vx = Math.cos(Date.now() * 0.008) * 2;
      }

      this.x += this.vx;
      this.y += this.vy;

      const pad = 40;
      this.x = Math.max(pad, Math.min(window.innerWidth - pad, this.x));
      this.y = Math.max(pad, Math.min(window.innerHeight - pad, this.y));

      const rot = Math.max(-25, Math.min(25, this.vx * 2.5));
      this.el.style.transform = `translate3d(${this.x - 28}px, ${this.y - 28}px, 0) rotate(${rot}deg)`;
    }

    _loop() {
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        this.update(dt);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  };

  /* ─────────────────────────────────────────
     CINEMATIC HOME BACKGROUND
     Optimized 2D canvas megacity
     ───────────────────────────────────────── */
  NE.HomeBackground = class HomeBackground {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());

      this.buildings = [];
      this.rain = [];
      this.traffic = [];
      this.particles = [];
      this.holograms = [];
      this.camera = { x: 0, y: 0, drift: 0 };
      this.time = 0;
      this.running = true;
      this.lastDraw = 0;
      this.targetFPS = 30;
      this.frameInterval = 1000 / this.targetFPS;

      this._initBuildings();
      this._initRain();
      this._initTraffic();
      this._initParticles();
      this._initHolograms();

      // Pause when tab hidden or not on home
      on(document, 'visibilitychange', () => {
        this.running = !document.hidden && this._isHomeActive();
      });

      // Observe screen changes
      const homeScreen = document.getElementById('screen-home');
      if (homeScreen) {
        const obs = new MutationObserver(() => {
          this.running = homeScreen.classList.contains('active') && !document.hidden;
        });
        obs.observe(homeScreen, { attributes: true });
      }

      this._loop();
    }

    _isHomeActive() {
      const home = document.getElementById('screen-home');
      return home && home.classList.contains('active');
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
      this.canvas.style.width = window.innerWidth + 'px';
      this.canvas.style.height = window.innerHeight + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._initBuildings();
    }

    _initBuildings() {
      this.buildings = [];
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = Math.ceil(w / 60) + 2;
      for (let i = 0; i < count; i++) {
        const bw = 30 + Math.random() * 50;
        const bh = 80 + Math.random() * (h * 0.45);
        this.buildings.push({
          x: i * 60 - 40,
          w: bw,
          h: bh,
          windows: Math.random() > 0.3,
          winColor: Math.random() > 0.5 ? 'rgba(0,212,255,0.12)' : 'rgba(255,180,100,0.08)',
          color: `hsl(225, 18%, ${6 + Math.random() * 10}%)`,
          speed: 0.02 + Math.random() * 0.03
        });
      }
    }

    _initRain() {
      this.rain = [];
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = window.innerWidth < 768 ? 60 : 100;
      for (let i = 0; i < count; i++) {
        this.rain.push({
          x: Math.random() * w,
          y: Math.random() * h,
          speed: 10 + Math.random() * 12,
          len: 8 + Math.random() * 14,
          opacity: 0.04 + Math.random() * 0.1
        });
      }
    }

    _initTraffic() {
      this.traffic = [];
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (let i = 0; i < 14; i++) {
        this.traffic.push({
          x: Math.random() * w,
          y: h * 0.15 + Math.random() * (h * 0.3),
          speed: (Math.random() - 0.5) * 3,
          size: 1 + Math.random() * 2,
          color: Math.random() > 0.5 ? '#00d4ff' : '#ff6b35',
          trail: Math.random() > 0.7
        });
      }
    }

    _initParticles() {
      this.particles = [];
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = window.innerWidth < 768 ? 25 : 40;
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.1 - Math.random() * 0.4,
          size: 0.5 + Math.random() * 1.5,
          alpha: 0.04 + Math.random() * 0.2,
          color: Math.random() > 0.7 ? '#ff6b35' : '#00d4ff'
        });
      }
    }

    _initHolograms() {
      this.holograms = [];
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (let i = 0; i < 3; i++) {
        this.holograms.push({
          x: w * (0.15 + Math.random() * 0.7),
          y: h * (0.2 + Math.random() * 0.3),
          w: 80 + Math.random() * 100,
          h: 40 + Math.random() * 50,
          phase: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 0.5
        });
      }
    }

    draw(now) {
      if (!this.running) return;
      if (now - this.lastDraw < this.frameInterval) return;
      this.lastDraw = now;

      const ctx = this.ctx;
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#020204');
      sky.addColorStop(0.6, '#0a0c18');
      sky.addColorStop(1, '#0d1020');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Camera drift
      this.camera.drift += 0.0003;
      this.camera.x = Math.sin(this.camera.drift) * 12;
      this.camera.y = Math.cos(this.camera.drift * 0.7) * 6;

      // Far city
      ctx.save();
      ctx.translate(this.camera.x * 0.3, this.camera.y * 0.3);
      this._drawCityLayer(ctx, w, h, 0.6, true);
      ctx.restore();

      // Near city
      ctx.save();
      ctx.translate(this.camera.x, this.camera.y);
      this._drawCityLayer(ctx, w, h, 1.0, false);
      ctx.restore();

      // Fog
      const fog = ctx.createLinearGradient(0, h * 0.5, 0, h);
      fog.addColorStop(0, 'transparent');
      fog.addColorStop(0.4, 'rgba(10, 12, 28, 0.3)');
      fog.addColorStop(1, 'rgba(10, 12, 28, 0.85)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);

      // Rain (batched)
      ctx.lineWidth = 1;
      this.rain.forEach(r => {
        ctx.strokeStyle = `rgba(200, 215, 255, ${r.opacity})`;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - 0.8, r.y + r.len);
        ctx.stroke();
        r.y += r.speed;
        r.x -= 0.4;
        if (r.y > h) {
          r.y = -r.len;
          r.x = Math.random() * w;
        }
      });

      // Traffic
      this.traffic.forEach(t => {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = t.color;
        ctx.fillRect(t.x, t.y, t.size * 6, t.size);
        if (t.trail) {
          ctx.globalAlpha = 0.12;
          const tl = t.speed > 0 ? -14 : 14;
          ctx.fillRect(t.x + tl, t.y, 14, t.size);
        }
        ctx.globalAlpha = 1;
        t.x += t.speed;
        if (t.x > w + 40) t.x = -40;
        if (t.x < -40) t.x = w + 40;
      });

      // Particles
      this.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
      });
      ctx.globalAlpha = 1;

      // Holograms
      this.time += 0.016;
      this.holograms.forEach(ho => {
        const flicker = 0.02 + Math.sin(this.time * ho.speed + ho.phase) * 0.015;
        ctx.fillStyle = `rgba(0, 212, 255, ${flicker})`;
        ctx.fillRect(ho.x, ho.y, ho.w, ho.h);
        ctx.fillStyle = `rgba(0, 212, 255, ${flicker * 1.5})`;
        const scanY = (this.time * 40) % ho.h;
        ctx.fillRect(ho.x, ho.y + scanY, ho.w, 1);
      });

      // Vignette
      const vig = ctx.createRadialGradient(w/2, h/2, w*0.3, w/2, h/2, w*0.8);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(2,2,4,0.4)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    _drawCityLayer(ctx, w, h, scale, isFar) {
      const baseH = h * (isFar ? 0.5 : 0.7);
      this.buildings.forEach((b, i) => {
        if (isFar && i % 2 !== 0) return;
        const bx = b.x + (isFar ? i * 20 : 0);
        const by = h - b.h * (isFar ? 0.6 : 1) * scale;
        const bw = b.w * scale;
        const bh = b.h * scale;

        ctx.fillStyle = isFar
          ? `hsl(225, 15%, ${parseInt(b.color.match(/\d+%/)[0]) * 0.6}%)`
          : b.color;
        ctx.fillRect(bx, by, bw, bh);

        if (b.windows && !isFar) {
          ctx.fillStyle = b.winColor;
          const winW = 3;
          const winH = 5;
          const cols = Math.floor(bw / 12);
          const rows = Math.floor(bh / 18);
          for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
              if (Math.random() > 0.6) continue;
              const wx = bx + c * 12 + 3;
              const wy = by + r * 18 + 4;
              ctx.fillRect(wx, wy, winW, winH);
            }
          }
        }

        if (!isFar) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(bx, by, 1, bh);
        }
      });
    }

    _loop() {
      const step = (now) => {
        this.draw(now);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  };

  /* ─────────────────────────────────────────
     SCREEN TRANSITION ENHANCER
     Hooks into existing showScreen safely
     ───────────────────────────────────────── */
  NE.ScreenEnhancer = {
    init() {
      const screens = $$('.screen');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          if (m.type === 'attributes' && m.attributeName === 'class') {
            const screen = m.target;
            if (screen.classList.contains('active')) {
              screen.classList.add('entering');
              setTimeout(() => screen.classList.remove('entering'), 600);
            }
          }
        });
      });
      screens.forEach(s => observer.observe(s, { attributes: true }));
    }
  };

  /* ─────────────────────────────────────────
     HUD ENHANCEMENT HELPERS
     Non-destructive visual upgrades
     ───────────────────────────────────────── */
  NE.HUDEnhance = {
    setHealth(current, max) {
      const bar = document.getElementById('health-bar');
      const text = document.getElementById('health-text');
      const pct = Math.max(0, Math.min(100, (current / max) * 100));
      if (bar) bar.style.width = pct + '%';
      if (text) text.textContent = `${Math.ceil(current)}/${max}`;
      const bars = document.getElementById('player-bars');
      if (bars) {
        if (pct < 30) bars.classList.add('critical');
        else bars.classList.remove('critical');
      }
    },

    setEnergy(current, max) {
      const bar = document.getElementById('energy-bar');
      const text = document.getElementById('energy-text');
      const pct = Math.max(0, Math.min(100, (current / max) * 100));
      if (bar) bar.style.width = pct + '%';
      if (text) text.textContent = `${Math.ceil(current)}/${max}`;
    },

    setAbility(slotIndex, cooldownPercent, isReady) {
      const slot = document.getElementById(`ability-${slotIndex}`);
      const cd = document.getElementById(`cd-${slotIndex}`);
      if (!slot || !cd) return;
      if (isReady) {
        slot.classList.add('active');
        cd.classList.remove('active');
        cd.textContent = '';
      } else {
        slot.classList.remove('active');
        cd.classList.add('active');
        cd.textContent = Math.ceil(cooldownPercent * 100) + '%';
      }
    },

    setScore(alpha, omega, maxScore = 100) {
      const alphaEl = document.getElementById('score-alpha');
      const omegaEl = document.getElementById('score-omega');
      const alphaBar = document.getElementById('alpha-bar');
      const omegaBar = document.getElementById('omega-bar');
      if (alphaEl) alphaEl.textContent = alpha;
      if (omegaEl) omegaEl.textContent = omega;
      if (alphaBar) alphaBar.style.width = (alpha / maxScore * 100) + '%';
      if (omegaBar) omegaBar.style.width = (omega / maxScore * 100) + '%';
    },

    setTimer(seconds) {
      const el = document.getElementById('timer-display');
      if (!el) return;
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    },

    setXP(level, percent) {
      const badge = document.getElementById('player-level');
      const fill = document.getElementById('xp-fill');
      if (badge) badge.textContent = level;
      if (fill) fill.style.width = percent + '%';
    },

    setOnlineCount(count) {
      const el = document.getElementById('online-count');
      if (el) el.textContent = count.toLocaleString();
    },

    setRoomCode(code) {
      const el = document.getElementById('room-code');
      if (el) el.textContent = code;
    },

    setTeamList(team, players) {
      const listId = team === 'alpha' ? 'team-alpha-list' : 'team-omega-list';
      const countId = team === 'alpha' ? 'alpha-count' : 'omega-count';
      const list = document.getElementById(listId);
      const count = document.getElementById(countId);
      if (count) count.textContent = `${players.length}/4`;
      if (!list) return;
      if (players.length === 0) {
        list.innerHTML = '<li class="player-slot empty">Awaiting operator...</li>';
        return;
      }
      const esc = (s) => {
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
      };
      list.innerHTML = players.map(p =>
        `<li class="player-slot ${p.ready ? 'ready' : ''} ${p.isHost ? 'host' : ''}">${esc(p.name)}</li>`
      ).join('');
    },

    addKillFeed(killer, victim, weapon = '') {
      const container = document.getElementById('kill-feed');
      if (!container) return;
      const esc = (s) => {
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
      };
      const item = document.createElement('div');
      item.className = 'kill-feed-item';
      item.innerHTML = `
        <span class="killer">${esc(killer)}</span>
        <span class="weapon">${esc(weapon || '■')}</span>
        <span class="victim">${esc(victim)}</span>
      `;
      container.appendChild(item);
      while (container.children.length > 5) {
        container.removeChild(container.firstChild);
      }
      setTimeout(() => {
        item.style.transition = 'all 0.3s ease';
        item.style.opacity = '0';
        item.style.transform = 'translateX(20px)';
        setTimeout(() => item.remove(), 300);
      }, 4500);
    },

    showMatchAlert(text, duration = 2000) {
      const container = document.querySelector('.hud-center');
      if (!container) return;
      let alert = document.getElementById('match-alert');
      if (!alert) {
        alert = document.createElement('div');
        alert.id = 'match-alert';
        alert.className = 'match-alert';
        container.appendChild(alert);
      }
      alert.textContent = text;
      alert.classList.add('active');
      setTimeout(() => alert.classList.remove('active'), duration);
    },

    showRespawn(seconds) {
      const overlay = document.getElementById('respawn-overlay');
      const timer = document.getElementById('respawn-timer');
      const bar = overlay?.querySelector('.respawn-progress');
      if (!overlay || !timer) return;
      overlay.classList.add('active');
      let remaining = seconds;
      timer.textContent = remaining.toFixed(1);
      if (bar) bar.style.width = '100%';
      const interval = setInterval(() => {
        remaining -= 0.1;
        const display = Math.max(0, remaining);
        timer.textContent = display.toFixed(1);
        if (bar) bar.style.width = ((display / seconds) * 100) + '%';
        if (remaining <= 0) {
          clearInterval(interval);
          overlay.classList.remove('active');
        }
      }, 100);
    },

    showFreeze() {
      const overlay = document.getElementById('freeze-overlay');
      if (overlay) overlay.classList.add('active');
    },

    hideFreeze() {
      const overlay = document.getElementById('freeze-overlay');
      if (overlay) overlay.classList.remove('active');
    },

    showScoreboard(data) {
      const overlay = document.getElementById('scoreboard');
      const tbody = document.getElementById('scoreboard-body');
      if (!overlay || !tbody) return;
      const esc = (s) => {
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
      };
      tbody.innerHTML = (data || []).map((row, i) => `
        <tr>
          <td class="col-rank">${i + 1}</td>
          <td class="col-name">${esc(row.name || '')}</td>
          <td class="col-team ${row.team === 'alpha' ? 'team-alpha' : 'team-omega'}">${row.team === 'alpha' ? 'ALPHA' : 'OMEGA'}</td>
          <td class="col-stat">${row.kills || 0}</td>
          <td class="col-stat">${row.cores || 0}</td>
          <td class="col-stat">${row.deaths || 0}</td>
          <td class="col-stat">${row.score || 0}</td>
        </tr>
      `).join('');
      overlay.classList.add('active');
    },

    hideScoreboard() {
      const overlay = document.getElementById('scoreboard');
      if (overlay) overlay.classList.remove('active');
    },

    setMatchEnd(result, reason, stats) {
      const screen = document.getElementById('screen-end');
      const resultEl = document.getElementById('end-result');
      const reasonEl = document.getElementById('end-reason');
      const table = document.getElementById('stats-table');
      if (resultEl) {
        resultEl.textContent = result ? 'VICTORY' : 'DEFEAT';
        resultEl.className = 'end-result ' + (result ? 'victory' : 'defeat');
      }
      if (reasonEl) reasonEl.textContent = reason || 'Match concluded';
      if (table && stats) {
        const esc = (s) => {
          const d = document.createElement('div');
          d.textContent = String(s);
          return d.innerHTML;
        };
        table.innerHTML = stats.map(s => `
          <tr>
            <td>${esc(s.label || '')}</td>
            <td>${esc(String(s.value || ''))}</td>
          </tr>
        `).join('');
      }
      if (result && NE.mascot) {
        setTimeout(() => NE.mascot.celebrate(), 400);
      }
    }
  };

  /* ─────────────────────────────────────────
     TOAST ENHANCER
     Wraps existing showToast if present
     ───────────────────────────────────────── */
  NE.ToastEnhance = {
    init() {
      // If existing showToast exists, wrap it to also use our styled container
      if (typeof window.showToast === 'function' && !window._neonToastWrapped) {
        const orig = window.showToast;
        window._neonToastWrapped = true;
        window.showToast = (msg, type = 'info', duration = 3000) => {
          // Try our styled version first, fallback to original
          const container = document.getElementById('toast');
          if (container) {
            this._styledToast(msg, type, duration);
          } else {
            orig(msg, type, duration);
          }
        };
      }
      // If no existing showToast, provide one
      if (typeof window.showToast !== 'function') {
        window.showToast = (msg, type = 'info', duration = 3000) => {
          this._styledToast(msg, type, duration);
        };
      }
    },

    _styledToast(message, type, duration) {
      const container = document.getElementById('toast');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast-item ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      const remove = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px) translateX(-50%) scale(0.95)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 250);
      };
      setTimeout(remove, duration);
    }
  };

  /* ─────────────────────────────────────────
     SETTINGS UI HELPERS
     ───────────────────────────────────────── */
  NE.SettingsUI = {
    init() {
      // Toggle buttons
      $$('.toggle-btn').forEach(btn => {
        on(btn, 'click', () => {
          btn.classList.toggle('active');
          const label = btn.querySelector('.toggle-label');
          if (label) label.textContent = btn.classList.contains('active') ? 'ON' : 'OFF';
        });
      });

      // Segmented controls
      on(document, 'click', (e) => {
        const seg = e.target.closest('.seg-btn');
        if (seg) {
          const parent = seg.closest('.segmented-control');
          parent?.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
          seg.classList.add('active');
        }
      });

      // Sliders
      on(document, 'input', (e) => {
        if (e.target.type === 'range') {
          const valDisplay = e.target.closest('.slider-control')?.querySelector('.slider-value');
          if (valDisplay) valDisplay.textContent = e.target.value + '%';
        }
      });
    }
  };

  /* ─────────────────────────────────────────
     INITIALIZATION
     ───────────────────────────────────────── */
  NE.init = function() {
    if (this._initialized) return;
    this._initialized = true;

    // Home background (only if home screen exists)
    const homeCanvas = document.getElementById('home-bg-canvas');
    if (homeCanvas) {
      this.homeBg = new this.HomeBackground(homeCanvas);
    }

    // Mascot
    this.mascot = new this.Mascot();

    // Screen transitions
    this.ScreenEnhancer.init();

    // Toast
    this.ToastEnhance.init();

    // Settings UI
    this.SettingsUI.init();

    if (this.debug) console.log('[NeonEnhancements] v' + this.version + ' initialized');
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NE.init());
  } else {
    NE.init();
  }

})();
