import {
	Genus,
	Match,
	Numerus,
	PronomenType,
	Wortart,
} from "prompts/endgame/zod/types";

const sitzen = {
	sitzen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["💺"],
				grundform: "sitzen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const sitz = {
	sitz: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🪑"],
				genus: Genus.M,
				grundform: "Sitz",
				wortart: Wortart.Nomen,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["💺"],
				grundform: "sitzen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const untergen = {
	untergen: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🌅"],
				grundform: "untergehen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const untergehen = {
	untergehen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🌅"],
				grundform: "untergehen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const aufgepast = {
	aufgepast: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["👀"],
				grundform: "aufpassen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const aufgepasst = {
	aufgepasst: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["👀"],
				grundform: "aufpassen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const aufpassen = {
	aufpassen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["👀"],
				grundform: "aufpassen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const Hoffungen = {
	Hoffungen: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🙏"],
				genus: Genus.F,
				grundform: "Hoffnung",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const hangstauf = {
	hangstauf: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🖼️"],
				grundform: "aufhängen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const aufhängen = {
	aufhängen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🖼️"],
				grundform: "aufhängen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const nieser = {
	nieser: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🤧"],
				genus: Genus.M,
				grundform: "Nieser",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const niesen = {
	niesen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🤧"],
				grundform: "niesen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const klares = {
	klares: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["✨"],
				grundform: "klar",
				wortart: Wortart.Adjektiv,
			},
		],
	},
};

const klar = {
	klar: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["✨"],
				grundform: "klar",
				wortart: Wortart.Adjektiv,
			},
			{
				emojiBeschreibungs: ["✨"],
				grundform: "klar",
				wortart: Wortart.Adverb,
			},
			{
				emojiBeschreibungs: ["✨"],
				genus: Genus.N,
				grundform: "Klar",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const hiemwerken = {
	hiemwerken: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🔨"],
				grundform: "heimwerken",
				wortart: Wortart.Verb,
			},
			{
				emojiBeschreibungs: ["🛠"],
				genus: Genus.N,
				grundform: "Heimwerk",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const heimwerken = {
	heimwerken: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🔨"],
				grundform: "heimwerken",
				wortart: Wortart.Verb,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🛠"],
				genus: Genus.N,
				grundform: "Heimwerk",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const heimwerkst = {
	heimwerkst: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🔨"],
				grundform: "heimwerken",
				wortart: Wortart.Verb,
			},
		],
	},
};

const unbandiges = {
	unbandiges: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🔥"],
				grundform: "unbändig",
				wortart: Wortart.Adjektiv,
			},
		],
	},
};

const backen = {
	backen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🍞"],
				grundform: "backen",
				wortart: Wortart.Verb,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["😊"],
				genus: Genus.F,
				grundform: "Backe",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const Rechercheergbnisse = {
	Rechercheergbnisse: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🔍"],
				genus: Genus.N,
				grundform: "Rechercheergebnis",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const See = {
	See: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🏞"],
				genus: Genus.M,
				grundform: "See",
				wortart: Wortart.Nomen,
			},
			{
				emojiBeschreibungs: ["🌊"],
				genus: Genus.F,
				grundform: "See",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const trotz = {
	trotz: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🛡"],
				grundform: "trotz",
				wortart: Wortart.Praeposition,
			},
			{
				emojiBeschreibungs: ["😤"],
				genus: Genus.M,
				grundform: "Trotz",
				wortart: Wortart.Nomen,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["😤"],
				grundform: "trotzen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const trozdem = {
	trozdem: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["💪🔥"],
				grundform: "trotzdem",
				wortart: Wortart.Adverb,
			},
		],
	},
};

const mit = {
	mit: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🤝"],
				grundform: "mit",
				wortart: Wortart.Praeposition,
			},
			{
				emojiBeschreibungs: ["🤝"],
				grundform: "mit",
				wortart: Wortart.Praefix,
			},
		],
	},
};

const an = {
	an: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["📍"],
				grundform: "an",
				wortart: Wortart.Praeposition,
			},
			{
				emojiBeschreibungs: ["📍"],
				grundform: "an",
				wortart: Wortart.Praefix,
			},
		],
	},
};

const selbst = {
	selbst: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🙋"],
				grundform: "selbst",
				wortart: Wortart.Adverb,
			},
			{
				emojiBeschreibungs: ["🪞"],
				genus: Genus.N,
				grundform: "Selbst",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const uber = {
	uber: {
		[Match.Grundform]: [
			{
				eigenname: true,
				emojiBeschreibungs: ["🏙️"],
				genus: Genus.N,
				grundform: "Uber",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const über = {
	über: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🔝"],
				grundform: "über",
				wortart: Wortart.Praeposition,
			},
			{
				emojiBeschreibungs: ["🔝"],
				grundform: "über",
				wortart: Wortart.Praefix,
			},
		],
	},
};

const umfaren = {
	umfaren: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🚗🔄", "🚗💥"],
				grundform: "umfahren",
				wortart: Wortart.Verb,
			},
		],
	},
};

