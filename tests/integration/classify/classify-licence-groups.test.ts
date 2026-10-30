/**
 * The `classify-licence-groups` desktop scenario's story without Obsidian:
 * the plugin's dumgen service with the scenario's script, the real resolver,
 * and the dictionary store over a fake vault with the plugin's
 * projections. It proves the script gives Mutter two Readings whose
 * plurals differ, so the desktop scenario tests the Obsidian side only.
 */
import { describe, expect, it } from "bun:test";
import { makeDumdictVaultStore } from "@textfresser/dictionary";
import { type Answer, operations } from "dumgen";
import { Effect } from "effect";
import { ClassifyCommander } from "../../../src/commanders/classify/classify-commander";
import { memoryJudgementCache } from "../../../src/commanders/classify/judgement-cache";
import { dumgenUnitResolver } from "../../../src/commanders/classify/resolution/dumgen-unit-resolver";
import { makeKnowledgeQueue } from "../../../src/commanders/classify/resolution/knowledge-queue";
import { produceKnowledge } from "../../../src/commanders/classify/resolution/produce-knowledge";
import { createScrollActivity } from "../../../src/commanders/classify/resolution/scroll-activity";
import { memorySegmentationCache } from "../../../src/commanders/classify/segmentation-cache";
import { FakeVault } from "../../../src/packages/composed/dictionary/tests/support/fake-vault";
import { dictionaryProjections } from "../../../src/stateless-helpers/dictionary-projections";
import {
	expectLicenceGroupNotes,
	LICENCE_GROUPS_DUMGEN,
	NUT_PATH,
	NUT_SELECTION,
	PARENT_PATH,
	PARENT_SELECTION,
	STORY,
} from "../../obsidian-e2e/scenarios/classify-licence-groups-script";
import { linkTo } from "../../obsidian-e2e/scenarios/dictionary-layout";
import { inScope } from "../../support/scoped";
import {
	clicksOn,
	MemoryScroll,
	resolveAmong,
} from "../../unit/classify/resolution/support";
import { dumgenServiceOver, unreachable } from "../../unit/dumgen/dumgen-support";

const SCROLL = "Library/Story.md";

/** The driver's expansion of a scenario's jev script into dumgen Answers. */
function answersOf(
	script: Readonly<Record<string, string | number>>,
): Record<string, Answer> {
	return Object.fromEntries(
		Object.entries(script).map(([id, answer]) => [
			id,
			typeof answer === "number"
				? { noul: answer, type: "noul" }
				: {
						choice: answer,
						confidence: 1,
						probabilities: { [answer]: 1 },
						type: "choice",
					},
		]),
	);
}

describe("Classify gives each Licence Group its own table", () => {
	it("draws one table per Licence Group of Mutter, and each Reading note embeds its own", async () => {
		const dumgen = dumgenServiceOver(unreachable, () => ({
			openaiApiKey: "",
			typesafeApiKey: "",
		}));
		Effect.runSync(
			dumgen.testing.useScripted({
			jev: answersOf(LICENCE_GROUPS_DUMGEN.jev),
			luna: LICENCE_GROUPS_DUMGEN.luna,
			}),
		);
		// Obsidian knows the Scroll, so refs name it by its basename.
		const vault = new FakeVault({ [SCROLL]: STORY });
		const store = await Effect.runPromise(
			makeDumdictVaultStore({ projections: dictionaryProjections, vault }),
		);
		const scroll = new MemoryScroll(SCROLL, STORY);
		const notices: string[] = [];
		const { value: queue } = await inScope(
			makeKnowledgeQueue({
				notify: (message) => notices.push(message),
				run: (job) =>
					produceKnowledge(
						{ dumgen: operations, store, translationLanguages: ["en", "ru"] },
						job,
					).pipe(dumgen.provideBackground),
			}),
		);
		const cache = memorySegmentationCache();
		const activity = createScrollActivity();
		const commander = new ClassifyCommander({
			cache,
			dumgen: dumgen.provide,
			missingProviderKeys: dumgen.missingKeys,
			resolver: dumgenUnitResolver({
				activity,
				dumgen: operations,
				judgements: memoryJudgementCache(),
				knowledge: queue,
				notify: (message) => notices.push(message),
				scroll,
				store: Effect.succeed(store),
			}),
			segmenterVersion: Effect.succeed("test-segmenter"),
		});
		// The user clicks each unit Classify linked, which attests it (#281).
		const { clickAll } = await clicksOn({
			activity,
			cache,
			classify: (input) => commander.classify(input),
			resolve: (linkpath) =>
				resolveAmong(() => [...vault.markdownPaths(), SCROLL])(linkpath),
			scroll,
			store,
		});
		const classify = async (selection: string) => {
			const from = scroll.content.indexOf(selection);
			await Effect.runPromise(
				commander.execute(
					{
						content: scroll.content,
						scrollPath: SCROLL,
						selection: { from, to: from + selection.length },
					},
					(message) => notices.push(message),
				),
			);
			const resolved = commander.latestHandoff()?.resolved;
			await clickAll();
			await Effect.runPromise(queue.whenIdle);
			return resolved;
		};

		expect(await classify(PARENT_SELECTION)).toEqual([
			{ linked: 1, readingPath: PARENT_PATH },
		]);
		expect(await classify(NUT_SELECTION)).toEqual([
			{ linked: 1, readingPath: NUT_PATH },
		]);
		expect(scroll.content).toBe(
			`${linkTo(PARENT_PATH, "Die Mutter")} lacht. ^0\n\n${linkTo(NUT_PATH, "Eine Mutter")} klemmt. ^1\n`,
		);
		expectLicenceGroupNotes(
			Object.fromEntries(
				vault
					.markdownPaths()
					.filter((path) => path.startsWith("Worter/"))
					.map((path) => [path, vault.content(path)]),
			),
		);
		// The licence judge was asked about the stored plural, once.
		expect(Effect.runSync(dumgen.testing.requests)?.jev.paradigmLicence).toBe(1);
	});
});
