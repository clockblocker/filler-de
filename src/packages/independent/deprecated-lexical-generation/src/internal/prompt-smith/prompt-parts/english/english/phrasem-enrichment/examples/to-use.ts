import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "By and large, the rollout was successful.",
			kind: "DiscourseFormula",
			word: "by and large",
		},
		output: {
			senseEmojis: ["📊", "👍"],
			ipa: "baɪ ən lɑːrdʒ",
			senseGloss: "generally speaking",
		},
	},
	{
		input: {
			context: "After three hours of meetings, we called it a day.",
			kind: "Idiom",
			word: "call it a day",
		},
		output: {
			senseEmojis: ["🛑", "📅"],
			ipa: "kɔːl ɪt ə deɪ",
			senseGloss: "stop for now",
		},
	},
] satisfies {
	input: UserInput<"PhrasemEnrichment">;
	output: AgentOutput<"PhrasemEnrichment">;
}[];
