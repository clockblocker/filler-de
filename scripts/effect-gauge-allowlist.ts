// The edges of the Effect migration (#215, #234): the files where an
// `Effect.run*` / `runtime.run*` site, a `throw` or a `try` is there by
// design. `bun run gauge:effect` counts only what a file holds beyond its
// allowance, and `--check` fails on that and on an allowance a file no
// longer uses, so the list stays exact. Lint rules are allowed per line
// instead, by `oxlint-disable-next-line <rule> -- <reason>` comments, which
// the gauge counts as `suppressions`.

/** The metrics a file may be allowed some of. */
export type AllowedMetric = "run-sites" | "throw" | "try";

/**
 * A file, and how many sites of each metric it may hold. Patterns are globs
 * relative to the repo root; a directory glob's count applies to each file
 * it matches.
 */
export type Allowance = {
	readonly pattern: string;
	readonly allow: Partial<Record<AllowedMetric, number>>;
	readonly reason: string;
};

const INSIDE_EFFECT_TRY =
	"throws inside the body of an `Effect.try`, whose `catch` turns the throw into a typed failure";
const INVARIANT =
	"a documented invariant: the throw is unreachable for valid input, and reaching it is a bug, so it dies as a defect";
const CATCHES_THROWING_CALL =
	"synchronous code that calls a throwing parser or path codec and turns its throw into a value";

