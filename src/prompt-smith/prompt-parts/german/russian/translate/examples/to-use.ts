import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: "Guten Morgen! Wie geht es Ihnen heute?",
		output: "Доброе утро! Как у вас дела сегодня?",
	},
	{
		input: "Das Wetter ist heute sehr schön.",
		output: "Сегодня очень хорошая погода.",
	},
] satisfies { input: UserInput<"Translate">; output: AgentOutput<"Translate"> }[];
