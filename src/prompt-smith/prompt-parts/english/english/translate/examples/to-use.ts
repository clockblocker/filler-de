import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: "Good morning! How are you today?",
		output: "Good morning! How are you doing today?",
	},
	{
		input: "The weather is very nice today.",
		output: "The weather is quite pleasant today.",
	},
] satisfies { input: UserInput<"Translate">; output: AgentOutput<"Translate"> }[];
