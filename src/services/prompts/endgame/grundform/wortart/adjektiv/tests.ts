import { Vergleichsgrad } from "../../../zod/types";

const gut = {
	gut: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["gut"],
				[Vergleichsgrad.Komparativ]: ["besser"],
				[Vergleichsgrad.Superlativ]: ["best"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const gross = {
	groß: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["groß"],
				[Vergleichsgrad.Komparativ]: ["größer"],
				[Vergleichsgrad.Superlativ]: ["größt"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const klein = {
	klein: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["klein"],
				[Vergleichsgrad.Komparativ]: ["kleiner"],
				[Vergleichsgrad.Superlativ]: ["kleinst"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
	],
};

const aussehend = {
	aussehend: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["aussehend"],
			},
			regelmaessig: true,
			steigerungsfaehig: false,
		},
	],
};

const tot = {
	tot: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["tot"],
			},
			regelmaessig: true,
			steigerungsfaehig: false,
		},
	],
};

const fleissig = {
	fleißig: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["fleißig"],
				[Vergleichsgrad.Komparativ]: ["fleißiger"],
				[Vergleichsgrad.Superlativ]: ["fleißigst"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
	],
};

const selbstbewusst = {
	selbstbewusst: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["selbstbewusst"],
				[Vergleichsgrad.Komparativ]: ["selbstbewusster"],
				[Vergleichsgrad.Superlativ]: ["selbstbewusstest"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
	],
};

