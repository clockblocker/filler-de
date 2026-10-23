import type { TranslateSentenceInput } from "dumgen";
import type { Dumgen } from "../../../../src/managers/dumgen/dumgen-over";

/**
 * A dumgen whose `translate.sentence` answers with `translate`, recording
 * every input. Its other operations are not stubbed.
 */
export function stubDumgen(
	translate: Dumgen["translate"]["sentence"],
): { readonly dumgen: Dumgen; readonly inputs: TranslateSentenceInput[] } {
	const inputs: TranslateSentenceInput[] = [];
	const dumgen = {
		translate: {
			sentence: (input: TranslateSentenceInput) => {
				inputs.push(input);
				return translate(input);
			},
		},
	} as unknown as Dumgen;
	return { dumgen, inputs };
}
