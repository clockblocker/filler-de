import {
	AdverbCategory,
	Genus,
	Kasus,
	NomenDeklination,
	Numerus,
	PartikelType,
	PronomenType,
	Trennbarkeit,
	Wortart,
} from "../../../zod/types";

const sitzen = {
	sitzen: [
		{
			emojiBeschreibungs: ["💺"],
			grundform: "sitzen",
			rechtschreibung: "sitzen",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
	],
};

const sitz = {
	sitz: [
		{
			emojiBeschreibungs: ["💺"],
			grundform: "sitzen",
			rechtschreibung: "sitz",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🪑"],
			genus: Genus.M,
			grundform: "Sitz",
			rechtschreibung: "Sitz",
			wortart: Wortart.Nomen,
		},
	],
};

const untergen = {
	untergen: [
		{
			emojiBeschreibungs: ["🌅"],
			grundform: "untergehen",
			rechtschreibung: "untergehen",
			regelmaessig: true,
			trennbarkeit: Trennbarkeit.Trennbar,
			wortart: Wortart.Verb,
		},
	],
};

const aufgepast = {
	aufgepast: [
		{
			emojiBeschreibungs: ["👀"],
			grundform: "aufpassen",
			rechtschreibung: "aufgepasst",
			regelmaessig: true,
			trennbarkeit: Trennbarkeit.Trennbar,
			wortart: Wortart.Verb,
		},
	],
};

const Hoffungen = {
	Hoffungen: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🙏"],
			genus: Genus.F,
			grundform: "Hoffnung",
			rechtschreibung: "Hoffnungen",
			wortart: Wortart.Nomen,
		},
	],
};

const hangstauf = {
	hangstauf: [
		{
			emojiBeschreibungs: ["🖼️"],
			grundform: "aufhängen",
			rechtschreibung: "hängst auf",
			regelmaessig: true,
			trennbarkeit: Trennbarkeit.Trennbar,
			wortart: Wortart.Verb,
		},
	],
};

const nieser = {
	nieser: [
		{
			emojiBeschreibungs: ["🤧"],
			grundform: "niesen",
			rechtschreibung: "niest",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Schwach,
			emojiBeschreibungs: ["🤧"],
			genus: Genus.M,
			grundform: "Nieser",
			rechtschreibung: "Nieser",
			wortart: Wortart.Nomen,
		},
	],
};

const klares = {
	klares: [
		{
			emojiBeschreibungs: ["✨"],
			grundform: "klar",
			rechtschreibung: "klares",
			wortart: Wortart.Adjektiv,
		},
	],
};

const klar = {
	klar: [
		{
			emojiBeschreibungs: ["✨"],
			grundform: "klar",
			rechtschreibung: "klar",
			wortart: Wortart.Adjektiv,
		},
		{
			adverbCategory: [AdverbCategory.Grad],
			emojiBeschreibungs: ["✨"],
			grundform: "klar",
			rechtschreibung: "klar",
			wortart: Wortart.Adverb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["✨"],
			genus: Genus.N,
			grundform: "Klar",
			rechtschreibung: "Klar",
			wortart: Wortart.Nomen,
		},
	],
};

const hiemwerken = {
	hiemwerken: [
		{
			emojiBeschreibungs: ["🔨"],
			grundform: "heimwerken",
			rechtschreibung: "heimwerken",
			regelmaessig: true,
			trennbarkeit: Trennbarkeit.Untrennbar,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🛠"],
			genus: Genus.N,
			grundform: "Heimwerk",
			rechtschreibung: "Heimwerken",
			wortart: Wortart.Nomen,
		},
	],
};

const unbandiges = {
	unbandiges: [
		{
			emojiBeschreibungs: ["🔥"],
			grundform: "unbändig",
			rechtschreibung: "unbandiges",
			wortart: Wortart.Adjektiv,
		},
	],
};

