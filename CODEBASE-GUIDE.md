# Codebase Architecture & App-Server Guide

## Overview

This document explains how the Hyperfy world development system works, focusing on the dev server and app-server architecture.

## Quick Start

### Dev Server Lifecycle

**START**: Run once to start the server
npm run dev

**USE**: Access the world many times
- Open browser: http://localhost:5000

**STOP**: When you are done
lsof -ti:5000 | xargs kill -9

**RESTART**: If needed
lsof -ti:5000 | xargs kill -9 && npm run dev

## What is the App-Server?

The app-server is a development helper tool that runs alongside your world server. Think of it as a live development assistant.

### What it does:
- Live Sync: Automatically updates your running world when you edit code
- App Management: Helps manage apps/scripts within your world
- Dev Mode Only: Only runs during development (npm run dev)
- Optional: Your world still works without it (just less convenient)

### What it does NOT do:
- It is NOT required for the world to run
- It does NOT serve the client to browsers
- It does NOT handle player connections
- It does NOT run game logic

## Architecture Components

### 1. World Server (The Main Server)

**Entry Point**: npm run dev:runtime

**What it does:**
- Runs the actual game world on port 5000
- Handles player connections
- Processes game logic
- Serves the client interface to browsers
- Loads and manages worlds, entities, physics

### 2. App-Server (The Sync Helper)

**Entry Point**: node bin/gamedev.mjs app-server

**What it does:**
- Watches for file changes in your project
- Rebuilds changed code
- Syncs updates to the running world server
- Provides app management commands

**Why it errors:**
- Error: invalid_code - It tries to connect before world server is ready
- This is NORMAL and can be ignored
- The world server still runs perfectly

### 3. Client Interface (What Players See)

**What it does:**
- Display the 3D world in the browser
- Handles user input (keyboard, mouse, VR)
- Renders the scene with THREE.js
- Communicates with world server via WebSocket

**How to access:** http://localhost:5000

## Why invalid_code Always Appears

This confuses many developers. Here is why it happens:

1. App-server starts and tries to connect immediately
2. World server needs 5-10 seconds to start
3. App-server gives up after 2-3 seconds
4. By the time world server is ready, app-server already exited
5. But the world server still runs perfectly!

Bottom line: The app-server sync is a convenience feature. Your world works without it.

## Common Errors Explained

### 1. Error: invalid_code - ALWAYS HAPPENS

**Why:** App-server tries to connect before world server is ready
**Impact:** None - world server still runs fine
**Action:** Ignore it!

### 2. EADDRINUSE: address already in use - PORT CONFLICT

**Why:** Another process is using port 5000
**Impact:** Server cannot start
**Action:** Kill the process: lsof -ti:5000 | xargs kill -9

### 3. server listening on port 5000 - SUCCESS!

**Why:** World server started successfully
**Impact:** Server is ready
**Action:** Open http://localhost:5000 in browser

## Quick Commands

Development:
npm run dev              # Start dev server

Server Management:
lsof -ti:5000            # Check if running
lsof -ti:5000 | xargs kill -9  # Stop server

Check Status:
curl http://localhost:5000 || echo Not running

Building:
npm run build           # Build for production

## Flip Animations Status

Already Implemented:
- FLIP (front flip) - asset://emote-flip.glb
- BACKFLIP - asset://emote-backflip.glb
- SIDEFLIP_LEFT - asset://emote-flip-left.glb
- SIDEFLIP_RIGHT - asset://emote-flip-right.glb

How to trigger: Jump while moving in different directions
- Forward + Jump = FLIP
- Backward + Jump = BACKFLIP
- Left + Jump = SIDEFLIP_LEFT
- Right + Jump = SIDEFLIP_RIGHT

## Troubleshooting Guide

Problem: Port in use
Symptom: EADDRINUSE error
Solution: lsof -ti:5000 | xargs kill -9

Problem: Cannot start
Symptom: failed to launch
Solution: Kill process, then npm run dev

Problem: App-server error
Symptom: invalid_code
Action: Ignore it - server still works

Problem: Not sure if running
Symptom: No output
Solution: Check: lsof -ti:5000

Problem: Need to restart
Symptom: Server acting weird
Solution: Kill and restart

## Project Structure

gamedev/
├── app-server/          # Development sync tool
├── bin/                 # CLI tools (gamedev.mjs)
├── build/               # Built/compiled output
├── docs/                # Documentation
├── examples/            # Example worlds/apps
├── scripts/             # Build scripts
├── src/
│   ├── client/          # Client-side code (browser)
│   ├── core/            # Core engine (entities, systems, utils)
│   ├── server/          # Server-side code (Node.js)
│   └── world/           # World assets and scenes
├── test/                # Tests
├── worlds/              # Your worlds (basic/)
└── apps/                # Your apps

Key directories:
- src/core/entities:   Player, entities, components
- src/core/extras:     VRM factory, emotes, utilities
- src/world/assets:    3D models, animations (.glb files)
