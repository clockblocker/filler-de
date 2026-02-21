#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
	_CMD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
	_CMD_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

source "$_CMD_DIR/../lib.sh"

print_section "Scanning linked dictionary entries"
fail=0
count=0
while IFS= read -r path; do
	[[ -z "$path" ]] && continue
	count=$((count + 1))
	if ! check_entry_nonempty "$path"; then
		fail=1
	fi
done < <(collect_linked_entries)

echo "Checked $count linked entries from $SRC"
if (( fail > 0 )); then
	echo "Found empty or missing entries."
	exit 1
fi

echo "All linked entries are non-empty."
