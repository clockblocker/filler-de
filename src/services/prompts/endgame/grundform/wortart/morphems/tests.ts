import { Morphem, Wortart } from "../../../zod/types";

const fahren = {
	fahren: {
		morphemischeZerlegung: [
			{ fahr: Morphem.Stamm },
			{ en: Morphem.Endung },
		],
	},
};

const spazierenGehen = {
	"spazieren gehen": {
		morphemischeZerlegung: [
			{ spazier: Morphem.Stamm },
			{ en: Morphem.Endung },
			{ geh: Morphem.Stamm },
			{ en: Morphem.Endung },
		],
		zusammengesetztAus: [
			{ spazieren: Wortart.Verb },
			{ gehen: Wortart.Verb },
		],
	},
};

const rechercheergebnis = {
	rechercheergebnis: {
		morphemischeZerlegung: [
			{ Recherche: Morphem.Stamm },
			{ ergeb: Morphem.Stamm },
			{ nis: Morphem.Suffix },
		],
		zusammengesetztAus: [
			{ Recherche: Wortart.Nomen },
			{ Ergebnis: Wortart.Nomen },
		],
	},
};

const bildungsurlaub = {
	bildungsurlaub: {
		morphemischeZerlegung: [
			{ Bildung: Morphem.Stamm },
			{ s: Morphem.Fugenelement },
			{ urlaub: Morphem.Stamm },
		],
		zusammengesetztAus: [
			{ Bildung: Wortart.Nomen },
			{ Urlaub: Wortart.Nomen },
		],
	},
};

const standhalten = {
	standhalten: {
		morphemischeZerlegung: [
			{ stand: Morphem.Stamm },
			{ halt: Morphem.Stamm },
			{ en: Morphem.Endung },
		],
		zusammengesetztAus: [
			{ stehen: Wortart.Verb },
			{ halten: Wortart.Verb },
		],
	},
};

const busch = {
	busch: {
		morphemischeZerlegung: [{ Busch: Morphem.Stamm }],
	},
};

const verstehen = {
	verstehen: {
		morphemischeZerlegung: [
			{ ver: Morphem.Praefix },
			{ steh: Morphem.Stamm },
			{ en: Morphem.Endung },
		],
		zusammengesetztAus: [
			{ ver: Wortart.Praefix },
			{ stehen: Wortart.Verb },
		],
	},
};

const aufstehen = {
	aufstehen: {
		morphemischeZerlegung: [
			{ auf: Morphem.Praefix },
			{ steh: Morphem.Stamm },
			{ en: Morphem.Endung },
		],
		zusammengesetztAus: [
			{ auf: Wortart.Praefix },
			{ stehen: Wortart.Verb },
		],
	},
};

const verfeinden = {
	verfeinden: {
		morphemischeZerlegung: [
			{ ver: Morphem.Praefix },
			{ feind: Morphem.Stamm },
			{ en: Morphem.Endung },
		],
		zusammengesetztAus: [
			{ ver: Wortart.Praefix },
			{ feinden: Wortart.Verb },
		],
	},
};

const standig = {
	standig: {
		morphemischeZerlegung: [
			{ stand: Morphem.Stamm },
			{ ig: Morphem.Suffix },
		],
	},
};

const wiederaufstehen = {
	wiederaufstehen: {
		morphemischeZerlegung: [
			{ wieder: Morphem.Praefix },
			{ auf: Morphem.Praefix },
			{ steh: Morphem.Stamm },
			{ en: Morphem.Endung },
		],
		zusammengesetztAus: [
			{ wieder: Wortart.Praefix },
			{ auf: Wortart.Praefix },
			{ stehen: Wortart.Verb },
		],
	},
};

const mietschuldenfreiheitsbescheinigung = {
	mietschuldenfreiheitsbescheinigung: {
		morphemischeZerlegung: [
			{ Miet: Morphem.Stamm },
			{ schuld: Morphem.Stamm },
			{ en: Morphem.Fugenelement },
			{ frei: Morphem.Stamm },
			{ heit: Morphem.Suffix },
			{ s: Morphem.Fugenelement },
			{ be: Morphem.Praefix },
			{ schein: Morphem.Stamm },
			{ ig: Morphem.Suffix },
			{ ung: Morphem.Suffix },
		],
		zusammengesetztAus: [
			{ Miete: Wortart.Nomen },
			{ Schuld: Wortart.Nomen },
			{ Freiheit: Wortart.Nomen },
			{ Bescheinigung: Wortart.Nomen },
		],
	},
};

const arbeitsunfaehigkeitsbescheinigung = {
	arbeitsunfaehigkeitsbescheinigung: {
		morphemischeZerlegung: [
			{ Arbeit: Morphem.Stamm },
			{ s: Morphem.Fugenelement },
			{ un: Morphem.Praefix },
			{ fähig: Morphem.Stamm },
			{ keit: Morphem.Suffix },
			{ s: Morphem.Fugenelement },
			{ be: Morphem.Praefix },
			{ schein: Morphem.Stamm },
			{ ig: Morphem.Suffix },
			{ ung: Morphem.Suffix },
		],
		zusammengesetztAus: [
			{ Arbeit: Wortart.Nomen },
			{ Unfähigkeit: Wortart.Nomen },
			{ Bescheinigung: Wortart.Nomen },
		],
	},
};

const haus = {
	haus: {
		morphemischeZerlegung: [{ Haus: Morphem.Stamm }],
	},
};

const baum = {
	baum: {
		morphemischeZerlegung: [{ Baum: Morphem.Stamm }],
	},
};

const kind = {
	kind: {
		morphemischeZerlegung: [{ Kind: Morphem.Stamm }],
	},
};

// veranschaulicht = ver + an + schaulicht
// Waren = Ware | sein
// Taten = Taten | tun
// Gefahren = Gefahr | fahren
const bundesverfassungsgericht = {
	bundesverfassungsgericht: {
		morphemischeZerlegung: [
			{ Bund: Morphem.Stamm },
			{ es: Morphem.Fugenelement },
			{ verfassung: Morphem.Stamm },
			{ s: Morphem.Fugenelement },
			{ gericht: Morphem.Stamm },
		],
		zusammengesetztAus: [
			{ Bund: Wortart.Nomen },
			{ Verfassung: Wortart.Nomen },
			{ Gericht: Wortart.Nomen },
		],
	},
};

export const tests = {
	...fahren,
	...rechercheergebnis,
	...aufstehen,
	...bildungsurlaub,
	...verstehen,
	...verfeinden,
	...standig,
	...wiederaufstehen,
	...mietschuldenfreiheitsbescheinigung,
	...arbeitsunfaehigkeitsbescheinigung,
	...kind,
	...haus,
	...baum,
	...standhalten,
	...busch,
	...bundesverfassungsgericht,
	...spazierenGehen,
};
