import {
	Trennbarkeit,
	Regelmaessigkeit,
	Genus,
	Wortart,
	NomenDeklination,
	Kasus,
	PartikelType,
	AdverbCategory,
	Numerus,
	PronomenType,
	Match,
} from 'prompts/wip/endgame/zod/types';
const sitzen = {
	sitzen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'sitzen',
				emojiBeschreibungs: ['💺'],
			},
		],
	},
};

const sitz = {
	sitz: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Sitz',
				emojiBeschreibungs: ['🪑'],
				genus: Genus.M,
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'sitzen',
				emojiBeschreibungs: ['💺'],
			},
		],
	},
};

const untergen = {
	untergen: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Verb,
				grundform: 'untergehen',
				emojiBeschreibungs: ['🌅'],
			},
		],
	},
};

const untergehen = {
	untergehen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'untergehen',
				emojiBeschreibungs: ['🌅'],
			},
		],
	},
};

const aufgepast = {
	aufgepast: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Verb,
				grundform: 'aufpassen',
				emojiBeschreibungs: ['👀'],
			},
		],
	},
};

const aufgepasst = {
	aufgepasst: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'aufpassen',
				emojiBeschreibungs: ['👀'],
			},
		],
	},
};

const aufpassen = {
	aufpassen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'aufpassen',
				emojiBeschreibungs: ['👀'],
			},
		],
	},
};

const Hoffungen = {
	Hoffungen: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Hoffnung',
				emojiBeschreibungs: ['🙏'],
				genus: Genus.F,
			},
		],
	},
};

const hangstauf = {
	hangstauf: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Verb,
				grundform: 'aufhängen',
				emojiBeschreibungs: ['🖼️'],
			},
		],
	},
};

const aufhängen = {
	aufhängen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'aufhängen',
				emojiBeschreibungs: ['🖼️'],
			},
		],
	},
};

const nieser = {
	nieser: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Nieser',
				emojiBeschreibungs: ['🤧'],
				genus: Genus.M,
			},
		],
	},
};

const niesen = {
	niesen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'niesen',
				emojiBeschreibungs: ['🤧'],
			},
		],
	},
};

const klares = {
	klares: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'klar',
				emojiBeschreibungs: ['✨'],
			},
		],
	},
};

const klar = {
	klar: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'klar',
				emojiBeschreibungs: ['✨'],
			},
			{
				wortart: Wortart.Adverb,
				grundform: 'klar',
				emojiBeschreibungs: ['✨'],
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Klar',
				emojiBeschreibungs: ['✨'],
				genus: Genus.N,
			},
		],
	},
};

const hiemwerken = {
	hiemwerken: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Verb,
				grundform: 'heimwerken',
				emojiBeschreibungs: ['🔨'],
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Heimwerk',
				emojiBeschreibungs: ['🛠'],
				genus: Genus.N,
			},
		],
	},
};

const heimwerken = {
	heimwerken: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'heimwerken',
				emojiBeschreibungs: ['🔨'],
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Heimwerk',
				emojiBeschreibungs: ['🛠'],
				genus: Genus.N,
			},
		],
	},
};

const heimwerkst = {
	heimwerkst: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'heimwerken',
				emojiBeschreibungs: ['🔨'],
			},
		],
	},
};

const unbandiges = {
	unbandiges: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'unbändig',
				emojiBeschreibungs: ['🔥'],
			},
		],
	},
};

const backen = {
	backen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'backen',
				emojiBeschreibungs: ['🍞'],
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Backe',
				emojiBeschreibungs: ['😊'],
				genus: Genus.F,
			},
		],
	},
};

const Rechercheergbnisse = {
	Rechercheergbnisse: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Rechercheergebnis',
				emojiBeschreibungs: ['🔍'],
				genus: Genus.N,
			},
		],
	},
};

const See = {
	See: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'See',
				emojiBeschreibungs: ['🏞'],
				genus: Genus.M,
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'See',
				emojiBeschreibungs: ['🌊'],
				genus: Genus.F,
			},
		],
	},
};

