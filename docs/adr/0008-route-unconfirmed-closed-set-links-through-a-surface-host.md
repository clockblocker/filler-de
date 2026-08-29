---
status: accepted
---

# Route unconfirmed closed-set links through a surface host

An unconfirmed user-authored Surface link routes to a shared `Worter` surface host. A model-confirmed closed-set attestation can route to the exact `Library` leaf. This avoids silent selection of the wrong grammar role, but it requires membership Entries in the surface host.

## Consequences

- A `Worter` note can contain open-set Entries and closed-set membership Entries.
- Manual completion must not select one Library leaf from an unconfirmed Surface.
- The current unique-Library-match completion behavior must migrate to this policy.
- Temporary `unknown` hosts must be removed or promoted during Lemma finalization.
