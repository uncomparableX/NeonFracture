// ═══════════════════════════════════════════════════════
// NEON FRACTURE — SETTINGS SYSTEM (FINAL FIX)
// ═══════════════════════════════════════════════════════

const Settings = (() => {
  let settings = {
    volume: 1,
    sensitivity: 1,
    graphics: 'high'
  };

  function load() {
    try {
      const saved = localStorage.getItem('nf_settings');
      if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[Settings] Failed to load settings');
    }

    apply();
  }

  function save() {
    try {
      localStorage.setItem('nf_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('[Settings] Failed to save settings');
    }
  }

  function apply() {
    // Safe renderer usage
    if (typeof Renderer !== 'undefined' && Renderer.init) {
      // future graphics adjustments can go here
    }
  }

  function set(key, value) {
    settings[key] = value;
    save();
    apply();
  }

  function get(key) {
    return settings[key];
  }

  return {
    load,
    save,
    set,
    get
  };
})();
