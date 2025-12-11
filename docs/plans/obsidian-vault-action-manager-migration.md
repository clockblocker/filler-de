## OVAM migration plan (updated)

- Phase 1: Make `SplitPath` the cross-domain DTO. Replace `PrettyPath` usages (code + tests) with split-path types/literals; drop PrettyPath vault actions. Ensure action factories emit `VaultAction` with split-path payloads.
- Phase 2: Wire manager into callers. Replace legacy queue/executor/services with `ObsidianVaultActionManagerImpl` dispatch/read APIs. Executor writes must create-if-missing.
- Phase 3: Event/self-event handling. Use manager `subscribe`; rely on self-event tracker; keep queue cap/backpressure (500) and collapse/sort.
- Phase 4: Cleanup. Remove deprecated queue/background action types; align tests/e2e to manager paths only; trim testing-only expose hooks when legacy gone.
