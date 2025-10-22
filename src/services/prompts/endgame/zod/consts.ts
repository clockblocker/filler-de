import { Genus, Kasus } from "./types";

export const Tag = {
	Nomen: "Nomen",
	Pronomen: "Pronomen",
	Verb: "Verb",
	Adjektiv: "Adjektiv",
	Adverb: "Adverb",
	Artikel: "Artikel",
	Partikel: "Partikel",
	Praeposition: "Praeposition",
	Konjunktion: "Konjunktion",
	Numerale: "Numerale",
	Praefix: "Praefix",
	Redewendung: "Redewendung",
	Interjektion: "Interjektion",
	Unbekannt: "Unbekannt",
	Morphem: "Morphem",

	Grundform: "Grundform",
	Flexion: "Flexion",
	Tippfehler: "Tippfehler",

	Regelmaessig: "Regelmaessig",
	Unregelmaessig: "Unregelmaessig",

	Steigerungsfaehig: "Steigerungsfaehig",
	Unsteigerungsfaehig: "Unteigerungsfaehig",

	Komparativ: "Komparativ",
	Positiv: "Positiv",
	Superlativ: "Superlativ",

	Einzahl: "Einzahl",
	Mehrzahl: "Mehrzahl",

	Feminin: "Feminin",
	Maskulin: "Maskulin",
	Neutrum: "Neutrum",

	Nominativ: "Nominativ",
	Genitiv: "Genitiv",
	Dativ: "Dativ",
	Akkusativ: "Akkusativ",

	Stark: "Stark",
	Schwach: "Schwach",
	Gemischt: "Gemischt",

	Eigenname: "Eigenname",

	Zirkumfix: "Zirkumfix",
	Konversion: "Konversion",
	Suffix: "Suffix",
	Stamm: "Stamm",
	Endung: "Endung",
	Fugenelement: "Fugenelement",
	Possessiv: "Possessiv",
	Reflexiv: "Reflexiv",
	Personal: "Personal",
	Generalisierendes: "Generalisierendes",
	Demonstrativ: "Demonstrativ",
	"W-Pronomen": "W-Pronomen",
	Indefinit: "Indefinit",
	Quantifikativ: "Quantifikativ",
	Trennbar: "Trennbar",
	Untrennbar: "Untrennbar",
	Lokal: "Lokal",
	Temporal: "Temporal",
	Modal: "Modal",
	Kausal: "Kausal",
	Grad: "Grad",
	Bestimmt: "Bestimmt",
	Unbestimmt: "Unbestimmt",
	Intensität: "Intensität",
	Fokus: "Fokus",
	Negation: "Negation",
	Abtönung: "Abtönung",
	Konnektiv: "Konnektiv",
	Grundzahl: "Grundzahl",
	Ordnungszahl: "Ordnungszahl",
	Bruchzahl: "Bruchzahl",
	Multiplikativ: "Multiplikativ",
	Kollektiv: "Kollektiv",
	Koordinierend: "Koordinierend",
	Subordinierend: "Subordinierend",

	Rexlexiv: "Rexlexiv",
	Praesens: "Praesens",
	Praeteritum: "Praeteritum",
	Imperativ: "Imperativ",
	KI: "KI", // Konjunktiv I
	KII: "KII", // Konjunktiv II
	Infinitiv: "Infinitiv",
	ZuInfinitiv: "ZuInfinitiv",
	PI: "PI", // Partizip I
	PII: "PII", // Partizip II
};

const tagMap = new Map(Object.entries(Tag));

export const TagFromKasus = {
	[Kasus.N]: Tag.Nominativ,
	[Kasus.G]: Tag.Gemischt,
	[Kasus.D]: Tag.Dativ,
	[Kasus.A]: Tag.Akkusativ,
};

export const TagFromGenus = {
	[Genus.F]: "Feminin",
	[Genus.M]: "Maskulin",
	[Genus.N]: "Neutrum",
};

const tagFromString = (s: string): string => {
	return tagMap.get(s) ?? "";
};

export const makeTagChain = (parts: string[]): string => {
	return parts
		.map((p) => tagFromString(p))
		.filter((p) => p)
		.join("/");
};