const backen = {
	backen: [
		{
			emojiBeschreibungs: ["🍞"],
			grundform: "backen",
			rechtschreibung: "backen",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
		{
			emojiBeschreibungs: ["🍞"],
			grundform: "backen",
			rechtschreibung: "backen",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["😊"],
			genus: Genus.F,
			grundform: "Backe",
			rechtschreibung: "Backe",
			wortart: Wortart.Nomen,
		},
	],
};

const Rechercheergbnisse = {
	Rechercheergbnisse: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🔍"],
			genus: Genus.N,
			grundform: "Rechercheergebnis",
			rechtschreibung: "Rechercheergebnisse",
			wortart: Wortart.Nomen,
		},
	],
};

const See = {
	See: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🏞"],
			genus: Genus.M,
			grundform: "See",
			rechtschreibung: "See",
			wortart: Wortart.Nomen,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🌊"],
			genus: Genus.F,
			grundform: "See",
			rechtschreibung: "See",
			wortart: Wortart.Nomen,
		},
	],
};

const trotz = {
	trotz: [
		{
			emojiBeschreibungs: ["🛡"],
			grundform: "trotz",
			possibleGoverningKasuss: ["Genitiv"],
			rechtschreibung: "trotz",
			wortart: Wortart.Praeposition,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["😤"],
			genus: Genus.M,
			grundform: "Trotz",
			rechtschreibung: "Trotz",
			wortart: Wortart.Nomen,
		},
		{
			emojiBeschreibungs: ["😤"],
			grundform: "trotzen",
			rechtschreibung: "trotz",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
	],
};

const trozdem = {
	trozdem: [
		{
			adverbCategory: [AdverbCategory.Modal],
			emojiBeschreibungs: ["💪🔥"],
			grundform: "trotzdem",
			rechtschreibung: "trotzdem",
			wortart: Wortart.Adverb,
		},
	],
};

const mit = {
	mit: [
		{
			emojiBeschreibungs: ["🤝"],
			grundform: "mit",
			possibleGoverningKasuss: [Kasus.D],
			rechtschreibung: "mit",
			wortart: Wortart.Praeposition,
		},
		{
			emojiBeschreibungs: ["🤝"],
			grundform: "mit",
			rechtschreibung: "mit",
			wortart: Wortart.Praefix,
		},
	],
};

const an = {
	an: [
		{
			emojiBeschreibungs: ["📍"],
			grundform: "an",
			possibleGoverningKasuss: [Kasus.D, Kasus.A],
			rechtschreibung: "an",
			wortart: Wortart.Praeposition,
		},
		{
			emojiBeschreibungs: ["📍"],
			grundform: "an",
			rechtschreibung: "an",
			wortart: Wortart.Praefix,
		},
	],
};

const selbst = {
	selbst: [
		{
			adverbCategory: [AdverbCategory.Modal],
			emojiBeschreibungs: ["🙋"],
			grundform: "selbst",
			rechtschreibung: "selbst",
			wortart: Wortart.Adverb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🪞"],
			genus: Genus.N,
			grundform: "Selbst",
			rechtschreibung: "Selbst",
			wortart: Wortart.Nomen,
		},
	],
};

const uber = {
	uber: [
		{
			emojiBeschreibungs: ["🔝"],
			grundform: "über",
			possibleGoverningKasuss: [Kasus.D, Kasus.A],
			rechtschreibung: "über",
			wortart: Wortart.Praeposition,
		},
		{
			emojiBeschreibungs: ["🔝"],
			grundform: "über",
			rechtschreibung: "über",
			wortart: Wortart.Praefix,
		},
		{
			deklination: NomenDeklination.Stark,
			eigenname: true,
			emojiBeschreibungs: ["🏙️"],
			genus: Genus.N,
			grundform: "Uber",
			rechtschreibung: "Uber",
			wortart: Wortart.Nomen,
		},
	],
};

const umfaren = {
	umfaren: [
		{
			emojiBeschreibungs: ["🚗🔄"],
			grundform: "umfahren",
			rechtschreibung: "umfahren",
			regelmaessig: false,
			trennbarkeit: Trennbarkeit.Trennbar,
			wortart: Wortart.Verb,
		},
		{
			emojiBeschreibungs: ["🚗💥"],
			grundform: "umfahren",
			rechtschreibung: "umfahren",
			regelmaessig: false,
			trennbarkeit: Trennbarkeit.Untrennbar,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🚗🔄"],
			genus: Genus.F,
			grundform: "Umfahrt",
			rechtschreibung: "Umfahren",
			wortart: Wortart.Nomen,
		},
	],
};

const geoffnet = {
	geoffnet: [
		{
			emojiBeschreibungs: ["🚪👐"],
			grundform: "öffnen",
			rechtschreibung: "geöffnet",
			wortart: Wortart.Verb,
			// partizipVariant: PartizipVariant.P2,
		},
	],
};

const verfallen = {
	verfallen: [
		{
			emojiBeschreibungs: ["🏚️"],
			grundform: "verfallen",
			rechtschreibung: "verfallen",
			regelmaessig: false,
			trennbarkeit: Trennbarkeit.Untrennbar,
			wortart: Wortart.Verb,
		},
		// {
		//   wortart: Wortart.PartizipialesAdjektiv,
		//   rechtschreibung: "verfallen",
		//   grundform: "verfallen",
		//   emojiBeschreibungs: ["🏚️"],
		//   partizipVariant: PartizipVariant.P2,
		// }
	],
};

const verfall = {
	verfall: [
		{
			emojiBeschreibungs: ["🏚️"],
			grundform: "verfallen",
			rechtschreibung: "verfall",
			regelmaessig: false,
			trennbarkeit: Trennbarkeit.Untrennbar,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🏚️"],
			genus: Genus.M,
			grundform: "Verfall",
			rechtschreibung: "Verfall",
			wortart: Wortart.Nomen,
		},
	],
};

const derVerfall = {
	"der verfall": [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🏚️"],
			genus: Genus.M,
			grundform: "Verfall",
			rechtschreibung: "Verfall",
			wortart: Wortart.Nomen,
		},
	],
};

