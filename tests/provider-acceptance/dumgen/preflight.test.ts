import { describe, expect, it } from "bun:test";
import type {
	GrammarResolution,
	ResolveGrammarInput,
	SegmentedSentence,
} from "dumgen";
import * as Effect from "effect/Effect";
import type { DumgenOperations } from "../../../src/managers/dumgen";
import { fakeDumgen } from "../../unit/dumgen/dumgen-support";
import { parseCliOptions, requireOptIn } from "./run";
import {
	clickedUnit,
	runDumgenSmoke,
	SMOKE_CLICK,
	SMOKE_OPERATIONS,
	SMOKE_SENTENCE,
} from "./smoke";

const segmented: SegmentedSentence = {
	segments: [
		{ kind: "ResolvableText", text: "Der" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "alte" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "Hund" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "schläft" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "im" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "Garten" },
		{ kind: "Punctuation", text: "." },
	],
	text: SMOKE_SENTENCE,
	units: [
		{ route: "Unresolved", segments: [0] },
		{ route: "Unresolved", segments: [2] },
		{
			route: { family: "Lexeme", kind: "NOUN", language: "de" },
			segments: [4],
		} as SegmentedSentence["units"][number],
		{ route: "Unresolved", segments: [6, 8, 10] },
	],
};

/** A dumgen that answers offline and counts the operations the smoke runs. */
function offlineDumgen() {
	const ran: string[] = [];
	const dumgen = {
		resolve: {
			grammar: (input: ResolveGrammarInput) => {
				ran.push("resolve.grammar");
				expect(input.unit.segments).toEqual([4]);
				return Effect.succeed({
					_tag: "Resolved",
					attestation: { lemma: { canonicalForm: SMOKE_CLICK } },
				} as unknown as GrammarResolution);
			},
		},
		segment: {
			inUnits: () => {
				ran.push("segment.inUnits");
				return Effect.succeed({
					language: "de" as const,
					paragraphs: [{ sentences: [segmented] }],
				});
			},
		},
		translate: {
			sentence: () => {
				ran.push("translate.sentence");
				return Effect.succeed("The old dog sleeps in the garden.");
			},
		},
	} as unknown as DumgenOperations;
	return { dumgen, ran };
}

describe("dumgen provider acceptance preflight", () => {
	it("requires explicit authorization and both provider keys", () => {
		expect(() =>
			requireOptIn({ OPENAI_API_KEY: "sk", TYPESAFE_API_KEY: "ts" }),
		).toThrow("TEXTFRESSER_PROVIDER_ACCEPTANCE=1");
		expect(() =>
			requireOptIn({ TEXTFRESSER_PROVIDER_ACCEPTANCE: "1" }),
		).toThrow("Missing TYPESAFE_API_KEY and OPENAI_API_KEY");
		expect(() =>
			requireOptIn({
				OPENAI_API_KEY: " ",
				TEXTFRESSER_PROVIDER_ACCEPTANCE: "1",
				TYPESAFE_API_KEY: "ts",
			}),
		).toThrow("Missing OPENAI_API_KEY");
		expect(
			requireOptIn({
				OPENAI_API_KEY: "sk",
				TEXTFRESSER_PROVIDER_ACCEPTANCE: "1",
				TYPESAFE_API_KEY: "ts",
			}),
		).toEqual({ openaiApiKey: "sk", typesafeApiKey: "ts" });
	});

	it("requires an explicit suite budget", () => {
		expect(() => parseCliOptions([], {})).toThrow(
			"Choose an explicit request budget",
		);
		expect(() => parseCliOptions(["--suite=all"], {})).toThrow(
			"Choose an explicit request budget",
		);
		expect(parseCliOptions(["--suite=smoke"], {}).suite).toBe("smoke");
	});

	it("finds the clicked Segment's routed unit", () => {
		expect(clickedUnit(segmented, SMOKE_CLICK)?.segments).toEqual([4]);
		expect(clickedUnit(segmented, "alte")).toBeUndefined();
		expect(clickedUnit(segmented, "Katze")).toBeUndefined();
	});

	it("runs each budgeted operation once and passes on good answers", async () => {
		const { dumgen, ran } = offlineDumgen();
		// The stubs answer offline; no transport is reached.
		const checks = await Effect.runPromise(
			runDumgenSmoke(dumgen).pipe(Effect.provide(fakeDumgen())),
		);
		expect(ran).toEqual([...SMOKE_OPERATIONS]);
		expect(checks.filter((check) => !check.passed)).toEqual([]);
	});
});