export const EDGE_ALLOWLIST: readonly Allowance[] = [
	// ─── The run boundary ───
	{
		allow: { "run-sites": 4 },
		pattern: "src/runtime/plugin-runtime.ts",
		reason:
			"the plugin runtime, the only `run*` boundary: it starts the one `ManagedRuntime`'s build with `runCallback`, and every command, user event, settings change, E2E hook and synchronous read enters it through `runPromiseExit` or `runSyncExit`",
	},
	{
		allow: { "run-sites": 1 },
		pattern: "src/runtime/observability.ts",
		reason:
			"the edge log, `logAtEdge`, for plain TypeScript where no Effect runs: it runs its log synchronously in the observability context with `runSyncExitWith`",
	},

	// ─── src/main.ts ───
	{
		allow: { throw: 1, try: 1 },
		pattern: "src/main.ts",
		reason:
			"the Plugin class: `onload` catches a runtime that fails to build, since Obsidian must not see it throw, and the Classify E2E hook throws when it cannot script dumgen, so a scenario never reaches a provider",
	},

	// ─── src/managers ───
	{
		allow: { try: 1 },
		pattern: "src/managers/dumgen/provider-failure.ts",
		reason: `${CATCHES_THROWING_CALL}: \`JSON.parse\` probes where a provider's body ends`,
	},
	{
		allow: { try: 1 },
		pattern:
			"src/managers/obsidian/behavior-manager/wikilink-complition-behavior.ts",
		reason: `${CATCHES_THROWING_CALL}: a link that has no Crossroad path, in a synchronous editor callback`,
	},
	{
		allow: { try: 1 },
		pattern: "src/managers/obsidian/host/plugin-host.ts",
		reason:
			"the host service's guard around an Obsidian or DOM callback, where no Effect runs: a handler's throw is logged instead of reaching Obsidian",
	},
	{
		allow: { throw: 1 },
		pattern: "src/managers/obsidian/host/request-url-fetch.ts",
		reason:
			"dumgen's transport port is a Promise with an `AbortSignal` (dumgen ADR 0009); the throw inside its `then` rejects that Promise when the signal aborts",
	},
	{
		allow: { try: 1 },
		pattern: "src/managers/overlay-manager/context-menu/context-menu.ts",
		reason: `${CATCHES_THROWING_CALL}: the note's metadata, read in Obsidian's synchronous menu callback to decide which items to show`,
	},

	// ─── src/settings ───
	{
		allow: { throw: 1 },
		pattern: "src/settings/parsed-settings.ts",
		reason: `${INSIDE_EFFECT_TRY}: \`parseSettings\` refuses a Library root that is a file, and the Settings service runs it in \`Effect.try\``,
	},

	// ─── src/stateless-helpers: metadata transforms ───
	{
		allow: { throw: 1 },
		pattern: "src/stateless-helpers/dictionary-notes.ts",
		reason:
			"a metadata transform refuses a write by throwing, since a VAM `Transform` returns content; its callers run it in `Effect.try` or a `try` and turn the throw into their own failure",
	},
	{
		allow: { throw: 2 },
		pattern: "src/stateless-helpers/note-metadata/index.ts",
		reason:
			"a metadata transform refuses to overwrite data it cannot read by throwing `NoteMetadataError`; its callers run it in `Effect.try` or VAM's `Vault.process` and turn the throw into their own failure",
	},
	{
		allow: { throw: 1 },
		pattern: "src/stateless-helpers/note-metadata/library-metadata.ts",
		reason:
			"a metadata transform refuses an invalid value by throwing `NoteMetadataError`, as `note-metadata/index.ts` does",
	},
	{
		allow: { throw: 1, try: 1 },
		pattern: "src/stateless-helpers/note-metadata/namespace.ts",
		reason:
			"a metadata transform refuses an invalid value by throwing `NoteMetadataError`, as `note-metadata/index.ts` does; the `try` turns a throwing migration into an `Invalid` reading",
	},
	{
		allow: { try: 1 },
		pattern: "src/stateless-helpers/note-metadata/internal/frontmatter.ts",
		reason: `${CATCHES_THROWING_CALL}: Obsidian's \`parseYaml\``,
	},
	{
		allow: { try: 1 },
		pattern: "src/stateless-helpers/note-metadata/internal/hidden-section.ts",
		reason: `${CATCHES_THROWING_CALL}: \`JSON.parse\``,
	},

	// ─── dictionary ───
	{
		allow: { try: 1 },
		pattern: "src/packages/composed/dictionary/src/freeform.ts",
		reason:
			"probes the note writers, whose metadata transforms refuse by throwing, and returns the refusal as the problem",
	},
	{
		allow: { try: 1 },
		pattern: "src/packages/composed/dictionary/src/note-index.ts",
		reason: `${CATCHES_THROWING_CALL}: a Lemma from stored data that has no path, which lemma-note-codec's invariants ask callers to catch`,
	},
	{
		allow: { try: 1 },
		pattern: "src/packages/composed/dictionary/src/render.ts",
		reason: `${CATCHES_THROWING_CALL}: a form key that has no Crossroad path`,
	},
	{
		allow: { try: 1 },
		pattern: "src/packages/composed/dictionary/src/view.ts",
		reason:
			"the one place a slice loader's refusal becomes a typed failure: `attempted` returns it as a `DictionaryRequestError` `Result`",
	},
	{
		allow: { throw: 1 },
		pattern: "src/packages/composed/dictionary/src/slices.ts",
		reason:
			"a slice loader refuses an oversized relation neighbourhood by throwing; `attempted` in `view.ts` returns it as a `DictionaryRequestError`",
	},
	{
		allow: { throw: 1 },
		pattern: "src/packages/composed/dictionary/src/stage-changes.ts",
		reason: `${INSIDE_EFFECT_TRY}: staging refuses a relation to a missing target, and the store runs \`stageChanges\` in \`Effect.try\``,
	},
	{
		allow: { throw: 1 },
		pattern: "src/packages/composed/dictionary/src/store.ts",
		reason: `${INSIDE_EFFECT_TRY}: a written note that does not parse back is a \`DictionaryRoundTripError\``,
	},
	{
		allow: { throw: 2 },
		pattern: "src/packages/composed/dictionary/src/vault.ts",
		reason: `${INVARIANT}; the store spells every path it hands \`mdSplitPath\` and \`folderSplitPath\` itself`,
	},

	// ─── vault-action-manager ───
	{
		allow: { "run-sites": 1, throw: 1 },
		pattern: "src/packages/independent/vault-action-manager/src/facade.ts",
		reason:
			"`createVaultActionManager`, the standalone wrapper VAM's tests build on: it runs the Layer's build synchronously on a runtime of its own, and throws its `VamSetupError`",
	},
	{
		allow: { "run-sites": 1 },
		pattern:
			"src/packages/independent/vault-action-manager/src/impl/event-processing/vault-observation.ts",
		reason:
			"VAM's `vault.on` bridge: Obsidian calls its callbacks synchronously, so each event enters the runtime's context with `runSyncExitWith`",
	},
	{
		allow: { "run-sites": 1, throw: 1, try: 1 },
		pattern:
			"src/packages/independent/vault-action-manager/src/file-services/background/helpers/tfile-helper.ts",
		reason:
			"the callback of `Vault.process`, which Obsidian calls synchronously: it records the self-event with `runSync`, and wraps a transform's throw as `TransformThrew` so the write fails typed",
	},
	{
		allow: { throw: 1 },
		pattern:
			"src/packages/independent/vault-action-manager/src/internal/content-precondition.ts",
		reason:
			"a transform for `Vault.process`, which refuses a stale file by throwing `ContentPreconditionFailed` in the same synchronous call that writes, so the check and the write stay atomic",
	},
	{
		allow: { throw: 3, try: 2 },
		pattern: "src/packages/independent/vault-action-manager/src/effect/vam-live.ts",
		reason:
			"DOM interop for the active editor: the inline-title restore throws inside `Effect.try`, and the `Effect.callback` that waits for a view catches its DOM setup's throw and resumes with a typed failure",
	},
	{
		allow: { throw: 2 },
		pattern:
			"src/packages/independent/vault-action-manager/src/file-services/active-view/active-editor-snapshot.ts",
		reason: `${INSIDE_EFFECT_TRY}: an editor that changed under its snapshot is an \`IdentityMismatch\``,
	},
	{
		allow: { throw: 1 },
		pattern:
			"src/packages/independent/vault-action-manager/src/file-services/active-view/writer/active-file-writer.ts",
		reason: `${INSIDE_EFFECT_TRY}: an editor with no selection is a \`ReadFailure\``,
	},
	{
		allow: { throw: 1 },
		pattern:
			"src/packages/independent/vault-action-manager/src/impl/actions-processing/topological-sort.ts",
		reason: `${INVARIANT}; the dependency graph VAM builds has no cycles`,
	},
	{
		allow: { throw: 1 },
		pattern:
			"src/packages/independent/vault-action-manager/src/impl/protected-paths.ts",
		reason:
			"refuses the vault root as a protected prefix while VAM's Layer builds, so the launch fails and names VAM rather than protecting every path",
	},
	{
		allow: { try: 1 },
		pattern:
			"src/packages/independent/vault-action-manager/src/impl/vault-reader.ts",
		reason: `${CATCHES_THROWING_CALL}: a file the scan cannot path becomes a scan diagnostic`,
	},
	{
		allow: { try: 6 },
		pattern:
			"src/packages/independent/vault-action-manager/src/diagnostics/format-cause.ts",
		reason:
			"`formatCause` prints any value, including one whose getters or `toString` throw; it is the log of last resort, so it must not throw itself",
	},

	// ─── Pure packages ───
	{
		allow: { throw: 1 },
		pattern:
			"src/packages/composed/library-core/src/healer/library-tree/codex/codex-split-path.ts",
		reason: INVARIANT,
	},
	{
		allow: { throw: 1 },
		pattern:
			"src/packages/composed/library-core/src/healer/library-tree/codex/generate-codex-content.ts",
		reason: INVARIANT,
	},
	{
		allow: { throw: 2 },
		pattern:
			"src/packages/composed/library-core/src/healer/library-tree/tree-action/utils/locator/locator-utils.ts",
		reason: INVARIANT,
	},
	{
		allow: { throw: 2, try: 1 },
		pattern: "src/packages/independent/lemma-note-codec/src/path/slots.ts",
		reason: `${INVARIANT}; the \`try\` asks whether folders spell a route canonically, where an unspellable value means they do not`,
	},
	{
		allow: { try: 1 },
		pattern: "src/packages/independent/lemma-note-codec/src/links.ts",
		reason: `${CATCHES_THROWING_CALL}: a Lemma from stored data that has no path, as \`slots.ts\`'s invariants ask`,
	},
	{
		allow: { try: 1 },
		pattern: "src/packages/independent/lemma-note-codec/src/metadata.ts",
		reason: `${CATCHES_THROWING_CALL}: a field parser's \`ParsingError\` becomes a reported issue`,
	},
];