const schloss = {
	schloss: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🏰", "🔒"],
			genus: Genus.N,
			grundform: "Schloss",
			rechtschreibung: "Schloss",
			wortart: Wortart.Nomen,
		},
		{
			emojiBeschreibungs: ["🚪"],
			grundform: "schließen",
			rechtschreibung: "schließen",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
	],
};

const gehobener = {
	gehobener: [
		{
			emojiBeschreibungs: ["🎩"],
			grundform: "gehoben",
			rechtschreibung: "gehoben",
			wortart: Wortart.Adjektiv,
		},
	],
};

const wahlwiese = {
	wahlwiese: [
		{
			adverbCategory: [AdverbCategory.Modal],
			emojiBeschreibungs: ["🔀"],
			grundform: "wahlweise",
			rechtschreibung: "wahlweise",
			wortart: Wortart.Adverb,
		},
	],
};

const deutschen = {
	deutschen: [
		{
			emojiBeschreibungs: ["🇩🇪"],
			grundform: "deutsch",
			rechtschreibung: "deutschen",
			wortart: Wortart.Adjektiv,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🇩🇪"],
			genus: Genus.N,
			grundform: "Deutsche",
			rechtschreibung: "Deutsche",
			wortart: Wortart.Nomen,
		},
	],
};

const deutsch = {
	deutsch: [
		{
			emojiBeschreibungs: ["🇩🇪"],
			grundform: "deutsch",
			rechtschreibung: "deutsch",
			wortart: Wortart.Adjektiv,
		},
		{
			adverbCategory: [AdverbCategory.Modal],
			emojiBeschreibungs: ["🇩🇪"],
			grundform: "deutsch",
			rechtschreibung: "deutsch",
			wortart: Wortart.Adverb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🇩🇪"],
			genus: Genus.N,
			grundform: "Deutsche",
			rechtschreibung: "Deutsche",
			wortart: Wortart.Nomen,
		},
	],
};

const laden = {
	laden: [
		{
			emojiBeschreibungs: ["📦➡️🚚"],
			grundform: "laden",
			rechtschreibung: "laden",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			emojiBeschreibungs: ["✉️➡️👥"],
			grundform: "laden",
			rechtschreibung: "laden",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🏪🛍️"],
			genus: Genus.M,
			grundform: "Laden",
			rechtschreibung: "Laden",
			wortart: Wortart.Nomen,
		},
	],
};

