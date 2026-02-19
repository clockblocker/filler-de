#!/bin/bash
# Typecheck only files changed vs master

set -u

CHANGED_FILE_LIST=$(git diff --name-only master...HEAD -- '*.ts' '*.tsx')

if [ -z "$CHANGED_FILE_LIST" ]; then
  echo "No TypeScript files changed vs master"
  exit 0
fi

CHANGED_FILES_TMP=$(mktemp)
trap 'rm -f "$CHANGED_FILES_TMP"' EXIT
printf '%s\n' "$CHANGED_FILE_LIST" > "$CHANGED_FILES_TMP"

TSC_OUTPUT=$(bun x tsc --noEmit --pretty false 2>&1)
TSC_EXIT=$?

if [ $TSC_EXIT -eq 0 ]; then
  echo "TypeScript check passed"
  exit 0
fi

FILTERED_OUTPUT=$(
  printf '%s\n' "$TSC_OUTPUT" | awk '
    NR == FNR {
      files[$0] = 1
      next
    }
    {
      for (file in files) {
        if (index($0, file "(") == 1 || index($0, file ":") == 1) {
          print
          found = 1
          break
        }
      }
    }
    END {
      if (!found) {
        exit 1
      }
    }
  ' "$CHANGED_FILES_TMP" -
)
FILTER_EXIT=$?

if [ $FILTER_EXIT -eq 0 ]; then
  printf '%s\n' "$FILTERED_OUTPUT"
  exit 1
fi

echo "TypeScript has errors, but none are in files changed vs master."
exit 0
