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
} from 'prompts/wip/endgame/zod/types';

const sitzen = {
	sitzen: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'sitzen',
			grundform: 'sitzen',
			emojiBeschreibungs: ['💺'],
			regelmaessig: true,
		},
	],
};

const sitz = {
	sitz: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'sitz',
			grundform: 'sitzen',
			emojiBeschreibungs: ['💺'],
			regelmaessig: true,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Sitz',
			grundform: 'Sitz',
			emojiBeschreibungs: ['🪑'],
			genus: Genus.M,
			deklination: NomenDeklination.Stark,
		},
	],
};

const untergen = {
	untergen: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'untergehen',
			grundform: 'untergehen',
			emojiBeschreibungs: ['🌅'],
			trennbarkeit: Trennbarkeit.Trennbar,
			regelmaessig: true,
		},
	],
};

const aufgepast = {
	aufgepast: [ 
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'aufgepasst',
			grundform: 'aufpassen',
			emojiBeschreibungs: ['👀'],
			trennbarkeit: Trennbarkeit.Trennbar,
			regelmaessig: true,
		},
	],
};

const Hoffungen = {
	Hoffungen: [
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Hoffnungen',
			grundform: 'Hoffnung',
			emojiBeschreibungs: ['🙏'],
			genus: Genus.F,
			deklination: NomenDeklination.Stark,
		},
	],
};

const hangstauf = {
	hangstauf: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'hängst auf',
			grundform: 'aufhängen',
			emojiBeschreibungs: ['🖼️'],
			trennbarkeit: Trennbarkeit.Trennbar,
			regelmaessig: true,
		},
	],
};

const nieser = {
	nieser: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'niest',
			grundform: 'niesen',
			emojiBeschreibungs: ['🤧'],
			regelmaessig: true,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Nieser',
			grundform: 'Nieser',
			emojiBeschreibungs: ['🤧'],
			genus: Genus.M,
			deklination: NomenDeklination.Schwach,
		},
	],
};

const klares = {
	klares: [
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'klares',
			grundform: 'klar',
			emojiBeschreibungs: ['✨'],
		},
	],
};

const klar = {
	klar: [
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'klar',
			grundform: 'klar',
			emojiBeschreibungs: ['✨'],
		},
		{
			wortart: Wortart.Adverb,
			rechtschreibung: 'klar',
			grundform: 'klar',
			emojiBeschreibungs: ['✨'],
			adverbCategory: [AdverbCategory.Grad],
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Klar',
			grundform: 'Klar',
			emojiBeschreibungs: ['✨'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
	],
};

const hiemwerken = {
	hiemwerken: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'heimwerken',
			grundform: 'heimwerken',
			emojiBeschreibungs: ['🔨'],
			trennbarkeit: Trennbarkeit.Untrennbar,
			regelmaessig: true,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Heimwerken',
			grundform: 'Heimwerk',
			emojiBeschreibungs: ['🛠'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
	],
};

const unbandiges = {
	unbandiges: [
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'unbandiges',
			grundform: 'unbändig',
			emojiBeschreibungs: ['🔥'],
		},
	],
};

const backen = {
	backen: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'backen',
			grundform: 'backen',
			emojiBeschreibungs: ['🍞'],
			regelmaessig: false,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'backen',
			grundform: 'backen',
			emojiBeschreibungs: ['🍞'],
			regelmaessig: true,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Backe',
			grundform: 'Backe',
			emojiBeschreibungs: ['😊'],
			genus: Genus.F,
			deklination: NomenDeklination.Stark,
		},
	],
};

const Rechercheergbnisse = {
	Rechercheergbnisse: [
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Rechercheergebnisse',
			grundform: 'Rechercheergebnis',
			emojiBeschreibungs: ['🔍'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
	],
};

const See = {
	See: [
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'See',
			grundform: 'See',
			emojiBeschreibungs: ['🏞'],
			genus: Genus.M,
			deklination: NomenDeklination.Stark,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'See',
			grundform: 'See',
			emojiBeschreibungs: ['🌊'],
			genus: Genus.F,
			deklination: NomenDeklination.Stark,
		},
	],
};

