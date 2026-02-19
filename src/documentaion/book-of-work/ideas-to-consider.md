---
  Reviewed: 2026-02-19 (from open PRs #6, #7, #13, #15, #16, #17, #22)
  Accepted items moved to: documentation/book-of-work.md

  Rejected:

  #: 2
  Item: Remove vestigial apiProvider setting
  Source: PR #22
  What: apiProvider: "google" is a typed literal with one option. Settings tab renders a pointless
    dropdown. Remove from types.ts, settings-tab.ts, api-service.ts, and locales.
  Decision: Rejected. apiProvider will be expanded later
