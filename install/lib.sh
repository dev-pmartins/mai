#!/usr/bin/env bash
# Shared helpers for tool adapters. Sourced by install.sh, never run directly.

set -euo pipefail

MAI_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log_info() { printf '  %s\n' "$1"; }
log_warn() { printf '  WARN: %s\n' "$1" >&2; }
log_skip() { printf '  skip (already installed): %s\n' "$1"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'error: required command "%s" not found\n' "$1" >&2
    exit 1
  }
}

# backup_if_conflict <path>
# If path exists and is not already the correct symlink, move it aside.
# Safe to call on a path that doesn't exist yet.
backup_if_conflict() {
  local path="$1"
  [ -e "$path" ] || [ -L "$path" ] || return 0
  local backup="${path}.bak-$(date +%Y%m%d%H%M%S)"
  mv "$path" "$backup"
  log_warn "existing content at $path backed up to $backup"
}

# link_item <src> <dest>
# Idempotent symlink creation: no-op if dest already points at src,
# backs up (never deletes) anything else found at dest.
link_item() {
  local src="$1" dest="$2"
  if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
    log_skip "$dest"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  backup_if_conflict "$dest"
  ln -s "$src" "$dest"
  log_info "linked $dest -> $src"
}

# merge_json_fragment <fragment-file> <target-file> <owner-key> <container-jq-path>
# Injects the contents of a JSON object fragment into target-file under
# container-jq-path (e.g. '.hooks.PreToolUse' or '.mcpServers'), tagging every
# injected entry with an owner marker so re-running never duplicates and
# untagged (user-owned) entries are never touched.
#
# This is intentionally a thin dispatcher — actual merge shape differs between
# a hooks array (event -> array of hook objects) and a flat mcpServers map, so
# callers use the two specific functions below instead of calling this direct.
merge_mcp_server() {
  local fragment="$1" target="$2" server_name="$3"
  require_cmd jq
  mkdir -p "$(dirname "$target")"
  [ -f "$target" ] || echo '{}' > "$target"
  local tmp
  tmp="$(mktemp)"
  jq --slurpfile frag "$fragment" --arg name "$server_name" '
    .mcpServers = ((.mcpServers // {}) | del(.[$name])) |
    .mcpServers[$name] = ($frag[0][$name] + {"_mai": $name})
  ' "$target" > "$tmp"
  mv "$tmp" "$target"
  log_info "merged mcp server \"$server_name\" into $target"
}

merge_hook() {
  local fragment="$1" target="$2" hook_name="$3"
  require_cmd jq
  mkdir -p "$(dirname "$target")"
  [ -f "$target" ] || echo '{}' > "$target"
  local event
  event="$(jq -r '.event' "$fragment")"
  local tmp
  tmp="$(mktemp)"
  jq --slurpfile frag "$fragment" --arg event "$event" --arg name "$hook_name" '
    .hooks = (.hooks // {}) |
    .hooks[$event] = ((.hooks[$event] // []) | map(select(._mai != $name))) |
    .hooks[$event] += [($frag[0] | del(.event) | . + {"_mai": $name})]
  ' "$target" > "$tmp"
  mv "$tmp" "$target"
  log_info "merged hook \"$hook_name\" ($event) into $target"
}

# each_item <glob> — echoes matches, expanding to nothing (not a literal glob
# string) when no file matches.
each_item() {
  local pattern="$1"
  shopt -s nullglob
  local matches=($pattern)
  shopt -u nullglob
  printf '%s\n' "${matches[@]+"${matches[@]}"}"
}
