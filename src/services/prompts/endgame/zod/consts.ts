import { Genus, Kasus } from "./types";

export const Tag = {
	Abtönung: "Abtönung",
	Adjektiv: "Adjektiv",
	Adverb: "Adverb",
	Akkusativ: "Akkusativ",
	Artikel: "Artikel",
	Bestimmt: "Bestimmt",
	Bruchzahl: "Bruchzahl",
	Dativ: "Dativ",
	Demonstrativ: "Demonstrativ",

	Eigenname: "Eigenname",

	Einzahl: "Einzahl",
	Endung: "Endung",

	Feminin: "Feminin",
	Flexion: "Flexion",
	Fokus: "Fokus",
	Fugenelement: "Fugenelement",
	Gemischt: "Gemischt",
	Generalisierendes: "Generalisierendes",
	Genitiv: "Genitiv",
	Grad: "Grad",

	Grundform: "Grundform",
	Grundzahl: "Grundzahl",
	Imperativ: "Imperativ",
	Indefinit: "Indefinit",
	Infinitiv: "Infinitiv",
	Intensität: "Intensität",
	Interjektion: "Interjektion",
	Kausal: "Kausal",
	KI: "KI", // Konjunktiv I
	KII: "KII", // Konjunktiv II
	Kollektiv: "Kollektiv",

	Komparativ: "Komparativ",
	Konjunktion: "Konjunktion",
	Konnektiv: "Konnektiv",
	Konversion: "Konversion",
	Koordinierend: "Koordinierend",
	Lokal: "Lokal",
	Maskulin: "Maskulin",
	Mehrzahl: "Mehrzahl",
	Modal: "Modal",
	Morphem: "Morphem",
	Multiplikativ: "Multiplikativ",
	Negation: "Negation",
	Neutrum: "Neutrum",
	Nomen: "Nomen",

	Nominativ: "Nominativ",
	Numerale: "Numerale",
	Ordnungszahl: "Ordnungszahl",
	Partikel: "Partikel",
	Personal: "Personal",
	PI: "PI", // Partizip I
	PII: "PII", // Partizip II
	Positiv: "Positiv",
	Possessiv: "Possessiv",
	Praefix: "Praefix",
	Praeposition: "Praeposition",
	Praesens: "Praesens",
	Praeteritum: "Praeteritum",
	Pronomen: "Pronomen",
	Quantifikativ: "Quantifikativ",
	Redewendung: "Redewendung",
	Reflexiv: "Reflexiv",

	Regelmaessig: "Regelmaessig",

	Rexlexiv: "Rexlexiv",
	Schwach: "Schwach",
	Stamm: "Stamm",

	Stark: "Stark",

	Steigerungsfaehig: "Steigerungsfaehig",
	Subordinierend: "Subordinierend",
	Suffix: "Suffix",
	Superlativ: "Superlativ",
	Temporal: "Temporal",
	Tippfehler: "Tippfehler",
	Trennbar: "Trennbar",
	Unbekannt: "Unbekannt",
	Unbestimmt: "Unbestimmt",
	Unregelmaessig: "Unregelmaessig",
	Unsteigerungsfaehig: "Unteigerungsfaehig",
	Untrennbar: "Untrennbar",
	Verb: "Verb",
	"W-Pronomen": "W-Pronomen",

	Zirkumfix: "Zirkumfix",
	ZuInfinitiv: "ZuInfinitiv",
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
