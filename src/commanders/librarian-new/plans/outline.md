Concretely:
	1.	Take a snapshot (or keep the old tree around).
	2.	Apply BulkTreeActions to a draft tree (or record them as a patch).
	3.	Generate healing VaultActions from the draft.
	4.	Dispatch healing actions.
	5.	Re-read only the impacted roots (subtree scan / list) and verify.
	6.	If OK → commit the draft (swap it in) + update caches.
	7.	If not OK → discard draft and resync the affected subtree (or full resync as fallback).

this sounds ok and has some conceptual overlap with 

```
there are 2 possible states of affairs:
1) Structural invariant is already kept = we happy
2) Some folders / files are breaking the invariant. We somehow identify the set of the healing VaultActions and dispatching them. Afterwards, we assume that we are now at state 1
```

