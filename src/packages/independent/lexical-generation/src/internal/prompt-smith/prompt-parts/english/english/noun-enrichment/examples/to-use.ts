import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "London remains a major financial center.",
			word: "London",
		},
		output: {
			emojiDescription: ["🏙️"],
			ipa: "ˈlʌndən",
			nounClass: "Proper",
			senseGloss: "capital city",
		},
	},
	{
		input: {
			context: "The old house is at the end of the street.",
			word: "house",
		},
		output: {
			emojiDescription: ["🏠"],
			ipa: "haʊs",
			nounClass: "Common",
			senseGloss: "dwelling building",
		},
	},
] satisfies {
	input: UserInput<"NounEnrichment">;
	output: AgentOutput<"NounEnrichment">;
}[];