const umfahren = {
	umfahren: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🚗🔄", "🚗💥"],
				grundform: "umfahren",
				wortart: Wortart.Verb,
			},
		],
	},
};

const umfahrten = {
	umfahrten: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🚗🔄"],
				genus: Genus.F,
				grundform: "Umfahrt",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const geoffnet = {
	geoffnet: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🚪👐"],
				grundform: "öffnen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const verfallen = {
	verfallen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🏚️"],
				grundform: "verfallen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const verfall = {
	verfall: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🏚️"],
				genus: Genus.M,
				grundform: "Verfall",
				wortart: Wortart.Nomen,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🏚️"],
				grundform: "verfallen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const derVerfall = {
	"der verfall": {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🏚️"],
				genus: Genus.M,
				grundform: "Verfall",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const schloss = {
	schloss: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🏰", "🔒"],
				genus: Genus.N,
				grundform: "Schloss",
				wortart: Wortart.Nomen,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🚪"],
				grundform: "schließen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const gehobener = {
	gehobener: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🎩"],
				grundform: "gehoben",
				wortart: Wortart.Adjektiv,
			},
		],
	},
};

const wahlwiese = {
	wahlwiese: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🔀"],
				grundform: "wahlweise",
				wortart: Wortart.Adverb,
			},
		],
	},
};

const deutschen = {
	deutschen: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🇩🇪"],
				grundform: "deutsch",
				wortart: Wortart.Adjektiv,
			},
			{
				emojiBeschreibungs: ["🇩🇪"],
				genus: Genus.N,
				grundform: "Deutsche",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const deutsch = {
	deutsch: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🇩🇪"],
				grundform: "deutsch",
				wortart: Wortart.Adjektiv,
			},
			{
				emojiBeschreibungs: ["🇩🇪"],
				grundform: "deutsch",
				wortart: Wortart.Adverb,
			},
		],
	},
};

const laden = {
	laden: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["📦➡️🚚", "✉️➡️👥"],
				grundform: "laden",
				wortart: Wortart.Verb,
			},
			{
				emojiBeschreibungs: ["🏪🛍️"],
				genus: Genus.M,
				grundform: "Laden",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const gefallen = {
	gefallen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["👍"],
				grundform: "gefallen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const wende = {
	wende: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🧱➡️🇩🇪"],
				genus: Genus.F,
				grundform: "Wende",
				wortart: Wortart.Nomen,
			},
			{
				emojiBeschreibungs: ["🔄"],
				genus: Genus.M,
				grundform: "Wende",
				wortart: Wortart.Nomen,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🔄", "👉💬"],
				grundform: "wenden",
				wortart: Wortart.Verb,
			},
		],
	},
};

const wenden = {
	wenden: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🔄", "👉💬"],
				grundform: "wenden",
				wortart: Wortart.Verb,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🧱➡️🇩🇪"],
				genus: Genus.F,
				grundform: "Wende",
				wortart: Wortart.Nomen,
			},
			{
				emojiBeschreibungs: ["🔄"],
				genus: Genus.M,
				grundform: "Wende",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const stapelbaren = {
	stapelbaren: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["📦"],
				grundform: "stapelbar",
				wortart: Wortart.Adjektiv,
			},
		],
	},
};

const vorbei = {
	vorbei: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🏃‍♂️💨"],
				grundform: "vorbei",
				wortart: Wortart.Praeposition,
			},
			{
				emojiBeschreibungs: ["🏁"],
				grundform: "vorbei",
				wortart: Wortart.Adverb,
			},
		],
	},
};

const mystery = `a – das Kissen hab' ich auch [[bekommen]].  
Aber es ist vorbei! [[vorbei]]! Und [[jetzt]] [[heul]] bitte nicht!  
Tschüs.  
Männer!`;

const shit = {
	[mystery]: {
		[Match.Unbekannt]: [
			{
				comment:
					"Der Text ist kein einzelnes Wort und enthält keine bekannten Redewendungen.",
				emojiBeschreibungs: ["❓"],
				grundform: "Unbekannt",
				wortart: Wortart.Unbekannt,
			},
		],
	},
};

const augeben = {
	augeben: {
		[Match.Unbekannt]: [
			{
				comment:
					"Ich kann deine Absicht nicht feststellen. Vielleicht hast du 'ausgeben' oder 'aufgeben' gemeint?",
				emojiBeschreibungs: ["❓"],
				grundform: "Unbekannt",
				wortart: Wortart.Unbekannt,
			},
		],
	},
};

