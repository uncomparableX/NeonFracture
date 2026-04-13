// ═══════════════════════════════════════════════════════
// NEON FRACTURE — AUDIO ENGINE v2
// Procedural SFX + Generative Cyberpunk Music
// ═══════════════════════════════════════════════════════
const Audio = (() => {
  let ctx = null;
  let masterGain, sfxBus, musicBus;
  let musicRunning = false;
  let musicLoopId   = null;
  const cfg = { sfx: true, music: true };
  const NOTE = freq => 440 * Math.pow(2, (freq - 69) / 12); // midi to Hz

  // ─── INIT ──────────────────────────────────────────────
  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = make('gain', null, { gain: 0.7 });
      masterGain.connect(ctx.destination);
      sfxBus  = make('gain', masterGain, { gain: 0.85 });
      musicBus = make('gain', masterGain, { gain: 0.22 });
    } catch (e) { console.warn('AudioContext unavailable:', e); }
  }

  function resume() { ctx?.state === 'suspended' && ctx.resume(); }

  // ─── DSP HELPERS ───────────────────────────────────────
  function make(type, dest, params = {}) {
    if (!ctx) return null;
    const node = ctx['create' + type.charAt(0).toUpperCase() + type.slice(1)]();
    Object.assign(node, params);
    if (params.gain !== undefined && node.gain) node.gain.value = params.gain;
    if (dest) node.connect(dest);
    return node;
  }

  function osc(freq, type, dest, start = 0, stop = 0.3, vol = 0.4) {
    if (!ctx || !cfg.sfx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + stop);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + stop + 0.01);
    return { o, g };
  }

  function sweepOsc(startFreq, endFreq, type, dest, duration, vol = 0.4) {
    if (!ctx || !cfg.sfx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(startFreq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(); o.stop(ctx.currentTime + duration + 0.01);
  }

  function noise(duration, vol = 0.3, filterFreq = 3000, filterType = 'lowpass') {
    if (!ctx || !cfg.sfx) return;
    const len = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src  = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const g    = ctx.createGain();
    src.buffer = buf; filt.type = filterType; filt.frequency.value = filterFreq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(filt); filt.connect(g); g.connect(sfxBus);
    src.start(); src.stop(ctx.currentTime + duration + 0.01);
  }

  function distort(amount = 50) {
    if (!ctx) return null;
    const wave = ctx.createWaveShaper();
    const k    = amount;
    const n    = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
    }
    wave.curve = curve;
    return wave;
  }

  // ─── SOUND EFFECTS ─────────────────────────────────────
  const sfx = {
    shoot() {
      sweepOsc(1200, 600, 'sawtooth', null, 0.07, 0.25);
      noise(0.05, 0.2, 5000);
    },

    hit() {
      noise(0.12, 0.5, 2500);
      sweepOsc(300, 80, 'sawtooth', null, 0.18, 0.35);
    },

    kill() {
      [0, 80, 160].forEach(delay => {
        setTimeout(() => {
          if (!ctx || !cfg.sfx) return;
          const freqs = [523, 659, 784, 1047];
          freqs.forEach((f, i) => osc(f, 'square', null, i * 0.06, 0.18, 0.35));
        }, delay);
      });
    },

    death() {
      sweepOsc(500, 60, 'sawtooth', null, 0.6, 0.5);
      noise(0.3, 0.4, 1000);
      osc(200, 'sine', null, 0.1, 0.5, 0.3);
    },

    dash() {
      sweepOsc(200, 1800, 'sine', null, 0.15, 0.4);
      noise(0.08, 0.3, 8000);
    },

    freeze() {
      for (let i = 0; i < 6; i++) {
        osc(NOTE(72 + i * 2), 'sine', null, i * 0.045, 0.2, 0.3);
      }
      noise(0.25, 0.15, 800, 'highpass');
    },

    pulse() {
      noise(0.08, 0.6, 800);
      sweepOsc(100, 600, 'sawtooth', null, 0.3, 0.5);
      osc(80, 'sine', null, 0, 0.4, 0.5);
    },

    shield() {
      osc(NOTE(64), 'sine', null, 0, 0.08, 0.2);
      osc(NOTE(68), 'sine', null, 0.05, 0.1, 0.3);
      sweepOsc(600, 1200, 'sine', null, 0.2, 0.35);
    },

    coreCapture() {
      [NOTE(60), NOTE(64), NOTE(67), NOTE(72), NOTE(76)].forEach((f, i) => {
        osc(f, 'sine', null, i * 0.07, 0.25, 0.45);
      });
      noise(0.15, 0.2, 6000);
    },

    levelUp() {
      const melody = [NOTE(60), NOTE(64), NOTE(67), NOTE(72), NOTE(76), NOTE(84)];
      melody.forEach((f, i) => {
        osc(f, 'square', null, i * 0.06, 0.18, 0.3);
        osc(f * 2, 'sine', null, i * 0.06, 0.15, 0.15);
      });
    },

    countdown() {
      osc(NOTE(57), 'square', null, 0, 0.18, 0.45);
    },

    countdownGo() {
      osc(NOTE(69), 'square', null, 0,    0.12, 0.6);
      osc(NOTE(73), 'square', null, 0.08, 0.12, 0.6);
      osc(NOTE(76), 'square', null, 0.16, 0.25, 0.7);
      noise(0.06, 0.4, 6000);
    },

    powerup() {
      sweepOsc(400, 1200, 'sine', null, 0.2, 0.4);
      osc(NOTE(76), 'sine', null, 0.15, 0.2, 0.3);
    },

    uiClick() { osc(800, 'sine', null, 0, 0.06, 0.2); },
    uiHover()  { osc(1000, 'sine', null, 0, 0.04, 0.1); },
    uiBack()   { sweepOsc(600, 300, 'sine', null, 0.08, 0.15); },
    error()    { osc(200, 'sawtooth', null, 0, 0.15, 0.35); osc(180, 'sawtooth', null, 0.1, 0.15, 0.3); }
  };

  function play(name) {
    if (!ctx || !cfg.sfx) return;
    try { resume(); sfx[name]?.(); } catch (e) {}
  }

  // ─── GENERATIVE CYBERPUNK MUSIC ────────────────────────
  // BPM=132, 16-step sequencer running on Web Audio clock
  const BPM    = 132;
  const STEP   = (60 / BPM) / 4; // 16th note in seconds
  let seqStep  = 0;
  let nextStep = 0;
  let seqTimeout = null;

  // Bass synth note pattern (MIDI numbers, null = rest)
  const bassPattern = [
    36,null,36,null, 41,null,43,null,
    36,null,36,null, 38,null,41,41
  ];

  // Lead arp pattern
  const arpPattern = [
    null,48,null,52, null,55,null,60,
    null,48,null,55, null,52,null,57
  ];

  // Chord voicings (every 4 bars)
  const chords = [
    [36,43,48,55], [34,41,46,53], [39,46,51,58], [37,44,49,56]
  ];
  let chordIdx = 0, barCount = 0;

  function scheduleStep(time) {
    const step = seqStep % 16;

    // ── KICK (beat 1 and 3) ──────────────────────────────
    if (step === 0 || step === 8) kick(time);

    // ── SNARE / CLAP (beat 2 and 4) ──────────────────────
    if (step === 4 || step === 12) snare(time);

    // ── HI-HAT (every step, accented on off-beats) ───────
    hihat(time, step % 2 === 0 ? 0.08 : 0.04);

    // ── OPEN HI-HAT (step 6, 14) ─────────────────────────
    if (step === 6 || step === 14) openHihat(time);

    // ── BASS ─────────────────────────────────────────────
    const bn = bassPattern[step];
    if (bn !== null) bassNote(time, NOTE(bn), step < 8 ? STEP * 1.8 : STEP * 0.9);

    // ── ARP ──────────────────────────────────────────────
    const an = arpPattern[step];
    if (an !== null) arpNote(time, NOTE(an));

    // ── CHORD PAD (every 16 steps) ────────────────────────
    if (step === 0) {
      chordPad(time, chords[chordIdx % chords.length]);
      barCount++;
      if (barCount % 4 === 0) chordIdx++;
    }
  }

  function kick(time) {
    if (!cfg.music) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    o.frequency.setValueAtTime(160, time);
    o.frequency.exponentialRampToValueAtTime(28, time + 0.22);
    g.gain.setValueAtTime(1.2, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
    o.connect(g); g.connect(comp); comp.connect(musicBus);
    o.start(time); o.stop(time + 0.36);
    // Click transient
    const nc = ctx.createOscillator();
    const ng = ctx.createGain();
    nc.frequency.value = 4000;
    ng.gain.setValueAtTime(0.4, time);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
    nc.connect(ng); ng.connect(musicBus);
    nc.start(time); nc.stop(time + 0.03);
  }

  function snare(time) {
    if (!cfg.music) return;
    // Noise burst
    const len = Math.ceil(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 3000; filt.Q.value = 0.5;
    const g   = ctx.createGain(); g.gain.setValueAtTime(0.55, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    src.connect(filt); filt.connect(g); g.connect(musicBus);
    src.start(time);
    // Tone component
    const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
    o2.frequency.setValueAtTime(220, time); o2.frequency.exponentialRampToValueAtTime(120, time + 0.08);
    g2.gain.setValueAtTime(0.25, time); g2.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    o2.connect(g2); g2.connect(musicBus); o2.start(time); o2.stop(time + 0.12);
  }

  function hihat(time, vol) {
    if (!cfg.music) return;
    const len = Math.ceil(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 9000;
    const g   = ctx.createGain(); g.gain.setValueAtTime(vol, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    src.connect(filt); filt.connect(g); g.connect(musicBus); src.start(time);
  }

  function openHihat(time) {
    if (!cfg.music) return;
    const len = Math.ceil(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 7000;
    const g   = ctx.createGain(); g.gain.setValueAtTime(0.12, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
    src.connect(filt); filt.connect(g); g.connect(musicBus); src.start(time);
  }

  function bassNote(time, freq, dur) {
    if (!cfg.music) return;
    const o1 = ctx.createOscillator(); const o2 = ctx.createOscillator();
    const g  = ctx.createGain(); const dist = distort(30);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 600;
    o1.type = 'sawtooth'; o1.frequency.value = freq;
    o2.type = 'square';   o2.frequency.value = freq * 1.01;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.45, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o1.connect(g); o2.connect(g);
    if (dist) { g.connect(dist); dist.connect(filt); } else { g.connect(filt); }
    filt.connect(musicBus);
    o1.start(time); o1.stop(time + dur + 0.01);
    o2.start(time); o2.stop(time + dur + 0.01);
  }

  function arpNote(time, freq) {
    if (!cfg.music) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = freq * 2; filt.Q.value = 2;
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, time); g.gain.exponentialRampToValueAtTime(0.0001, time + STEP * 0.8);
    o.connect(filt); filt.connect(g); g.connect(musicBus);
    o.start(time); o.stop(time + STEP * 0.9);
  }

  function chordPad(time, notes) {
    if (!cfg.music) return;
    const dur = STEP * 16;
    notes.forEach(note => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 1200;
      o.type = 'sawtooth'; o.frequency.value = NOTE(note);
      o.detune.value = (Math.random() - 0.5) * 8; // slight detuning
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.06, time + 0.3);
      g.gain.setValueAtTime(0.06, time + dur - 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(filt); filt.connect(g); g.connect(musicBus);
      o.start(time); o.stop(time + dur + 0.01);
    });
  }

  // ── Lookahead scheduler ──────────────────────────────────
  const LOOKAHEAD = 0.1; // seconds
  const TICK_MS   = 25;

  function scheduler() {
    if (!ctx || !cfg.music || !musicRunning) return;
    while (nextStep < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(nextStep);
      nextStep += STEP;
      seqStep++;
    }
    seqTimeout = setTimeout(scheduler, TICK_MS);
  }

  function startMusic() {
    if (!ctx || musicRunning) return;
    musicRunning = true;
    seqStep      = 0;
    nextStep     = ctx.currentTime + 0.1;
    chordIdx     = 0; barCount = 0;
    scheduler();
  }

  function stopMusic() {
    musicRunning = false;
    if (seqTimeout) { clearTimeout(seqTimeout); seqTimeout = null; }
  }

  function setMusic(v) {
    cfg.music = v;
    musicBus && (musicBus.gain.value = v ? 0.22 : 0);
    if (!v) stopMusic(); else if (ctx) startMusic();
  }

  function setSfx(v) {
    cfg.sfx = v;
    sfxBus && (sfxBus.gain.value = v ? 0.85 : 0);
  }

  function getSettings() { return { ...cfg }; }

  return { init, resume, play, startMusic, stopMusic, setMusic, setSfx, getSettings };
})();
