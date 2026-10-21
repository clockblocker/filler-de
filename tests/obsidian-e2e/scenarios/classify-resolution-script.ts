/**
 * The scripted dumgen of the `classify-resolution` scenario, shared with its
 * in-process twin (`tests/integration/classify/classify-resolution.test.ts`),
 * which proves the script resolves through the real dumgen without Obsidian.
 *
 * "Der Hund fängt heute auf jeden Fall an." segments into the noun unit
 * Der Hund (Segments 0 and 2), the separable verb fängt … an (4 and 14),
 * heute (6) and the Locution auf jeden Fall (8, 10 and 12). jev answers by
 * question id, so the grammar answers serve every unit that asks them; Luna
 * writes each unit's Canonical Form, drafting its Emoji Description, and the
 * Knowledge base text and the noun's plural. The other structural aspects
 * stay unscripted and fail as values.
 */
export const STORY =
	"Der Hund fängt heute auf jeden Fall an. ^0\n\nDer Hund schläft. ^1\n";

export const FIRST_SELECTION = "Hund fängt heute auf jeden Fall an";
export const SECOND_SELECTION = "Hund schläft";

export const CLASSIFY_RESOLUTION_DUMGEN = {
	jev: {
		archaic: "Current",
		citation: "Used",
		comparable: "No",
		coverage: "Full",
		degree: "Pos",
		e_5_6: 0.95,
		e_5_7: 0.95,
		e_6_7: 0.95,
		f_5: 0.95,
		f_6: 0.95,
		f_7: 0.95,
		formGender: "der",
		gender: "der",
		governed_m1: "Free",
		mood: "Ind",
		nounKind: "Ordinary",
		number: "Sing",
		orthography: "None",
		person: "3",
		plurality: "HasPlural",
		prefix: "p0",
		r_1_2: "Lexeme/NOUN",
		r_3_8: "Lexeme/VERB",
		r_4: "Lexeme/ADV",
		r_5_6_7: "Locution/ADV",
		s_article_1: "p2",
		s_particle_8: "p3",
		spelling: "Canonical",
		tense: "Pres",
		verbForm: "Fin",
	},
	luna: {
		canonical: [
			{
				output: {
					article: "der",
					canonicalForm: "Hund",
					emojiDescription: "🐕",
					members: ["der", "Hund"],
				},
				when: '"text":"Hund"',
			},
			{
				output: {
					canonicalForm: "anfangen",
					emojiDescription: "🏁",
					members: ["fangen", "an"],
				},
				when: '"text":"fängt"',
			},
			{
				output: {
					canonicalForm: "heute",
					emojiDescription: "📅",
					members: ["heute"],
				},
				when: '"text":"heute"',
			},
			{
				output: {
					canonicalForm: "auf jeden Fall",
					emojiDescription: "✅",
					members: ["auf", "jeden", "Fall"],
				},
				when: '"text":"jeden"',
			},
		],
		definition: [{ output: "Eine Bedeutung im Satz." }],
		plural: [{ output: ["Hunde"], when: '"lemma":"Hund"' }],
		relationCandidates: [{ output: [] }],
		transcription: [{ output: "ˈtɛst" }],
		translations: [
			{ output: ["слово"], when: '"language":"ru"' },
			{ output: ["word"] },
		],
	},
} as const;

/** Where each unit's Lemma note lives (ADR-0015). */
export const LEMMA_PATHS = {
	anfangen: "Worter/de/Lexeme/VERB/an/a/anf/anfan/anfangen.md",
	aufJedenFall: "Worter/de/Locution/ADV/a/auf/aufje/auf jeden Fall.md",
	heute: "Worter/de/Lexeme/ADV/h/heu/heute/heute.md",
	hund: "Worter/de/Lexeme/NOUN/Masc/h/hun/hund/Hund.md",
} as const;
