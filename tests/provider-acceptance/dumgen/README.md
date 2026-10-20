# dumgen provider acceptance

This opt-in smoke checks that the plugin's dumgen wiring reaches both live
providers: TypeSafe (jev) and OpenAI (Luna). It builds dumgen through
`createDumgenProviders` and `createRequestUrlFetch` from `src/managers/dumgen`.
The runtime's `fetch` stands in for Obsidian's `requestUrl`, so requests go
through the plugin's own requestUrl port. It does not start Obsidian.

The smoke sends one German Sentence through three operations:

1. `segment.inUnits`, which segments the Sentence (several jev requests).
2. `resolve.grammar`, which resolves a click on `Hund` (jev and Luna).
3. `translate.sentence`, which translates the Sentence into English (one Luna
   request).

The command makes no request unless `TEXTFRESSER_PROVIDER_ACCEPTANCE=1`,
`TYPESAFE_API_KEY` and `OPENAI_API_KEY` are all set and the budget is given
explicitly:

```bash
TEXTFRESSER_PROVIDER_ACCEPTANCE=1 TYPESAFE_API_KEY=… OPENAI_API_KEY=… \
  bun run test:provider-acceptance:dumgen --suite=smoke
```

The report goes to
`tests/provider-acceptance/artifacts/dumgen/smoke.json`, or under
`TEXTFRESSER_PROVIDER_ARTIFACT_DIR` when that is set. It records each check
and each operation's calls, tokens and duration.

The free preflight, `bun run test:provider-acceptance:preflight`, runs the
smoke against an offline dumgen without credentials or network access.
