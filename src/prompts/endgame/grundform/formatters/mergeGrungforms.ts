import { Grundform, Wortart } from "prompts/endgame/zod/types";

function keyFromGrundform<G extends Grundform>(g: G) {
    return `${g.wortart}-${(g as any)?.genus || ""}`;
}

export function mergeGrundforms<G extends Grundform>(grundforms: G[]): G[] {
    const merged: G[] = [];

    const m = new Map(grundforms.map(g => [keyFromGrundform(g), {...g, emojiBeschreibungs: [] as string[]}]));
    for (let g of grundforms) {
        const k = keyFromGrundform(g);
        if (g.wortart === Wortart.PartizipialesAdjektiv) {
            if (m.has(`${Wortart.Verb}-`)) {
                continue;
            }
        } else if (g.wortart === Wortart.Adverb) {
            if (m.has(`${Wortart.Adjektiv}-`)) {
                continue;
            }
        }
        const a = m.get(k);
        if (a) {
            m.set(k, {...a, emojiBeschreibungs: [...a.emojiBeschreibungs, ...g.emojiBeschreibungs]})
        }
    }

    for (let v of m.values()) {
        merged.push(v);
    }

    return merged;
};
