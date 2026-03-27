import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "London remains a major financial center.",
			word: "London",
		},
		output: {
			emojiDescription: ["🏙️"],
			ipa: "ˈlʌndən",
			nounClass: "Proper",
		},
	},
] satisfies {
	input: UserInput<"NounEnrichment">;
	output: AgentOutput<"NounEnrichment">;
}[];
