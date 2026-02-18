import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Er ist stolz auf seine Arbeit.",
			pos: "Adjective",
			word: "stolz",
		},
		output: {
			emojiDescription: ["😌"],
			ipa: "ʃtɔlts",
			senseGloss: "feeling pride",
		},
	},
] satisfies {
	input: UserInput<"LexemEnrichment">;
	output: AgentOutput<"LexemEnrichment">;
}[];
