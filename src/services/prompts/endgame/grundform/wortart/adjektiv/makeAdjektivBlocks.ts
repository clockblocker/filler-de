import type TextEaterPlugin from "main";
import type { TFile } from "obsidian";
import { makeTagChain, Tag } from "prompts/endgame/zod/consts";
import { adjektivOutputSchema } from "prompts/endgame/zod/schemas";
import {
	type AdjektivOutput,
	type Backlink,
	Block,
	type GrundformKerl,
	Match,
	Wortart,
} from "prompts/endgame/zod/types";
import { getPathsToNotes } from "../../formatters/link";
import { promtMakerFromKeyword } from "../endgamePromptMakers";
import {
	makeAllDeclensionsFromAdjektivstamm,
	makeReprSentenceForRoot,
} from "./formatter";
import {
	type AllDeclensions,
	type AllDeclensionsFromGrad,
	AllDeclensionsFromGradSchema,
	allDeclensionsFromGradKeys,
	allDeclensionsKeys,
	caseDeclensionKeys,
	declensionKeys,
	type PathFromWort,
	type PathFromWortFromGrad,
	PathFromWortFromGradSchema,
} from "./types-and-consts";

// export async function makeAdjektivBlock(
// 	plugin: TextEaterPlugin,
// 	file: TFile,
// 	word: string
// ): Promise<Block | null> {
// 	const prompt = promtMakerFromKeyword[Wortart.Adjektiv]();
// 	const generatedAdjektivOutput = await plugin.apiService.generateContent(
// 		prompt,
// 		word,
// 		true
// 	);
// 	const parsedAdjektivOutput = adjektivOutputSchema.safeParse(
// 		JSON.parse(generatedAdjektivOutput)
// 	);

// 	if (parsedAdjektivOutput.error) {
// 		console.error({
// 			zodError: parsedAdjektivOutput.error,
// 			output: generatedAdjektivOutput,
// 		});
// 		await plugin.deprecatedFileService.writeToOpenedFile(
// 			file.path,
// 			'Contact t.me/@clockblocker'
// 		);
// 		return null;
// 	}

// 	const adjektivOutput = parsedAdjektivOutput.data;

// 	const formSubblocks = await Promise.all(
// 		adjektivOutput.map((o) =>
// 			makeBlocksForAdjektivOutputElement(plugin, file, o)
// 		)
// 	);
// 	const backlinks = formSubblocks.map((s) => s.backlinks).flat();
// 	const adjektivOutputBlock = {
// 		repr: formSubblocks.map(({ repr }) => repr).join('\n\n'),
// 		backlinks: backlinks,
// 	};

// 	return adjektivOutputBlock;
// }

async function makeBlocksForAdjektivOutputElement(
	plugin: TextEaterPlugin,
	file: TFile,
	adjektivOutputElement: AdjektivOutput[-1],
) {
	const backlinksFromWord = await makebacklinksFromWord(
		plugin,
		file,
		adjektivOutputElement,
	);
	const pathFromWord: PathFromWort = {};

	const backlinksMap = new Map();
	Object.keys(backlinksFromWord).forEach((word) => {
		backlinksFromWord[word].forEach(({ path, tags }) => {
			pathFromWord[word] = path;
			if (!backlinksMap.has(path)) {
				backlinksMap.set(path, new Set([]));
			}
			tags?.forEach((tag) => {
				backlinksMap.get(path).add(tag);
			});
		});
	});

	const backlinks = [...backlinksMap.entries()].map(([path, tagSet]) => ({
		path,
		tags: [...tagSet],
	}));

	const repr = makeReprForAdjektivOutputElement(
		adjektivOutputElement,
		pathFromWord,
	);
	return { repr, backlinks };
}

const makeReprForAdjektivOutputElement = (
	adjektivOutputElement: AdjektivOutput[-1],
	pathFromWord: PathFromWort,
) => {
	return Object.values(adjektivOutputElement.adjektivstaemme)
		.map((staemme) =>
			staemme
				.map((word) => makeReprSentenceForRoot(word, pathFromWord))
				.join("\n\n"),
		)
		.join("\n");
};

type BacklinksFromWord = Record<string, Backlink[]>;