const trotz = {
	trotz: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Praeposition,
				grundform: 'trotz',
				emojiBeschreibungs: ['🛡'],
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Trotz',
				emojiBeschreibungs: ['😤'],
				genus: Genus.M,
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'trotzen',
				emojiBeschreibungs: ['😤'],
			},
		],
	},
};

const trozdem = {
	trozdem: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Adverb,
				grundform: 'trotzdem',
				emojiBeschreibungs: ['💪🔥'],
			},
		],
	},
};

const mit = {
	mit: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Praeposition,
				grundform: 'mit',
				emojiBeschreibungs: ['🤝'],
			},
			{
				wortart: Wortart.Praefix,
				grundform: 'mit',
				emojiBeschreibungs: ['🤝'],
			},
		],
	},
};

const an = {
	an: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Praeposition,
				grundform: 'an',
				emojiBeschreibungs: ['📍'],
			},
			{
				wortart: Wortart.Praefix,
				grundform: 'an',
				emojiBeschreibungs: ['📍'],
			},
		],
	},
};

const selbst = {
	selbst: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Adverb,
				grundform: 'selbst',
				emojiBeschreibungs: ['🙋'],
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Selbst',
				emojiBeschreibungs: ['🪞'],
				genus: Genus.N,
			},
		],
	},
};

const uber = {
	uber: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Uber',
				emojiBeschreibungs: ['🏙️'],
				genus: Genus.N,
				eigenname: true,
			},
		],
	},
};

const über = {
	über: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Praeposition,
				grundform: 'über',
				emojiBeschreibungs: ['🔝'],
			},
			{
				wortart: Wortart.Praefix,
				grundform: 'über',
				emojiBeschreibungs: ['🔝'],
			},
		],
	},
};

const umfaren = {
	umfaren: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Verb,
				grundform: 'umfahren',
				emojiBeschreibungs: ['🚗🔄', '🚗💥'],
			},
		],
	},
};

const umfahren = {
	umfahren: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'umfahren',
				emojiBeschreibungs: ['🚗🔄', '🚗💥'],
			},
		],
	},
};

const umfahrten = {
	umfahrten: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Umfahrt',
				emojiBeschreibungs: ['🚗🔄'],
				genus: Genus.F,
			},
		],
	},
};

const geoffnet = {
	geoffnet: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Verb,
				grundform: 'öffnen',
				emojiBeschreibungs: ['🚪👐'],
			},
		],
	},
};

const verfallen = {
	verfallen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'verfallen',
				emojiBeschreibungs: ['🏚️'],
			},
		],
	},
};

const verfall = {
	verfall: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Verfall',
				emojiBeschreibungs: ['🏚️'],
				genus: Genus.M,
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'verfallen',
				emojiBeschreibungs: ['🏚️'],
			},
		],
	},
};

const derVerfall = {
	'der verfall': {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Verfall',
				emojiBeschreibungs: ['🏚️'],
				genus: Genus.M,
			},
		],
	},
};

const schloss = {
	schloss: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Schloss',
				emojiBeschreibungs: ['🏰', '🔒'],
				genus: Genus.N,
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'schließen',
				emojiBeschreibungs: ['🚪'],
			},
		],
	},
};

const gehobener = {
	gehobener: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'gehoben',
				emojiBeschreibungs: ['🎩'],
			},
		],
	},
};

const wahlwiese = {
	wahlwiese: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Adverb,
				grundform: 'wahlweise',
				emojiBeschreibungs: ['🔀'],
			},
		],
	},
};

const deutschen = {
	deutschen: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'deutsch',
				emojiBeschreibungs: ['🇩🇪'],
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Deutsche',
				emojiBeschreibungs: ['🇩🇪'],
				genus: Genus.N,
			},
		],
	},
};

const deutsch = {
	deutsch: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'deutsch',
				emojiBeschreibungs: ['🇩🇪'],
			},
			{
				wortart: Wortart.Adverb,
				grundform: 'deutsch',
				emojiBeschreibungs: ['🇩🇪'],
			},
		],
	},
};

