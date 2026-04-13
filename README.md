# ⚡ NEON FRACTURE: QUANTUM ARENA

> A AAA-quality futuristic multiplayer browser game built with Three.js, Socket.io, and Node.js.

```
╔══════════════════════════════════════════════════════════╗
║  NEON FRACTURE: QUANTUM ARENA  —  v1.0.0 QUANTUM BUILD  ║
╚══════════════════════════════════════════════════════════╝
```

## 🎮 Game Overview

**Neon Fracture** is a real-time competitive multiplayer arena shooter running entirely in the browser. 
Two teams fight over energy cores and eliminate enemies in a glowing cyber arena.

### Win Conditions
- Capture 5 energy cores scattered across the arena (+10 pts each)
- Eliminate enemy players (+5 pts per kill)
- **First team to 100 points wins**, or highest score when time runs out (5 min)

---

## 📁 Project Structure

```
neon-fracture/
├── server/
│   └── index.js          # Node.js + Socket.io game server
├── public/
│   ├── index.html         # Main HTML shell
│   ├── css/
│   │   └── style.css      # Full AAA-quality stylesheet
│   └── js/
│       ├── audio.js       # Web Audio API synth engine
│       ├── renderer.js    # Three.js 3D renderer
│       ├── game.js        # Client-side game logic + HUD
│       ├── network.js     # Socket.io client layer
│       ├── ui.js          # Screen & UI manager
│       ├── input.js       # Keyboard + mouse input
│       ├── mobile.js      # Touch + virtual joystick
│       ├── settings.js    # Settings persistence
│       └── main.js        # Entry point + home background
├── package.json
├── render.yaml            # Render.com deployment config
└── README.md
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
# Clone or extract the project
cd neon-fracture

# Install dependencies
npm install

# Start the server
npm start

# Open in browser
open http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## 🌐 Deployment

### Option 1: Render.com (Recommended — Free)

1. Push code to a GitHub repository
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Deploy — your game will be live at `https://your-app.onrender.com`

The `render.yaml` file is pre-configured for one-click deployment.

### Option 2: Railway.app (Free tier)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Option 3: Fly.io (Free)

```bash
# Install flyctl
# https://fly.io/docs/hands-on/install-flyctl/

fly launch
fly deploy
```

### Option 4: Heroku

```bash
heroku create your-neon-fracture
git push heroku main
```

---

## 🎮 Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Move | WASD / Arrow Keys | Left joystick |
| Aim | Mouse | Right side drag |
| Shoot | Left click / Space | FIRE button |
| Quantum Dash | Q | ⚡ button |
| Time Freeze | E | ❄ button |
| Energy Pulse | R | ◎ button |
| Shield | F | 🛡 button |
| Scoreboard | TAB | — |

---

## ⚡ Abilities

| Ability | Key | Energy Cost | Cooldown | Effect |
|---------|-----|-------------|----------|--------|
| Quantum Dash | Q | 20 | 3s | Teleport forward 8 units |
| Time Freeze | E | 35 | 8s | Freeze all nearby enemies for 3s |
| Energy Pulse | R | 30 | 5s | 8-directional bullet burst |
| Shield Barrier | F | 25 | 6s | Block 80% damage for 4s |

---

## 🏗️ Architecture

```
Client (Browser)                    Server (Node.js)
─────────────────                   ─────────────────
Three.js Renderer                   Socket.io Server
├── 3D Arena (WebGL)                ├── Room Manager
├── Player Meshes                   ├── Game Tick (20Hz)
├── Particle System                 ├── Physics (bullets)
└── Post-processing                 ├── Collision Detection
                                    ├── Score Tracking
Web Audio API                       └── State Broadcast
├── Synth SFX
└── Procedural Music

Socket.io Client ◄──────────────── Socket.io Server
├── playerInput (50Hz)              ├── gameState (20Hz)
├── shoot                           ├── playerHit
├── useAbility                      ├── playerKilled
└── createRoom/joinRoom             └── coreCaptured
```

---

## 🔧 Configuration

Edit `server/index.js` to tune:

```js
const TICK_RATE = 20;        // Server tick rate (Hz)
const MAP_SIZE = 80;          // Arena size (units)
const PLAYER_SPEED = 0.25;    // Movement speed
const BULLET_SPEED = 1.2;     // Projectile speed
const ENERGY_REGEN = 0.15;    // Energy regen per tick
const HEALTH_MAX = 100;       // Max health
const ENERGY_MAX = 100;       // Max energy
```

---

## 🔮 Future Upgrade Suggestions

### Gameplay
- [ ] **Power-ups** — health packs, speed boosts, damage amplifiers scattered on map
- [ ] **Multiple game modes** — Deathmatch, King of the Hill, Capture the Flag
- [ ] **Character classes** — Tank, Assassin, Support with unique ability sets
- [ ] **Ranked matchmaking** — ELO-based skill matching
- [ ] **Persistent accounts** — JWT auth, leaderboards, cosmetics

### Visual
- [ ] **Post-processing** — Bloom, chromatic aberration, motion blur (Three.js EffectComposer)
- [ ] **Procedural map generation** — Different arena layouts each match
- [ ] **Animated skybox** — Moving nebula / cyber-city background
- [ ] **Advanced particles** — GPU particles for large-scale effects
- [ ] **Weapon skins** — Cosmetic ability visual variants

### Technical
- [ ] **Client-side prediction** — Smoother local movement
- [ ] **Lag compensation** — Hit registration on server at time of shot
- [ ] **WebRTC voice chat** — Team communication
- [ ] **Replay system** — Record and play back matches
- [ ] **Analytics** — Heatmaps, balance metrics

### Social
- [ ] **Friends system** — Invite links, private lobbies
- [ ] **Spectator mode** — Watch matches in progress
- [ ] **Tournament brackets** — Organized competitive play
- [ ] **Clan system** — Teams with persistent stats

---

## 📊 Performance Targets

| Device | FPS Target | Quality |
|--------|-----------|---------|
| High-end desktop | 60 FPS | High |
| Mid-range laptop | 60 FPS | Medium |
| Mobile (flagship) | 45 FPS | Low |
| Low-end mobile | 30 FPS | Low |

---

## 📄 License

MIT License — Free for personal and commercial use.

---

*Built with ❤️ and neon by the Quantum Arena team*
