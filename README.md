# mai

My AI toolkits — agents, skills, slash-commands, hooks and MCP server configs
in one place, installable on any machine via `git clone` + `./install.sh`.

## Layout

```
agents/<name>/agent.md        # Claude Code agent
skills/<name>/SKILL.md        # skill (+ optional references/)
commands/<name>.md            # slash command
hooks/<name>.json             # one fragment: {"event": ..., "matcher": ..., "hooks": [...]}
mcp/<name>.json               # one fragment: {"<name>": {"command": ..., "args": [...]}}
mcp/servers/<name>/           # optional: source for a locally-hosted MCP server
```

An `mcp/<name>.json` fragment can reference an external package (`npx -y ...`)
or a server whose source lives in this repo under `mcp/servers/<name>/` — in
that case point `command`/`args` at it with an absolute path built from the
`${MAI_ROOT}` placeholder (see `mcp/runrunit.json` for an example), which the
installer resolves at merge time. `${VAR}` placeholders anywhere in a
hook/mcp fragment are resolved the same way, straight from the process
environment — this is for **portable paths, not secrets**: project-scope
`.mcp.json`/`settings.json` are often committed to the *target* repo, so a
secret resolved here would land in that repo's git history. A locally-hosted
server that needs credentials should load its own `.env`, anchored to its own
file location rather than `process.cwd()` (see `mcp/servers/runrunit/src/env.ts`).

## Secrets

Copy `.env.example` to `.env` at the repo root and fill in the real values —
`.env` is gitignored, never committed. Each locally-hosted server under
`mcp/servers/<name>/` is responsible for loading this root `.env` itself
(anchored to its own file path, not `process.cwd()`); it never flows through
an installed fragment or into any merged `settings.json`/`.mcp.json`.

There is no manifest or registry. Adding content is just adding a
correctly-named folder/file — the installer discovers everything by
scanning these five directories. Copy `agents/example-agent/`,
`skills/example-skill/`, or `commands/example-command.md` as a starting
template; delete the example once you've added your first real item.

`name` in frontmatter (agents/skills/commands) must match the folder/file
name — `lint.sh` enforces this.

## Install

```
./install.sh --tool claude --scope global
./install.sh --tool claude --scope project --project-dir ~/code/some-repo
```

- `--tool`: `claude`, `copilot`, `cursor`, or `all` (copilot/cursor adapters
  are not implemented yet — see Roadmap).
- `--scope`: `global` (applies to every project on the machine, e.g.
  `~/.claude/`) or `project` (applies to one repo, `--project-dir` defaults
  to the current directory).

Agents/skills/commands are plain symlinks into the target tool's directory —
editing a file in this repo and running `git pull` on another machine
updates every existing symlink instantly, no reinstall needed. Hooks and MCP
servers are merged as JSON into `settings.json` / `.mcp.json` (or
`~/.claude.json` for global scope) because those files also hold your own,
unrelated settings; the merge only ever touches entries this repo
previously added (tagged internally), so your own hooks/servers are never
touched or duplicated.

Re-running `install.sh` is always safe: existing correct symlinks are
left alone, and anything real found in the way gets backed up (never
deleted) before being replaced. Only **brand-new** items need one
`install.sh` re-run to get their first symlink — content edits to
already-linked items don't.

## Validate

```
./lint.sh
```

Checks that every agent/skill/command has the required frontmatter
(`name`, `description`) with a matching `name`, and that every hook/mcp
fragment is valid JSON. Runs in CI on every push/PR (see
`.github/workflows/lint.yml`).

## Dependencies

`bash`, `jq`, `python3` (stdlib only) — nothing else.

## Roadmap

1. ✅ Claude Code adapter (`install/claude.sh`)
2. GitHub Copilot adapter (`install/copilot.sh`) — currently a stub
3. Cursor adapter (`install/cursor.sh`) — currently a stub