const trotz = {
	trotz: [
		{
			wortart: Wortart.Praeposition,
			rechtschreibung: 'trotz',
			grundform: 'trotz',
			emojiBeschreibungs: ['🛡'],
			possibleGoverningKasuss: ['Genitiv'],
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Trotz',
			grundform: 'Trotz',
			emojiBeschreibungs: ['😤'],
			genus: Genus.M,
			deklination: NomenDeklination.Stark,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'trotz',
			grundform: 'trotzen',
			emojiBeschreibungs: ['😤'],
			regelmaessig: true,
		},
	],
};

const trozdem = {
	trozdem: [
		{
			wortart: Wortart.Adverb,
			adverbCategory: [AdverbCategory.Modal],
			rechtschreibung: 'trotzdem',
			grundform: 'trotzdem',
			emojiBeschreibungs: ['💪🔥'],
		},
	],
};

const mit = {
	mit: [
		{
			wortart: Wortart.Praeposition,
			rechtschreibung: 'mit',
			grundform: 'mit',
			emojiBeschreibungs: ['🤝'],
			possibleGoverningKasuss: [Kasus.D],
		},
		{
			wortart: Wortart.Praefix,
			rechtschreibung: 'mit',
			grundform: 'mit',
			emojiBeschreibungs: ['🤝'],
		},
	],
};

const an = {
	an: [
		{
			wortart: Wortart.Praeposition,
			rechtschreibung: 'an',
			grundform: 'an',
			emojiBeschreibungs: ['📍'],
			possibleGoverningKasuss: [Kasus.D, Kasus.A],
		},
		{
			wortart: Wortart.Praefix,
			rechtschreibung: 'an',
			grundform: 'an',
			emojiBeschreibungs: ['📍'],
		},
	],
};

const selbst = {
	selbst: [
		{
			wortart: Wortart.Adverb,
			rechtschreibung: 'selbst',
			grundform: 'selbst',
			emojiBeschreibungs: ['🙋'],
			adverbCategory: [AdverbCategory.Modal],
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Selbst',
			grundform: 'Selbst',
			emojiBeschreibungs: ['🪞'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
	],
};

const uber = {
	uber: [
		{
			wortart: Wortart.Praeposition,
			rechtschreibung: 'über',
			grundform: 'über',
			emojiBeschreibungs: ['🔝'],
			possibleGoverningKasuss: [Kasus.D, Kasus.A],
		},
		{
			wortart: Wortart.Praefix,
			rechtschreibung: 'über',
			grundform: 'über',
			emojiBeschreibungs: ['🔝'],
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Uber',
			grundform: 'Uber',
			emojiBeschreibungs: ['🏙️'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
			eigenname: true,
		},
	],
};

const umfaren = {
	umfaren: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'umfahren',
			grundform: 'umfahren',
			emojiBeschreibungs: ['🚗🔄'],
			trennbarkeit: Trennbarkeit.Trennbar,
			regelmaessig: false,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'umfahren',
			grundform: 'umfahren',
			emojiBeschreibungs: ['🚗💥'],
			trennbarkeit: Trennbarkeit.Untrennbar,
			regelmaessig: false,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Umfahren',
			grundform: 'Umfahrt',
			emojiBeschreibungs: ['🚗🔄'],
			genus: Genus.F,
			deklination: NomenDeklination.Stark,
		},
	],
};

const geoffnet = {
	geoffnet: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'geöffnet',
			grundform: 'öffnen',
			emojiBeschreibungs: ['🚪👐'],
			// partizipVariant: PartizipVariant.P2,
		},
	],
};

