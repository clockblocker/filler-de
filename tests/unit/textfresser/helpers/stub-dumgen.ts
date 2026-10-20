import type { Dumgen, TranslateSentenceInput } from "dumgen";

/** For Textfresser state in tests that never reach dumgen. */
export const noDumgen = (): never => {
	throw new Error("dumgen is not used in this test");
};

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
