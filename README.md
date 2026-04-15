# ⚡ NEON FRACTURE: QUANTUM ARENA

A fast-paced, browser-based multiplayer arena shooter set in a neon cyber world.

Built as a real-time game that runs entirely in the browser — no installs, just jump in and play.

---

## 🎮 What it is

Neon Fracture is a competitive multiplayer game where two teams fight inside a futuristic arena.  
Players capture energy cores, eliminate opponents, and use abilities to control the match.

It’s designed to feel responsive, visually intense, and lightweight enough to run directly in the browser.

---

## 🧠 Core Gameplay

- Two teams: **Alpha vs Omega**
- Matches last **5 minutes**
- First team to **100 points wins**

### How you score:
- Capture energy cores → +10 points  
- Eliminate enemies → +5 points  

If time runs out, the team with the higher score wins.

---

## ⚡ Abilities

Each player has access to a small set of abilities:

- **Dash** → quick forward teleport  
- **Freeze** → temporarily disable nearby enemies  
- **Pulse** → radial burst attack  
- **Shield** → reduce incoming damage  

Abilities use energy and have cooldowns, so timing matters.

---

## 🎮 Controls

**Desktop**
- Move → WASD / Arrow keys  
- Aim → Mouse  
- Shoot → Click / Space  
- Abilities → Q / E / R / F  
- Scoreboard → TAB  

**Mobile**
- Left joystick → movement  
- Right side → aim  
- On-screen buttons → abilities  

---

## 🧩 Tech Stack

### Frontend
- Three.js (WebGL rendering)  
- Web Audio API (sound + effects)  
- Vanilla JavaScript  

### Backend
- Node.js + Express  
- Socket.io (real-time communication)  

---

## ⚙️ How it works (high-level)

- The server runs the game loop (tick-based simulation)  
- Clients send input (movement, shooting, abilities)  
- Server processes everything and sends back game state  
- Clients render what the server tells them  

Client (browser) → input → Server  
Server → state → Client  

This keeps gameplay consistent across all players.

---

## 📁 Project Structure

/public → frontend (client)  
  /js  
    game.js  
    network.js  
    renderer.js  
    ui.js  
    main.js  
  /css  
    style.css  
  index.html  

/server  
  index.js → main game server  

package.json  

---

## 🧪 What’s interesting here

- Real-time multiplayer in a pure browser environment  
- No frameworks — everything is written from scratch  
- Server-authoritative game logic  
- Lightweight but visually styled (neon / cyber theme)  

---

## 🧱 Current State

The core loop is functional:
- Room creation / joining  
- Real-time sync  
- Abilities + combat  
- Score system  

Still evolving — more polish and features can be added.

---

## 📌 Notes

This is more of a systems + gameplay project than a production game.  
Focus is on networking, real-time sync, and game mechanics rather than assets or monetization.

