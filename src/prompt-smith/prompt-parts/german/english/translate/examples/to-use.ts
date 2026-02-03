import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: "Guten Morgen! Wie geht es Ihnen heute?",
		output: "Good morning! How are you today?",
	},
	{
		input: "Das Wetter ist heute sehr schön.",
		output: "The weather is very nice today.",
	},
] satisfies {
	input: UserInput<"Translate">;
	output: AgentOutput<"Translate">;
}[];
