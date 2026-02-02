const _valence = [
	{
		arguments: [
			{
				case: "NOM",
				function: "subject",
				role: "AGENT",
				surface: "wir",
			},
			{
				case: "mit+DAT",
				function: "prep object (question)",
				role: "INSTRUMENT",
				surface: "womit",
			},
		],
		separablePrefix: null,
		verb: "heizen",
		// voice: 'Active',
		// mood: 'Interrogative',
		// verbForm: 'Infinitive (werden + heizen)',
		// auxiliaries: ['werden']
	},
	{
		arguments: [
			{
				case: "NOM",
				function: "subject",
				role: "AGENT",
				surface: null, // imperative = subject is implicit
			},
			{
				case: "ACC",
				function: "object of preposition",
				preposition: "auf",
				role: "THEME",
				surface: "dich",
			},
		],
		separablePrefix: "auf",
		verb: "aufpassen",
		// voice: 'Active',
		// mood: 'Imperative',
		// verbForm: 'Finite',
	},
];