async function makebacklinksFromWord(
	plugin: TextEaterPlugin,
	file: TFile,
	adjektivOutputElement: AdjektivOutput[-1],
) {
	const { allDeclensionsFromGrad, pathFromWortFromGrad, error } =
		await makeDeclensionsMaps(plugin, file, adjektivOutputElement);

	if (error) {
		return {} as BacklinksFromWord;
	}

	const backlinksFromWord: BacklinksFromWord = {};

	for (const grad of allDeclensionsFromGradKeys) {
		const allDeclensions = allDeclensionsFromGrad?.[grad];
		if (!allDeclensions) {
			continue;
		}

		const pathFromWort = pathFromWortFromGrad?.[grad];
		if (!pathFromWort) {
			continue;
		}

		for (const art of allDeclensionsKeys) {
			const i = allDeclensions[art];
			if (i === undefined) {
				continue;
			}

			for (const kasus of declensionKeys) {
				const ii = i[kasus];
				if (ii === undefined) {
					continue;
				}

				for (const caseDec of caseDeclensionKeys) {
					const roots = ii[caseDec];
					roots.forEach(({ agj }) => {
						const existingBacklinks = backlinksFromWord[agj] || [];

						if (pathFromWort) {
							const path = pathFromWort[agj];
							const tags = [
								makeTagChain([
									Wortart.Adjektiv,
									Match.Flexion,
									adjektivOutputElement.steigerungsfaehig
										? Tag.Steigerungsfaehig
										: Tag.Unsteigerungsfaehig,
									adjektivOutputElement.regelmaessig
										? Tag.Regelmaessig
										: Tag.Unregelmaessig,
									grad,
									art,
								]),
							];
							backlinksFromWord[agj] = [
								...existingBacklinks,
								{ path, tags: tags },
							];
						}
					});
				}
			}
		}
	}

	return backlinksFromWord;
}

function getAllDeclensionsFromGrad(adjektivOutputElement: AdjektivOutput[-1]) {
	const adjektivstaemmeFromGrad = adjektivOutputElement.adjektivstaemme;

	const unsafeAllDeclensionsFromGrad: any = {};

	for (const grad of allDeclensionsFromGradKeys) {
		const roots =
			adjektivstaemmeFromGrad[
				grad as keyof typeof adjektivstaemmeFromGrad
			];
		if (roots) {
			const declensions = makeAllDeclensionsFromAdjektivstamm(roots);
			unsafeAllDeclensionsFromGrad[grad] = declensions;
		}
	}

	const parsedAllDeclensions = AllDeclensionsFromGradSchema.safeParse(
		unsafeAllDeclensionsFromGrad,
	);

	if (parsedAllDeclensions.error) {
		console.error(parsedAllDeclensions.error);
		return undefined;
	}

	return parsedAllDeclensions.data;
}

async function makeDeclensionsMaps(
	plugin: TextEaterPlugin,
	file: TFile,
	adjektivOutputElement: AdjektivOutput[-1],
): Promise<
	| {
			allDeclensionsFromGrad: undefined;
			pathFromWortFromGrad: undefined;
			error: true;
	  }
	| {
			allDeclensionsFromGrad: AllDeclensionsFromGrad;
			pathFromWortFromGrad: PathFromWortFromGrad;
			error: false;
	  }
> {
	const allDeclensionsFromGrad = getAllDeclensionsFromGrad(
		adjektivOutputElement,
	);
	if (allDeclensionsFromGrad === undefined) {
		return {
			allDeclensionsFromGrad: undefined,
			pathFromWortFromGrad: undefined,
			error: true,
		};
	}

	const promiseArray = allDeclensionsFromGradKeys.map(async (grad) => {
		const declensions = allDeclensionsFromGrad[grad];
		if (!declensions) {
			return [grad, undefined] as const;
		}

		const path = await makePathFromWordFromAllDeclensions(
			plugin,
			file,
			declensions,
		);
		return [grad, path] as const;
	});

	const results = await Promise.all(promiseArray);

	const unsafePathFromWortFromGrad: any = {};
	for (const [grad, path] of results) {
		unsafePathFromWortFromGrad[grad] = path;
	}

	const parsedPathFromWortFromGrad = PathFromWortFromGradSchema.safeParse(
		unsafePathFromWortFromGrad,
	);

	if (parsedPathFromWortFromGrad.error) {
		console.error(parsedPathFromWortFromGrad.error);
		return {
			allDeclensionsFromGrad: undefined,
			pathFromWortFromGrad: undefined,
			error: true,
		};
	}

	return {
		allDeclensionsFromGrad,
		pathFromWortFromGrad: parsedPathFromWortFromGrad.data,
		error: false,
	};
}

async function makePathFromWordFromAllDeclensions(
	plugin: TextEaterPlugin,
	file: TFile,
	declensions: AllDeclensions,
) {
	const agjSet = new Set<string>();

	Object.values(declensions).forEach((declension) => {
		Object.values(declension).forEach((caseDeclension) => {
			Object.values(caseDeclension).forEach((root) => {
				root.forEach(({ agj }) => {
					agjSet.add(agj);
				});
			});
		});
	});

	const kerls = [...agjSet].map((grundform) => ({
		grundform,
		wortart: Wortart.Adjektiv,
		match: Match.Flexion,
	}));

	const paths = await getPathsToNotes(
		plugin,
		file,
		kerls as (GrundformKerl & { match: Match })[],
	);

	const pathFromWort = Object.fromEntries(
		kerls.map((k, i) => [k.grundform, paths[i]]),
	) as Record<string, string>;

	return pathFromWort;
}
