import type { GermanLinguisticUnit } from "../../linguistics/german/schemas/linguistic-unit";

export type EntrySection = {
	kind: string; // CSS suffix: "kontexte", "synonyme", "morpheme", etc.
	title: string; // Display text: "Deine Kontexte", "Semantische Beziehungen"
	content: string; // Section body (trimmed)
};

export type DictEntryMeta = {
	linguisticUnit?: GermanLinguisticUnit;
	emojiDescription?: string[];
} & Record<string, unknown>;

export type DictEntry = {
	id: string; // Block ID from header: "l-nom-n-m1"
	headerContent: string; // Header line without the ^blockId
	sections: EntrySection[];
	meta: DictEntryMeta;
};
