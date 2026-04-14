import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Das machen wir auf jeden Fall morgen.",
			kind: "DiscourseFormula",
			word: "auf jeden Fall",
		},
		output: {
			senseEmojis: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			senseGloss: "definitely / certainly",
		},
	},
	{
		input: {
			context: "Er hat den Löffel abgegeben.",
			kind: "Idiom",
			word: "den Löffel abgeben",
		},
		output: {
			senseEmojis: ["💀"],
			ipa: "deːn ˈlœfl̩ ˈapɡeːbn̩",
			senseGloss: "to die",
		},
	},
] satisfies {
	input: UserInput<"PhrasemEnrichment">;
	output: AgentOutput<"PhrasemEnrichment">;
}[];
