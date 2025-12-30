0) Scope & normalize
	•	Normalize paths (relative to libraryRoot)
	•	Classify transitions:
	•	outside→inside
	•	inside→outside
	•	inside→inside
	•	outside→outside (ignore)

1) Extract “semantic signal” from each root event

Per root event, derive:
	•	node kind (Section/Scroll/File)
	•	observed parent chain (from pathParts)
	•	observed basename/foldername
	•	declared chain + core name (from basename/foldername parsing, using delimiter rules)
	•	validity flags (delimiter misuse, codex special cases)

2) Decide policy winner (one of two)

Your stated constraint: no multi-effect renames because you pick one winner.

So implement exactly one of:
	•	Path-king: canonical parent chain = observed chain; canonical name derived from that
	•	Basename-king: canonical parent chain = declared chain; canonical name derived from that

This yields a single canonical target locator + canonical split path.

3) Emit TreeActions
	•	Create inside → CreateNode
	•	Delete inside → DeleteNode
	•	Rename root:
	•	if winner implies same parent in tree terms → RenameNode
	•	else → MoveNode with splitPathToVaultLocationOfTarget (observed current location) and newParent (canonical parent)

And because you’ll generate exactly one VaultAction.Rename(fromObserved,toCanonical) in healing, that lines up with your “single rename suffices” claim.
