# Awaken Dragon

`awakendragon` is a self-contained project for:

- Name: 醒龙
- English name: Awaken the Dragon
- Role: a newly hatched little dragon learning Chinese with the user

Everything related to this project lives under `awakendragon/`.
Other top-level directories in this repository are unrelated.

## Layout

- `agent/prompts/`: OpenClaw bootstrap files
- `agent/scripts/`: sync scripts for the live OpenClaw workspace
- `assets/dragon/`: source images for the dragon character
- `app/canvas/`: future canvas UI source
- `app/server/`: future project-local backend/API source
- `app/shared/`: shared types and helpers
- `data/`: generated assets, scene state, and structured memory
- `docs/`: project notes and implementation docs

## Local setup

Sync the workspace files:

```bash
node awakendragon/agent/scripts/sync-workspace.mjs
```

Register the agent in OpenClaw:

```bash
openclaw agents add awakendragon \
  --workspace /Users/jianghao/.openclaw/workspace-awakendragon \
  --model openai-codex/gpt-5.4 \
  --non-interactive
```

Load identity from `IDENTITY.md`:

```bash
openclaw agents set-identity \
  --agent awakendragon \
  --workspace /Users/jianghao/.openclaw/workspace-awakendragon \
  --from-identity
```

Then start a session:

```bash
openclaw tui --session agent:awakendragon:main
```
