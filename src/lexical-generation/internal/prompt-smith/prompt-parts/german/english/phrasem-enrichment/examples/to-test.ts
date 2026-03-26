import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Das machen wir auf jeden Fall morgen.",
			kind: "DiscourseFormula",
			word: "auf jeden Fall",
		},
		output: {
			emojiDescription: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			senseGloss: "definitely / certainly",
		},
	},
] satisfies {
	input: UserInput<"PhrasemEnrichment">;
	output: AgentOutput<"PhrasemEnrichment">;
}[];