const spazirengegangen = {
	"ging spaziren": {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🚶‍♂️"],
				grundform: "spazieren gehen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const spazierenGehen = {
	"spazieren gehen": {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🚶‍♂️"],
				grundform: "spazieren gehen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const doch = {
	doch: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["💬"],
				grundform: "doch",
				wortart: Wortart.Partikel,
			},
		],
	},
};

const Redewendung1 = {
	"das eis zwischen sie ist gebrochen": {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["❄️🧊"],
				grundform: "Das Eis brechen",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const DasEisBrechen = {
	"das eis brechen": {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["❄️🧊"],
				grundform: "Das Eis brechen",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const schaffen = {
	schaffen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["💪✅", "✨🌍"],
				grundform: "schaffen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const DieKuhIstNunVomEis = {
	"kuh ist nun vom eis": {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🐄🧊"],
				grundform: "die Kuh ist vom Eis",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const schafen = {
	schafen: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🐑"],
				genus: Genus.N,
				grundform: "Schaf",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const mleken = {
	mleken: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🐄"],
				grundform: "melken",
				wortart: Wortart.Verb,
			},
		],
	},
};

const melken = {
	melken: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🐄"],
				grundform: "melken",
				wortart: Wortart.Verb,
			},
		],
	},
};

const bewegen = {
	bewegen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["💪➡️🪑", "💬➡️😢"],
				grundform: "bewegen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const senden = {
	senden: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["📤", "📡"],
				grundform: "senden",
				wortart: Wortart.Verb,
			},
		],
	},
};

const genau = {
	genau: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["✔️"],
				grundform: "genau",
				wortart: Wortart.Adverb,
			},
			{
				emojiBeschreibungs: ["✔️"],
				grundform: "genau",
				wortart: Wortart.Adjektiv,
			},
		],
	},
};

const genauso = {
	genauso: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🤝"],
				grundform: "genauso",
				wortart: Wortart.Adverb,
			},
		],
	},
};

const fussballbegeistert = {
	fussballbegeistert: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["⚽️🔥"],
				grundform: "fußballbegeistert",
				wortart: Wortart.Adjektiv,
			},
		],
	},
};

const sofort = {
	sofort: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["⏱️"],
				grundform: "sofort",
				wortart: Wortart.Adverb,
			},
		],
	},
};

const zwar = {
	zwar: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🔗"],
				grundform: "zwar",
				wortart: Wortart.Partikel,
			},
		],
	},
};

const weiss = {
	weiss: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["⚪️"],
				genus: Genus.N,
				grundform: "Weiß",
				wortart: Wortart.Nomen,
			},
			{
				emojiBeschreibungs: ["⚪️"],
				grundform: "weiß",
				wortart: Wortart.Adjektiv,
			},
			{
				emojiBeschreibungs: ["🧠"],
				grundform: "wissen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const weiß = {
	weiß: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["⚪️"],
				genus: Genus.N,
				grundform: "Weiß",
				wortart: Wortart.Nomen,
			},
			{
				emojiBeschreibungs: ["⚪️"],
				grundform: "weiß",
				wortart: Wortart.Adjektiv,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🧠"],
				grundform: "wissen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const wissen = {
	wissen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🧠"],
				grundform: "wissen",
				wortart: Wortart.Verb,
			},
			{
				emojiBeschreibungs: ["🧠"],
				genus: Genus.N,
				grundform: "Wissen",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const erinern = {
	erinern: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["🧠"],
				grundform: "erinnern",
				wortart: Wortart.Verb,
			},
		],
	},
};

const erinnern = {
	erinnern: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🧠"],
				grundform: "erinnern",
				wortart: Wortart.Verb,
			},
		],
	},
};

const rechnen = {
	rechnen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🧮"],
				grundform: "rechnen",
				wortart: Wortart.Verb,
			},
		],
	},
};

const glaubiger = {
	glaubiger: {
		[Match.Tippfehler]: [
			{
				emojiBeschreibungs: ["💰"],
				genus: Genus.M,
				grundform: "Gläubiger",
				wortart: Wortart.Nomen,
			},
			{
				emojiBeschreibungs: ["🙏"],
				grundform: "gläubig",
				wortart: Wortart.Adjektiv,
			},
		],
	},
};