const verfallen = {
	verfallen: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'verfallen',
			grundform: 'verfallen',
			emojiBeschreibungs: ['🏚️'],
			trennbarkeit: Trennbarkeit.Untrennbar,
			regelmaessig: false,
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
			wortart: Wortart.Verb,
			rechtschreibung: 'verfall',
			grundform: 'verfallen',
			emojiBeschreibungs: ['🏚️'],
			trennbarkeit: Trennbarkeit.Untrennbar,
			regelmaessig: false,
		},
		{
			rechtschreibung: 'Verfall',
			grundform: 'Verfall',
			wortart: Wortart.Nomen,
			genus: Genus.M,
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ['🏚️'],
		},
	],
};

const derVerfall = {
	'der verfall': [
		{
			rechtschreibung: 'Verfall',
			grundform: 'Verfall',
			wortart: Wortart.Nomen,
			genus: Genus.M,
			deklination: NomenDeklination.Stark,
			emojiBeschreibungs: ['🏚️'],
		},
	],
};

const schloss = {
	schloss: [
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Schloss',
			grundform: 'Schloss',
			emojiBeschreibungs: ['🏰', '🔒'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'schließen',
			grundform: 'schließen',
			emojiBeschreibungs: ['🚪'],
			regelmaessig: false,
		},
	],
};

const gehobener = {
	gehobener: [
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'gehoben',
			grundform: 'gehoben',
			emojiBeschreibungs: ['🎩'],
		},
	],
};

const wahlwiese = {
	wahlwiese: [
		{
			wortart: Wortart.Adverb,
			rechtschreibung: 'wahlweise',
			grundform: 'wahlweise',
			emojiBeschreibungs: ['🔀'],
			adverbCategory: [AdverbCategory.Modal],
		},
	],
};

const deutschen = {
	deutschen: [
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'deutschen',
			grundform: 'deutsch',
			emojiBeschreibungs: ['🇩🇪'],
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Deutsche',
			grundform: 'Deutsche',
			emojiBeschreibungs: ['🇩🇪'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
	],
};

const deutsch = {
	deutsch: [
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'deutsch',
			grundform: 'deutsch',
			emojiBeschreibungs: ['🇩🇪'],
		},
		{
			wortart: Wortart.Adverb,
			rechtschreibung: 'deutsch',
			grundform: 'deutsch',
			emojiBeschreibungs: ['🇩🇪'],
			adverbCategory: [AdverbCategory.Modal],
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Deutsche',
			grundform: 'Deutsche',
			emojiBeschreibungs: ['🇩🇪'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
	],
};

const laden = {
	laden: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'laden',
			grundform: 'laden',
			emojiBeschreibungs: ['📦➡️🚚'],
			regelmaessig: true,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'laden',
			grundform: 'laden',
			emojiBeschreibungs: ['✉️➡️👥'],
			regelmaessig: false,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Laden',
			grundform: 'Laden',
			emojiBeschreibungs: ['🏪🛍️'],
			genus: Genus.M,
			deklination: NomenDeklination.Stark,
		},
	],
};

const gefallen = {
	gefallen: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'gefallen',
			grundform: 'gefallen',
			emojiBeschreibungs: ['👍'],
			trennbarkeit: Trennbarkeit.Untrennbar,
			regelmaessig: false,
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
			wortart: Wortart.Nomen,
			rechtschreibung: 'Wende',
			grundform: 'Wende',
			emojiBeschreibungs: ['🔄'],
			genus: Genus.F,
			deklination: NomenDeklination.Stark,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'wende',
			grundform: 'wenden',
			emojiBeschreibungs: ['🔄'],
			regelmaessig: true,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'wende',
			grundform: 'wenden',
			emojiBeschreibungs: ['👉💬'],
			regelmaessig: false,
		},
	],
};

const stapelbaren = {
	stapelbaren: [
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'stapelbaren',
			grundform: 'stapelbar',
			emojiBeschreibungs: ['📦'],
		},
	],
};