const laden = {
	laden: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'laden',
				emojiBeschreibungs: ['📦➡️🚚', '✉️➡️👥'],
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Laden',
				emojiBeschreibungs: ['🏪🛍️'],
				genus: Genus.M,
			},
		],
	},
};

const gefallen = {
	gefallen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'gefallen',
				emojiBeschreibungs: ['👍'],
			},
		],
	},
};

const wende = {
	wende: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Wende',
				emojiBeschreibungs: ['🧱➡️🇩🇪'],
				genus: Genus.F,
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Wende',
				emojiBeschreibungs: ['🔄'],
				genus: Genus.M,
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'wenden',
				emojiBeschreibungs: ['🔄', '👉💬'],
			},
		],
	},
};

const wenden = {
	wenden: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'wenden',
				emojiBeschreibungs: ['🔄', '👉💬'],
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Wende',
				emojiBeschreibungs: ['🧱➡️🇩🇪'],
				genus: Genus.F,
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Wende',
				emojiBeschreibungs: ['🔄'],
				genus: Genus.M,
			},
		],
	},
};

const stapelbaren = {
	stapelbaren: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'stapelbar',
				emojiBeschreibungs: ['📦'],
			},
		],
	},
};

const vorbei = {
	vorbei: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Praeposition,
				grundform: 'vorbei',
				emojiBeschreibungs: ['🏃‍♂️💨'],
			},
			{
				wortart: Wortart.Adverb,
				grundform: 'vorbei',
				emojiBeschreibungs: ['🏁'],
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
				wortart: Wortart.Unbekannt,
				grundform: 'Unbekannt',
				emojiBeschreibungs: ['❓'],
				comment:
					'Der Text ist kein einzelnes Wort und enthält keine bekannten Redewendungen.',
			},
		],
	},
};

const augeben = {
	augeben: {
		[Match.Unbekannt]: [
			{
				wortart: Wortart.Unbekannt,
				grundform: 'Unbekannt',
				emojiBeschreibungs: ['❓'],
				comment:
					"Ich kann deine Absicht nicht feststellen. Vielleicht hast du 'ausgeben' oder 'aufgeben' gemeint?",
			},
		],
	},
};

const spazirengegangen = {
	'ging spaziren': {
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'spazieren gehen',
				emojiBeschreibungs: ['🚶‍♂️'],
			},
		],
	},
};

const spazierenGehen = {
	'spazieren gehen': {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'spazieren gehen',
				emojiBeschreibungs: ['🚶‍♂️'],
			},
		],
	},
};

const doch = {
	doch: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Partikel,
				grundform: 'doch',
				emojiBeschreibungs: ['💬'],
			},
		],
	},
};

const Redewendung1 = {
	'das eis zwischen sie ist gebrochen': {
		[Match.Flexion]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'Das Eis brechen',
				emojiBeschreibungs: ['❄️🧊'],
			},
		],
	},
};

const DasEisBrechen = {
	'das eis brechen': {
		[Match.Flexion]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'Das Eis brechen',
				emojiBeschreibungs: ['❄️🧊'],
			},
		],
	},
};

const schaffen = {
	schaffen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'schaffen',
				emojiBeschreibungs: ['💪✅', '✨🌍'],
			},
		],
	},
};

const DieKuhIstNunVomEis = {
	'kuh ist nun vom eis': {
		[Match.Flexion]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'die Kuh ist vom Eis',
				emojiBeschreibungs: ['🐄🧊'],
			},
		],
	},
};

const schafen = {
	schafen: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Schaf',
				emojiBeschreibungs: ['🐑'],
				genus: Genus.N,
			},
		],
	},
};

const mleken = {
	mleken: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Verb,
				grundform: 'melken',
				emojiBeschreibungs: ['🐄'],
			},
		],
	},
};

const melken = {
	melken: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'melken',
				emojiBeschreibungs: ['🐄'],
			},
		],
	},
};

const bewegen = {
	bewegen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'bewegen',
				emojiBeschreibungs: ['💪➡️🪑', '💬➡️😢'],
			},
		],
	},
};

