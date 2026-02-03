import type { AgentOutput, UserInput } from "../../../../schemas";

export const examples = [
	{
		input: "Good morning! How are you today?",
		output: "Доброе утро! Как у вас дела сегодня?",
	},
	{
		input: "The weather is very nice today.",
		output: "Сегодня очень хорошая погода.",
	},
] satisfies { input: UserInput<"Translate">; output: AgentOutput<"Translate"> }[];
