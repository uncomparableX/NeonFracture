# Neon Fracture: Quantum Arena

Neon Fracture is a fast-paced, browser-based real-time multiplayer arena game built with a focus on networking, synchronization, and performance.

The game runs entirely in the browser with no installation required.

Live Demo: https://neonfracture.onrender.com

---

## Overview

Neon Fracture is a competitive multiplayer experience where two teams (Alpha vs Omega) fight inside a futuristic arena. Players capture energy cores, eliminate opponents, and use abilities to control the match.

The project emphasizes real-time systems, server-authoritative architecture, and lightweight rendering using WebGL.

---

## Gameplay

- Two teams: Alpha vs Omega  
- Match duration: 5 minutes  
- Win condition: First to 100 points or highest score at timeout  

### Scoring

- Capture energy cores: +10 points  
- Eliminate opponents: +5 points  

---

## Abilities

Each player has access to a set of abilities with cooldowns and energy costs:

- Dash: Short forward teleport  
- Freeze: Temporarily disables nearby enemies  
- Pulse: Radial burst attack  
- Shield: Reduces incoming damage  

---

## Controls

### Desktop

- Movement: WASD / Arrow keys  
- Aim: Mouse  
- Shoot: Click / Space  
- Abilities: Q / E / R / F  
- Scoreboard: TAB  

### Mobile

- Left joystick: Movement  
- Right side: Aim  
- On-screen buttons: Abilities  

---

## Tech Stack

### Frontend

- JavaScript (Vanilla)
- Three.js (WebGL rendering)
- HTML5 Canvas (render loop integration)
- CSS (UI and HUD styling)
- Web Audio API (sound effects and feedback)

### Backend

- Node.js
- Express.js
- Socket.io (real-time bidirectional communication)

### Networking Model

- WebSocket-based communication
- Event-driven architecture
- Server-authoritative game state

### Deployment

- Render (free tier hosting)
- GitHub (version control and deployment integration)

---

## Architecture (High-Level)

The game uses a server-authoritative model to maintain consistency across clients.

- The server runs the game loop (tick-based simulation)
- Clients send input events (movement, shooting, abilities)
- The server processes all actions and updates the global state
- The server broadcasts state updates to all clients
- Clients render based on server state

Flow:

Client → Input → Server  
Server → State → Client  

---

## Project Structure
/public
/js
game.js # core gameplay logic
network.js # socket communication
renderer.js # rendering (Three.js / Canvas)
ui.js # UI and HUD logic
main.js # entry point
/css
style.css
index.html

/server
index.js # main game server

package.json


---

## Key Features

- Real-time multiplayer gameplay in the browser
- Server-authoritative synchronization model
- Tick-based game loop
- Lightweight rendering with Three.js
- Ability-based combat system
- Cross-platform support (desktop and mobile browsers)

---

## Challenges and Learnings

- Handling real-time synchronization across multiple clients  
- Managing latency and maintaining smooth gameplay  
- Designing a server-authoritative system to prevent desync  
- Optimizing performance for low-resource environments  
- Debugging distributed, non-deterministic behavior  

---

## Current Status

The core systems are functional:

- Multiplayer room handling  
- Real-time player synchronization  
- Combat and ability mechanics  
- Scoring and match logic  

The project is actively being improved with ongoing updates to visuals, performance, and gameplay.

---

## Notes

This project is focused on real-time systems and gameplay architecture rather than production-level assets or monetization.

---

## Try It

https://neonfracture.onrender.com

---

## Repository

https://github.com/uncomparableX/NeonFracture