const gefallen = {
	gefallen: [
		{
			emojiBeschreibungs: ["👍"],
			grundform: "gefallen",
			rechtschreibung: "gefallen",
			regelmaessig: false,
			trennbarkeit: Trennbarkeit.Untrennbar,
			wortart: Wortart.Verb,
		},
		// {
		//   wortart: Wortart.PartizipialesAdjektiv,
		//   rechtschreibung: "gefallen",
		//   grundform: "gefallen",
		//   emojiBeschreibungs: ["👍"],
		//   partizipVariant: PartizipVariant.P2,
		// }
	],
};

const wende = {
	wende: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🔄"],
			genus: Genus.F,
			grundform: "Wende",
			rechtschreibung: "Wende",
			wortart: Wortart.Nomen,
		},
		{
			emojiBeschreibungs: ["🔄"],
			grundform: "wenden",
			rechtschreibung: "wende",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			emojiBeschreibungs: ["👉💬"],
			grundform: "wenden",
			rechtschreibung: "wende",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
	],
};

const stapelbaren = {
	stapelbaren: [
		{
			emojiBeschreibungs: ["📦"],
			grundform: "stapelbar",
			rechtschreibung: "stapelbaren",
			wortart: Wortart.Adjektiv,
		},
	],
};

const vorbei = {
	vorbei: [
		{
			emojiBeschreibungs: ["🏃‍♂️💨"],
			grundform: "vorbei",
			rechtschreibung: "vorbei",
			wortart: Wortart.Praeposition,
		},
		{
			adverbCategory: [AdverbCategory.Lokal],
			emojiBeschreibungs: ["🏁"],
			grundform: "vorbei",
			rechtschreibung: "vorbei",
			wortart: Wortart.Adverb,
		},
	],
};

const mystery = `a – das Kissen hab' ich auch [[bekommen]].  
Aber es ist vorbei! [[vorbei]]! Und [[jetzt]] [[heul]] bitte nicht!  
Tschüs.  
Männer!`;

const shit = {
	[`${mystery}`]: [
		{
			comment:
				"Der Text ist kein einzelnes Wort und enthält keine bekannten Redewendungen.",
			emojiBeschreibungs: ["❓"],
			grundform: "Unbekannt",
			rechtschreibung: "Unbekannt",
			wortart: Wortart.Unbekannt,
		},
	],
};

const augeben = {
	augeben: [
		{
			comment:
				"Ich kann deine Absicht nicht feststellen. Vielleicht hast du [[ausgeben]] oder [[aufgeben]] gemeint?",
			emojiBeschreibungs: ["❓"],
			grundform: "Unbekannt",
			rechtschreibung: "Unbekannt",
			wortart: Wortart.Unbekannt,
		},
	],
};

const spazirengegangen = {
	"ging spaziren": [
		{
			emojiBeschreibungs: ["🚶‍♂️"],
			grundform: "spazieren gehen",
			rechtschreibung: "ging spazieren",
			regelmaessig: false,
			trennbarkeit: Trennbarkeit.Trennbar,
			wortart: Wortart.Verb,
		},
	],
};

const doch = {
	doch: [
		{
			emojiBeschreibungs: ["💬"],
			grundform: "doch",
			partikelType: [PartikelType.Konnektiv],
			rechtschreibung: "doch",
			wortart: Wortart.Partikel,
		},
	],
};

const Redewendung1 = {
	"das eis zwischen sie ist gebrochen": [
		{
			emojiBeschreibungs: ["❄️🧊"],
			grundform: "Das Eis brechen",
			rechtschreibung: "Das Eis brechen",
			wortart: Wortart.Redewendung,
		},
	],
};

