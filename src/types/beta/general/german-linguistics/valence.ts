const valence = [
	{
		verb: 'heizen',
		separablePrefix: null,
		arguments: [
			{
				role: 'AGENT',
				surface: 'wir',
				function: 'subject',
				case: 'NOM',
			},
			{
				role: 'INSTRUMENT',
				surface: 'womit',
				function: 'prep object (question)',
				case: 'mit+DAT',
			},
		],
		// voice: 'Active',
		// mood: 'Interrogative',
		// verbForm: 'Infinitive (werden + heizen)',
		// auxiliaries: ['werden']
	},
	{
		verb: 'aufpassen',
		separablePrefix: 'auf',
		arguments: [
			{
				role: 'AGENT',
				surface: null, // imperative = subject is implicit
				function: 'subject',
				case: 'NOM',
			},
			{
				role: 'THEME',
				surface: 'dich',
				function: 'object of preposition',
				case: 'ACC',
				preposition: 'auf',
			},
		],
		// voice: 'Active',
		// mood: 'Imperative',
		// verbForm: 'Finite',
	},
];
