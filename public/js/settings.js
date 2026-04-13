// ═══════════════════════════════════════════════════════
// NEON FRACTURE — SETTINGS
// ═══════════════════════════════════════════════════════
const Settings = (() => {
  const defaults = { sfx: true, music: true, shake: true, gfx: 'medium' };
  let cfg = { ...defaults };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('nf_settings') || '{}');
      cfg = { ...defaults, ...saved };
    } catch(e) {}
    apply();
  }

  function save() {
    try { localStorage.setItem('nf_settings', JSON.stringify(cfg)); } catch(e) {}
  }

  function apply() {
    Audio.setSfx(cfg.sfx);
    Audio.setMusic(cfg.music);
    Renderer.setQuality(cfg.gfx);
    // Update toggle states
    ['sfx','music','shake'].forEach(k => {
      const el = document.getElementById(`toggle-${k}`);
      if (el) el.classList.toggle('active', cfg[k]);
    });
    const gfxEl = document.getElementById('gfx-quality');
    if (gfxEl) gfxEl.value = cfg.gfx;
  }

  function toggle(key) {
    cfg[key] = !cfg[key];
    const el = document.getElementById(`toggle-${key}`);
    if (el) el.classList.toggle('active', cfg[key]);
    if (key === 'sfx') Audio.setSfx(cfg.sfx);
    if (key === 'music') { Audio.setMusic(cfg.music); if (cfg.music) Audio.startMusic(); }
    save();
    Audio.play('uiClick');
  }

  function setGfx(val) {
    cfg.gfx = val;
    Renderer.setQuality(val);
    save();
  }

  function get(key) { return cfg[key]; }

  return { load, toggle, setGfx, get };
})();
