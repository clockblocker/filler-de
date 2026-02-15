import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	// Basic DE→EN
	{
		input: "Guten Morgen! Wie geht es Ihnen heute?",
		output: "Good morning! How are you today?",
	},
	// Basic EN→DE
	{
		input: "The weather is beautiful today.",
		output: "Das Wetter ist heute wunderschön.",
	},
	// Other→EN (French)
	{
		input: "Bonjour, comment ça va?",
		output: "Hello, how are you?",
	},
	// Bold concept preserved
	{
		input: "Das **Herz** schlägt schnell.",
		output: "The **heart** beats fast.",
	},
	// Italic: emphasis transferred to verb in DE
	{
		input: "She *really* loves coffee.",
		output: "Sie *liebt* Kaffee wirklich.",
	},
	// Highlight: same word, easy case
	{
		input: "==Winter== kam früh.",
		output: "==Winter== came early.",
	},
	// Word order shift: Buch at pos 3 → book at pos 4
	{
		input: "Er hat das **Buch** auf den Tisch gelegt.",
		output: "He put the **book** on the table.",
	},
	// Function words: relative pronoun + preposition decorated
	{
		input: "Die Frau hatte zwei Töchter mit ins Haus gebracht, *die* schön und weiß **von** Angesicht waren, aber garstig und schwarz von Herzen.",
		output: "The woman had brought two daughters into the house, *who* were beautiful and white **of** face, but vile and black of heart.",
	},
	// Square brackets: article preserved
	{
		input: "und auf [dem] Rückweg, als er",
		output: "and on [the] way back, when he",
	},
	// Idiom: decoration follows meaning, not literal words
	// Reflexive quirk: bend grammar to preserve sich → herself
	{
		input: "Aber dann freut sie **sich**, dass ihr bester Freund wieder verliebt ist und dieses Mal *keinen Korb* bekommen hat.",
		output: "But then she finds **herself** happy that her best friend is in love again and this time *wasn't rejected*.",
	},
	// Separable verb: zu|stimmen prefix preserved via "go along"
	{
		input: "Du stimmst mir *zu*, richtig?",
		output: "You go *along* with me, right?",
	},
	// Two identical words, different roles: preposition vs separable prefix
	{
		input: "Pass ~~auf~~ dich **auf**",
		output: "Watch **out** ~~for~~ yourself",
	},
] satisfies {
	input: UserInput<"Translate">;
	output: AgentOutput<"Translate">;
}[];
