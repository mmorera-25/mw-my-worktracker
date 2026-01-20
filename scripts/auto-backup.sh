#!/usr/bin/env bash
set -euo pipefail

# Always run from the repo root
cd "$(git rev-parse --show-toplevel)"

# Skip if there is nothing new to commit
if git diff --quiet && git diff --cached --quiet; then
  echo "Auto-backup: no changes to commit."
  exit 0
fi

commit_msg="backup $(date -u +'%Y-%m-%d %H:%M:%S UTC')"

echo "Auto-backup: committing changes..."
git add -A
git commit -m "${commit_msg}"

echo "Auto-backup: pushing to origin..."
git push
