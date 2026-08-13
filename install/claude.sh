#!/usr/bin/env bash
# Claude Code adapter. Sourced by install.sh with SCOPE and PROJECT_DIR set.
# agents/skills/commands -> plain symlinks.
# hooks/mcp -> JSON merge into settings.json / .mcp.json (or ~/.claude.json).

install_claude() {
  local base
  if [ "$SCOPE" = "global" ]; then
    base="$HOME/.claude"
  else
    base="$PROJECT_DIR/.claude"
  fi

  log_info "claude ($SCOPE): base=$base"

  for dir in "$MAI_ROOT"/agents/*/; do
    [ -d "$dir" ] || continue
    local name
    name="$(basename "$dir")"
    link_item "$dir" "$base/agents/$name"
  done

  for dir in "$MAI_ROOT"/skills/*/; do
    [ -d "$dir" ] || continue
    local name
    name="$(basename "$dir")"
    link_item "$dir" "$base/skills/$name"
  done

  for file in "$MAI_ROOT"/commands/*.md; do
    [ -f "$file" ] || continue
    local name
    name="$(basename "$file")"
    link_item "$file" "$base/commands/$name"
  done

  local settings_file mcp_file
  settings_file="$base/settings.json"
  if [ "$SCOPE" = "global" ]; then
    mcp_file="$HOME/.claude.json"
  else
    mcp_file="$PROJECT_DIR/.mcp.json"
  fi

  for file in "$MAI_ROOT"/hooks/*.json; do
    [ -f "$file" ] || continue
    local name
    name="$(basename "$file" .json)"
    merge_hook "$file" "$settings_file" "$name"
  done

  for file in "$MAI_ROOT"/mcp/*.json; do
    [ -f "$file" ] || continue
    local name
    name="$(basename "$file" .json)"
    merge_mcp_server "$file" "$mcp_file" "$name"
  done
}
