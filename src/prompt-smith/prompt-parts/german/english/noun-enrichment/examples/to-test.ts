import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Das Haus steht am Ende der Straße.",
			word: "Haus",
		},
		output: {
			emojiDescription: ["🏠"],
			genus: "Neutrum",
			ipa: "haʊ̯s",
			nounClass: "Common",
			senseGloss: "dwelling building",
		},
	},
] satisfies {
	input: UserInput<"NounEnrichment">;
	output: AgentOutput<"NounEnrichment">;
}[];