const senden = {
	senden: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'senden',
				emojiBeschreibungs: ['📤', '📡'],
			},
		],
	},
};

const genau = {
	genau: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Adverb,
				grundform: 'genau',
				emojiBeschreibungs: ['✔️'],
			},
			{
				wortart: Wortart.Adjektiv,
				grundform: 'genau',
				emojiBeschreibungs: ['✔️'],
			},
		],
	},
};

const genauso = {
	genauso: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Adverb,
				grundform: 'genauso',
				emojiBeschreibungs: ['🤝'],
			},
		],
	},
};

const fussballbegeistert = {
	fussballbegeistert: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'fußballbegeistert',
				emojiBeschreibungs: ['⚽️🔥'],
			},
		],
	},
};

const sofort = {
	sofort: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Adverb,
				grundform: 'sofort',
				emojiBeschreibungs: ['⏱️'],
			},
		],
	},
};

const zwar = {
	zwar: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Partikel,
				grundform: 'zwar',
				emojiBeschreibungs: ['🔗'],
			},
		],
	},
};

const weiss = {
	weiss: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Weiß',
				emojiBeschreibungs: ['⚪️'],
				genus: Genus.N,
			},
			{
				wortart: Wortart.Adjektiv,
				grundform: 'weiß',
				emojiBeschreibungs: ['⚪️'],
			},
			{
				wortart: Wortart.Verb,
				grundform: 'wissen',
				emojiBeschreibungs: ['🧠'],
			},
		],
	},
};

const weiß = {
	weiß: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Weiß',
				emojiBeschreibungs: ['⚪️'],
				genus: Genus.N,
			},
			{
				wortart: Wortart.Adjektiv,
				grundform: 'weiß',
				emojiBeschreibungs: ['⚪️'],
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'wissen',
				emojiBeschreibungs: ['🧠'],
			},
		],
	},
};

const wissen = {
	wissen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'wissen',
				emojiBeschreibungs: ['🧠'],
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Wissen',
				emojiBeschreibungs: ['🧠'],
				genus: Genus.N,
			},
		],
	},
};

const erinern = {
	erinern: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Verb,
				grundform: 'erinnern',
				emojiBeschreibungs: ['🧠'],
			},
		],
	},
};

const erinnern = {
	erinnern: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'erinnern',
				emojiBeschreibungs: ['🧠'],
			},
		],
	},
};

const rechnen = {
	rechnen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'rechnen',
				emojiBeschreibungs: ['🧮'],
			},
		],
	},
};

const glaubiger = {
	glaubiger: {
		[Match.Tippfehler]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Gläubiger',
				emojiBeschreibungs: ['💰'],
				genus: Genus.M,
			},
			{
				wortart: Wortart.Adjektiv,
				grundform: 'gläubig',
				emojiBeschreibungs: ['🙏'],
			},
		],
	},
};

const sie = {
	sie: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Pronomen,
				grundform: 'sie',
				emojiBeschreibungs: ['👩'],
				pronomenType: PronomenType.Personal,
				number: [Numerus.Einzahl],
				genera: [Genus.F],
			},
			{
				wortart: Wortart.Pronomen,
				grundform: 'sie',
				emojiBeschreibungs: ['👥'],
				pronomenType: PronomenType.Personal,
				number: [Numerus.Mehrzahl],
			},
			{
				wortart: Wortart.Pronomen,
				grundform: 'sie',
				emojiBeschreibungs: ['🧑‍💼'],
				pronomenType: PronomenType.Personal,
				number: [Numerus.Einzahl, Numerus.Mehrzahl],
			},
		],
	},
};

const halbenMette = {
	'halben Miete': {
		[Match.Flexion]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'die halbe Miete sein',
				emojiBeschreibungs: ['🔑🧩🎯'],
			},
		],
	},
};

const dieHalbeMieteSein = {
	'die halbe Miete sein': {
		[Match.Grundform]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'die halbe Miete sein',
				emojiBeschreibungs: ['🔑🧩🎯'],
			},
		],
	},
};

const ganzUndGar = {
	'ganz und gar': {
		[Match.Grundform]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'ganz und gar',
				emojiBeschreibungs: ['💯👌'],
			},
		],
	},
};