const schaffen = {
	schaffen: [
		{
			emojiBeschreibungs: ["💪✅"],
			grundform: "schaffen",
			rechtschreibung: "schaffen",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			emojiBeschreibungs: ["✨🌍"],
			grundform: "schaffen",
			rechtschreibung: "schaffen",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
	],
};

const DieKuhIstNunVomEis = {
	"kuh ist nun vom eis": [
		{
			emojiBeschreibungs: ["🐄🧊"],
			grundform: "die Kuh ist vom Eis",
			rechtschreibung: "Kuh ist nun vom Eis",
			wortart: Wortart.Redewendung,
		},
	],
};

const schafen = {
	schafen: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🐑"],
			genus: Genus.N,
			grundform: "Schaf",
			rechtschreibung: "Schafen",
			wortart: Wortart.Nomen,
		},
	],
};

const mleken = {
	mleken: [
		{
			emojiBeschreibungs: ["🐄"],
			grundform: "melken",
			rechtschreibung: "melken",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			emojiBeschreibungs: ["🐄"],
			grundform: "melken",
			rechtschreibung: "melken",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
	],
};

const bewegen = {
	bewegen: [
		{
			emojiBeschreibungs: ["💪➡️🪑"],
			grundform: "bewegen",
			rechtschreibung: "bewegen",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			emojiBeschreibungs: ["💬➡️😢"],
			grundform: "bewegen",
			rechtschreibung: "bewegen",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
	],
};

const senden = {
	senden: [
		{
			emojiBeschreibungs: ["📤"],
			grundform: "senden",
			rechtschreibung: "senden",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			emojiBeschreibungs: ["📡"],
			grundform: "senden",
			rechtschreibung: "senden",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
	],
};

const genau = {
	genau: [
		{
			adverbCategory: [AdverbCategory.Modal],
			emojiBeschreibungs: ["✔️"],
			grundform: "genau",
			rechtschreibung: "genau",
			wortart: Wortart.Adverb,
		},
		{
			emojiBeschreibungs: ["✔️"],
			grundform: "genau",
			rechtschreibung: "genau",
			wortart: Wortart.Adjektiv,
		},
	],
};

const genauso = {
	genauso: [
		{
			adverbCategory: [AdverbCategory.Modal],
			emojiBeschreibungs: ["🤝"],
			grundform: "genauso",
			rechtschreibung: "genauso",
			wortart: Wortart.Adverb,
		},
	],
};

const fussballbegeistert = {
	fussballbegeistert: [
		{
			emojiBeschreibungs: ["⚽️🔥"],
			grundform: "fußballbegeistert",
			rechtschreibung: "fußballbegeistert",
			wortart: Wortart.Adjektiv,
		},
	],
};

const sofort = {
	sofort: [
		{
			adverbCategory: [AdverbCategory.Temporal],
			emojiBeschreibungs: ["⏱️"],
			grundform: "sofort",
			rechtschreibung: "sofort",
			wortart: Wortart.Adverb,
		},
	],
};

const zwar = {
	zwar: [
		{
			emojiBeschreibungs: ["🔗"],
			grundform: "zwar",
			partikelType: [PartikelType.Konnektiv],
			rechtschreibung: "zwar",
			wortart: Wortart.Partikel,
		},
	],
};

const weiss = {
	weiss: [
		{
			emojiBeschreibungs: ["🧠"],
			grundform: "wissen",
			rechtschreibung: "weiß",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["⚪️"],
			genus: Genus.N,
			grundform: "Weiß",
			rechtschreibung: "Weiß",
			wortart: Wortart.Nomen,
		},
		{
			emojiBeschreibungs: ["⚪️"],
			grundform: "weiß",
			rechtschreibung: "weiß",
			wortart: Wortart.Adjektiv,
		},
	],
};

const wissen = {
	wissen: [
		{
			emojiBeschreibungs: ["🧠"],
			grundform: "wissen",
			rechtschreibung: "wissen",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🧠"],
			genus: Genus.N,
			grundform: "Wissen",
			rechtschreibung: "Wissen",
			wortart: Wortart.Nomen,
		},
	],
};

const erinern = {
	erinern: [
		{
			emojiBeschreibungs: ["🧠"],
			grundform: "erinnern",
			rechtschreibung: "erinnern",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
	],
};

const rechnen = {
	rechnen: [
		{
			emojiBeschreibungs: ["🧮"],
			grundform: "rechnen",
			rechtschreibung: "rechnen",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
	],
};

const glaubiger = {
	glaubiger: [
		{
			emojiBeschreibungs: ["🙏"],
			grundform: "gläubig",
			rechtschreibung: "gläubiger",
			wortart: Wortart.Adjektiv,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["💰"],
			genus: Genus.M,
			grundform: "Gläubiger",
			rechtschreibung: "Gläubiger",
			wortart: Wortart.Nomen,
		},
	],
};

const sie = {
	sie: [
		{
			emojiBeschreibungs: ["👩"],
			genera: [Genus.F],
			grundform: "sie",
			number: [Numerus.Einzahl],
			pronomenType: PronomenType.Personal,
			rechtschreibung: "sie",
			wortart: Wortart.Pronomen,
		},
		{
			emojiBeschreibungs: ["👥"],
			grundform: "sie",
			number: [Numerus.Mehrzahl],
			pronomenType: PronomenType.Personal,
			rechtschreibung: "sie",
			wortart: Wortart.Pronomen,
		},
		{
			emojiBeschreibungs: ["🧑‍💼"],
			grundform: "sie",
			number: [Numerus.Einzahl, Numerus.Mehrzahl],
			pronomenType: PronomenType.Personal,
			rechtschreibung: "Sie",
			wortart: Wortart.Pronomen,
		},
	],
};

const DasEisBrechen = {
	"eis zwischen ihnen ist gebrochen": [
		{
			emojiBeschreibungs: ["🤝"],
			grundform: "das Eis brechen",
			rechtschreibung: "das Eis zwischen ihnen ist gebrochen",
			wortart: Wortart.Redewendung,
		},
	],
};

const halbenMette = {
	"halben Miete": [
		{
			emojiBeschreibungs: ["🔑🧩🎯"],
			grundform: "halbe Miete",
			rechtschreibung: "halben Miete",
			wortart: Wortart.Redewendung,
		},
	],
};

const ganzUndGar = {
	"ganz und gar": [
		{
			emojiBeschreibungs: ["💯👌"],
			grundform: "ganz und gar",
			rechtschreibung: "ganz und gar",
			wortart: Wortart.Redewendung,
		},
	],
};

const tomatenAufDenAugen = {
	"hast do tomaten auf den augen?": [
		{
			emojiBeschreibungs: ["🍅🙈🤷‍♂️"],
			grundform: "Tomaten auf den Augen haben",
			rechtschreibung: "Hast do Tomaten auf den Augen?",
			wortart: Wortart.Redewendung,
		},
	],
};

const baerenAufgebracht = {
	"und ihm einen bären aufzubinden?": [
		{
			emojiBeschreibungs: ["🐻🤥🙄"],
			grundform: "Jemandem einen Bären aufbinden",
			rechtschreibung: "und ihm einen Bären aufzubinden?",
			wortart: Wortart.Redewendung,
		},
	],
};

const durchUndDurch = {
	"durch und durch": [
		{
			emojiBeschreibungs: ["💯👌"],
			grundform: "durch und durch",
			rechtschreibung: "durch und durch",
			wortart: Wortart.Redewendung,
		},
	],
};

const vollUndGanz = {
	"voll und ganz": [
		{
			emojiBeschreibungs: ["🎯👌"],
			grundform: "voll und ganz",
			rechtschreibung: "voll und ganz",
			wortart: Wortart.Redewendung,
		},
	],
};

const nullUndNichtig = {
	"null und nichtig": [
		{
			emojiBeschreibungs: ["0️⃣🚫"],
			grundform: "null und nichtig",
			rechtschreibung: "null und nichtig",
			wortart: Wortart.Redewendung,
		},
	],
};

const klippUndKlar = {
	"klipp und klar": [
		{
			emojiBeschreibungs: ["✅"],
			grundform: "klipp und klar",
			rechtschreibung: "klipp und klar",
			wortart: Wortart.Redewendung,
		},
	],
};

const reinUndGar = {
	"rein und gar": [
		{
			emojiBeschreibungs: ["✨👌"],
			grundform: "rein und gar",
			rechtschreibung: "rein und gar",
			wortart: Wortart.Redewendung,
		},
	],
};

const molken = {
	molken: [
		{
			emojiBeschreibungs: ["🐄"],
			grundform: "melken",
			rechtschreibung: "molken",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🥛"],
			genus: Genus.F,
			grundform: "Molke",
			rechtschreibung: "Molken",
			wortart: Wortart.Nomen,
		},
	],
};

const schleifen = {
	schleifen: [
		{
			emojiBeschreibungs: ["⚙️✨"],
			grundform: "schleifen",
			rechtschreibung: "schleifen",
			regelmaessig: true,
			wortart: Wortart.Verb,
		},
		{
			emojiBeschreibungs: ["🚶‍♂️💤"],
			grundform: "schleifen",
			rechtschreibung: "schleifen",
			regelmaessig: false,
			wortart: Wortart.Verb,
		},
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🎀"],
			genus: Genus.F,
			grundform: "Schleife",
			rechtschreibung: "Schleifen",
			wortart: Wortart.Nomen,
		},
	],
};

const mietschuldenfreiheitsbescheinigung = {
	mietschuldenfreiheitsbescheinigung: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🏠✅📄"],
			genus: Genus.F,
			grundform: "Mietschuldenfreiheitsbescheinigung",
			rechtschreibung: "Mietschuldenfreiheitsbescheinigung",
			wortart: Wortart.Nomen,
		},
	],
};

const arbeitsunfaehigkeitsbescheinigung = {
	arbeitsunfaehigkeitsbescheinigung: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["🤒🏥📄"],
			genus: Genus.F,
			grundform: "Arbeitsunfaehigkeitsbescheinigung",
			rechtschreibung: "Arbeitsunfaehigkeitsbescheinigung",
			wortart: Wortart.Nomen,
		},
	],
};

