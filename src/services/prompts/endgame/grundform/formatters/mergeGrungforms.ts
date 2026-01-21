import { type Grundform, Wortart } from "../../zod/types";

function keyFromGrundform<G extends Grundform>(g: G) {
	if (g.wortart === Wortart.Nomen) {
		return `${g.wortart}-${g.genus}`;
	}
	return `${g.wortart}`;
}

export function mergeGrundforms<G extends Grundform>(grundforms: G[]): G[] {
	const merged: G[] = [];

	const m = new Map(
		grundforms.map((g) => [
			keyFromGrundform(g),
			{ ...g, emojiBeschreibungs: [] as string[] },
		]),
	);
	for (const g of grundforms) {
		const k = keyFromGrundform(g);
		if (g.wortart === Wortart.Adverb) {
			if (m.has(`${Wortart.Adjektiv}-`)) {
				continue;
			}
		}
		const a = m.get(k);
		if (a) {
			m.set(k, {
				...a,
				emojiBeschreibungs: [
					...a.emojiBeschreibungs,
					...g.emojiBeschreibungs,
				],
			});
		}
	}

	for (const v of m.values()) {
		merged.push(v);
	}

	return merged;
}
