// ═══════════════════════════════════════════════════════
//  NEON FRACTURE — RENDERER  (Complete v4)
//  FIXED: all graphics, colourful arena, visible boundary,
//         rich lighting, neon floor, animated sky dome
// ═══════════════════════════════════════════════════════
const Renderer = (() => {
  let _renderer = null, _scene = null, _camera = null, _clock = null;
  let _ready    = false;

  // Object maps
  const playerMeshes  = new Map();
  const bulletMeshes  = new Map();
  const coreMeshes    = new Map();
  const powerupMeshes = new Map();
  let   particles     = [];

  // Arena animated refs
  let cameraTarget = null, cameraOffset = null, shakeMag = 0;
  let myPlayerId   = null, quality = 'medium';

  let centerCrystal = null, centerRing = null, innerRing = null;
  let pulseRings    = [];
  let teamLightA    = null, teamLightB = null, centerLight = null;
  let boundaryGlow  = []; // animated boundary strips
  let skyDome       = null;
  let floorGrid     = null;

  const TEAM_A_COLOR  = 0x00d4ff;
  const TEAM_B_COLOR  = 0xff6b35;
  const TEAM_COLORS   = { A: TEAM_A_COLOR, B: TEAM_B_COLOR };
  const POWERUP_COLS  = { health: 0x39ff14, speed: 0xffee00, ammo: 0xff00ff };

  // ── INIT ──────────────────────────────────────────────
  function init(canvasEl) {
    if (_ready) { try { clear(); } catch(e) {} }

    cameraTarget = new THREE.Vector3();
    cameraOffset = new THREE.Vector3(0, 24, 28);

    const w = window.innerWidth, h = window.innerHeight;

    _renderer = new THREE.WebGLRenderer({
      canvas:            canvasEl,
      antialias:         quality !== 'low',
      powerPreference:  'high-performance'
    });
    _renderer.setSize(w, h);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'low' ? 1 : 1.5));
    _renderer.shadowMap.enabled  = quality === 'high';
    _renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    _renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 2.0; // brighter overall scene
    try { _renderer.outputColorSpace = THREE.SRGBColorSpace; } catch(e) {}

    _scene = new THREE.Scene();
    _scene.fog = new THREE.Fog(0x04081a, 70, 160); // pushed back — more arena visible

    _camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);
    _camera.position.set(0, 24, 28);
    _camera.lookAt(0, 0, 0);

    _clock = new THREE.Clock();

    // Reset collections
    playerMeshes.clear(); bulletMeshes.clear();
    coreMeshes.clear();   powerupMeshes.clear();
    particles = [];
    pulseRings = []; boundaryGlow = [];
    centerCrystal = centerRing = innerRing = null;
    teamLightA = teamLightB = centerLight = skyDome = floorGrid = null;

    _buildSkyDome();
    _buildArena();
    _buildLighting();
    _buildBoundaryWalls();
    _buildCenterStructure();
    _buildTeamBases();
    _buildObstacles();
    _buildBackgroundParticles();

    window.removeEventListener('resize', _onResize);
    window.addEventListener('resize', _onResize);

    _ready = true;
    console.log('[Renderer] v4 init complete');
    return _renderer;
  }

  function _onResize() {
    if (!_camera || !_renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    _camera.aspect = w / h;
    _camera.updateProjectionMatrix();
    _renderer.setSize(w, h);
  }

  function setQuality(q) { quality = q; }

  // ══════════════════════════════════════════════════════
  //  ARENA CONSTRUCTION
  // ══════════════════════════════════════════════════════

  // Sky dome — deep space with nebula colours
  function _buildSkyDome() {
    // Use vertex colours to fake a top-to-horizon gradient — zero shader cost
    const geo = new THREE.SphereGeometry(280, 24, 16);
    const posArr = geo.attributes.position.array;
    const colours = new Float32Array(posArr.length);
    for (let i = 0; i < posArr.length; i += 3) {
      const y = posArr[i + 1]; // positive = up
      const t = Math.max(0, Math.min(1, (y + 280) / 560)); // 0=bottom,1=top
      // horizon: deep purple-blue  top: near-black dark-navy
      colours[i]     = 0.02 + t * 0.01;   // R
      colours[i + 1] = 0.03 + t * 0.02;   // G
      colours[i + 2] = 0.10 + t * 0.05;   // B — noticeably blue-purple
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    const mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
    skyDome = new THREE.Mesh(geo, mat);
    _scene.add(skyDome);
  }

  // Floor — glowing hex tile pattern
  function _buildArena() {
    // Base floor - dark blue-black
    const floorMat = new THREE.MeshStandardMaterial({
      color:            0x010a18,
      roughness:        0.9,
      metalness:        0.1,
      emissive:         0x001133,
      emissiveIntensity: 0.6
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    _scene.add(floor);

    // Neon grid lines on floor — bright cyan
    const gridMat = new THREE.LineBasicMaterial({ color: 0x004466, transparent: true, opacity: 0.7 });
    for (let i = -45; i <= 45; i += 5) {
      _scene.add(_line([-45, 0.03, i], [45, 0.03, i], gridMat));
      _scene.add(_line([i, 0.03, -45], [i, 0.03, 45], gridMat));
    }

    // Bright axis cross
    _scene.add(_line([-45, 0.05, 0], [45, 0.05, 0],
      new THREE.LineBasicMaterial({ color: 0x00aadd, transparent: true, opacity: 0.5 })));
    _scene.add(_line([0, 0.05, -45], [0, 0.05, 45],
      new THREE.LineBasicMaterial({ color: 0x00aadd, transparent: true, opacity: 0.5 })));

    // Hex floor tiles — vibrant colour-coded by zone (cheap MeshBasicMaterial = no lighting cost)
    if (quality !== 'low') {
      // Palette: centre = purple, left = cyan tint, right = orange tint
      const getHexColor = (col, row) => {
        const cx = (col - 5) * 8.0;
        if (cx < -14) return [0x001e44, 0x0044aa]; // team A zone — blue
        if (cx >  14) return [0x2a0e00, 0x994400]; // team B zone — orange
        return [0x16002e, 0x6600cc];                // centre — purple
      };
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 11; c++) {
          const x = (c - 5) * 8.0 + ((r % 2) ? 4.0 : 0);
          const z = (r - 3) * 7.0;
          if (Math.abs(x) > 44 || Math.abs(z) > 44) continue;
          const [baseCol, emitCol] = getHexColor(c, r);
          const isAccent = (r + c) % 4 === 0; // every 4th tile is brighter
          const hx = new THREE.Mesh(
            new THREE.CylinderGeometry(3.6, 3.6, 0.05, 6),
            new THREE.MeshStandardMaterial({
              color:             baseCol,
              emissive:          emitCol,
              emissiveIntensity: isAccent ? 0.9 : 0.45,
              transparent:       true,
              opacity:           isAccent ? 0.85 : 0.65
            })
          );
          hx.position.set(x, 0.025, z);
          _scene.add(hx);
        }
      }
    }

    // Team zone floor tints — stronger opacity so zones feel distinct
    const zoneA = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 92),
      new THREE.MeshStandardMaterial({
        color: 0x00aaff, transparent: true, opacity: 0.09,
        emissive: 0x0088cc, emissiveIntensity: 0.5
      })
    );
    zoneA.rotation.x = -Math.PI / 2;
    zoneA.position.set(-32, 0.06, 0);
    _scene.add(zoneA);

    const zoneB = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 92),
      new THREE.MeshStandardMaterial({
        color: 0xff6b35, transparent: true, opacity: 0.09,
        emissive: 0xff4400, emissiveIntensity: 0.5
      })
    );
    zoneB.rotation.x = -Math.PI / 2;
    zoneB.position.set(32, 0.06, 0);
    _scene.add(zoneB);
  }

  // Boundary walls — VISIBLE glowing walls so players know the edge
  function _buildBoundaryWalls() {
    const MAP = 47;
    // Wall geometry is thin but TALL so it's very visible
    const wallH = 6;
    const wallData = [
      { pos: [0,  wallH/2,  MAP], size: [94, wallH, 0.8], color: 0x00ccff, emit: 0x0088cc }, // North
      { pos: [0,  wallH/2, -MAP], size: [94, wallH, 0.8], color: 0x00ccff, emit: 0x0088cc }, // South
      { pos: [ MAP, wallH/2, 0], size: [0.8, wallH, 94], color: 0xff6b35, emit: 0xcc4400 }, // East
      { pos: [-MAP, wallH/2, 0], size: [0.8, wallH, 94], color: 0x00ccff, emit: 0x0088cc }  // West
    ];

    wallData.forEach(w => {
      // Main wall body — dark with emissive tint
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(...w.size),
        new THREE.MeshStandardMaterial({
          color:            0x001122,
          emissive:         new THREE.Color(w.emit),
          emissiveIntensity: 0.4,
          metalness:        0.95,
          roughness:        0.2,
          transparent:      true,
          opacity:          0.85
        })
      );
      wall.position.set(...w.pos);
      wall.castShadow = true;
      _scene.add(wall);

      // Glowing top edge strip — the most visible part
      const [sx, sy, sz] = w.size;
      const edgeStrip = new THREE.Mesh(
        new THREE.BoxGeometry(sx + 0.2, 0.25, sz + 0.2),
        new THREE.MeshStandardMaterial({
          color:            new THREE.Color(w.color),
          emissive:         new THREE.Color(w.color),
          emissiveIntensity: 4.0,
          transparent:      true,
          opacity:          0.9
        })
      );
      edgeStrip.position.set(w.pos[0], w.pos[1] + sy / 2 + 0.12, w.pos[2]);
      _scene.add(edgeStrip);
      boundaryGlow.push(edgeStrip);

      // Glowing base strip on floor
      const baseStrip = new THREE.Mesh(
        new THREE.BoxGeometry(sx + 0.5, 0.12, sz + 0.5),
        new THREE.MeshStandardMaterial({
          color:            new THREE.Color(w.color),
          emissive:         new THREE.Color(w.color),
          emissiveIntensity: 3.0,
          transparent:      true,
          opacity:          0.7
        })
      );
      baseStrip.position.set(w.pos[0], 0.06, w.pos[2]);
      _scene.add(baseStrip);
      boundaryGlow.push(baseStrip);
    });

    // Corner tower pillars — bright and colourful
    [[-MAP, -MAP], [MAP, -MAP], [-MAP, MAP], [MAP, MAP]].forEach(([x, z], i) => {
      const color  = i % 2 === 0 ? 0x00d4ff : 0xff6b35;
      const emitC  = new THREE.Color(color);

      // Tower body
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 2.2, 10, 6),
        new THREE.MeshStandardMaterial({
          color:            0x000d1a,
          emissive:         emitC,
          emissiveIntensity: 0.5,
          metalness:        0.95
        })
      );
      tower.position.set(x, 5, z);
      _scene.add(tower);

      // Glowing beacon orb on top
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 10, 10),
        new THREE.MeshStandardMaterial({
          color:            new THREE.Color(color),
          emissive:         new THREE.Color(color),
          emissiveIntensity: 5.0
        })
      );
      orb.position.set(x, 10.7, z);
      orb.userData.isBeacon = true;
      orb.userData.beaconColor = color;
      orb.userData.beaconPhase = Math.random() * Math.PI * 2;
      _scene.add(orb);

      // Point light from each beacon
      const bl = new THREE.PointLight(new THREE.Color(color), 3.5, 20);
      bl.position.set(x, 10, z);
      _scene.add(bl);

      // Horizontal glow ring around tower top
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.5, 0.15, 6, 24),
        new THREE.MeshStandardMaterial({
          color:            new THREE.Color(color),
          emissive:         new THREE.Color(color),
          emissiveIntensity: 3.0,
          transparent:      true,
          opacity:          0.7
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 9.5, z);
      ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.8;
      pulseRings.push(ring);
      _scene.add(ring);
    });
  }

  // Central structure — the focal point with colour
  function _buildCenterStructure() {
    // Raised platform
    _scene.add(_mesh(
      new THREE.CylinderGeometry(8, 9, 0.6, 12),
      { color: 0x001122, emissive: 0x003355, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.2 },
      [0, 0.3, 0]
    ));

    // Outer glow ring — cyan
    centerRing = _mesh(
      new THREE.TorusGeometry(9, 0.25, 8, 48),
      { color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 2.5, transparent: true, opacity: 0.8 },
      [0, 0.6, 0]
    );
    centerRing.rotation.x = Math.PI / 2;
    _scene.add(centerRing);

    // Inner spinning ring — orange
    innerRing = _mesh(
      new THREE.TorusGeometry(5, 0.12, 6, 36),
      { color: 0xff9900, emissive: 0xff9900, emissiveIntensity: 3, transparent: true, opacity: 0.75 },
      [0, 0.65, 0]
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.userData.spinSpeed = 2.5;
    pulseRings.push(innerRing);
    _scene.add(innerRing);

    // Second inner ring — purple
    const pRing = _mesh(
      new THREE.TorusGeometry(3, 0.1, 6, 30),
      { color: 0xcc00ff, emissive: 0xcc00ff, emissiveIntensity: 3, transparent: true, opacity: 0.7 },
      [0, 0.65, 0]
    );
    pRing.rotation.set(Math.PI / 2, 0, 0.5);
    pRing.userData.spinSpeed = -3.5;
    pulseRings.push(pRing);
    _scene.add(pRing);

    // Central pillar
    _scene.add(_mesh(
      new THREE.CylinderGeometry(0.7, 1.2, 9, 8),
      { color: 0x001122, emissive: 0x002244, emissiveIntensity: 1.5, metalness: 0.95 },
      [0, 4.5, 0]
    ));

    // Floating crystal — the gem of the arena
    centerCrystal = _mesh(
      new THREE.OctahedronGeometry(1.8),
      { color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 4, transparent: true, opacity: 0.9 },
      [0, 10, 0]
    );
    _scene.add(centerCrystal);

    // Crystal light source
    centerLight = new THREE.PointLight(0x00ffff, 5, 30);
    centerLight.position.set(0, 10, 0);
    _scene.add(centerLight);

    // Vertical energy beam going up from crystal
    const beam = _mesh(
      new THREE.CylinderGeometry(0.08, 0.5, 20, 6, 1, true),
      { color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2, transparent: true, opacity: 0.12, side: 2 },
      [0, 20, 0]
    );
    _scene.add(beam);

    // Spokes radiating out from centre
    const spokeMat = new THREE.LineBasicMaterial({ color: 0x004466, transparent: true, opacity: 0.4 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      _scene.add(_line([0, 0.06, 0], [Math.cos(a) * 46, 0.06, Math.sin(a) * 46], spokeMat));
    }
  }

  // Team bases — strong colours so teams know where to spawn
  function _buildTeamBases() {
    [
      { x: -30, color: TEAM_A_COLOR, emitInt: 0.25, team: 'A' },
      { x:  30, color: TEAM_B_COLOR, emitInt: 0.25, team: 'B' }
    ].forEach(base => {
      const col = new THREE.Color(base.color);

      // Raised platform
      const plat = _mesh(
        new THREE.BoxGeometry(20, 0.5, 22),
        { color: 0x000d1a, emissive: col, emissiveIntensity: base.emitInt, metalness: 0.85 },
        [base.x, 0.25, 0]
      );
      plat.receiveShadow = true;
      _scene.add(plat);

      // Platform top neon edge
      const platEdge = _mesh(
        new THREE.BoxGeometry(20.3, 0.1, 22.3),
        { color: base.color, emissive: base.color, emissiveIntensity: 2.5, transparent: true, opacity: 0.8 },
        [base.x, 0.55, 0]
      );
      _scene.add(platEdge);

      // 4 corner pillars
      [[-8, -9], [8, -9], [-8, 9], [8, 9]].forEach(([px, pz]) => {
        const pillar = _mesh(
          new THREE.CylinderGeometry(0.3, 0.35, 6, 7),
          { color: base.color, emissive: col, emissiveIntensity: 2.5 },
          [base.x + px, 3, pz]
        );
        _scene.add(pillar);

        // Top cap glow
        const cap = _mesh(
          new THREE.SphereGeometry(0.5, 8, 8),
          { color: base.color, emissive: col, emissiveIntensity: 5.5 },
          [base.x + px, 6.5, pz]
        );
        cap.userData.isBeacon = true;
        cap.userData.beaconColor = base.color;
        cap.userData.beaconPhase = Math.random() * Math.PI * 2;
        _scene.add(cap);
      });

      // Horizontal connecting ring
      const connRing = _mesh(
        new THREE.TorusGeometry(10, 0.12, 6, 32),
        { color: base.color, emissive: col, emissiveIntensity: 2, transparent: true, opacity: 0.6 },
        [base.x, 5.5, 0]
      );
      connRing.rotation.x = Math.PI / 2;
      connRing.userData.spinSpeed = (base.team === 'A' ? 0.4 : -0.4);
      pulseRings.push(connRing);
      _scene.add(connRing);

      // Team light
      const tl = new THREE.PointLight(new THREE.Color(base.color), 4, 35);
      tl.position.set(base.x, 6, 0);
      _scene.add(tl);
      if (base.team === 'A') teamLightA = tl; else teamLightB = tl;

      // Floor spawn glow
      const glow = _mesh(
        new THREE.PlaneGeometry(18, 20),
        { color: base.color, emissive: col, emissiveIntensity: 0.15, transparent: true, opacity: 0.12 },
        [base.x, 0.05, 0]
      );
      glow.rotation.x = -Math.PI / 2;
      _scene.add(glow);
    });
  }

  // Obstacles / cover — with bright neon top edges
  function _buildObstacles() {
    const configs = [
      { x: -10, z: -12, w: 5, h: 3,   d: 3.5, c: TEAM_A_COLOR },
      { x:  10, z: -12, w: 5, h: 3,   d: 3.5, c: TEAM_B_COLOR },
      { x: -10, z:  12, w: 5, h: 3,   d: 3.5, c: TEAM_A_COLOR },
      { x:  10, z:  12, w: 5, h: 3,   d: 3.5, c: TEAM_B_COLOR },
      { x: -20, z:   0, w: 2.5, h: 3.5, d: 9, c: TEAM_A_COLOR },
      { x:  20, z:   0, w: 2.5, h: 3.5, d: 9, c: TEAM_B_COLOR },
      { x:   0, z: -22, w: 9, h: 2.5, d: 2.5, c: 0xcc00ff     },
      { x:   0, z:  22, w: 9, h: 2.5, d: 2.5, c: 0xcc00ff     },
      { x: -33, z: -18, w: 3, h: 2.5, d: 3,   c: TEAM_A_COLOR },
      { x: -33, z:  18, w: 3, h: 2.5, d: 3,   c: TEAM_A_COLOR },
      { x:  33, z: -18, w: 3, h: 2.5, d: 3,   c: TEAM_B_COLOR },
      { x:  33, z:  18, w: 3, h: 2.5, d: 3,   c: TEAM_B_COLOR }
    ];

    configs.forEach(c => {
      // Dark body
      const obs = _mesh(
        new THREE.BoxGeometry(c.w, c.h, c.d),
        { color: 0x050f20, roughness: 0.45, metalness: 0.7,  emissive: new THREE.Color(c.c).multiplyScalar(0.18), emissiveIntensity: 1.2 },
        [c.x, c.h / 2, c.z]
      );
      obs.castShadow = obs.receiveShadow = true;
      _scene.add(obs);

      // Neon top edge
      const edge = _mesh(
        new THREE.BoxGeometry(c.w + 0.15, 0.15, c.d + 0.15),
        { color: c.c, emissive: c.c, emissiveIntensity: 3.5, transparent: true, opacity: 0.85 },
        [c.x, c.h + 0.07, c.z]
      );
      _scene.add(edge);

      // Subtle corner glow lights
      const pl = new THREE.PointLight(new THREE.Color(c.c), 0.8, 8);
      pl.position.set(c.x, c.h, c.z);
      _scene.add(pl);
    });
  }

  // ── LIGHTING ──────────────────────────────────────────
  function _buildLighting() {
    // Brighter ambient — characters are visible without looking washed-out
    _scene.add(new THREE.AmbientLight(0x1a2a50, 2.2));

    // Key directional — cooler white from above so team colours pop
    const dir = new THREE.DirectionalLight(0xc8d8ff, 1.2);
    dir.position.set(10, 50, 20);
    dir.castShadow = quality === 'high';
    if (dir.castShadow) {
      dir.shadow.mapSize.set(2048, 2048);
      dir.shadow.camera.left = dir.shadow.camera.bottom = -55;
      dir.shadow.camera.right = dir.shadow.camera.top = 55;
      dir.shadow.bias = -0.001;
    }
    _scene.add(dir);

    // Vivid coloured fills — Team A side cyan, Team B side warm orange
    const sideA = new THREE.DirectionalLight(0x0055bb, 0.9);
    sideA.position.set(-40, 15, 0); _scene.add(sideA);
    const sideB = new THREE.DirectionalLight(0xbb4400, 0.9);
    sideB.position.set(40, 15, 0); _scene.add(sideB);

    // Upward purple fill — gives floor a nice purple-glow sheen
    const bounce = new THREE.DirectionalLight(0x330066, 0.6);
    bounce.position.set(0, -20, 0); _scene.add(bounce);
  }

  // Floating particle field in background
  function _buildBackgroundParticles() {
    const count = quality === 'low' ? 200 : 600;
    const pos   = new Float32Array(count * 3);
    const col   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r   = 120 + Math.random() * 150;
      const phi = Math.random() * Math.PI;
      const th  = Math.random() * Math.PI * 2;
      pos[i*3]   = r * Math.sin(phi) * Math.cos(th);
      pos[i*3+1] = Math.random() * 80 + 5;
      pos[i*3+2] = r * Math.sin(phi) * Math.sin(th);
      // Mix of cyan, purple, orange, white — carnival feel in background
      const bright = 0.5 + Math.random() * 0.5;
      const rng = Math.random();
      if (rng < 0.45) {         // cyan-blue
        col[i*3]=bright*0.15; col[i*3+1]=bright*0.65; col[i*3+2]=bright;
      } else if (rng < 0.7) {   // orange-yellow
        col[i*3]=bright; col[i*3+1]=bright*0.45; col[i*3+2]=0;
      } else if (rng < 0.85) {  // purple-pink
        col[i*3]=bright*0.7; col[i*3+1]=0; col[i*3+2]=bright;
      } else {                  // near-white stars
        col[i*3]=bright; col[i*3+1]=bright; col[i*3+2]=bright;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo,
      new THREE.PointsMaterial({ size: 1.2, vertexColors: true, transparent: true, opacity: 0.8 }));
    _scene.add(pts);
    skyDome.userData.particles = pts; // reuse ref for rotation
  }

  // ── MESH HELPERS ──────────────────────────────────────
  function _mesh(geo, matProps, pos) {
    const mat = new THREE.MeshStandardMaterial(matProps);
    const m   = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    return m;
  }

  function _line(a, b, mat) {
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...a), new THREE.Vector3(...b)
      ]),
      mat
    );
  }

  // ── PLAYER MESHES ─────────────────────────────────────
  function _createPlayerMesh(player) {
    const group = new THREE.Group();
    const color = TEAM_COLORS[player.team] || 0x00d4ff;
    const cObj  = new THREE.Color(color);
    const dim   = cObj.clone().multiplyScalar(0.3);

    // Blob shadow — elliptical, cheaper than real shadow, good depth cue
    const shdw = _mesh(
      new THREE.CircleGeometry(0.95, 10),
      { color: 0x000000, transparent: true, opacity: 0.55 },
      [0, 0.018, 0]
    );
    shdw.rotation.x = -Math.PI / 2;
    group.add(shdw);

    // ── Character scale: 1.35× bigger, softer/rounder shapes, warmer body colour ──
    // Using SphereGeometry for rounder feel (cheap, same poly as capsule)
    const bodyCol = player.team === 'A' ? 0x0a1e3a : 0x2a0e08; // tinted body per team
    const legMat  = { color: bodyCol, emissive: dim, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.6 };

    // Rounded legs — spheres instead of cylinders = cuter silhouette, same cost
    [-0.28, 0.28].forEach((s, li) => {
      const leg = _mesh(new THREE.SphereGeometry(0.2, 8, 6), legMat, [s, 0.22, 0]);
      leg.scale.y = 1.9;  // stretch vertically = pill shape
      leg.userData.isLeg = li;
      group.add(leg);
    });

    // Torso — slightly rounded box (bigger + rounder = cuter)
    const torso = _mesh(new THREE.BoxGeometry(1.15, 1.1, 0.72),
      { color: bodyCol, emissive: dim, emissiveIntensity: 1.0, metalness: 0.5, roughness: 0.5 },
      [0, 1.22, 0]);
    torso.castShadow = true;
    group.add(torso);

    // Chest panel — wide team-colour stripe, very visible
    group.add(_mesh(new THREE.BoxGeometry(1.16, 0.32, 0.74),
      { color, emissive: cObj, emissiveIntensity: 3.5 }, [0, 1.28, 0]));

    // Rounded shoulder pads — adds cute silhouette bulk
    [-0.68, 0.68].forEach(s => {
      group.add(_mesh(new THREE.SphereGeometry(0.25, 7, 6),
        { color, emissive: cObj, emissiveIntensity: 2 }, [s, 1.5, 0]));
    });

    // Arms
    [-0.76, 0.76].forEach(s => {
      const arm = _mesh(new THREE.SphereGeometry(0.17, 7, 6), legMat, [s, 1.15, 0.06]);
      arm.scale.y = 2.2;
      group.add(arm);
    });

    // Head — rounder with SphereGeometry top, box jaw = cute helmet look
    const head = _mesh(new THREE.SphereGeometry(0.44, 10, 8),
      { color: bodyCol, emissive: dim, emissiveIntensity: 1.4, metalness: 0.4, roughness: 0.4 },
      [0, 2.04, 0]);
    head.castShadow = true;
    group.add(head);

    // Visor — wide glowing band, very readable at distance
    group.add(_mesh(new THREE.BoxGeometry(0.62, 0.22, 0.12),
      { color, emissive: cObj, emissiveIntensity: 6, transparent: true, opacity: 0.97 },
      [0, 2.06, 0.4]));

    // Ear nubs — cheap detail that sells the helmet shape
    [-0.45, 0.45].forEach(s =>
      group.add(_mesh(new THREE.BoxGeometry(0.09, 0.22, 0.22),
        { color, emissive: cObj, emissiveIntensity: 3 }, [s, 2.04, 0.06]))
    );

    // Gun — thicker and more prominent
    group.add(_mesh(new THREE.BoxGeometry(0.14, 0.2, 0.75),
      { color, emissive: cObj, emissiveIntensity: 3, metalness: 1 },
      [0.72, 1.15, -0.42]));

    // Aura sphere — soft team-coloured glow ring around whole character
    const aura = _mesh(new THREE.SphereGeometry(1.3, 8, 8),
      { color, emissive: cObj, emissiveIntensity: 0.7, transparent: true, opacity: 0.07 },
      [0, 1.1, 0]);
    group.add(aura);
    group.userData.aura = aura;

    // Player point light — big contribution to scene colour
    const pl = new THREE.PointLight(new THREE.Color(color), 4.5, 10);
    pl.position.set(0, 1.5, 0);
    group.add(pl);
    group.userData.pLight = pl;

    // Health bar sprite
    group.userData.healthBar = _makeHealthBar(color);
    group.add(group.userData.healthBar);

    // Name tag sprite
    group.userData.nameTag = _makeNameTag(player.name, color);
    group.add(group.userData.nameTag);

    // Shield bubble — hidden by default
    const shield = _mesh(new THREE.SphereGeometry(1.7, 14, 12),
      { color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.8, transparent: true, opacity: 0.22, wireframe: true },
      [0, 1.0, 0]);
    shield.visible = false;
    group.add(shield);
    group.userData.shield = shield;

    // Freeze overlay
    const ice = _mesh(new THREE.SphereGeometry(1.5, 10, 8),
      { color: 0x88ddff, emissive: 0x44aaee, emissiveIntensity: 1.5, transparent: true, opacity: 0.3 },
      [0, 1.0, 0]);
    ice.visible = false;
    group.add(ice);
    group.userData.iceMesh = ice;

    group.userData.team = player.team;
    group.userData.walkPhase = Math.random() * Math.PI * 2;
    group.userData.prevX = 0; group.userData.prevZ = 0;
    return group;
  }

  function _makeHealthBar(teamColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 22;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(2.4, 0.38, 1); spr.position.y = 3.0;
    spr.userData = { canvas, ctx, teamColor, isHealthBar: true };
    _updateHealthBar(spr, 1);
    return spr;
  }

  function _updateHealthBar(spr, pct) {
    if (!spr?.userData?.isHealthBar) return;
    const { canvas, ctx, teamColor } = spr.userData;
    ctx.clearRect(0, 0, 128, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(2, 7, 124, 11);
    const hex = '#' + teamColor.toString(16).padStart(6, '0');
    ctx.fillStyle = pct > 0.5 ? hex : pct > 0.25 ? '#ffaa00' : '#ff2244';
    ctx.fillRect(2, 7, Math.max(0, 124 * pct), 11);
    spr.material.map.needsUpdate = true;
  }

  function _makeNameTag(name, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 60;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 60);
    ctx.font = 'bold 22px "Orbitron",monospace';
    ctx.textAlign = 'center';
    const hex = '#' + color.toString(16).padStart(6, '0');
    ctx.shadowColor = hex; ctx.shadowBlur = 14; ctx.fillStyle = hex;
    ctx.fillText(name.substring(0, 14).toUpperCase(), 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(3.4, 0.75, 1); spr.position.y = 3.7;
    return spr;
  }

  // ── CORE MESH ─────────────────────────────────────────
  function _createCoreMesh(core) {
    const group = new THREE.Group();

    group.add(_mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.3, 8),
      { color: 0x111122, metalness: 0.9, roughness: 0.3, emissive: 0x003366, emissiveIntensity: 0.7 }));

    const ring1 = _mesh(new THREE.TorusGeometry(1.1, 0.1, 6, 28),
      { color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 4, transparent: true, opacity: 0.9 },
      [0, 0.5, 0]);
    ring1.rotation.x = Math.PI / 2; ring1.userData.spinSpeed = 2.5;
    group.add(ring1); group.userData.ring1 = ring1;

    const ring2 = _mesh(new THREE.TorusGeometry(0.8, 0.07, 5, 22),
      { color: 0xff8800, emissive: 0xff8800, emissiveIntensity: 3, transparent: true, opacity: 0.75 },
      [0, 0.5, 0]);
    ring2.rotation.set(1.2, 0.5, 0); ring2.userData.spinSpeed = -3.5;
    group.add(ring2); group.userData.ring2 = ring2;

    const crystal = _mesh(new THREE.OctahedronGeometry(0.55),
      { color: 0xffffff, emissive: 0xffee55, emissiveIntensity: 6, transparent: true, opacity: 0.95 },
      [0, 0.5, 0]);
    group.add(crystal); group.userData.crystal = crystal;

    const light = new THREE.PointLight(0xffaa00, 4, 12);
    light.position.y = 0.5; group.add(light); group.userData.light = light;

    // Capture beam (thin upward cylinder)
    const beam = _mesh(
      new THREE.CylinderGeometry(0.06, 0.35, 14, 6, 1, true),
      { color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 1.5, transparent: true, opacity: 0.1, side: 2 },
      [0, 7, 0]
    );
    group.add(beam);

    group.position.set(core.x, 0.15, core.z);
    group.userData.floatOffset = Math.random() * Math.PI * 2;
    return group;
  }

  // ── POWERUP MESH ──────────────────────────────────────
  function _createPowerupMesh(pu) {
    const group = new THREE.Group();
    const color = POWERUP_COLS[pu.type] || 0xffffff;
    const c     = new THREE.Color(color);

    const body = _mesh(new THREE.IcosahedronGeometry(0.55),
      { color, emissive: c, emissiveIntensity: 4, transparent: true, opacity: 0.92 });
    group.add(body); group.userData.body = body;

    const ring = _mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 26),
      { color, emissive: c, emissiveIntensity: 3, transparent: true, opacity: 0.65 });
    ring.rotation.x = Math.PI / 2; group.add(ring);

    const pl = new THREE.PointLight(new THREE.Color(color), 3, 7);
    group.add(pl);

    group.position.set(pu.x, 0.7, pu.z);
    group.userData.floatOffset = Math.random() * Math.PI * 2;
    return group;
  }

  // ── PARTICLE FX ───────────────────────────────────────
  function _spawnParticle(x, y, z, vel, color, life, decay, geo) {
    if (!_scene) return;
    const p = new THREE.Mesh(
      geo || new THREE.SphereGeometry(0.1 + Math.random() * 0.12, 4, 4),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color), emissive: new THREE.Color(color),
        emissiveIntensity: 5, transparent: true, opacity: 1
      })
    );
    p.position.set(x, y, z);
    p.userData.vel   = vel instanceof THREE.Vector3 ? vel : new THREE.Vector3(...vel);
    p.userData.life  = life  || 1.0;
    p.userData.decay = decay || 0.045;
    _scene.add(p);
    particles.push(p);
  }

  function _shockwave(x, z, color) {
    if (!_scene) return;
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.1, 4, 20),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color), emissive: new THREE.Color(color),
        emissiveIntensity: 4, transparent: true, opacity: 0.9
      })
    );
    r.rotation.x = Math.PI / 2; r.position.set(x, 0.12, z);
    r.userData = { vel: new THREE.Vector3(), life: 0.7, decay: 0.045, isShockwave: true };
    _scene.add(r); particles.push(r);
  }

  // Public particle spawners
  function spawnExplosion(x, y, z, color, count) {
    if (!_ready) return;
    color = color || 0xff4400; count = quality === 'low' ? Math.floor((count||18)*0.4) : (count||18);
    for (let i = 0; i < count; i++) {
      const spd = 0.1 + Math.random() * 0.22;
      const ang = Math.random() * Math.PI * 2;
      _spawnParticle(
        x + (Math.random()-0.5)*0.5, y, z + (Math.random()-0.5)*0.5,
        new THREE.Vector3(Math.cos(ang)*spd, 0.05+Math.random()*0.2, Math.sin(ang)*spd),
        color, 1.0, 0.04 + Math.random()*0.03
      );
    }
    _shockwave(x, z, color);
  }

  function spawnDashTrail(x, y, z, team) {
    if (!_ready) return;
    const color = TEAM_COLORS[team] || 0x00d4ff;
    for (let i = 0; i < 14; i++) {
      _spawnParticle(
        x + (Math.random()-0.5)*0.7, y + Math.random()*2, z + (Math.random()-0.5)*0.7,
        new THREE.Vector3((Math.random()-0.5)*0.05, 0.03+Math.random()*0.05, (Math.random()-0.5)*0.05),
        color, 0.9, 0.05 + Math.random()*0.03
      );
    }
  }

  function spawnFreezeEffect(x, z) {
    if (!_ready) return;
    for (let i = 0; i < 20; i++) {
      const a = (i/20)*Math.PI*2;
      _spawnParticle(x, 0.4, z,
        new THREE.Vector3(Math.cos(a)*0.28, 0.08+Math.random()*0.1, Math.sin(a)*0.28),
        0x88eeff, 0.9, 0.022 + Math.random()*0.015,
        new THREE.IcosahedronGeometry(0.15 + Math.random()*0.12)
      );
    }
    _shockwave(x, z, 0x44ccff);
  }

  function spawnCaptureEffect(x, z) {
    if (!_ready) return;
    for (let i = 0; i < 32; i++) {
      const a = Math.random()*Math.PI*2, spd = 0.12+Math.random()*0.22;
      _spawnParticle(x, 0.6, z,
        new THREE.Vector3(Math.cos(a)*spd, 0.15+Math.random()*0.12, Math.sin(a)*spd),
        0xffff00, 1.0, 0.025+Math.random()*0.015
      );
    }
    _shockwave(x, z, 0xffcc00);
  }

  function spawnShieldBreak(x, z) {
    if (!_ready) return;
    for (let i = 0; i < 16; i++) {
      const a = (i/16)*Math.PI*2;
      _spawnParticle(
        x + Math.cos(a)*1.6, 1, z + Math.sin(a)*1.6,
        new THREE.Vector3(Math.cos(a)*0.18, 0.06+Math.random()*0.1, Math.sin(a)*0.18),
        0x00ffff, 0.7, 0.045,
        new THREE.BoxGeometry(0.09, 0.09, 0.38)
      );
    }
  }

  function spawnLevelUpEffect(x, z) {
    if (!_ready) return;
    for (let i = 0; i < 22; i++) {
      _spawnParticle(
        x + (Math.random()-0.5)*0.9, Math.random()*0.6, z + (Math.random()-0.5)*0.9,
        new THREE.Vector3((Math.random()-0.5)*0.05, 0.14+Math.random()*0.09, (Math.random()-0.5)*0.05),
        0xffd700, 1.2, 0.02
      );
    }
  }

  function addBulletTrail(x, z, team) {
    if (!_ready || quality === 'low') return;
    const color = TEAM_COLORS[team] || 0x00d4ff;
    _spawnParticle(x, 0.65, z, new THREE.Vector3(0, 0.015, 0), color, 0.22, 0.09,
      new THREE.SphereGeometry(0.07, 4, 4));
  }

  // ── STATE SYNC ────────────────────────────────────────
  function syncGameState(state, myId) {
    if (!_ready || !_scene) return;
    myPlayerId = myId;
    const now  = Date.now();

    // Players
    const seenP = new Set();
    (state.players || []).forEach(p => {
      seenP.add(p.id);
      if (!playerMeshes.has(p.id)) {
        const m = _createPlayerMesh(p); _scene.add(m); playerMeshes.set(p.id, m);
      }
      const mesh = playerMeshes.get(p.id);
      mesh.visible = !!p.alive;
      if (!p.alive) return;

      // Smooth interpolation for others, snap for self
      if (p.id !== myId) {
        mesh.position.x += (p.x - mesh.position.x) * 0.4;
        mesh.position.z += (p.z - mesh.position.z) * 0.4;
      } else {
        mesh.position.x = p.x; mesh.position.z = p.z;
      }
      mesh.position.y = 0;
      mesh.rotation.y = -p.rotY;

      // Walk animation
      const moved = Math.abs(p.x - (mesh.userData.prevX||p.x)) + Math.abs(p.z - (mesh.userData.prevZ||p.z));
      if (moved > 0.02) {
        mesh.userData.walkPhase = (mesh.userData.walkPhase||0) + 0.25;
        const wb = Math.sin(mesh.userData.walkPhase) * 0.22;
        mesh.children.forEach(c => {
          if (c.userData.isLeg === 0) c.position.z =  wb;
          if (c.userData.isLeg === 1) c.position.z = -wb;
        });
      }
      mesh.userData.prevX = p.x; mesh.userData.prevZ = p.z;

      // Health bar
      if (mesh.userData.healthBar) _updateHealthBar(mesh.userData.healthBar, p.health / 100);

      // Shield / freeze
      if (mesh.userData.shield) mesh.userData.shield.visible = !!p.shieldActive;
      if (mesh.userData.iceMesh) mesh.userData.iceMesh.visible = (p.frozenUntil||0) > now;

      // Increase glow on frozen players
      if (mesh.userData.pLight) {
        mesh.userData.pLight.intensity = (p.frozenUntil||0) > now ? 5 : 3;
        mesh.userData.pLight.color.set(
          (p.frozenUntil||0) > now ? 0x88ccff : (TEAM_COLORS[p.team] || 0x00d4ff)
        );
      }
    });
    playerMeshes.forEach((m, id) => {
      if (!seenP.has(id)) { _scene.remove(m); playerMeshes.delete(id); }
    });

    // Bullets
    const seenB = new Set();
    (state.bullets || []).forEach(b => {
      seenB.add(b.id);
      if (!bulletMeshes.has(b.id)) {
        const color  = TEAM_COLORS[b.team] || 0x00d4ff;
        const bullet = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 7, 7),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(color), emissive: new THREE.Color(color), emissiveIntensity: 7
          })
        );
        const bl = new THREE.PointLight(new THREE.Color(color), 3, 5); bullet.add(bl);
        _scene.add(bullet); bulletMeshes.set(b.id, bullet);
      }
      const bm = bulletMeshes.get(b.id);
      addBulletTrail(b.x, b.z, b.team);
      bm.position.set(b.x, 0.7, b.z);
    });
    bulletMeshes.forEach((m, id) => {
      if (!seenB.has(id)) { _scene.remove(m); bulletMeshes.delete(id); }
    });

    // Cores
    (state.cores || []).forEach(c => {
      if (!coreMeshes.has(c.id)) {
        const cm = _createCoreMesh(c); _scene.add(cm); coreMeshes.set(c.id, cm);
      }
      coreMeshes.get(c.id).visible = !!c.active;
    });

    // Powerups
    const seenPU = new Set();
    (state.powerups || []).forEach(pu => {
      seenPU.add(pu.id);
      if (!powerupMeshes.has(pu.id)) {
        const pm = _createPowerupMesh(pu); _scene.add(pm); powerupMeshes.set(pu.id, pm);
      }
    });
    powerupMeshes.forEach((m, id) => {
      if (!seenPU.has(id)) { _scene.remove(m); powerupMeshes.delete(id); }
    });

    // Camera follow my player
    if (myId) {
      const myP = (state.players || []).find(p => p.id === myId);
      if (myP && myP.alive) {
        cameraTarget.lerp(new THREE.Vector3(myP.x, 0, myP.z), 0.07);
      }
    }
  }

  // ── RENDER LOOP ───────────────────────────────────────
  function render() {
    if (!_ready || !_renderer || !_scene || !_camera || !_clock) return;

    try {
      const delta   = _clock.getDelta();
      const elapsed = _clock.getElapsedTime();

      // Camera
      _camera.position.x += (cameraTarget.x - _camera.position.x) * 0.07;
      _camera.position.z += (cameraTarget.z + cameraOffset.z - _camera.position.z) * 0.07;
      _camera.position.y += (cameraOffset.y - _camera.position.y) * 0.05;
      if (shakeMag > 0) {
        _camera.position.x += (Math.random()-0.5) * shakeMag;
        _camera.position.y += (Math.random()-0.5) * shakeMag * 0.5;
        shakeMag *= 0.80; if (shakeMag < 0.002) shakeMag = 0;
      }
      _camera.lookAt(new THREE.Vector3(cameraTarget.x, 0, cameraTarget.z));

      // Arena anims
      if (centerCrystal) {
        centerCrystal.rotation.y += delta * 1.4;
        centerCrystal.rotation.x += delta * 0.5;
        centerCrystal.position.y  = 10 + Math.sin(elapsed * 1.5) * 0.4;
      }
      if (centerRing)  centerRing.rotation.z  += delta * 0.5;
      if (centerLight) centerLight.intensity   = 4 + 1.5 * Math.sin(elapsed * 2.5);
      if (teamLightA)  teamLightA.intensity    = 3.5 + 1.0 * Math.sin(elapsed * 1.7);
      if (teamLightB)  teamLightB.intensity    = 3.5 + 1.0 * Math.sin(elapsed * 1.7 + 1.6);

      // Spinning rings
      pulseRings.forEach(r => { r.rotation.z += delta * (r.userData.spinSpeed || 1.5); });

      // Boundary glow pulse
      boundaryGlow.forEach((b, i) => {
        b.material.emissiveIntensity = 2.5 + 1.5 * Math.sin(elapsed * 1.8 + i * 0.5);
      });

      // Beacon orbs pulse
      _scene.traverse(obj => {
        if (obj.userData.isBeacon) {
          const phase = obj.userData.beaconPhase || 0;
          obj.material.emissiveIntensity = 4 + 2 * Math.sin(elapsed * 2.5 + phase);
        }
      });

      // Core animations
      coreMeshes.forEach(cm => {
        if (!cm.visible) return;
        const t = elapsed + (cm.userData.floatOffset || 0);
        cm.position.y = 0.15 + Math.sin(t * 2.2) * 0.22;
        if (cm.userData.ring1) cm.userData.ring1.rotation.z   += delta * 2.5;
        if (cm.userData.ring2) cm.userData.ring2.rotation.y   += delta * 3.5;
        if (cm.userData.crystal) cm.userData.crystal.rotation.y += delta * 2.5;
        if (cm.userData.light) cm.userData.light.intensity = 3.5 + 1.5 * Math.sin(t * 3.5);
      });

      // Powerup float
      powerupMeshes.forEach(pm => {
        const t = elapsed + (pm.userData.floatOffset || 0);
        pm.position.y = 0.7 + Math.sin(t * 2.3) * 0.2;
        pm.rotation.y += delta * 2.2;
      });

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= p.userData.decay;
        if (p.userData.isShockwave) {
          p.scale.addScalar(0.22);
          p.material.opacity = p.userData.life;
        } else {
          p.position.addScaledVector(p.userData.vel, 1);
          p.userData.vel.y -= 0.010;
          p.material.opacity = p.userData.life;
          p.scale.multiplyScalar(0.970);
        }
        if (p.userData.life <= 0) { _scene.remove(p); particles.splice(i, 1); }
      }

      // Background particle drift
      if (skyDome?.userData?.particles) skyDome.userData.particles.rotation.y += delta * 0.003;

      _renderer.render(_scene, _camera);
    } catch(err) {
      console.warn('[Renderer] frame error (skipped):', err.message);
    }
  }

  function shake(mag) {
    mag = mag || 0.3;
    try { if (typeof Settings !== 'undefined' && !Settings.get('shake')) return; } catch(e) {}
    shakeMag = Math.max(shakeMag, mag);
  }

  function clear() {
    if (_scene) {
      playerMeshes.forEach(m  => _scene.remove(m));
      bulletMeshes.forEach(m  => _scene.remove(m));
      coreMeshes.forEach(m    => _scene.remove(m));
      powerupMeshes.forEach(m => _scene.remove(m));
      particles.forEach(p     => _scene.remove(p));
    }
    playerMeshes.clear(); bulletMeshes.clear();
    coreMeshes.clear();   powerupMeshes.clear();
    particles = [];
    if (cameraTarget) cameraTarget.set(0, 0, 0);
    myPlayerId = null;
  }

  // ── PUBLIC API ────────────────────────────────────────
  return {
    init, render, clear, setQuality, shake,
    syncGameState,
    spawnExplosion, spawnDashTrail, spawnFreezeEffect,
    spawnCaptureEffect, spawnShieldBreak, spawnLevelUpEffect,
    addBulletTrail
  };
})();
