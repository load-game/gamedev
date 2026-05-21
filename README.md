# Lobby

Open-source runtime and SDK for persistent multiplayer 3D worlds.

## Quick Start

Create a new world project with the `gamedev` CLI:

```bash
mkdir my-lobby-world
cd my-lobby-world
npx gamedev init
vp install
vp run dev
```

Then open `http://localhost:3000`.

What `vp run dev` does:

- Requires Node.js `24.15.0` (latest LTS).
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
- [Plugin Architecture](docs/plugin-architecture.md)
- [Docker Deployment](DOCKER.md)

## Developing This Repository

If you are working on the runtime/SDK itself (not just a world project):

```bash
vp install
cp .env.example .env
vp run dev
```

Workspace packages live under `packages/`:

- `packages/client` browser runtime and assets
- `packages/server` runtime server
- `packages/cli` `gamedev` CLI
- `packages/app-server` sync/deploy service
- `packages/core` shared runtime code
- `packages/node-client` headless client

Useful commands:

```bash
vp run build
vp run test
vp run lint
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
