# World Entities CLI

Batch-create and batch-delete entities in `world.json` for agent-driven workflows.

This tool is generic by design: agents decide what to place and where, and provide transform data.

## Command

```bash
npm run world:entities -- <command> [flags]
```

## Add entities from a template

Clone an existing entity instance by ID, but apply transform overrides from a JSON file.

```bash
npm run world:entities -- add \
  --template-id k3sbGG4iq4 \
  --transforms tmp/add-trees.json
```

Replace mode (delete all current instances of the template blueprint first, then add):

```bash
npm run world:entities -- add \
  --template-id k3sbGG4iq4 \
  --transforms tmp/add-trees.json \
  --replace \
  --yes
```

## Delete entities

Delete by blueprint:

```bash
npm run world:entities -- delete --blueprint Tree --yes
```

Delete by explicit ID list file:

```bash
npm run world:entities -- delete --ids tmp/delete-ids.json --yes
```

## Flags

- `--world <path>`: world file path (default `world.json`)
- `--yes`: skip confirmation prompts and allow no-op operations
- `--replace`: add mode only; remove existing entities with template blueprint before add

## Transforms File Format

`--transforms` must point to a JSON array of objects:

```json
[
  {
    "position": [0, 0, 0],
    "quaternion": [0, 0, 0, 1],
    "scale": [1, 1, 1],
    "pinned": false,
    "props": {},
    "state": {}
  }
]
```

Fields:

- `position` required (`[x, y, z]`)
- `quaternion` optional (`[x, y, z, w]`, default `[0,0,0,1]`)
- `scale` optional (`[x, y, z]`, default `[1,1,1]`)
- `pinned` optional (default `false`)
- `props` optional (default cloned from template entity)
- `state` optional (default cloned from template entity)
- `id` optional (auto-generated short 10-char ID if omitted)

## Temp file workflow for agents

Store generated transform files in `tmp/` (gitignored except `.gitkeep`/`README.md`), run the command, then delete the temp file.

Example:

```bash
# 1) Create temp transforms JSON under tmp/
# 2) Run CLI
npm run world:entities -- add --template-id k3sbGG4iq4 --transforms tmp/run-001.json --yes
# 3) Remove temp file
rm tmp/run-001.json
```

## Runtime Player Wallet Sync

This CLI only edits `world.json`, but runtime player snapshots and incremental player updates also include a `solanaWallet` field.

Use the scripting runtime to react to those changes:

- Read `player.solanaWallet` from the player API.
- Listen for `world.on('solanaWallet', ({ playerId, solanaWallet }) => { ... })` when you need change notifications.
- Use the user menu's Solana panel for client-side balance checks and world-token deposit/withdraw flows; those actions do not modify `world.json`.
