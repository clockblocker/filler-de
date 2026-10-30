import { describe, expect, it } from "bun:test";
import type { AttestationLink } from "dumdict";
import type { SegmentedSentence } from "dumgen";
import { Deferred, Effect } from "effect";
import {
	ClassifyError,
	type ClassifyInput,
	type ClassifyOutcome,
} from "../../../../src/commanders/classify/classify-selection";
import { makeOccurrenceAttester } from "../../../../src/commanders/classify/resolution/attest-occurrence";
import { occurrencesAt } from "../../../../src/commanders/classify/resolution/occurrence-keys";
import { createScrollActivity } from "../../../../src/commanders/classify/resolution/scroll-activity";
import { attestationRefOf } from "../../../../src/commanders/classify/resolution/scroll-links";
import { memorySegmentationCache } from "../../../../src/commanders/classify/segmentation-cache";
import { sentenceKey } from "../../../../src/commanders/classify/sentence-key";
import { inScope } from "../../../support/scoped";
import { run } from "./support";

const SCROLL = "Library/Story.md";
const READING = "Worter/de/Lexeme/NOUN/Masc/s/see/see/🌊 See";
const CONTENT = `Der [[${READING}|See]] ist tief. ^0\n\nDer [[Elsewhere|Rest]] ist hier. ^1\n`;
const SENTENCE: SegmentedSentence = {
	segments: [
		{ kind: "ResolvableText", text: "Der" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "See" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "ist" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "tief" },
		{ kind: "Punctuation", text: "." },
	],
	text: "Der See ist tief.",
	units: [{ route: { family: "Lexeme", kind: "NOUN", language: "de" }, segments: [2] }],
};
const SEE_AT = CONTENT.indexOf("See]]");

/**
 * The attester over a Scroll of `CONTENT`, whose Classify records each run
 * and, once `release` is called, stores the clicked occurrence's ref.
 */
async function attesterOver(
	options: {
		readonly blocked?: string;
		readonly fails?: boolean;
		/** Classify waits for this before it ends. */
		readonly gate?: Deferred.Deferred<void>;
	} = {},
) {
	const cache = memorySegmentationCache();
	await run(cache.put(sentenceKey("test-segmenter", "de", SENTENCE.text), SENTENCE));
	const stored: AttestationLink<"de">[] = [];
	const runs: ClassifyInput[] = [];
	const notices: string[] = [];
	const activity = createScrollActivity();
	const busy: boolean[] = [];
	const keyed = (
		await run(
			occurrencesAt(CONTENT, [{ from: SEE_AT, to: SEE_AT + 3 }], cache, "test-segmenter"),
		)
	).get(SEE_AT);
	const { value: attester } = await inScope(
		makeOccurrenceAttester({
			activity,
			...(options.blocked === undefined ? {} : { blockedBy: () => options.blocked }),
			cache,
			classify: (input) =>
				Effect.gen(function* () {
					runs.push(input);
					busy.push(activity.busy(SCROLL));
					if (options.gate) yield* Deferred.await(options.gate);
					if (options.fails)
						return yield* new ClassifyError({ message: "no keys", reason: "DumgenUnavailable" });
					stored.push({
						ref: attestationRefOf(SCROLL, "0", keyed?.occurrence ?? "?"),
					} as AttestationLink<"de">);
					return { resolutions: [] } as unknown as ClassifyOutcome;
				}),
			notify: (message) => notices.push(message),
			scrolls: {
				read: (path) => Effect.succeed(path === SCROLL ? CONTENT : undefined),
				resolve: (linkpath) =>
					Effect.succeed(linkpath === READING ? `${READING}.md` : `${linkpath}.md`),
			},
			segmenterVersion: Effect.succeed("test-segmenter"),
			store: Effect.succeed({
				attestationLinksWithRefPrefix: (prefix: string) =>
					Effect.succeed(stored.filter(({ ref }) => ref.startsWith(prefix))),
			}),
		}),
	);
	const click = (offset: number, sourcePath = SCROLL, target = READING) =>
		run(attester.clicked({ offset, sourcePath, target }));
	return { attester, busy, click, notices, runs, stored };
}

describe("makeOccurrenceAttester", () => {
	it("attests a clicked unit link's occurrence through Classify on that link alone, the Scroll busy", async () => {
		const { attester, busy, click, runs } = await attesterOver();
		await click(SEE_AT + 1);
		await run(attester.whenIdle);
		expect(runs).toEqual([
			{
				attest: "Clicked",
				clickedReading: `${READING}.md`,
				content: CONTENT,
				german: "Known",
				scrollPath: SCROLL,
				selection: { from: SEE_AT, to: SEE_AT + 3 },
			},
		]);
		expect(busy).toEqual([true]);
	});

	it("does nothing for an occurrence already attested", async () => {
		const { attester, click, runs } = await attesterOver();
		await click(SEE_AT);
		await run(attester.whenIdle);
		await click(SEE_AT);
		await run(attester.whenIdle);
		expect(runs).toHaveLength(1);
	});

	it("attests again an occurrence whose stored ref names a block that went, as a deleted refrain copy's", async () => {
		const { attester, click, runs, stored } = await attesterOver();
		await click(SEE_AT);
		await run(attester.whenIdle);
		// The stored ref is now one of a copy whose block is gone; this copy
		// took over its key.
		const [only] = stored.splice(0);
		stored.push({ ...only, ref: (only?.ref ?? "").replace("#^0|", "#^7|") } as AttestationLink<"de">);
		await click(SEE_AT);
		await run(attester.whenIdle);
		expect(runs).toHaveLength(2);
	});

	it("runs a double click's occurrence once: the second waits for the first", async () => {
		const gate = Deferred.makeUnsafe<void>();
		const { attester, click, runs } = await attesterOver({ gate });
		await click(SEE_AT);
		await click(SEE_AT + 2);
		await run(Deferred.succeed(gate, undefined));
		await run(attester.whenIdle);
		expect(runs).toHaveLength(1);
	});

	it("leaves alone a click on no link, on a link outside the dictionary, in a dictionary note, or while blocked", async () => {
		const plain = await attesterOver();
		await plain.click(CONTENT.indexOf("tief"));
		await plain.click(CONTENT.indexOf("Rest"), SCROLL, "Elsewhere");
		await plain.click(SEE_AT, `${READING}.md`);
		await run(plain.attester.whenIdle);
		expect(plain.runs).toEqual([]);

		const blocked = await attesterOver({ blocked: "a dictionary reset is running" });
		await blocked.click(SEE_AT);
		await run(blocked.attester.whenIdle);
		expect(blocked.runs).toEqual([]);
	});

	it("leaves alone a click whose link it does not find at the offset, as in another pane's note or text not saved yet", async () => {
		const { attester, click, runs } = await attesterOver();
		// The click was on a link to another note, which the Scroll as read
		// holds no link to at that offset.
		await click(SEE_AT, SCROLL, "Worter/de/Lexeme/NOUN/Fem/t/tei/teich/🦆 Teich");
		await click(CONTENT.indexOf("Rest"), SCROLL, READING);
		await run(attester.whenIdle);
		expect(runs).toEqual([]);
	});

	it("tells the user what kept a click from attesting", async () => {
		const { attester, click, notices } = await attesterOver({ fails: true });
		await click(SEE_AT);
		await run(attester.whenIdle);
		expect(notices).toEqual(["⚠ Could not attest See: no keys"]);
	});
});