const hoch = {
	hoch: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["hoch"],
				[Vergleichsgrad.Komparativ]: ["höher"],
				[Vergleichsgrad.Superlativ]: ["höchst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const langsam = {
	langsam: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["langsam"],
				[Vergleichsgrad.Komparativ]: ["langsamer"],
				[Vergleichsgrad.Superlativ]: ["langsamst"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
	],
};

const fromm = {
	fromm: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["fromm"],
				[Vergleichsgrad.Komparativ]: ["frommer"],
				[Vergleichsgrad.Superlativ]: ["frommst"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["fromm"],
				[Vergleichsgrad.Komparativ]: ["frömmer"],
				[Vergleichsgrad.Superlativ]: ["frömmst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const glatt = {
	glatt: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["glatt"],
				[Vergleichsgrad.Komparativ]: ["glatter"],
				[Vergleichsgrad.Superlativ]: ["glattst"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["glatt"],
				[Vergleichsgrad.Komparativ]: ["glätter"],
				[Vergleichsgrad.Superlativ]: ["glättst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const arg = {
	arg: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["arg"],
				[Vergleichsgrad.Komparativ]: ["ärger"],
				[Vergleichsgrad.Superlativ]: ["ärgst"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
	],
};

const bange = {
	bange: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["bange"],
				[Vergleichsgrad.Komparativ]: ["banger"],
				[Vergleichsgrad.Superlativ]: ["bangst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["bange"],
				[Vergleichsgrad.Komparativ]: ["bänger"],
				[Vergleichsgrad.Superlativ]: ["bängst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const blass = {
	blass: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["blass"],
				[Vergleichsgrad.Komparativ]: ["blasser"],
				[Vergleichsgrad.Superlativ]: ["blassest"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["blass"],
				[Vergleichsgrad.Komparativ]: ["blässer"],
				[Vergleichsgrad.Superlativ]: ["blässest"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const dumm = {
	dumm: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["dumm"],
				[Vergleichsgrad.Komparativ]: ["dümmer"],
				[Vergleichsgrad.Superlativ]: ["dümmst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const gesund = {
	gesund: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["gesund"],
				[Vergleichsgrad.Komparativ]: ["gesunder"],
				[Vergleichsgrad.Superlativ]: ["gesundest"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["gesund"],
				[Vergleichsgrad.Komparativ]: ["gesünder"],
				[Vergleichsgrad.Superlativ]: ["gesündest"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const grob = {
	grob: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["grob"],
				[Vergleichsgrad.Komparativ]: ["gröber"],
				[Vergleichsgrad.Superlativ]: ["gröbst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const karg = {
	karg: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["karg"],
				[Vergleichsgrad.Komparativ]: ["karger"],
				[Vergleichsgrad.Superlativ]: ["kargst"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["karg"],
				[Vergleichsgrad.Komparativ]: ["kärger"],
				[Vergleichsgrad.Superlativ]: ["kärgst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const klug = {
	klug: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["klug"],
				[Vergleichsgrad.Komparativ]: ["klüger"],
				[Vergleichsgrad.Superlativ]: ["klügst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const krank = {
	krank: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["krank"],
				[Vergleichsgrad.Komparativ]: ["kränker"],
				[Vergleichsgrad.Superlativ]: ["kränkst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const nah = {
	nah: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["nah"],
				[Vergleichsgrad.Komparativ]: ["näher"],
				[Vergleichsgrad.Superlativ]: ["nächst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const nass = {
	nass: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["nass"],
				[Vergleichsgrad.Komparativ]: ["nasser"],
				[Vergleichsgrad.Superlativ]: ["nassest"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["nass"],
				[Vergleichsgrad.Komparativ]: ["nässer"],
				[Vergleichsgrad.Superlativ]: ["nässest"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const schmal = {
	schmal: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["schmal"],
				[Vergleichsgrad.Komparativ]: ["schmaler"],
				[Vergleichsgrad.Superlativ]: ["schmalst"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["schmal"],
				[Vergleichsgrad.Komparativ]: ["schmäler"],
				[Vergleichsgrad.Superlativ]: ["schmälst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const schön = {
	schön: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["schön"],
				[Vergleichsgrad.Komparativ]: ["schöner"],
				[Vergleichsgrad.Superlativ]: ["schönst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const schwarz = {
	schwarz: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["schwarz"],
				[Vergleichsgrad.Komparativ]: ["schwärzer"],
				[Vergleichsgrad.Superlativ]: ["schwärzest"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const teuer = {
	teu: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["teu"],
				[Vergleichsgrad.Komparativ]: ["teurer"],
				[Vergleichsgrad.Superlativ]: ["teuerst"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
	],
};

const viel = {
	viel: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["viel"],
				[Vergleichsgrad.Komparativ]: ["mehrer"],
				[Vergleichsgrad.Superlativ]: ["meist"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const wenig = {
	wenig: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["wenig"],
				[Vergleichsgrad.Komparativ]: ["weniger"],
				[Vergleichsgrad.Superlativ]: ["wenigst"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["wenig"],
				[Vergleichsgrad.Komparativ]: ["minder"],
				[Vergleichsgrad.Superlativ]: ["mindest"],
			},
			regelmaessig: false,
			steigerungsfaehig: true,
		},
	],
};

const wild = {
	wild: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["wild"],
				[Vergleichsgrad.Komparativ]: ["wilder"],
				[Vergleichsgrad.Superlativ]: ["wildest"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
	],
};

const sauer = {
	sauer: [
		{
			adjektivstaemme: {
				[Vergleichsgrad.Positiv]: ["sauer"],
				[Vergleichsgrad.Komparativ]: ["saurer", "sauerer"],
				[Vergleichsgrad.Superlativ]: ["saurste", "sauerste"],
			},
			regelmaessig: true,
			steigerungsfaehig: true,
		},
	],
};

export const tests = {
	...arg,
	...sauer,
	...bange,
	...blass,
	...dumm,
	...gesund,
	...grob,
	...karg,
	...klug,
	...krank,
	...nah,
	...nass,
	...schmal,
	...schön,
	...schwarz,
	...teuer,
	...viel,
	...wenig,
	...wild,
	...gut,
	...gross,
	...klein,
	...aussehend,
	...tot,
	...fleissig,
	...selbstbewusst,
	...hoch,
	...langsam,
	...fromm,
	...glatt,
};