const vorbei = {
	vorbei: [
		{
			wortart: Wortart.Praeposition,
			rechtschreibung: 'vorbei',
			grundform: 'vorbei',
			emojiBeschreibungs: ['🏃‍♂️💨'],
		},
		{
			wortart: Wortart.Adverb,
			rechtschreibung: 'vorbei',
			grundform: 'vorbei',
			emojiBeschreibungs: ['🏁'],
			adverbCategory: [AdverbCategory.Lokal],
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
			wortart: Wortart.Unbekannt,
			rechtschreibung: 'Unbekannt',
			grundform: 'Unbekannt',
			emojiBeschreibungs: ['❓'],
			comment:
				'Der Text ist kein einzelnes Wort und enthält keine bekannten Redewendungen.',
		},
	],
};

const augeben = {
	augeben: [
		{
			wortart: Wortart.Unbekannt,
			rechtschreibung: 'Unbekannt',
			grundform: 'Unbekannt',
			emojiBeschreibungs: ['❓'],
			comment:
				'Ich kann deine Absicht nicht feststellen. Vielleicht hast du [[ausgeben]] oder [[aufgeben]] gemeint?',
		},
	],
};

const spazirengegangen = {
	'ging spaziren': [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'ging spazieren',
			grundform: 'spazieren gehen',
			emojiBeschreibungs: ['🚶‍♂️'],
			trennbarkeit: Trennbarkeit.Trennbar,
			regelmaessig: false,
		},
	],
};

const doch = {
	doch: [
		{
			wortart: Wortart.Partikel,
			rechtschreibung: 'doch',
			grundform: 'doch',
			emojiBeschreibungs: ['💬'],
			partikelType: [PartikelType.Konnektiv],
		},
	],
};

const Redewendung1 = {
	'das eis zwischen sie ist gebrochen': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'Das Eis brechen',
			grundform: 'Das Eis brechen',
			emojiBeschreibungs: ['❄️🧊'],
		},
	],
};

const schaffen = {
	schaffen: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'schaffen',
			grundform: 'schaffen',
			emojiBeschreibungs: ['💪✅'],
			regelmaessig: true,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'schaffen',
			grundform: 'schaffen',
			emojiBeschreibungs: ['✨🌍'],
			regelmaessig: false,
		},
	],
};

const DieKuhIstNunVomEis = {
	'kuh ist nun vom eis': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'Kuh ist nun vom Eis',
			grundform: 'die Kuh ist vom Eis',
			emojiBeschreibungs: ['🐄🧊'],
		},
	],
};

const schafen = {
	schafen: [
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Schafen',
			grundform: 'Schaf',
			emojiBeschreibungs: ['🐑'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
	],
};

const mleken = {
	mleken: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'melken',
			grundform: 'melken',
			emojiBeschreibungs: ['🐄'],
			regelmaessig: true,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'melken',
			grundform: 'melken',
			emojiBeschreibungs: ['🐄'],
			regelmaessig: false,
		},
	],
};

const bewegen = {
	bewegen: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'bewegen',
			grundform: 'bewegen',
			emojiBeschreibungs: ['💪➡️🪑'],
			regelmaessig: true,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'bewegen',
			grundform: 'bewegen',
			emojiBeschreibungs: ['💬➡️😢'],
			regelmaessig: false,
		},
	],
};

const senden = {
	senden: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'senden',
			grundform: 'senden',
			emojiBeschreibungs: ['📤'],
			regelmaessig: true,
		},
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'senden',
			grundform: 'senden',
			emojiBeschreibungs: ['📡'],
			regelmaessig: false,
		},
	],
};

const genau = {
	genau: [
		{
			wortart: Wortart.Adverb,
			rechtschreibung: 'genau',
			grundform: 'genau',
			emojiBeschreibungs: ['✔️'],
			adverbCategory: [AdverbCategory.Modal],
		},
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'genau',
			grundform: 'genau',
			emojiBeschreibungs: ['✔️'],
		},
	],
};

const genauso = {
	genauso: [
		{
			wortart: Wortart.Adverb,
			rechtschreibung: 'genauso',
			grundform: 'genauso',
			emojiBeschreibungs: ['🤝'],
			adverbCategory: [AdverbCategory.Modal],
		},
	],
};

const fussballbegeistert = {
	fussballbegeistert: [
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'fußballbegeistert',
			grundform: 'fußballbegeistert',
			emojiBeschreibungs: ['⚽️🔥'],
		},
	],
};

