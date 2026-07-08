# Neon Fracture ⚡
### *Quantum Arena — Real Time Multiplayer Browser Based Game*
#### *Fast-Paced Competitive Arena Shooter Built for the Web*

<p align="center">

![Status](https://img.shields.io/badge/status-Active%20Development-orange?style=for-the-badge)
![Game](https://img.shields.io/badge/game-Real--Time%20Multiplayer-purple?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Web%20Browser-blue?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-66.2%25-yellow?style=for-the-badge&logo=javascript)
![CSS](https://img.shields.io/badge/CSS-24.8%25-blue?style=for-the-badge&logo=css3)
![HTML](https://img.shields.io/badge/HTML-9.0%25-orange?style=for-the-badge&logo=html5)
![Node.js](https://img.shields.io/badge/backend-Node.js-green?style=for-the-badge&logo=node.js)
![Socket.io](https://img.shields.io/badge/network-Socket.io-black?style=for-the-badge&logo=socket.io)
![Three.js](https://img.shields.io/badge/rendering-Three.js-white?style=for-the-badge&logo=three.js)
![WebGL](https://img.shields.io/badge/graphics-WebGL-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-lightgrey?style=for-the-badge)

</p>

<p align="center">
  <strong>Neon Fracture is not just a browser game.</strong><br/>
  It is a real-time multiplayer systems engineering project built around networking, synchronization, server-authoritative architecture, browser-native rendering, and competitive arena combat.
</p>

---

# ⚠️ Active Development

> **Neon Fracture is currently under active development.**
>
> Core multiplayer systems are functional, but gameplay balancing, visuals, optimization, feature expansion, and competitive systems are still evolving.

---

# 🌌 What is Neon Fracture?

**Neon Fracture: Quantum Arena** is a **browser-based real-time multiplayer arena combat game** where players fight in a futuristic battleground using movement, shooting, tactical abilities, and objective-based scoring.

Built entirely for the browser, Neon Fracture focuses on:

- **real-time multiplayer networking**
- **server-authoritative game architecture**
- **low-latency synchronization**
- **tick-based simulation**
- **ability-driven combat**
- **browser-native rendering**
- **competitive multiplayer systems**

Unlike simple browser games focused on local gameplay, Neon Fracture emphasizes **real-time systems engineering** and **multiplayer state consistency**, making it both a playable game **and** a technically strong engineering project.

---

# 🎯 Why Neon Fracture Exists

Building multiplayer games is fundamentally harder than building normal web apps.

Real-time multiplayer systems require:

- synchronization across multiple clients
- low-latency networking
- authoritative game state management
- event-driven communication
- deterministic simulation loops
- distributed state broadcasting
- combat resolution consistency
- performance-sensitive rendering

**Neon Fracture was built to explore those engineering challenges inside a browser-native multiplayer game.**

---

# 🎮 Gameplay Overview

## Match Objective

Two teams battle inside a futuristic arena:

- **Alpha Team**
- **Omega Team**

Victory conditions:

- First team to **100 points**
- Or highest score when the **5-minute timer expires**

---

## Scoring System

| Action | Points |
|------|------|
| Capture Energy Core | +10 |
| Eliminate Enemy | +5 |

---

## Tactical Abilities

Every player has access to combat abilities:

| Ability | Effect |
|------|------|
| **Dash** | Short forward teleport |
| **Freeze** | Temporarily disables nearby enemies |
| **Pulse** | Radial burst attack |
| **Shield** | Reduces incoming damage |

---

# ⚡ Feature Highlights

## Multiplayer Systems

- Real-time browser multiplayer
- Server-authoritative game state
- Tick-based simulation loop
- Low-latency WebSocket networking
- Cross-client synchronization
- Live state broadcasting
- Team scoring logic
- Competitive match handling

---

## Gameplay Systems

- Team-based arena combat
- Objective-based scoring
- Tactical ability system
- Cooldowns & energy costs
- Match timer logic
- Death/respawn systems
- Combat damage handling
- Scoreboard system

---

## Engineering Features

- Event-driven networking
- Distributed state synchronization
- Tick-rate simulation
- Input event validation
- Browser runtime optimization
- Lightweight rendering pipeline
- Server-side authority logic
- Multiplayer consistency architecture

---

# 🎮 Controls

## Desktop

| Action | Input |
|------|------|
| Move | WASD / Arrow Keys |
| Aim | Mouse |
| Shoot | Click / Space |
| Abilities | Q / E / R / F |
| Scoreboard | TAB |

---

## Mobile

| Action | Input |
|------|------|
| Move | Left Joystick |
| Aim | Right Touch Area |
| Abilities | On-screen buttons |

---

# 🔄 Core Gameplay Flow

```text
Player Joins Match
      ↓
Connected To Multiplayer Server
      ↓
Match Starts
      ↓
Move / Aim / Shoot / Use Abilities
      ↓
Capture Objectives / Eliminate Opponents
      ↓
Server Updates Official State
      ↓
Live State Broadcast To All Players
      ↓
Victory / Timeout
```

---

# 🏗 System Architecture

## High-Level Multiplayer Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                           PLAYERS                                   │
│                 Desktop Browser • Mobile Browser                     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BROWSER CLIENT                                  │
│                                                                      │
│ Input Handling • Rendering • HUD • Effects • Audio                   │
│ Three.js • Canvas • UI • Client Visual Layer                         │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                         WebSocket Events
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     MULTIPLAYER GAME SERVER                          │
│                                                                      │
│ Express.js • Socket.io • Tick Loop • Match Logic                     │
│ Combat Resolution • Ability System • Scoring                         │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               SERVER-AUTHORITATIVE GAME ENGINE                       │
│                                                                      │
│ Validate Inputs • Resolve Combat • Update State                      │
│ Sync World State • Broadcast Updates                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Multiplayer Networking Model

```text
Player A Browser ─┐
Player B Browser ─┼──→ Input Events → Game Server Tick Loop
Player C Browser ─┘

Server:
Validate Inputs
Resolve Combat
Update Official State
Update Scores
Broadcast Snapshot

Server ───→ All Clients Render New Arena State
```

---

## Server-Authoritative Flow

```text
Player Action
   ↓
Client Sends Input Event
   ↓
Server Validates Input
   ↓
Server Updates Official Game State
   ↓
Broadcast State Snapshot
   ↓
All Clients Render Based On Server State
```

> This prevents client-side desync and ensures consistency across all connected players.

---

# 🧰 Tech Stack

## Repository Language Breakdown

| Language | Usage |
|------|------|
| JavaScript | 66.2% |
| CSS | 24.8% |
| HTML | 9.0% |

---

## Frontend

| Technology | Purpose |
|------|------|
| Vanilla JavaScript | Core client logic |
| Three.js | WebGL rendering |
| HTML5 Canvas | Render loop integration |
| CSS | HUD / UI styling |
| Web Audio API | Audio feedback |

---

## Backend

| Technology | Purpose |
|------|------|
| Node.js | Multiplayer game server |
| Express.js | Backend framework |
| Socket.io | Real-time bidirectional communication |

---

## Networking Model

| Technology | Purpose |
|------|------|
| WebSockets | Low-latency communication |
| Event-driven architecture | Real-time gameplay events |
| Tick simulation | Consistent state updates |
| Server authority | Multiplayer consistency |

---

## Deployment

| Technology | Purpose |
|------|------|
| Render | Hosting |
| GitHub | Version control |

---

# 📂 Project Structure

```text
NeonFracture/
├── public/                    # Browser client
│   ├── assets/
│   ├── audio/
│   ├── textures/
│   └── ui/
│
├── server/                    # Multiplayer backend
│   ├── game/
│   │   ├── engine/
│   │   ├── entities/
│   │   ├── abilities/
│   │   ├── scoring/
│   │   └── state/
│   │
│   ├── networking/
│   ├── rooms/
│   ├── utils/
│   └── index.js
│
├── README.md
├── package.json
└── render.yaml
```

---

# 🌐 Play Online

Neon Fracture is a **browser-based multiplayer game** designed to be played online through its hosted deployment.

## Live Demo

**https://neonfracture.onrender.com**

No installation required — open in browser and join the arena.

---

# 🛠 Running For Development

If you want to test or develop Neon Fracture locally:

## Prerequisites

Install:

- Node.js 18+
- npm

---

## Clone Repository

```bash
git clone https://github.com/uncomparableX/NeonFracture.git
cd NeonFracture
```

---

## Install Dependencies

```bash
npm install
```

---

## Start Development Server

> Depending on project scripts:

```bash
npm start
```

or

```bash
npm run dev
```

This starts:

- browser game client
- multiplayer game server
- Socket.io networking layer
- local multiplayer testing environment

---

# 🔐 Environment Variables

Example `.env`

```env
PORT=3000
NODE_ENV=development

# Game Settings
TICK_RATE=60
MATCH_DURATION=300
MAX_PLAYERS=10

# Optional
CLIENT_URL=http://localhost:3000
```

---

# ▶️ How Multiplayer Works

Neon Fracture is **not a downloadable standalone game**.

Players connect like this:

```text
Browser Player
     ↓
WebSocket Connection
     ↓
Hosted Multiplayer Server
     ↓
Live Game State Sync
     ↓
Competitive Match
```

This makes Neon Fracture a **browser-native real-time multiplayer game**, where:

- clients render visuals
- server owns official state
- all players stay synchronized in real time

---

# 📸 Screenshots

## Main Arena

```text
/docs/screenshots/main-arena.png
```

---

## Gameplay HUD

```text
/docs/screenshots/hud.png
```

---

## Multiplayer Match

```text
/docs/screenshots/match.png
```

---

## Scoreboard

```text
/docs/screenshots/scoreboard.png
```

---

# 🛣 Roadmap

## In Progress

- [ ] Gameplay balancing
- [ ] Better visual effects
- [ ] Mobile UX improvements
- [ ] Performance optimization
- [ ] Match polish

---

## Planned

- [ ] Additional abilities
- [ ] More maps
- [ ] Better matchmaking
- [ ] Spectator mode
- [ ] Replay system
- [ ] UI polish improvements

---

## Future Vision

- [ ] Ranked competitive mode
- [ ] Dedicated servers
- [ ] Tournament support
- [ ] Persistent progression
- [ ] Team matchmaking queues

---

# ⚠️ Engineering Challenges & Learnings

Neon Fracture explores real multiplayer systems engineering challenges:

- synchronizing multiple players in real time
- handling latency-sensitive gameplay
- preventing desync
- managing distributed game state
- resolving combat authoritatively
- optimizing rendering in browsers
- debugging non-deterministic multiplayer behavior
- balancing performance and responsiveness

---

# ⚠️ Known Limitations

Current limitations may include:

- Render free-tier cold starts
- browser performance variability
- gameplay balancing still evolving
- networking edge-case tuning in progress
- visuals and polish under improvement

---

# 🔬 Why This Project Is Industry Relevant

Neon Fracture demonstrates engineering concepts beyond standard frontend projects:

- **real-time networking**
- **WebSocket systems**
- **distributed state synchronization**
- **tick-based simulation**
- **server-authoritative architecture**
- **event-driven backend design**
- **browser runtime optimization**
- **performance-sensitive rendering**

These concepts are highly relevant in:

- game engineering
- networking systems
- distributed software
- backend engineering
- performance engineering
- real-time systems design

---

# 💼 Why This Is Portfolio-Worthy

Neon Fracture is not just a browser game.

It demonstrates:

✅ Real-time multiplayer engineering  
✅ WebSocket networking  
✅ Server-authoritative architecture  
✅ Tick-based simulation  
✅ Distributed state management  
✅ Browser rendering systems  
✅ Multiplayer synchronization logic  
✅ Cross-platform browser gameplay  

For recruiters, this signals strength in:

- **real-time systems**
- **network programming**
- **backend engineering**
- **distributed systems**
- **performance engineering**
- **game systems architecture**

---

# 🤝 Contributing

Contributions are welcome.

## Workflow

1. Fork repository

2. Create feature branch

```bash
git checkout -b feature/amazing-feature
```

3. Commit changes

```bash
git commit -m "feat: add amazing feature"
```

4. Push changes

```bash
git push origin feature/amazing-feature
```

5. Open Pull Request

---

# 🔗 Links

## Live Demo

https://neonfracture.onrender.com

## Repository

https://github.com/uncomparableX/NeonFracture

---

# 📄 License

```text
MIT License
```

---

# 🌟 Final Note

**Neon Fracture: Quantum Arena** is a browser-native multiplayer combat game built as both a playable experience and a serious real-time systems engineering project.

It showcases:

> **Real-Time Multiplayer • Server Authority • WebGL Rendering • Low-Latency Networking • Competitive Game Systems**

---

<p align="center">
  <strong>Neon Fracture — Made with ❤️ by Apratim Das.</strong>
</p>
