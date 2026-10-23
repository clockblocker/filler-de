import { beforeEach, describe, expect, it } from "bun:test";
import { createVaultActionManager } from "@textfresser/vault-action-manager";
import { Cause, Deferred, Effect, Fiber } from "effect";
import type { App } from "obsidian";
import { makeKnowledgeQueue } from "../../../src/commanders/classify/resolution/knowledge-queue";
import { memorySegmentationCache } from "../../../src/commanders/classify/segmentation-cache";
import { ResetFailed } from "../../../src/commanders/dictionary-reset/ports";
import {
	DictionaryResetCommand,
	type DictionaryResetDeps,
} from "../../../src/commanders/dictionary-reset/reset-command";
import type { DumgenProvide } from "../../../src/managers/dumgen";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";
import { shownNotices } from "../../support/obsidian-dom";
import { inScope } from "../../support/scoped";

const SOURCE = "Worter backup 2026-10-21 05-43-21";
const OLD_HUND = [
	"🐕 der [[Hund]], [hʊnt](https://youglish.com/pronounce/Hund/german) ^LX-LM-NOUN-1",
	"",
	'<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>',
	"![[Story#^1|^]]",
	"",
].join("\n");

/**
 * The command over a vault holding one old note, its modal buttons run on
 * Effect's default runtime as the plugin runs them on its own: at once.
 */
async function resetOver(
	dumgen: DumgenProvide,
	overrides: Partial<DictionaryResetDeps> = {},
) {
	const vault = makeObsidianVault({
		[`${SOURCE}/de/lexem/lemma/h/hun/hund/Hund.md`]: OLD_HUND,
	});
	const { manager } = createVaultActionManager(vault.app);
	const steps: Fiber.Fiber<void>[] = [];
	const { value: knowledge } = await inScope(
		makeKnowledgeQueue({
			notify: () => {},
			run: () => Effect.die("no Knowledge runs here"),
		}),
	);
	const deps: DictionaryResetDeps = {
		app: {
			workspace: { openLinkText: () => Promise.resolve() },
		} as unknown as App,
		cache: memorySegmentationCache(),
		checkProviderKeys: Effect.succeed([]),
		dumgen,
		knowledge,
		missingProviderKeys: Effect.succeed([]),
		run: (_kind, effect) => {
			steps.push(Effect.runFork(effect));
		},
		segmenterVersion: Effect.succeed("test-segmenter"),
		store: Effect.die("the store is not read before dumgen"),
		vam: manager,
		...overrides,
	};
	const reset = Effect.runSync(DictionaryResetCommand.make(deps));
	/** Opens the modal, then clicks Execute… and Execute in the confirmation. */
	const execute = async () => {
		await Effect.runPromise(reset.open);
		const opening = reset.lastOpening();
		expect(opening).not.toBeNull();
		if (opening)
			expect((await Effect.runPromise(Deferred.await(opening))).kind).toBe(
				"Opened",
			);
		const before = reset.lastExecute();
		expect(reset.clickButton("Execute…")).toBe(true);
		expect(reset.clickButton("Execute")).toBe(true);
		const executed = reset.lastExecute();
		if (!executed || executed === before)
			throw new Error("the Execute did not start");
		return executed;
	};
	return { execute, reset, steps };
}

const outcomeOf = <A>(shown: Deferred.Deferred<A>) =>
	Effect.runPromise(Deferred.await(shown));

beforeEach(() => {
	shownNotices.length = 0;
});

describe("the dictionary reset's Execute", () => {
	it("stops with every reason it failed with, in its notice", async () => {
		// The Execute fails with a failure and a defect beside it.
		const failing = () =>
			Effect.failCause(
				Cause.combine(
					Cause.fail(
						new ResetFailed({
							cause: "test",
							message: "the backup could not be checked",
						}),
					),
					Cause.die(new Error("the transport exploded")),
				),
			);
		const { execute, reset } = await resetOver(failing as DumgenProvide);
		const outcome = await outcomeOf(await execute());
		const notice =
			"⚠ Dictionary reset stopped: the backup could not be checked; the transport exploded";
		expect(outcome).toEqual({ kind: "Stopped", notice });
		expect(shownNotices.at(-1)).toBe(notice);
		expect(reset.isRunning()).toBe(false);
	});

	it("still answers when a step dies, and releases the reset", async () => {
		const { execute, reset } = await resetOver(() => Effect.never, {
			missingProviderKeys: Effect.die(new Error("the keys are unreadable")),
		});
		expect(await outcomeOf(await execute())).toEqual({
			kind: "Stopped",
			notice: "⚠ Dictionary reset stopped: the keys are unreadable",
		});
		expect(reset.isRunning()).toBe(false);
	});

	it("runs alone: a second Execute is refused while the first runs", async () => {
		const { execute, reset } = await resetOver(() => Effect.never);
		const first = await execute();
		expect(reset.isRunning()).toBe(true);
		const second = await outcomeOf(await execute());
		expect(second).toEqual({
			kind: "Refused",
			notice: "⚠ A dictionary reset is already running.",
		});
		expect(reset.isRunning()).toBe(true);
		expect(await Effect.runPromise(reset.cancel)).toBe(true);
		expect(Deferred.isDoneUnsafe(first)).toBe(false);
	});

	it("answers that the plugin unloaded when unloading interrupts it, and tells nothing", async () => {
		const { execute, reset, steps } = await resetOver(() => Effect.never);
		const shown = await execute();
		const before = shownNotices.length;
		const step = steps.at(-1);
		if (step) await Effect.runPromise(Fiber.interrupt(step));
		expect(await outcomeOf(shown)).toEqual({
			kind: "Stopped",
			notice: "the plugin unloaded",
		});
		expect(shownNotices.slice(before)).toEqual([]);
		expect(reset.isRunning()).toBe(false);
		expect(await Effect.runPromise(reset.cancel)).toBe(false);
	});
});