const tomatenAufDenAugen = {
	'hast do tomaten auf den augen?': {
		[Match.Flexion]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'Tomaten auf den Augen haben',
				emojiBeschreibungs: ['🍅🙈🤷‍♂️'],
			},
		],
	},
};

const baerenAufgebracht = {
	'und ihm einen bären aufzubinden?': {
		[Match.Flexion]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'Jemandem einen Bären aufbinden',
				emojiBeschreibungs: ['🐻🤥🙄'],
			},
		],
	},
};

const durchUndDurch = {
	'durch und durch': {
		[Match.Grundform]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'durch und durch',
				emojiBeschreibungs: ['💯👌'],
			},
		],
	},
};

const vollUndGanz = {
	'voll und ganz': {
		[Match.Grundform]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'voll und ganz',
				emojiBeschreibungs: ['🎯👌'],
			},
		],
	},
};

const nullUndNichtig = {
	'null und nichtig': {
		[Match.Grundform]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'null und nichtig',
				emojiBeschreibungs: ['0️⃣🚫'],
			},
		],
	},
};

const klippUndKlar = {
	'klipp und klar': {
		[Match.Grundform]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'klipp und klar',
				emojiBeschreibungs: ['✅'],
			},
		],
	},
};

const reinUndGar = {
	'rein und gar': {
		[Match.Grundform]: [
			{
				wortart: Wortart.Redewendung,
				grundform: 'rein und gar',
				emojiBeschreibungs: ['✨👌'],
			},
		],
	},
};

const molken = {
	molken: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Molke',
				emojiBeschreibungs: ['🥛'],
				genus: Genus.F,
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Verb,
				grundform: 'melken',
				emojiBeschreibungs: ['🐄'],
			},
		],
	},
};

const schleifen = {
	schleifen: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Verb,
				grundform: 'schleifen',
				emojiBeschreibungs: ['⚙️✨'],
			},
			{
				wortart: Wortart.Verb,
				grundform: 'schleifen',
				emojiBeschreibungs: ['🚶‍♂️💤'],
			},
		],
		[Match.Flexion]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Schleife',
				emojiBeschreibungs: ['🎀'],
				genus: Genus.F,
			},
		],
	},
};

const mietschuldenfreiheitsbescheinigung = {
	mietschuldenfreiheitsbescheinigung: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Mietschuldenfreiheitsbescheinigung',
				emojiBeschreibungs: ['🏠✅📄'],
				genus: Genus.F,
			},
		],
	},
};

const arbeitsunfaehigkeitsbescheinigung = {
	arbeitsunfaehigkeitsbescheinigung: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Arbeitsunfaehigkeitsbescheinigung',
				emojiBeschreibungs: ['🤒🏥📄'],
				genus: Genus.F,
			},
		],
	},
};

const bundesverfassungsgericht = {
	bundesverfassungsgericht: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Bundesverfassungsgericht',
				emojiBeschreibungs: ['⚖️🏛️📜'],
				genus: Genus.N,
			},
		],
	},
};

const bildungsurlaub = {
	bildungsurlaub: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Nomen,
				grundform: 'Bildungsurlaub',
				emojiBeschreibungs: ['📚🏖️'],
				genus: Genus.M,
			},
		],
	},
};

const wild = {
	wild: {
		[Match.Grundform]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'wild',
				emojiBeschreibungs: ['🦁'],
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Wild',
				emojiBeschreibungs: ['🦌'],
				genus: Genus.N,
			},
		],
	},
};

const wilder = {
	wilder: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'wild',
				emojiBeschreibungs: ['🦁'],
			},
		],
	},
};

const wilde = {
	wilde: {
		[Match.Flexion]: [
			{
				wortart: Wortart.Adjektiv,
				grundform: 'wild',
				emojiBeschreibungs: ['🦁'],
			},
			{
				wortart: Wortart.Nomen,
				grundform: 'Wild',
				emojiBeschreibungs: ['🦌'],
				genus: Genus.N,
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
