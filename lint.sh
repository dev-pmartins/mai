#!/usr/bin/env bash
# Validates every agent/skill/command's frontmatter and every hook/mcp
# fragment's JSON shape. Run locally before committing; also runs in CI.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

fail=0

check_frontmatter() {
  local file="$1" expected_name="$2"
  python3 - "$file" "$expected_name" <<'PYEOF'
import sys

path, expected_name = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    text = f.read()

if not text.startswith("---\n"):
    print(f"{path}: missing frontmatter (must start with '---')")
    sys.exit(1)

end = text.find("\n---", 4)
if end == -1:
    print(f"{path}: frontmatter not closed with '---'")
    sys.exit(1)

fields = {}
for line in text[4:end].splitlines():
    if not line.strip() or line.strip().startswith("#"):
        continue
    if ":" not in line:
        continue
    key, _, value = line.partition(":")
    fields[key.strip()] = value.strip().strip('"').strip("'")

missing = [k for k in ("name", "description") if k not in fields or not fields[k]]
if missing:
    print(f"{path}: missing required frontmatter field(s): {', '.join(missing)}")
    sys.exit(1)

if fields["name"] != expected_name:
    print(f"{path}: frontmatter name \"{fields['name']}\" does not match expected \"{expected_name}\"")
    sys.exit(1)
PYEOF
}

check_json() {
  local file="$1"
  jq empty "$file" 2>/dev/null || {
    printf '%s: invalid JSON\n' "$file"
    return 1
  }
}

for dir in agents/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  file="$dir/agent.md"
  if [ ! -f "$file" ]; then
    printf '%s: missing agent.md\n' "$dir"
    fail=1
    continue
  fi
  check_frontmatter "$file" "$name" || fail=1
done

for dir in skills/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  file="$dir/SKILL.md"
  if [ ! -f "$file" ]; then
    printf '%s: missing SKILL.md\n' "$dir"
    fail=1
    continue
  fi
  check_frontmatter "$file" "$name" || fail=1
done

for file in commands/*.md; do
  [ -f "$file" ] || continue
  name="$(basename "$file" .md)"
  check_frontmatter "$file" "$name" || fail=1
done

for file in hooks/*.json mcp/*.json; do
  [ -f "$file" ] || continue
  check_json "$file" || fail=1
done

if [ "$fail" -eq 0 ]; then
  printf 'lint: all good\n'
else
  printf 'lint: failures found\n' >&2
fi
exit "$fail"
