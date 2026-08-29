import { describe, expect, it, mock } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
	type ScrollNodeSegmentId,
	type SectionNodeSegmentId,
	TreeNodeKind,
	TreeNodeStatus,
} from "@textfresser/library-core";
import {
	MD,
	SplitPathKind,
	VamVaultIoError,
	type VaultActionManagerReadableMdPath,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { buildInitialCreateActions } from "../../../src/commanders/librarian/init/build-initial-actions";
import { triggerSectionHealing } from "../../../src/commanders/librarian/runtime/section-healing";
import { defaultSettingsForUnitTests } from "../common-utils/consts";
import { makeTree } from "./library-tree/tree-test-helpers";

mock.module("../../../src/global-state/global-state", () => ({
	getParsedUserSettings: () => defaultSettingsForUnitTests,
}));

const codecs = makeCodecs(
	makeCodecRulesFromSettings(defaultSettingsForUnitTests),
);

function readableScroll(
	read: VaultActionManagerReadableMdPath["read"],
): VaultActionManagerReadableMdPath {
	return {
		basename: "Story",
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: ["Library"],
		read,
	};
}

describe("Librarian Effect helpers", () => {
	it("defers initial markdown reads and extracts completed status", async () => {
		let reads = 0;
		const program = buildInitialCreateActions(
			[
				readableScroll(() => {
					reads += 1;
					return Effect.succeed("---\nstatus: Done\n---\nBody");
				}),
			],
			codecs,
		);

		expect(Effect.isEffect(program)).toBe(true);
		expect(reads).toBe(0);

		const { createActions } = await Effect.runPromise(program);

		expect(reads).toBe(1);
		expect(createActions).toHaveLength(1);
		expect(createActions[0]?.initialStatus).toBe(TreeNodeStatus.Done);
	});

	it("defaults unreadable markdown status to NotStarted", async () => {
		const { createActions } = await Effect.runPromise(
			buildInitialCreateActions(
				[
					readableScroll(() =>
						Effect.fail(
							new VamVaultIoError({
								cause: new Error("unreadable"),
								operation: "read",
								path: "Library/Story.md",
							}),
						),
					),
				],
				codecs,
			),
		);

		expect(createActions).toHaveLength(1);
		expect(createActions[0]?.initialStatus).toBe(
			TreeNodeStatus.NotStarted,
		);
	});

	it("composes section dispatch lazily and preserves its error channel", async () => {
		const healer = makeTree({
			children: { Source: { kind: "Scroll" } },
			libraryRoot: "Library",
		});
		const rootSegmentId = codecs.segmentId.serializeSegmentId({
			coreName: "Library",
			targetKind: TreeNodeKind.Section,
		}) as SectionNodeSegmentId;
		const sectionSegmentId = codecs.segmentId.serializeSegmentId({
			coreName: "Pages",
			targetKind: TreeNodeKind.Section,
		}) as SectionNodeSegmentId;
		const sourceSegmentId = codecs.segmentId.serializeSegmentId({
			coreName: "Source",
			extension: MD,
			targetKind: TreeNodeKind.Scroll,
		}) as ScrollNodeSegmentId;
		const dispatchFailure = { _tag: "DispatchFailure" } as const;
		let dispatches = 0;

		const program = triggerSectionHealing(
			{
				codecs,
				dispatch: () => {
					dispatches += 1;
					return Effect.fail(dispatchFailure);
				},
				healer,
			},
			{
				deletedScrollSegmentId: sourceSegmentId,
				pageNodeNames: ["Page 1", "Page 2"],
				sectionChain: [rootSegmentId, sectionSegmentId],
			},
		);

		expect(Effect.isEffect(program)).toBe(true);
		expect(dispatches).toBe(0);

		const result = await Effect.runPromise(
			program.pipe(Effect.catch((error) => Effect.succeed(error))),
		);

		expect(dispatches).toBe(1);
		expect(result).toBe(dispatchFailure);
	});
});
