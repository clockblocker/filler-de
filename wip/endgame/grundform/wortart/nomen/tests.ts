const Mann = {
	Mann: [
		{
			g: 'maskulin',
			r: 'regelmäßig',
			emoji: '👨',
			Singular: [
				{
					N: ['Mann'],
					G: ['Mannes', 'Manns'],
					D: ['Mann', 'Manne'],
				},
			],
			Plural: [
				{
					N: ['Mannen'],
					G: ['Mannen'],
					D: ['Mannen'],
				},
			],
		},
		{
			g: 'maskulin',
			r: 'unregelmäßig',
			emoji: '👨',
			Singular: [
				{
					N: ['Mann'],
					G: ['Mannes', 'Manns'],
					D: ['Mann', 'Manne'],
				},
			],
			Plural: [
				{
					N: ['Männer'],
					G: ['Männer'],
					D: ['Männern'],
				},
			],
		},
		{
			g: 'maskulin',
			r: 'unregelmäßig',
			emoji: '🧑‍🤝‍🧑',
			Singular: [
				{
					N: ['Mann'],
					G: ['Manns'],
					D: ['Mann'],
				},
			],
			Plural: [
				{
					N: ['Leute'],
					G: ['Leute'],
					D: ['Leuten'],
				},
			],
		},
	],
};

export const tests = {
	...Mann,
};
