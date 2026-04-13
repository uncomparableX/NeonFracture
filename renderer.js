// ═══════════════════════════════════════════════════════
// NEON FRACTURE — THREE.JS RENDERER v2
// Full 3D arena, particle FX, animated world, powerups
// ═══════════════════════════════════════════════════════
const Renderer = (() => {
  let renderer, scene, camera, clock;
  let playerMeshes  = new Map();
  let bulletMeshes  = new Map();
  let coreMeshes    = new Map();
  let powerupMeshes = new Map();
  let particles     = [];
  let backgroundParticles;
  let cameraTarget  = new THREE.Vector3();
  let cameraOffset  = new THREE.Vector3(0, 22, 26);
  let shakeMag      = 0;
  let myPlayerId    = null;
  let quality       = 'medium';
  let frameCount    = 0;

  let centerCrystal, centerRing, pulseRings = [];
  let ambientLightA, ambientLightB, centerLight;

  const TEAM_COLORS = { A: 0x00d4ff, B: 0xff6b35 };
  const POWERUP_COLORS = { health: 0x39ff14, speed: 0xffff00, ammo: 0xff00ff };

  // ─── INIT ─────────────────────────────────────────────
  function init(canvasEl) {
    const w = window.innerWidth, h = window.innerHeight;
    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl, antialias: quality !== 'low',
      powerPreference: 'high-performance'
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'low' ? 1 : 1.5));
    renderer.shadowMap.enabled = quality === 'high';
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    try { renderer.outputColorSpace = THREE.SRGBColorSpace; } catch(e) {}

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000810, 0.016);
    scene.background = new THREE.Color(0x000308);

    camera = new THREE.PerspectiveCamera(62, w/h, 0.1, 600);
    camera.position.set(0, 22, 26);
    camera.lookAt(0, 0, 0);

    clock = new THREE.Clock();
    buildArena();
    buildLighting();
    buildBackground();
    window.addEventListener('resize', onResize);
    return renderer;
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w/h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  function setQuality(q) { quality = q; }

  // ─── ARENA ────────────────────────────────────────────
  function buildArena() {
    buildFloor(); buildGridOverlay(); buildBoundaryWalls();
    buildCenterStructure(); buildTeamBases(); buildObstacles();
    buildDecorColumns(); buildArenaMarkings();
  }

  function buildFloor() {
    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(102, 102),
      new THREE.MeshStandardMaterial({ color: 0x010812, roughness: 0.85, metalness: 0.15, emissive: 0x000306, emissiveIntensity: 1 })
    )).rotation.x = -Math.PI/2;

    if (quality !== 'low') {
      for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
        const hx = new THREE.Mesh(
          new THREE.CylinderGeometry(3.8, 3.8, 0.03, 6),
          new THREE.MeshStandardMaterial({ color: 0x001220, emissive: 0x001830, emissiveIntensity: 0.4, roughness: 0.7, metalness: 0.5, transparent: true, opacity: 0.55 })
        );
        hx.position.set((c-5.5)*6.92+((r%2)?3.46:0), 0.015, (r-3.5)*6.0);
        scene.add(hx);
      }
    }
  }

  function buildGridOverlay() {
    const mat = new THREE.LineBasicMaterial({ color: 0x003366, transparent: true, opacity: 0.5 });
    for (let i = -50; i <= 50; i += 5) {
      scene.add(makeLine([-50,0.02,i],[50,0.02,i],mat));
      scene.add(makeLine([i,0.02,-50],[i,0.02,50],mat));
    }
    const ax = new THREE.LineBasicMaterial({ color: 0x005599, transparent: true, opacity: 0.8 });
    scene.add(makeLine([-50,0.03,0],[50,0.03,0],ax));
    scene.add(makeLine([0,0.03,-50],[0,0.03,50],ax));
  }

  function makeLine(a, b, mat) {
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]),
      mat
    );
  }

  function buildBoundaryWalls() {
    const wMat = () => new THREE.MeshStandardMaterial({ color: 0x000d1a, roughness: 0.4, metalness: 0.9, emissive: 0x001122, emissiveIntensity: 0.6 });
    [[0,1.5,51,102,3,0.5],[0,1.5,-51,102,3,0.5],[51,1.5,0,0.5,3,102],[-51,1.5,0,0.5,3,102]].forEach(v => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(v[3],v[4],v[5]), wMat());
      m.position.set(v[0],v[1],v[2]); m.castShadow=true; scene.add(m);
    });
    [[-51,-51],[51,-51],[-51,51],[51,51]].forEach(([x,z]) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,8,6),
        new THREE.MeshStandardMaterial({ color:0x001122, emissive:0x003344, emissiveIntensity:0.8, metalness:0.9 }));
      t.position.set(x,4,z); scene.add(t);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4,8,8),
        new THREE.MeshStandardMaterial({ color:0x00ddff, emissive:0x00ddff, emissiveIntensity:4 }));
      orb.position.set(x,8.4,z); scene.add(orb);
      const bl = new THREE.PointLight(0x00ddff,1.5,12); bl.position.set(x,8,z); scene.add(bl);
    });
    const sM = new THREE.MeshStandardMaterial({ color:0x0077bb, emissive:0x0077bb, emissiveIntensity:1.5, transparent:true, opacity:0.4 });
    [[0,0.05,51,102,0.08,0.3],[0,0.05,-51,102,0.08,0.3],[51,0.05,0,0.3,0.08,102],[-51,0.05,0,0.3,0.08,102]].forEach(v => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(v[3],v[4],v[5]),sM.clone());
      s.position.set(v[0],v[1],v[2]); scene.add(s);
    });
  }

  function buildCenterStructure() {
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(7,8,0.5,12),
      new THREE.MeshStandardMaterial({ color:0x001122, emissive:0x002244, emissiveIntensity:0.5, metalness:0.9, roughness:0.3 }));
    plat.position.y=0.25; plat.receiveShadow=true; scene.add(plat);

    centerRing = new THREE.Mesh(new THREE.TorusGeometry(8,0.2,8,48),
      new THREE.MeshStandardMaterial({ color:0x00aaff, emissive:0x00aaff, emissiveIntensity:2, transparent:true, opacity:0.7 }));
    centerRing.rotation.x = Math.PI/2; centerRing.position.y=0.55; scene.add(centerRing);

    const iRing = new THREE.Mesh(new THREE.TorusGeometry(4,0.1,6,36),
      new THREE.MeshStandardMaterial({ color:0xff6b35, emissive:0xff6b35, emissiveIntensity:2.5, transparent:true, opacity:0.6 }));
    iRing.rotation.x=Math.PI/2; iRing.position.y=0.55; iRing.userData.spinSpeed=1.8;
    scene.add(iRing); pulseRings.push(iRing);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6,1.0,8,8),
      new THREE.MeshStandardMaterial({ color:0x001122, emissive:0x003355, emissiveIntensity:1, metalness:0.95, roughness:0.2 }));
    pillar.position.y=4; scene.add(pillar);

    centerCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.5),
      new THREE.MeshStandardMaterial({ color:0x00ffff, emissive:0x00ffff, emissiveIntensity:3, transparent:true, opacity:0.85 }));
    centerCrystal.position.y=9; scene.add(centerCrystal);

    centerLight = new THREE.PointLight(0x00ffff,3,25); centerLight.position.y=9; scene.add(centerLight);

    // Energy lines
    const lm = new THREE.LineBasicMaterial({ color:0x004466, transparent:true, opacity:0.5 });
    for (let i=0;i<12;i++) {
      const a=(i/12)*Math.PI*2;
      scene.add(makeLine([0,0.06,0],[Math.cos(a)*48,0.06,Math.sin(a)*48],lm.clone()));
    }
  }

  function buildTeamBases() {
    [{x:-28,color:0x00d4ff,team:'A'},{x:28,color:0xff6b35,team:'B'}].forEach(base => {
      const plat = new THREE.Mesh(new THREE.BoxGeometry(18,0.4,20),
        new THREE.MeshStandardMaterial({ color:0x000d1a, emissive:new THREE.Color(base.color), emissiveIntensity:0.12, metalness:0.8, roughness:0.4 }));
      plat.position.set(base.x,0.2,0); scene.add(plat);

      [[-7,-8],[7,-8],[-7,8],[7,8]].forEach(([px,pz]) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,5,6),
          new THREE.MeshStandardMaterial({ color:new THREE.Color(base.color), emissive:new THREE.Color(base.color), emissiveIntensity:1.8 }));
        col.position.set(base.x+px,2.5,pz); scene.add(col);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8),
          new THREE.MeshStandardMaterial({ color:new THREE.Color(base.color), emissive:new THREE.Color(base.color), emissiveIntensity:4 }));
        orb.position.set(base.x+px,5.4,pz); scene.add(orb);
      });

      const sg = new THREE.Mesh(new THREE.PlaneGeometry(16,18),
        new THREE.MeshStandardMaterial({ color:new THREE.Color(base.color), emissive:new THREE.Color(base.color), emissiveIntensity:0.08, transparent:true, opacity:0.15 }));
      sg.rotation.x=-Math.PI/2; sg.position.set(base.x,0.42,0); scene.add(sg);

      const bl = new THREE.PointLight(new THREE.Color(base.color),2.5,30);
      bl.position.set(base.x,5,0); scene.add(bl);
      if (base.team==='A') ambientLightA=bl; else ambientLightB=bl;
    });
  }

  function buildObstacles() {
    const cfgs = [
      {x:-10,z:-10,w:4,h:2.5,d:3},{x:10,z:-10,w:4,h:2.5,d:3},
      {x:-10,z:10,w:4,h:2.5,d:3},{x:10,z:10,w:4,h:2.5,d:3},
      {x:-18,z:0,w:2,h:3,d:8},{x:18,z:0,w:2,h:3,d:8},
      {x:-35,z:-20,w:3,h:2,d:3},{x:-35,z:20,w:3,h:2,d:3},
      {x:35,z:-20,w:3,h:2,d:3},{x:35,z:20,w:3,h:2,d:3}
    ];
    cfgs.forEach((c,i) => {
      const obs = new THREE.Mesh(new THREE.BoxGeometry(c.w,c.h,c.d),
        new THREE.MeshStandardMaterial({ color:0x000d1a, roughness:0.3, metalness:0.92, emissive:0x001122, emissiveIntensity:0.4 }));
      obs.position.set(c.x,c.h/2,c.z); obs.castShadow=obs.receiveShadow=true; scene.add(obs);
      const ec = i%2===0?0x00d4ff:0xff6b35;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(c.w+0.1,0.1,c.d+0.1),
        new THREE.MeshStandardMaterial({ color:ec, emissive:ec, emissiveIntensity:2.5, transparent:true, opacity:0.7 }));
      edge.position.set(c.x,c.h+0.05,c.z); scene.add(edge);
    });
  }

  function buildDecorColumns() {
    [[-25,25],[-25,-25],[25,25],[25,-25],[0,30],[0,-30]].forEach(([x,z]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.6,10,8),
        new THREE.MeshStandardMaterial({ color:0x000d1a, emissive:0x002233, emissiveIntensity:0.5, metalness:0.95, roughness:0.2 }));
      col.position.set(x,5,z); scene.add(col);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7,0.06,6,18),
        new THREE.MeshStandardMaterial({ color:0x00aaff, emissive:0x00aaff, emissiveIntensity:2.5, transparent:true, opacity:0.6 }));
      ring.position.set(x,5+(Math.random()*3-1.5),z);
      ring.rotation.x=Math.PI/2;
      ring.userData.floatOffset=Math.random()*Math.PI*2;
      ring.userData.isDecorRing=true;
      scene.add(ring);
    });
  }

  function buildArenaMarkings() {
    scene.add(makeLine([-19,0.04,-50],[-19,0.04,50],new THREE.LineBasicMaterial({color:0x003366,transparent:true,opacity:0.4})));
    scene.add(makeLine([19,0.04,-50],[19,0.04,50],new THREE.LineBasicMaterial({color:0x661100,transparent:true,opacity:0.4})));
    const div = new THREE.Mesh(new THREE.PlaneGeometry(0.1,100),
      new THREE.MeshStandardMaterial({color:0x004488,emissive:0x004488,emissiveIntensity:1,transparent:true,opacity:0.25}));
    div.rotation.x=-Math.PI/2; div.position.y=0.05; scene.add(div);
  }

  // ─── LIGHTING ─────────────────────────────────────────
  function buildLighting() {
    scene.add(new THREE.AmbientLight(0x020810,0.8));
    const dir = new THREE.DirectionalLight(0x203050,0.7);
    dir.position.set(15,40,20); dir.castShadow=quality==='high';
    if (dir.castShadow) {
      dir.shadow.mapSize.set(2048,2048);
      dir.shadow.camera.left=dir.shadow.camera.bottom=-60;
      dir.shadow.camera.right=dir.shadow.camera.top=60;
    }
    scene.add(dir);
    const rl=new THREE.DirectionalLight(0x003355,0.5); rl.position.set(-30,10,0); scene.add(rl);
    const rb=new THREE.DirectionalLight(0x331100,0.5); rb.position.set(30,10,0); scene.add(rb);
  }

  // ─── BACKGROUND ───────────────────────────────────────
  function buildBackground() {
    const count=quality==='low'?300:800;
    const pos=new Float32Array(count*3), col=new Float32Array(count*3);
    for (let i=0;i<count;i++) {
      const r=200+Math.random()*200, phi=Math.acos(2*Math.random()-1), th=Math.random()*Math.PI*2;
      pos[i*3]=r*Math.sin(phi)*Math.cos(th); pos[i*3+1]=Math.abs(r*Math.cos(phi))+20; pos[i*3+2]=r*Math.sin(phi)*Math.sin(th);
      const b=0.3+Math.random()*0.7, isO=Math.random()>0.75;
      col[i*3]=isO?b:b*0.3; col[i*3+1]=isO?b*0.4:b*0.7; col[i*3+2]=isO?b*0.1:b;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color',new THREE.BufferAttribute(col,3));
    backgroundParticles=new THREE.Points(geo,new THREE.PointsMaterial({size:0.8,vertexColors:true,transparent:true,opacity:0.9}));
    scene.add(backgroundParticles);
  }

  // ─── PLAYER FACTORY ───────────────────────────────────
  function createPlayerMesh(player) {
    const group=new THREE.Group();
    const color=TEAM_COLORS[player.team];
    const dim=new THREE.Color(color).multiplyScalar(0.35);

    // Shadow decal
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.7,12),
      new THREE.MeshStandardMaterial({color:0x000000,transparent:true,opacity:0.5}));
    shadow.rotation.x=-Math.PI/2; shadow.position.y=0.01; group.add(shadow);

    // Legs
    const legMat=new THREE.MeshStandardMaterial({color:0x080c14,emissive:dim,emissiveIntensity:0.5,metalness:0.85,roughness:0.3});
    [-0.22,0.22].forEach((side,li) => {
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.12,0.75,6),legMat);
      leg.position.set(side,0.38,0); leg.userData.isLeg=li; group.add(leg);
    });

    // Torso
    const torso=new THREE.Mesh(new THREE.BoxGeometry(0.9,1.0,0.55),
      new THREE.MeshStandardMaterial({color:0x060c16,emissive:dim,emissiveIntensity:0.8,metalness:0.9,roughness:0.2}));
    torso.position.y=1.15; torso.castShadow=true; group.add(torso);

    // Chest neon stripe
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.92,0.12,0.57),
      new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:3}));
    stripe.position.y=1.22; group.add(stripe);

    // Arms
    [-0.6,0.6].forEach(side => {
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.1,0.82,6),legMat.clone());
      arm.position.set(side,1.2,0.05); arm.rotation.z=side>0?0.28:-0.28; group.add(arm);
    });

    // Gun
    const gun=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.14,0.55),
      new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:2,metalness:1}));
    gun.position.set(0.6,1.1,-0.35); group.add(gun);

    // Head
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.65,0.58,0.62),
      new THREE.MeshStandardMaterial({color:0x0a1428,emissive:dim,emissiveIntensity:1.2,metalness:0.9,roughness:0.15}));
    head.position.y=1.88; head.castShadow=true; group.add(head);

    // Visor
    const visor=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.16,0.08),
      new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:4,transparent:true,opacity:0.95}));
    visor.position.set(0,1.92,0.36); group.add(visor);

    // Aura
    const aura=new THREE.Mesh(new THREE.SphereGeometry(1.05,8,8),
      new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:0.5,transparent:true,opacity:0.07}));
    aura.position.y=1.0; group.add(aura);
    group.userData.aura=aura;

    // Point light
    const pLight=new THREE.PointLight(new THREE.Color(color),2,7);
    pLight.position.y=1.5; group.add(pLight);
    group.userData.pLight=pLight;

    // Health bar sprite
    group.userData.healthBar=createHealthBarSprite(color);
    group.add(group.userData.healthBar);

    // Name tag
    const nt=createNameTag(player.name,color);
    group.add(nt); group.userData.nameTag=nt;

    // Shield
    const shield=new THREE.Mesh(new THREE.SphereGeometry(1.6,16,12),
      new THREE.MeshStandardMaterial({color:0x00ffff,emissive:0x00ffff,emissiveIntensity:0.8,transparent:true,opacity:0.18,wireframe:true}));
    shield.visible=false; shield.position.y=1.0; group.add(shield);
    group.userData.shield=shield;

    // Ice mesh
    const ice=new THREE.Mesh(new THREE.SphereGeometry(1.4,10,8),
      new THREE.MeshStandardMaterial({color:0x88ddff,emissive:0x44aaee,emissiveIntensity:1,transparent:true,opacity:0.25}));
    ice.visible=false; ice.position.y=1.0; group.add(ice);
    group.userData.iceMesh=ice;

    group.userData.team=player.team;
    group.userData.walkPhase=Math.random()*Math.PI*2;
    group.userData.prevX=0; group.userData.prevZ=0;
    return group;
  }

  function createHealthBarSprite(teamColor) {
    const canvas=document.createElement('canvas'); canvas.width=128; canvas.height=20;
    const ctx=canvas.getContext('2d');
    const tex=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
    sprite.scale.set(2.2,0.35,1); sprite.position.y=2.85;
    sprite.userData={canvas,ctx,teamColor,isHealthBar:true};
    updateHealthBar(sprite,1); return sprite;
  }

  function updateHealthBar(sprite,pct) {
    if (!sprite?.userData?.isHealthBar) return;
    const {canvas,ctx,teamColor}=sprite.userData;
    ctx.clearRect(0,0,128,20);
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(2,8,124,10);
    const hex='#'+teamColor.toString(16).padStart(6,'0');
    ctx.fillStyle=pct>0.5?hex:pct>0.25?'#ffaa00':'#ff2244';
    ctx.fillRect(2,8,Math.max(0,124*pct),10);
    sprite.material.map.needsUpdate=true;
  }

  function createNameTag(name,color) {
    const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=56;
    const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,256,56);
    ctx.font='bold 22px "Orbitron",monospace'; ctx.textAlign='center';
    const hex='#'+color.toString(16).padStart(6,'0');
    ctx.shadowColor=hex; ctx.shadowBlur=12; ctx.fillStyle=hex;
    ctx.fillText(name.substring(0,14).toUpperCase(),128,36);
    const tex=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
    sprite.scale.set(3.2,0.7,1); sprite.position.y=3.4;
    return sprite;
  }

  // ─── CORE FACTORY ─────────────────────────────────────
  function createCoreMesh(core) {
    const group=new THREE.Group();
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.5,0.25,8),
      new THREE.MeshStandardMaterial({color:0x111122,metalness:0.9,roughness:0.3,emissive:0x002244,emissiveIntensity:0.5})));

    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.0,0.08,6,28),
      new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0xffaa00,emissiveIntensity:3,transparent:true,opacity:0.85}));
    ring.rotation.x=Math.PI/2; ring.position.y=0.4; ring.userData.spinSpeed=2.2;
    group.add(ring); group.userData.ring=ring;

    const ring2=new THREE.Mesh(new THREE.TorusGeometry(0.75,0.05,5,22),
      new THREE.MeshStandardMaterial({color:0xff8800,emissive:0xff8800,emissiveIntensity:2.5,transparent:true,opacity:0.7}));
    ring2.position.y=0.5; ring2.rotation.set(Math.PI/2.5,0.5,0); ring2.userData.spinSpeed=-3.0;
    group.add(ring2); group.userData.ring2=ring2;

    const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(0.5),
      new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffee66,emissiveIntensity:5,transparent:true,opacity:0.95}));
    crystal.position.y=0.5; group.add(crystal); group.userData.crystal=crystal;

    const light=new THREE.PointLight(0xffaa00,3,10); light.position.y=0.5;
    group.add(light); group.userData.light=light;

    const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.4,12,6,1,true),
      new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0xffcc00,emissiveIntensity:1.5,transparent:true,opacity:0.12,side:THREE.DoubleSide}));
    beam.position.y=6; group.add(beam);

    group.position.set(core.x,0.12,core.z);
    group.userData.active=true;
    group.userData.floatOffset=Math.random()*Math.PI*2;
    return group;
  }

  // ─── POWERUP FACTORY ──────────────────────────────────
  function createPowerupMesh(pu) {
    const group=new THREE.Group();
    const color=POWERUP_COLORS[pu.type]||0xffffff;
    const body=new THREE.Mesh(new THREE.IcosahedronGeometry(0.5),
      new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:3,transparent:true,opacity:0.9}));
    group.add(body); group.userData.body=body;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.75,0.04,6,24),
      new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:2.5,transparent:true,opacity:0.5}));
    ring.rotation.x=Math.PI/2; group.add(ring);
    const light=new THREE.PointLight(new THREE.Color(color),2,6); group.add(light);
    group.position.set(pu.x,0.6,pu.z);
    group.userData.floatOffset=Math.random()*Math.PI*2;
    return group;
  }

  // ─── PARTICLE EFFECTS ─────────────────────────────────
  function addParticle(x,y,z,vel,color,life,decay,geo) {
    const p=new THREE.Mesh(
      geo||new THREE.SphereGeometry(0.08+Math.random()*0.1,4,4),
      new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:4,transparent:true,opacity:1})
    );
    p.position.set(x,y,z); p.userData.vel=vel; p.userData.life=life||1; p.userData.decay=decay||0.045;
    scene.add(p); particles.push(p);
  }

  function spawnShockwave(x,z,color) {
    const r=new THREE.Mesh(new THREE.TorusGeometry(0.2,0.08,4,20),
      new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:3,transparent:true,opacity:0.8}));
    r.rotation.x=Math.PI/2; r.position.set(x,0.1,z);
    r.userData={vel:new THREE.Vector3(),life:0.7,decay:0.05,isShockwave:true};
    scene.add(r); particles.push(r);
  }

  function spawnExplosion(x,y,z,color=0xff4400,count=22) {
    if (quality==='low') count=Math.floor(count*0.45);
    for (let i=0;i<count;i++) {
      const speed=0.12+Math.random()*0.22, angle=Math.random()*Math.PI*2;
      addParticle(
        x+(Math.random()-0.5)*0.4, y, z+(Math.random()-0.5)*0.4,
        new THREE.Vector3(Math.cos(angle)*speed,Math.random()*0.25,Math.sin(angle)*speed),
        color, 1.0, 0.045+Math.random()*0.03
      );
    }
    spawnShockwave(x,z,color);
  }

  function spawnDashTrail(x,y,z,team) {
    const color=TEAM_COLORS[team];
    for (let i=0;i<14;i++) {
      addParticle(
        x+(Math.random()-0.5)*0.6, y+Math.random()*1.8, z+(Math.random()-0.5)*0.6,
        new THREE.Vector3((Math.random()-0.5)*0.05,0.04+Math.random()*0.04,(Math.random()-0.5)*0.05),
        color, 0.9, 0.055+Math.random()*0.025
      );
    }
  }

  function spawnFreezeEffect(x,z) {
    for (let i=0;i<20;i++) {
      const a=(i/20)*Math.PI*2;
      addParticle(
        x,0.3,z, new THREE.Vector3(Math.cos(a)*0.25,0.08+Math.random()*0.08,Math.sin(a)*0.25),
        0x88eeff, 0.9, 0.02+Math.random()*0.015,
        new THREE.IcosahedronGeometry(0.14+Math.random()*0.1)
      );
    }
    spawnShockwave(x,z,0x44ccff);
  }

  function spawnCaptureEffect(x,z) {
    for (let i=0;i<35;i++) {
      const a=Math.random()*Math.PI*2, s=0.12+Math.random()*0.2;
      addParticle(x,0.5,z, new THREE.Vector3(Math.cos(a)*s,0.18+Math.random()*0.1,Math.sin(a)*s),
        0xffff00, 1.0, 0.025+Math.random()*0.015);
    }
    spawnShockwave(x,z,0xffcc00);
  }

  function spawnShieldBreak(x,z,team) {
    for (let i=0;i<16;i++) {
      const a=(i/16)*Math.PI*2;
      addParticle(
        x+Math.cos(a)*1.5, 1, z+Math.sin(a)*1.5,
        new THREE.Vector3(Math.cos(a)*0.15,0.05+Math.random()*0.1,Math.sin(a)*0.15),
        0x00ffff, 0.7, 0.04,
        new THREE.BoxGeometry(0.08,0.08,0.35)
      );
    }
  }

  function spawnLevelUpEffect(x,z) {
    for (let i=0;i<20;i++) {
      addParticle(
        x+(Math.random()-0.5)*0.8, Math.random()*0.5, z+(Math.random()-0.5)*0.8,
        new THREE.Vector3((Math.random()-0.5)*0.04,0.15+Math.random()*0.08,(Math.random()-0.5)*0.04),
        0xffd700, 1.2, 0.02
      );
    }
  }

  function addBulletTrail(x,z,team) {
    if (quality==='low') return;
    const color=TEAM_COLORS[team];
    addParticle(x,0.6,z, new THREE.Vector3(0,0.01,0), color, 0.25, 0.08,
      new THREE.SphereGeometry(0.06,4,4));
  }

  // ─── STATE SYNC ───────────────────────────────────────
  function syncGameState(state,myId) {
    myPlayerId=myId;
    const now=Date.now();

    // Players
    const seenP=new Set();
    state.players.forEach(p => {
      seenP.add(p.id);
      if (!playerMeshes.has(p.id)) {
        const mesh=createPlayerMesh(p); scene.add(mesh); playerMeshes.set(p.id,mesh);
      }
      const mesh=playerMeshes.get(p.id);
      mesh.visible=p.alive;
      if (!p.alive) return;

      if (p.id!==myId) {
        mesh.position.x+=(p.x-mesh.position.x)*0.35;
        mesh.position.z+=(p.z-mesh.position.z)*0.35;
      } else {
        mesh.position.x=p.x; mesh.position.z=p.z;
      }
      mesh.rotation.y=-p.rotY;

      const moved=Math.abs(p.x-(mesh.userData.prevX||p.x))+Math.abs(p.z-(mesh.userData.prevZ||p.z));
      if (moved>0.02) {
        mesh.userData.walkPhase=(mesh.userData.walkPhase||0)+0.22;
        const wb=Math.sin(mesh.userData.walkPhase)*0.18;
        mesh.children.forEach(c=>{
          if (c.userData.isLeg===0) c.position.z=wb;
          if (c.userData.isLeg===1) c.position.z=-wb;
        });
      }
      mesh.userData.prevX=p.x; mesh.userData.prevZ=p.z;

      if (mesh.userData.healthBar) updateHealthBar(mesh.userData.healthBar,p.health/100);
      if (mesh.userData.shield) mesh.userData.shield.visible=!!p.shieldActive;
      if (mesh.userData.iceMesh) mesh.userData.iceMesh.visible=p.frozenUntil>now;
    });
    playerMeshes.forEach((m,id)=>{ if (!seenP.has(id)) { scene.remove(m); playerMeshes.delete(id); } });

    // Bullets
    const seenB=new Set();
    state.bullets.forEach(b => {
      seenB.add(b.id);
      if (!bulletMeshes.has(b.id)) {
        const color=TEAM_COLORS[b.team];
        const bullet=new THREE.Mesh(new THREE.SphereGeometry(0.2,6,6),
          new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:6}));
        const bLight=new THREE.PointLight(new THREE.Color(color),2.5,4); bullet.add(bLight);
        scene.add(bullet); bulletMeshes.set(b.id,bullet);
      }
      const bm=bulletMeshes.get(b.id);
      addBulletTrail(b.x,b.z,b.team);
      bm.position.set(b.x,0.65,b.z);
    });
    bulletMeshes.forEach((m,id)=>{ if (!seenB.has(id)) { scene.remove(m); bulletMeshes.delete(id); } });

    // Cores
    state.cores.forEach(c => {
      if (!coreMeshes.has(c.id)) { const cm=createCoreMesh(c); scene.add(cm); coreMeshes.set(c.id,cm); }
      coreMeshes.get(c.id).visible=c.active;
    });

    // Powerups
    const seenPU=new Set();
    (state.powerups||[]).forEach(pu => {
      seenPU.add(pu.id);
      if (!powerupMeshes.has(pu.id)) { const pm=createPowerupMesh(pu); scene.add(pm); powerupMeshes.set(pu.id,pm); }
    });
    powerupMeshes.forEach((m,id)=>{ if (!seenPU.has(id)) { scene.remove(m); powerupMeshes.delete(id); } });

    // Camera
    if (myId) {
      const myP=state.players.find(p=>p.id===myId);
      if (myP&&myP.alive) cameraTarget.lerp(new THREE.Vector3(myP.x,0,myP.z),0.06);
    }
  }

  // ─── RENDER LOOP ──────────────────────────────────────
  function render() {
    const delta=clock.getDelta(), elapsed=clock.getElapsedTime();
    frameCount++;

    // Camera
    camera.position.x+=(cameraTarget.x-camera.position.x)*0.07;
    camera.position.z+=(cameraTarget.z+cameraOffset.z-camera.position.z)*0.07;
    camera.position.y+=(cameraOffset.y-camera.position.y)*0.05;
    if (shakeMag>0) {
      camera.position.x+=(Math.random()-0.5)*shakeMag;
      camera.position.y+=(Math.random()-0.5)*shakeMag*0.5;
      camera.position.z+=(Math.random()-0.5)*shakeMag*0.5;
      shakeMag*=0.82; if (shakeMag<0.002) shakeMag=0;
    }
    camera.lookAt(new THREE.Vector3(cameraTarget.x,0,cameraTarget.z));

    // Arena anims
    if (centerCrystal) {
      centerCrystal.rotation.y+=delta*1.2; centerCrystal.rotation.x+=delta*0.4;
      centerCrystal.position.y=9+Math.sin(elapsed*1.4)*0.35;
    }
    if (centerRing) centerRing.rotation.z+=delta*0.6;
    if (centerLight) centerLight.intensity=2.5+0.8*Math.sin(elapsed*2.5);
    pulseRings.forEach(r=>{ r.rotation.z+=delta*(r.userData.spinSpeed||1); });
    scene.traverse(o=>{ if (o.userData.isDecorRing) o.position.y+=Math.sin(elapsed*1.5+(o.userData.floatOffset||0))*delta*0.5; });
    if (ambientLightA) ambientLightA.intensity=2+0.6*Math.sin(elapsed*1.8);
    if (ambientLightB) ambientLightB.intensity=2+0.6*Math.sin(elapsed*1.8+1.5);

    // Cores
    coreMeshes.forEach(cm=>{
      if (!cm.visible) return;
      const t=elapsed+cm.userData.floatOffset;
      cm.position.y=0.12+Math.sin(t*2.0)*0.2;
      if (cm.userData.ring)    cm.userData.ring.rotation.z+=delta*2.2;
      if (cm.userData.ring2)   cm.userData.ring2.rotation.y+=delta*3.0;
      if (cm.userData.crystal) { cm.userData.crystal.rotation.y+=delta*2; cm.userData.crystal.position.y=0.5+Math.sin(t*2.5)*0.12; }
      if (cm.userData.light)   cm.userData.light.intensity=2.5+1.0*Math.sin(t*3);
    });

    // Powerups
    powerupMeshes.forEach(pm=>{
      const t=elapsed+pm.userData.floatOffset;
      pm.position.y=0.6+Math.sin(t*2.2)*0.18;
      pm.rotation.y+=delta*2;
    });

    // Particles
    for (let i=particles.length-1;i>=0;i--) {
      const p=particles[i]; p.userData.life-=p.userData.decay;
      if (p.userData.isShockwave) { p.scale.addScalar(0.18); p.material.opacity=p.userData.life; }
      else { p.position.addScaledVector(p.userData.vel,1); p.userData.vel.y-=0.009; p.material.opacity=p.userData.life; p.scale.multiplyScalar(0.975); }
      if (p.userData.life<=0) { scene.remove(p); particles.splice(i,1); }
    }

    if (backgroundParticles) backgroundParticles.rotation.y+=delta*0.004;
    renderer.render(scene,camera);
  }

  function shake(mag=0.3) {
    try { if (Settings&&!Settings.get('shake')) return; } catch(e) {}
    shakeMag=Math.max(shakeMag,mag);
  }

  function clear() {
    playerMeshes.forEach(m=>scene.remove(m));  playerMeshes.clear();
    bulletMeshes.forEach(m=>scene.remove(m));  bulletMeshes.clear();
    coreMeshes.forEach(m=>scene.remove(m));    coreMeshes.clear();
    powerupMeshes.forEach(m=>scene.remove(m)); powerupMeshes.clear();
    particles.forEach(p=>scene.remove(p));     particles.length=0;
    cameraTarget.set(0,0,0); myPlayerId=null;
  }

  return {
    init,render,clear,setQuality,shake,syncGameState,
    spawnExplosion,spawnDashTrail,spawnFreezeEffect,
    spawnCaptureEffect,spawnShieldBreak,spawnLevelUpEffect,addBulletTrail
  };
})();
