# Librarian filename invariant

Invariant: in Library roots every md filename encodes its tree path. Example: `Library/parent/child/NOTE-child-parent.md` ↔ path `["parent","child","NOTE"]`. Codex/scroll/page already follow codecs; no codex under `Library/Untracked`.

Policies
- Quarantine: undecodable/legacy → move to `Library/Untracked/` (excluded from scans/codex).
- Auto-heal: always enqueue rename/move; no user prompt; content untouched; only `.md`.
- Flush strategy: rename-in-place flush immediately; cross-folder batches flush once.

Plan
1) Canonicalization helpers: path↔basename, quarantine paths, guard to skip `Untracked`.
2) Startup audit: scan Library (skip `Untracked`), decode basenames; move undecodable to quarantine; if physical path ≠ canonical, enqueue rename/move; batch flush; rebuild trees; regenerate codexes.
3) Event handlers: on create/rename/move/delete, decode and auto-heal using scenario rules (same dir rename, cross-dir move). Ensure actions go through queue; skip tree/codex for quarantine.
4) Tests: canonical encode/decode, audit actions (rename, move, quarantine), event auto-heal, batching rules.
