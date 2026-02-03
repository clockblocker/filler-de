import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	// Basic DE→RU
	{
		input: "Guten Morgen! Wie geht es Ihnen heute?",
		output: "Доброе утро! Как у вас дела сегодня?",
	},
	// Basic RU→DE
	{
		input: "Погода сегодня прекрасная.",
		output: "Das Wetter ist heute wunderschön.",
	},
	// Other→RU (French)
	{
		input: "Bonjour, comment ça va?",
		output: "Привет, как дела?",
	},
	// Bold concept preserved
	{
		input: "Das **Herz** schlägt schnell.",
		output: "**Сердце** бьётся быстро.",
	},
	// Italic: emphasis transferred
	{
		input: "Она *очень* любит кофе.",
		output: "Sie *liebt* Kaffee wirklich.",
	},
	// Highlight: same concept
	{
		input: "==Winter== kam früh.",
		output: "==Зима== пришла рано.",
	},
	// Word order shift
	{
		input: "Er hat das **Buch** auf den Tisch gelegt.",
		output: "Он положил **книгу** на стол.",
	},
	// Function words: relative pronoun + preposition decorated
	{
		input: "Die Frau hatte zwei Töchter mit ins Haus gebracht, *die* schön und weiß **von** Angesicht waren, aber garstig und schwarz von Herzen.",
		output: "Женщина привела в дом двух дочерей, *которые* были красивы и белы **лицом**, но злы и черны сердцем.",
	},
	// Square brackets: article → demonstrative
	{
		input: "und auf [dem] Rückweg, als er",
		output: "и на [том] обратном пути, когда он",
	},
	// Idiom + reflexive quirk
	{
		input: "Aber dann freut sie **sich**, dass ihr bester Freund wieder verliebt ist und dieses Mal *keinen Korb* bekommen hat.",
		output: "Но потом она **сама** радуется, что её лучший друг снова влюблён и на этот раз *ему не отказали*.",
	},
] satisfies {
	input: UserInput<"Translate">;
	output: AgentOutput<"Translate">;
}[];
