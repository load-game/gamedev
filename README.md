# Lobby

Open-source runtime and SDK for persistent multiplayer 3D worlds.

## Quick Start

Create a new world project with the `gamedev` CLI:

```bash
mkdir my-lobby-world
cd my-lobby-world
npx gamedev init
npm install
npm run dev
```

Then open `http://localhost:3000`.

What `npm run dev` does:

- Requires Node.js `22.11.0` (or newer in the same major line).
- Starts a local world server when `WORLD_URL` points to localhost.
- Runs app-server sync so local edits deploy to the world in seconds.
- Auto-creates `.env` with local defaults if one does not exist yet.

## Lobby Runtime and SDK

This repository powers the `gamedev` package and CLI used to scaffold, run, sync, and deploy Lobby world projects.

## What You Get

- Persistent self-hosted world runtime (multiplayer, physics, WebXR).
- Multi-file app scripting with live sync via app-server.
- World project structure with `apps/`, `assets/`, `shared/`, and `world.json`.
- App deploys, rollback snapshots, and sync conflict resolution tools.

## Core CLI Commands

```bash
gamedev init
gamedev dev
gamedev app-server
gamedev apps deploy <app>
gamedev world export
gamedev world import
```

Run `gamedev help` for the full command list.

## Documentation

- [World Projects](docs/World-projects.md)
- [App-server](docs/App-server.md)
- [Scripting API](docs/scripting/README.md)
- [Docker Deployment](DOCKER.md)

## Developing This Repository

If you are working on the runtime/SDK itself (not just a world project):

```bash
npm install
cp .env.example .env
npm run dev
```

Useful commands:

```bash
npm run build
npm run test
npm run lint
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
