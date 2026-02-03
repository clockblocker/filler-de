---
name: Duplicated goBack links investigation
overview: Investigation of why creating a new file in Library/Text/Das Sagt Mann So/ yields two identical go-back links after healing. Flow traced; plausible root causes and verification steps are listed.
todos: []
isProject: false
---

# Duplicated goBack links — investigation plan

## Flow summary

- **New file creation**: User creates a file in `Library/Text/Das Sagt Mann So/` → Obsidian creates the file → Librarian receives bulk event → `processActions()` runs.
- **Actions for the new scroll** (`Untitled;;Das Sagt Mann So;;Text.md`):
  - **Backlink healing** (`[get-backlink-healing-vault-actions.ts](src/commanders/librarian/healer/backlink-healing/get-backlink-healing-vault-actions.ts)`): `collectTreeData(tree, codecs)` → one `ProcessMdFile` per scroll with `makeScrollBacklinkTransform(parentChain, codecs)` (strip existing go-back, then add one).
  - **Codex path**: Create impact only sets `contentChanged` (no `descendantsChanged`), so no `WriteScrollStatus` for the new scroll. So no second `ProcessMdFile` from codex actions for this scroll.
  - **Assembled array** (`[librarian.ts](src/commanders/librarian/librarian.ts)` ~324–335): `assembleVaultActions(healing, codexRecreations + scrollStatusActions)` then `getBacklinkHealingVaultActions()`. So the new scroll gets exactly one `ProcessMdFile` from backlink healing (scroll status only for ChangeStatus, not Create).
- **Collapse** (`[collapse.ts](src/managers/obsidian/vault-action-manager/impl/actions-processing/collapse.ts)`): Same path → same key (`makeSystemPathForSplitPath`). Two `ProcessMdFile` for same path are composed: `combined(content) = transform2(transform1(content))`. Both scroll backlink and codex backlink transforms do strip-then-add, so composition should still yield a single go-back link.
- **Scroll transform** (`[scroll-transforms.ts](src/commanders/librarian/healer/library-tree/codex/transforms/scroll-transforms.ts)`): `makeScrollBacklinkTransform` uses `goBackLinkHelper.strip(afterFrontmatter.trimStart())` then prepends one link. `goBackLinkHelper.strip()` (`[go-back-link.ts](src/stateless-helpers/go-back-link/go-back-link.ts)`) loops with `^\s*\[\[__[^\]]+\|←[^\]]+\]\]\s*` until no leading match; multiple leading links should all be removed.

So under the current design, the new scroll should get one go-back link. Duplication implies either a second writer that prepends without stripping, or strip failing to remove an existing link.

---

## Root causes to verify

1. **Two ProcessMdFile for the same scroll that do not collapse**
  - If the same scroll appears with two different `splitPath` representations (e.g. library-scoped vs not, or different path normalization), they would get different keys and run separately. First run: add one link. Second run: must strip then add; if the second run’s transform does *not* strip (e.g. a different transform that only prepends), result would be two links.
  - **Check**: Log `makeKeyForAction(a)` for every `ProcessMdFile` in the dispatched list and after collapse; confirm only one action per scroll path and that the key for the new scroll is unique.
2. **Strip regex not matching the actual link**
  - If the on-disk link format differs (delimiter, spaces, encoding), `buildPattern()` in `[go-back-link.ts](src/stateless-helpers/go-back-link/go-back-link.ts)` might not match, so `strip()` would be a no-op. A second run (from any source) would then prepend again → two links.
  - **Check**: Unit test `goBackLinkHelper.strip()` with the exact content you see in the file (both links). If it doesn’t remove both, relax or fix the pattern (e.g. allow optional spaces around `|` and `←`).
3. **Codex and scroll path mix-up**
  - Unlikely, but if the codex file path were mistaken for the scroll path (or vice versa), one could write codex content (with one backlink) and the other scroll content, or the same scroll could be written twice from different code paths.
  - **Check**: In logs, confirm the path for the duplicated go-back file is the scroll path (`.../Untitled;;Das Sagt Mann So;;Text.md`), not the codex path (`.../__;;Das Sagt Mann So;;Text.md`).
4. **EnsureExist + Process ordering / double Process**
  - If `ensureAllRequirementsMet` injects `UpsertMdFile(null)` for the new scroll and the same scroll also gets two `ProcessMdFile` (e.g. one from backlink and one from an unexpected code path), collapse should still merge the two Process into one. If they don’t merge (different keys), see (1). If the “second” write is an `UpsertMdFile(content)` with content that already contains two links, that write would win over Process and leave two links.
  - **Check**: Inspect `withEnsured` and `collapsed` in the dispatcher for the new scroll path: exactly one `ProcessMdFile` (or one Upsert + one Process composed), and no Upsert with non-null content for that path.
5. **Transform composition bug**
  - If the composed transform is built as `(content) => transformA(content)` and then `(content) => transformB(content)` but the second is applied to the *original* content instead of the first transform’s output, you could get two links (A adds one, B adds one to original).
  - **Check**: In `[collapse.ts](src/managers/obsidian/vault-action-manager/impl/actions-processing/collapse.ts)`, composition is `existingTransform(content)` then `actionTransform(first)`. Confirm that the executor calls the combined transform once and passes its result to the writer (no re-use of pre-transform content).

---

## Recommended next steps

- **Logging**: In `processActions`, log the list of vault action keys for `ProcessMdFile` targeting paths under the library (or log all keys for the new scroll’s path). After collapse, log again to confirm a single action per path.
- **Unit test**: In `tests/unit/` add a test for `goBackLinkHelper.strip()` with a string that has two leading go-back links (same format as in the vault). Assert that the result has zero leading go-back links.
- **Defensive hardening**: In `goBackLinkHelper.add()`, the implementation already calls `strip()` before adding; no change needed there. Optionally, in `makeScrollBacklinkTransform`, after building `cleanBody`, assert or log if `cleanBody !== goBackLinkHelper.strip(cleanBody)` (i.e. strip didn’t remove everything) to catch regex mismatches in the wild.

---

## Unresolved

- Exact code path that writes the second link (which component and under which condition) is not pinned down; the checks above are meant to narrow it down.
- Whether the duplicate appears only on “new file” creation or also on rename/move/status change may help distinguish between “two sources for the same path” vs “strip not matching.”

