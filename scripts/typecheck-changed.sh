#!/bin/bash
# Typecheck only files changed vs master

CHANGED=$(git diff --name-only master...HEAD -- '*.ts' '*.tsx' | tr '\n' '|' | sed 's/|$//')

if [ -z "$CHANGED" ]; then
  echo "No TypeScript files changed vs master"
  exit 0
fi

bun x tsc --noEmit 2>&1 | grep -E "^($CHANGED)"