const sofort = {
	sofort: [
		{
			wortart: Wortart.Adverb,
			rechtschreibung: 'sofort',
			grundform: 'sofort',
			emojiBeschreibungs: ['⏱️'],
			adverbCategory: [AdverbCategory.Temporal],
		},
	],
};

const zwar = {
	zwar: [
		{
			wortart: Wortart.Partikel,
			rechtschreibung: 'zwar',
			grundform: 'zwar',
			emojiBeschreibungs: ['🔗'],
			partikelType: [PartikelType.Konnektiv],
		},
	],
};

const weiss = {
	weiss: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'weiß',
			grundform: 'wissen',
			emojiBeschreibungs: ['🧠'],
			regelmaessig: false,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Weiß',
			grundform: 'Weiß',
			emojiBeschreibungs: ['⚪️'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'weiß',
			grundform: 'weiß',
			emojiBeschreibungs: ['⚪️'],
		},
	],
};

const wissen = {
	wissen: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'wissen',
			grundform: 'wissen',
			emojiBeschreibungs: ['🧠'],
			regelmaessig: false,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Wissen',
			grundform: 'Wissen',
			emojiBeschreibungs: ['🧠'],
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
		},
	],
};

const erinern = {
	erinern: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'erinnern',
			grundform: 'erinnern',
			emojiBeschreibungs: ['🧠'],
			regelmaessig: true,
		},
	],
};

const rechnen = {
	rechnen: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'rechnen',
			grundform: 'rechnen',
			emojiBeschreibungs: ['🧮'],
			regelmaessig: true,
		},
	],
};

const glaubiger = {
	glaubiger: [
		{
			wortart: Wortart.Adjektiv,
			rechtschreibung: 'gläubiger',
			grundform: 'gläubig',
			emojiBeschreibungs: ['🙏'],
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Gläubiger',
			grundform: 'Gläubiger',
			emojiBeschreibungs: ['💰'],
			genus: Genus.M,
			deklination: NomenDeklination.Stark,
		},
	],
};

const sie = {
	sie: [
		{
			wortart: Wortart.Pronomen,
			rechtschreibung: 'sie',
			grundform: 'sie',
			emojiBeschreibungs: ['👩'],
			pronomenType: PronomenType.Personal,
			number: [Numerus.Einzahl],
			genera: [Genus.F],
		},
		{
			wortart: Wortart.Pronomen,
			rechtschreibung: 'sie',
			grundform: 'sie',
			emojiBeschreibungs: ['👥'],
			pronomenType: PronomenType.Personal,
			number: [Numerus.Mehrzahl],
		},
		{
			wortart: Wortart.Pronomen,
			rechtschreibung: 'Sie',
			grundform: 'sie',
			emojiBeschreibungs: ['🧑‍💼'],
			pronomenType: PronomenType.Personal,
			number: [Numerus.Einzahl, Numerus.Mehrzahl],
		},
	],
};

const DasEisBrechen = {
	'eis zwischen ihnen ist gebrochen': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'das Eis zwischen ihnen ist gebrochen',
			grundform: 'das Eis brechen',
			emojiBeschreibungs: ['🤝'],
		},
	],
};

const halbenMette = {
	'halben Miete': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'halben Miete',
			grundform: 'halbe Miete',
			emojiBeschreibungs: ['🔑🧩🎯'],
		},
	],
};

const ganzUndGar = {
	'ganz und gar': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'ganz und gar',
			grundform: 'ganz und gar',
			emojiBeschreibungs: ['💯👌'],
		},
	],
};

const tomatenAufDenAugen = {
	'hast do tomaten auf den augen?': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'Hast do Tomaten auf den Augen?',
			grundform: 'Tomaten auf den Augen haben',
			emojiBeschreibungs: ['🍅🙈🤷‍♂️'],
		},
	],
};

