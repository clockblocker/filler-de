---
status: proposed
---

# Separate note documents from semantic note data

The linguistic note codec will use a document model for exact block order and freeform preservation, and a data model for validated Lemma and Selection content. Identity blocks will be canonical; headers and tags will be projections.

## Consequences

- Callers that need exact freeform placement must stay on the document model.
- Conversion through semantic data can lose freeform placement.
- Parsing will not perform repair. Normalization will be explicit.
- Loose semantic conversion must represent invalid Entries as partial-invalid data.
