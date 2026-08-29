import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	VamShutdownError,
} from "@textfresser/vault-action-manager/facade";
import {
	adaptLegacyVaultActionManager,
	createVaultActionManager as createLegacyVaultActionManager,
} from "@textfresser/vault-action-manager/legacy-neverthrow-facade";
import { Cause, Effect, Exit, Option } from "effect";
import {
	folderPath,
	makeFacadeHarness,
	mdPath,
} from "./helpers/facade-harness";

describe("VaultActionManager Effect facade", () => {
	it("exposes composable Effects for the complete public workflow", async () => {
		const harness = makeFacadeHarness();
		const { dispose, manager } = createVaultActionManager(harness.app);

		expect(Effect.isEffect(manager.dispatch([]))).toBe(true);
		expect(Effect.isEffect(manager.readContent(mdPath))).toBe(true);

		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* manager.startListening();
				const subscription = yield* manager.subscribeToBulk(
					() => Effect.void,
				);
				yield* manager.dispatch([]);
				const content = yield* manager.readContent(mdPath);
				const exists = yield* manager.exists(mdPath);
				const matches = yield* manager.findByBasename("note");
				const resolved = yield* manager.resolveLinkpathDest(
					"note",
					mdPath,
				);
				const listed = yield* manager.list(folderPath);
				const readablePaths =
					yield* manager.listAllFilesWithMdReaders(folderPath);
				const readable = readablePaths.find((path) => "read" in path);
				const readBack =
					readable && "read" in readable
						? yield* readable.read()
						: null;
				const activePath = yield* manager.mdPwd();
				const opened = yield* manager.getOpenedContent();
				const selection = yield* manager.getSelectionInfo();
				const selectionText = yield* manager.getSelectionText();
				yield* manager.cd(mdPath);
				yield* manager.scrollOpenedFileToLine(3);
				yield* subscription.close;

				return {
					activePath,
					content,
					exists,
					listed,
					matches,
					opened,
					readBack,
					resolved,
					selection,
					selectionText,
				};
			}),
		);

		expect(result.content).toBe("content");
		expect(result.exists).toBe(true);
		expect(result.matches).toEqual([mdPath]);
		expect(result.resolved).toEqual(mdPath);
		expect(result.listed).toEqual([mdPath]);
		expect(result.readBack).toBe("content");
		expect(result.activePath).toEqual(mdPath);
		expect(result.opened).toBe("content");
		expect(result.selection?.text).toBe("content");
		expect(result.selectionText).toBe("content");
		expect(harness.getScrollCount()).toBe(1);
		expect(harness.removed).toHaveLength(3);

		await Effect.runPromise(dispose);
	});

	it("keeps shutdown in the typed Effect error channel", async () => {
		const harness = makeFacadeHarness();
		const { dispose, manager } = createVaultActionManager(harness.app);
		await Effect.runPromise(dispose);
		await Effect.runPromise(dispose);

		const exit = await Effect.runPromiseExit(manager.readContent(mdPath));
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const failure = Option.getOrUndefined(
				Cause.findErrorOption(exit.cause),
			);
			expect(failure).toBeInstanceOf(VamShutdownError);
		}
	});

	it("keeps the legacy subpath source-compatible", async () => {
		const harness = makeFacadeHarness();
		const { dispose, manager } = createLegacyVaultActionManager(
			harness.app,
		);

		const read = manager.readContent(mdPath);
		expect(Effect.isEffect(read)).toBe(false);
		expect((await read).isOk()).toBe(true);
		await dispose();
	});

	it("adapts the canonical manager without owning a second runtime", async () => {
		const harness = makeFacadeHarness();
		const canonical = createVaultActionManager(harness.app);
		const legacy = adaptLegacyVaultActionManager(canonical.manager);

		expect((await legacy.readContent(mdPath)).isOk()).toBe(true);
		await Effect.runPromise(canonical.dispose);

		const readAfterCanonicalDisposal = await legacy.readContent(mdPath);
		expect(readAfterCanonicalDisposal.isErr()).toBe(true);
	});
});
