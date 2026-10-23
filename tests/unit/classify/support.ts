import type { Answer } from "dumgen";
import { Effect, Layer } from "effect";
import {
	type ClassifyInput,
	ClassifySegmenter,
	classifySelection,
} from "../../../src/commanders/classify/classify-selection";
import {
	memorySegmentationCache,
	SegmentationCache,
} from "../../../src/commanders/classify/segmentation-cache";
import {
	pendingUnitResolver,
	UnitResolver,
} from "../../../src/commanders/classify/unit-resolver";
import { createScriptedJev } from "../../../src/managers/dumgen/scripted-jev";
import { fakeDumgen } from "../dumgen/dumgen-support";

const picked = (choice: string): Answer => ({
	choice,
	confidence: 1,
	probabilities: { [choice]: 1 },
	type: "choice",
});

/**
 * jev's answers that segment "Er fängt heute an." into Er (PRON), the
 * separable verb fängt … an (VERB, Segments 2 and 6) and heute (ADV). Ids
 * are per Sentence, so any Sentence without its own answers gets the
 * scripted jev's defaults.
 */
export const FAENGT_AN_ANSWERS = {
	i_1: picked("c0"),
	r_1: picked("Lexeme/PRON"),
	r_2_4: picked("Lexeme/VERB"),
	r_3: picked("Lexeme/ADV"),
	s_particle_4: picked("p2"),
} satisfies Record<string, Answer>;

export function classifyHarness(
	options: {
		readonly answers?: Readonly<Record<string, Answer>>;
		readonly failStage?: string;
	} = {},
) {
	const scripted = createScriptedJev(options.answers ?? FAENGT_AN_ANSWERS);
	const dumgen = fakeDumgen({
		jev: (request, context) =>
			context.stage === options.failStage
				? Promise.reject(new Error("jev is down"))
				: scripted.ask(request, context),
		luna: () => Promise.reject(new Error("segmentation asked Luna")),
	});
	const cache = memorySegmentationCache();
	const handedOver: unknown[] = [];
	const layer = Layer.mergeAll(
		Layer.succeed(SegmentationCache, cache),
		Layer.succeed(UnitResolver, {
			resolve: (plan) => {
				handedOver.push(plan);
				return pendingUnitResolver.resolve(plan);
			},
		}),
		Layer.succeed(ClassifySegmenter, { segmenterVersion: "test-segmenter" }),
		dumgen,
	);
	return {
		cache,
		classify: (input: ClassifyInput) =>
			Effect.runPromise(classifySelection(input).pipe(Effect.provide(layer))),
		classifyExit: (input: ClassifyInput) =>
			Effect.runPromiseExit(
				classifySelection(input).pipe(Effect.provide(layer)),
			),
		handedOver,
		requests: scripted.requests,
	};
}

/** The selection of the `occurrence`th `text` in `content`. */
export function selectionOf(content: string, text: string, occurrence = 0) {
	let from = -1;
	for (let index = 0; index <= occurrence; index++)
		from = content.indexOf(text, from + 1);
	if (from < 0) throw new Error(`${text} is not in the content`);
	return { from, to: from + text.length };
}