const sie = {
	sie: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["👩"],
				genera: [Genus.F],
				grundform: "sie",
				number: [Numerus.Einzahl],
				pronomenType: PronomenType.Personal,
				wortart: Wortart.Pronomen,
			},
			{
				emojiBeschreibungs: ["👥"],
				grundform: "sie",
				number: [Numerus.Mehrzahl],
				pronomenType: PronomenType.Personal,
				wortart: Wortart.Pronomen,
			},
			{
				emojiBeschreibungs: ["🧑‍💼"],
				grundform: "sie",
				number: [Numerus.Einzahl, Numerus.Mehrzahl],
				pronomenType: PronomenType.Personal,
				wortart: Wortart.Pronomen,
			},
		],
	},
};

const halbenMette = {
	"halben Miete": {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🔑🧩🎯"],
				grundform: "die halbe Miete sein",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const dieHalbeMieteSein = {
	"die halbe Miete sein": {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🔑🧩🎯"],
				grundform: "die halbe Miete sein",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const ganzUndGar = {
	"ganz und gar": {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["💯👌"],
				grundform: "ganz und gar",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const tomatenAufDenAugen = {
	"hast do tomaten auf den augen?": {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🍅🙈🤷‍♂️"],
				grundform: "Tomaten auf den Augen haben",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const baerenAufgebracht = {
	"und ihm einen bären aufzubinden?": {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🐻🤥🙄"],
				grundform: "Jemandem einen Bären aufbinden",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const durchUndDurch = {
	"durch und durch": {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["💯👌"],
				grundform: "durch und durch",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const vollUndGanz = {
	"voll und ganz": {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🎯👌"],
				grundform: "voll und ganz",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const nullUndNichtig = {
	"null und nichtig": {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["0️⃣🚫"],
				grundform: "null und nichtig",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const klippUndKlar = {
	"klipp und klar": {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["✅"],
				grundform: "klipp und klar",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const reinUndGar = {
	"rein und gar": {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["✨👌"],
				grundform: "rein und gar",
				wortart: Wortart.Redewendung,
			},
		],
	},
};

const molken = {
	molken: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🥛"],
				genus: Genus.F,
				grundform: "Molke",
				wortart: Wortart.Nomen,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🐄"],
				grundform: "melken",
				wortart: Wortart.Verb,
			},
		],
	},
};

const schleifen = {
	schleifen: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["⚙️✨"],
				grundform: "schleifen",
				wortart: Wortart.Verb,
			},
			{
				emojiBeschreibungs: ["🚶‍♂️💤"],
				grundform: "schleifen",
				wortart: Wortart.Verb,
			},
		],
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🎀"],
				genus: Genus.F,
				grundform: "Schleife",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const mietschuldenfreiheitsbescheinigung = {
	mietschuldenfreiheitsbescheinigung: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🏠✅📄"],
				genus: Genus.F,
				grundform: "Mietschuldenfreiheitsbescheinigung",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const arbeitsunfaehigkeitsbescheinigung = {
	arbeitsunfaehigkeitsbescheinigung: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🤒🏥📄"],
				genus: Genus.F,
				grundform: "Arbeitsunfaehigkeitsbescheinigung",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const bundesverfassungsgericht = {
	bundesverfassungsgericht: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["⚖️🏛️📜"],
				genus: Genus.N,
				grundform: "Bundesverfassungsgericht",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const bildungsurlaub = {
	bildungsurlaub: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["📚🏖️"],
				genus: Genus.M,
				grundform: "Bildungsurlaub",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const wild = {
	wild: {
		[Match.Grundform]: [
			{
				emojiBeschreibungs: ["🦁"],
				grundform: "wild",
				wortart: Wortart.Adjektiv,
			},
			{
				emojiBeschreibungs: ["🦌"],
				genus: Genus.N,
				grundform: "Wild",
				wortart: Wortart.Nomen,
			},
		],
	},
};

const wilder = {
	wilder: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🦁"],
				grundform: "wild",
				wortart: Wortart.Adjektiv,
			},
		],
	},
};

const wilde = {
	wilde: {
		[Match.Flexion]: [
			{
				emojiBeschreibungs: ["🦁"],
				grundform: "wild",
				wortart: Wortart.Adjektiv,
			},
			{
				emojiBeschreibungs: ["🦌"],
				genus: Genus.N,
				grundform: "Wild",
				wortart: Wortart.Nomen,
			},
		],
	},
};

export const tests = {
	...molken,
	...sie,
	...wild,
	...wilder,
	...wilde,
	...glaubiger,
	...genau,
	...genauso,
	...fussballbegeistert,
	...sofort,
	...zwar,
	...weiss,
	...erinern,
	...erinnern,
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
	...spazierenGehen,
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
	...untergehen,
	...aufgepasst,
	...aufpassen,
	...aufhängen,
	...niesen,
	...heimwerken,
	...heimwerkst,
	...wenden,
	...melken,
	...umfahren,
	...umfahrten,
	...weiß,
	...über,
	...dieHalbeMieteSein,
};
