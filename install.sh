#!/usr/bin/env bash
# Entrypoint: symlinks this repo's agents/skills/commands/hooks/mcp into the
# locations expected by each supported AI tool.
#
# Usage:
#   ./install.sh --tool claude|copilot|cursor|all --scope global|project [--project-dir <path>]
#
# Adding new content never requires touching this script: adapters discover
# items by globbing agents/, skills/, commands/, hooks/, mcp/ directly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage: ./install.sh --tool claude|copilot|cursor|all --scope global|project [--project-dir <path>]

  --tool         which AI tool(s) to install into (required)
  --scope        global (~/.claude, ~/.config/... etc) or project (default: cwd)
  --project-dir  target project directory when --scope project (default: cwd)
EOF
}

TOOL=""
SCOPE=""
PROJECT_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --tool) TOOL="$2"; shift 2 ;;
    --scope) SCOPE="$2"; shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage; exit 1 ;;
  esac
done

[ -n "$TOOL" ] || { printf 'error: --tool is required\n' >&2; usage; exit 1; }
[ -n "$SCOPE" ] || { printf 'error: --scope is required\n' >&2; usage; exit 1; }

case "$SCOPE" in
  global) ;;
  project) PROJECT_DIR="${PROJECT_DIR:-$PWD}" ;;
  *) printf 'error: --scope must be "global" or "project"\n' >&2; exit 1 ;;
esac

# shellcheck source=install/lib.sh
source "$SCRIPT_DIR/install/lib.sh"

run_tool() {
  local tool="$1"
  case "$tool" in
    claude)
      source "$SCRIPT_DIR/install/claude.sh"
      printf 'installing for claude (%s)\n' "$SCOPE"
      install_claude
      ;;
    copilot)
      source "$SCRIPT_DIR/install/copilot.sh"
      printf 'installing for copilot (%s)\n' "$SCOPE"
      install_copilot
      ;;
    cursor)
      source "$SCRIPT_DIR/install/cursor.sh"
      printf 'installing for cursor (%s)\n' "$SCOPE"
      install_cursor
      ;;
    *)
      printf 'error: unknown tool "%s" (expected claude, copilot, cursor, or all)\n' "$tool" >&2
      exit 1
      ;;
  esac
}

if [ "$TOOL" = "all" ]; then
  run_tool claude
  run_tool copilot
  run_tool cursor
else
  run_tool "$TOOL"
fi
