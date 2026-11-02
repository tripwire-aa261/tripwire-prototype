#!/usr/bin/env bash
# PreToolUse hook: block "git commit" from Claude Code unless context/HANDOFF.md
# is part of the commit. Reads the tool call as JSON on stdin; exit 2 blocks it
# and sends the stderr message back to Claude.

input=$(cat)

case "$input" in
  *"git commit"*|*"git -C"*" commit"*) ;;
  *) exit 0 ;;
esac

# Escape hatch for commits that need no handoff.
case "$input" in
  *"[skip-handoff]"*) exit 0 ;;
esac

# Allowed if the same command stages the handoff file.
case "$input" in
  *"context/HANDOFF.md"*) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if git diff --cached --name-only | grep -qx "context/HANDOFF.md"; then
  exit 0
fi

echo "Commit blocked: context/HANDOFF.md is not staged. Run the /handoff skill first so teammates can continue from this session, then commit again. For a trivial commit, add [skip-handoff] to the message." >&2
exit 2
