import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Er ging gestern in den Park.",
			pos: "Verb",
			word: "gehen",
		},
		output: {
			emojiDescription: ["🚶"],
			ipa: "ˈɡeːən",
			senseGloss: "to walk",
		},
	},
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