const baerenAufgebracht = {
	'und ihm einen bären aufzubinden?': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'und ihm einen Bären aufzubinden?',
			grundform: 'Jemandem einen Bären aufbinden',
			emojiBeschreibungs: ['🐻🤥🙄'],
		},
	],
};

const durchUndDurch = {
	'durch und durch': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'durch und durch',
			grundform: 'durch und durch',
			emojiBeschreibungs: ['💯👌'],
		},
	],
};

const vollUndGanz = {
	'voll und ganz': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'voll und ganz',
			grundform: 'voll und ganz',
			emojiBeschreibungs: ['🎯👌'],
		},
	],
};

const nullUndNichtig = {
	'null und nichtig': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'null und nichtig',
			grundform: 'null und nichtig',
			emojiBeschreibungs: ['0️⃣🚫'],
		},
	],
};

const klippUndKlar = {
	'klipp und klar': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'klipp und klar',
			grundform: 'klipp und klar',
			emojiBeschreibungs: ['✅'],
		},
	],
};

const reinUndGar = {
	'rein und gar': [
		{
			wortart: Wortart.Redewendung,
			rechtschreibung: 'rein und gar',
			grundform: 'rein und gar',
			emojiBeschreibungs: ['✨👌'],
		},
	],
};

const molken = {
	molken: [
		{
			wortart: Wortart.Verb,
			rechtschreibung: 'molken',
			grundform: 'melken',
			emojiBeschreibungs: ['🐄'],
			regelmaessig: false,
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Molken',
			grundform: 'Molke',
			emojiBeschreibungs: ['🥛'],
			genus: Genus.F,
			deklination: NomenDeklination.Stark,
		},
	],
};

const schleifen = {
	schleifen: [
		{
			wortart: Wortart.Verb,
			regelmaessig: true,
			rechtschreibung: 'schleifen',
			grundform: 'schleifen',
			emojiBeschreibungs: ['⚙️✨'],
		},
		{
			wortart: Wortart.Verb,
			regelmaessig: false,
			rechtschreibung: 'schleifen',
			grundform: 'schleifen',
			emojiBeschreibungs: ['🚶‍♂️💤'],
		},
		{
			wortart: Wortart.Nomen,
			rechtschreibung: 'Schleifen',
			grundform: 'Schleife',
			emojiBeschreibungs: ['🎀'],
			genus: Genus.F,
			deklination: NomenDeklination.Stark,
		},
	],
};

const mietschuldenfreiheitsbescheinigung = {
	mietschuldenfreiheitsbescheinigung: [
		{
			wortart: Wortart.Nomen,
			genus: Genus.F,
			deklination: NomenDeklination.Stark,
			rechtschreibung: 'Mietschuldenfreiheitsbescheinigung',
			grundform: 'Mietschuldenfreiheitsbescheinigung',
			emojiBeschreibungs: ['🏠✅📄'],
		},
	],
};

const arbeitsunfaehigkeitsbescheinigung = {
	arbeitsunfaehigkeitsbescheinigung: [
		{
			wortart: Wortart.Nomen,
			genus: Genus.F,
			deklination: NomenDeklination.Stark,
			rechtschreibung: 'Arbeitsunfaehigkeitsbescheinigung',
			grundform: 'Arbeitsunfaehigkeitsbescheinigung',
			emojiBeschreibungs: ['🤒🏥📄'],
		},
	],
};

const bundesverfassungsgericht = {
	bundesverfassungsgericht: [
		{
			wortart: Wortart.Nomen,
			genus: Genus.N,
			deklination: NomenDeklination.Stark,
			rechtschreibung: 'Bundesverfassungsgericht',
			grundform: 'Bundesverfassungsgericht',
			emojiBeschreibungs: ['⚖️🏛️📜'],
		},
	],
};

const bildungsurlaub = {
	bildungsurlaub: [
		{
			wortart: Wortart.Nomen,
			genus: Genus.M,
			deklination: NomenDeklination.Stark,
			rechtschreibung: 'Bildungsurlaub',
			grundform: 'Bildungsurlaub',
			emojiBeschreibungs: ['📚🏖️'],
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
