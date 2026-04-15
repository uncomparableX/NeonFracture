// ═══════════════════════════════════════════════════════
// NEON FRACTURE — RENDERER (FIXED)
// ═══════════════════════════════════════════════════════

const Renderer = (() => {
  let scene, camera, renderer;

  function init() {
    if (!window.THREE) {
      console.error('THREE.js not loaded');
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
    renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(renderer.domElement);

    camera.position.z = 5;

    animate();
  }

  function animate() {
    requestAnimationFrame(animate);
    if (renderer) renderer.render(scene, camera);
  }

  return {
    init
  };
})();
