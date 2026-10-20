import type { Dumgen, SegmentedSentence, Unit } from "dumgen";
import * as Effect from "effect/Effect";

/** The one German Sentence the smoke segments, clicks and translates. */
export const SMOKE_SENTENCE = "Der alte Hund schläft im Garten.";
/** The Segment the smoke clicks, and the Canonical Form it expects. */
export const SMOKE_CLICK = "Hund";

/**
 * The live requests the smoke may send: `segment.inUnits` on one Sentence,
 * one `resolve.grammar` click and one `translate.sentence`.
 */
export const SMOKE_OPERATIONS = [
	"segment.inUnits",
	"resolve.grammar",
	"translate.sentence",
] as const;

export type SmokeCheck = {
	readonly name: string;
	readonly passed: boolean;
	readonly detail: string;
};

/** The unit holding the first Segment spelled `click`, if it has a route. */
export function clickedUnit(
	sentence: SegmentedSentence,
	click: string,
): Unit | undefined {
	const index = sentence.segments.findIndex(
		({ kind, text }) => kind === "ResolvableText" && text === click,
	);
	if (index < 0) return undefined;
	const unit = sentence.units.find(({ segments }) => segments.includes(index));
	return unit && unit.route !== "Unresolved" ? unit : undefined;
}

/**
 * Segments `SMOKE_SENTENCE`, resolves the grammar of the click on
 * `SMOKE_CLICK` and translates the Sentence into English. A failed
 * expectation is a failed check; a provider failure fails the Effect.
 */
export const runDumgenSmoke = Effect.fn("runDumgenSmoke")(function* (
	dumgen: Dumgen,
) {
	const checks: SmokeCheck[] = [];
	const check = (name: string, passed: boolean, detail: string) => {
		checks.push({ detail, name, passed });
		return passed;
	};

	const segmented = yield* dumgen.segment.inUnits({
		language: "de",
		paragraphs: [{ sentences: [SMOKE_SENTENCE] }],
	});
	const sentence = segmented.paragraphs[0]?.sentences[0];
	if (
		check(
			"segment.inUnits segments the Sentence",
			sentence !== undefined && sentence.failed !== true,
			sentence ? `${sentence.units.length} units` : "no Sentence came back",
		) &&
		sentence
	) {
		const unit = clickedUnit(sentence, SMOKE_CLICK);
		if (
			check(
				`"${SMOKE_CLICK}" lands on a routed unit`,
				unit !== undefined,
				JSON.stringify(unit?.route ?? "no routed unit"),
			) &&
			unit
		) {
			const grammar = yield* dumgen.resolve.grammar({
				language: "de",
				lemmaCandidates: [],
				neighbours: {},
				sentence,
				unit,
			});
			const attestation =
				grammar._tag === "Resolved"
					? JSON.stringify(grammar.attestation)
					: "";
			check(
				"resolve.grammar resolves the click",
				grammar._tag === "Resolved",
				grammar._tag === "Resolved"
					? attestation.slice(0, 300)
					: JSON.stringify(grammar),
			);
			check(
				`its Canonical Form is "${SMOKE_CLICK}"`,
				attestation.includes(`"canonicalForm":"${SMOKE_CLICK}"`),
				attestation.slice(0, 300),
			);
		}
	}

	const translation = yield* dumgen.translate.sentence({
		into: "en",
		language: "de",
		sentence: SMOKE_SENTENCE,
	});
	check(
		"translate.sentence translates into English",
		/\bdog\b/i.test(translation),
		translation,
	);
	return checks;
});