const bundesverfassungsgericht = {
	bundesverfassungsgericht: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["⚖️🏛️📜"],
			genus: Genus.N,
			grundform: "Bundesverfassungsgericht",
			rechtschreibung: "Bundesverfassungsgericht",
			wortart: Wortart.Nomen,
		},
	],
};

const bildungsurlaub = {
	bildungsurlaub: [
		{
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ["📚🏖️"],
			genus: Genus.M,
			grundform: "Bildungsurlaub",
			rechtschreibung: "Bildungsurlaub",
			wortart: Wortart.Nomen,
		},
	],
};

export const tests = {
	...molken,
	...sie,
	...glaubiger,
	...genau,
	...genauso,
	...fussballbegeistert,
	...sofort,
	...zwar,
	...weiss,
	...erinern,
	...rechnen,
	...nieser,
	...sitz,
	...sitzen,
	...aufgepast,
	...untergen,
	...Hoffungen,
	...hangstauf,
	...deutsch,
	...hiemwerken,
	...klares,
	...Rechercheergbnisse,
	...backen,
	...unbandiges,
	...See,
	...trotz,
	...mit,
	...an,
	...uber,
	...selbst,
	...umfaren,
	...geoffnet,
	...verfallen,
	...schloss,
	...gehobener,
	...wahlwiese,
	...deutschen,
	...wende,
	...stapelbaren,
	...vorbei,
	...spazirengegangen,
	...doch,
	...shit,
	...laden,
	...gefallen,
	...Redewendung1,
	...klar,
	...mleken,
	...bewegen,
	...senden,
	...DasEisBrechen,
	...halbenMette,
	...ganzUndGar,
	...tomatenAufDenAugen,
	...baerenAufgebracht,
	...durchUndDurch,
	...vollUndGanz,
	...nullUndNichtig,
	...klippUndKlar,
	...reinUndGar,
	...augeben,
	...schafen,
	...wissen,
	...schaffen,
	...DieKuhIstNunVomEis,
	...verfall,
	...derVerfall,
	...trozdem,
	...schleifen,
	...mietschuldenfreiheitsbescheinigung,
	...arbeitsunfaehigkeitsbescheinigung,
	...bundesverfassungsgericht,
	...bildungsurlaub,
};
