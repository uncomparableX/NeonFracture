// ═══════════════════════════════════════════════════════
// NEON FRACTURE — RENDERER (FINAL STABLE)
// ═══════════════════════════════════════════════════════

const Renderer = (() => {
  let scene, camera, renderer;

  function init() {
    if (!window.THREE) {
      console.error('[Renderer] THREE.js not loaded');
      return;
    }

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(renderer.domElement);

    camera.position.z = 5;

    window.addEventListener('resize', onResize);

    animate();
  }

  function onResize() {
    if (!camera || !renderer) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  return {
    init
  };
})();
