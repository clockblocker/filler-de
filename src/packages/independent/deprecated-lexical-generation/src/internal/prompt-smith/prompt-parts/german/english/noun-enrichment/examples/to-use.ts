import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Die Deutsche Bank hat ihren Sitz in Frankfurt.",
			word: "Deutsche Bank",
		},
		output: {
			senseEmojis: ["🏦"],
			genus: "Femininum",
			ipa: "ˈdɔʏ̯tʃə baŋk",
			nounClass: "Proper",
			senseGloss: "financial institution",
		},
	},
	{
		input: {
			context: "Das alte Haus steht am Ende der Straße.",
			word: "Haus",
		},
		output: {
			senseEmojis: ["🏠"],
			genus: "Neutrum",
			ipa: "haʊ̯s",
			nounClass: "Common",
			senseGloss: "dwelling building",
		},
	},
] satisfies {
	input: UserInput<"NounEnrichment">;
	output: AgentOutput<"NounEnrichment">;
}[];
