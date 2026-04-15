window.addEventListener('DOMContentLoaded', () => {

  try { Audio?.init?.(); } catch {}

  try { Settings?.load?.(); } catch {}

  document.addEventListener('click', () => {
    try { Audio?.resume?.(); } catch {}
  }, { once: true });

  // SAFE hover
  document.addEventListener('mouseover', (e) => {
    if (e.target && e.target.matches &&
        e.target.matches('.btn-primary, .btn-secondary, .team-btn')) {
      try { Audio?.play?.('uiHover'); } catch {}
    }
  });

  createConnectionBadge();

  Network.connect();

  console.log('⚡ GAME BOOTED');
});

// SAFE CONNECTION BADGE
function createConnectionBadge() {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:10px;left:10px;
    font-size:10px;color:#0f0;z-index:9999;
  `;
  document.body.appendChild(el);

  setInterval(() => {
    el.textContent = Network.isConnected() ? 'CONNECTED' : 'OFFLINE';
  }, 1000);
}
