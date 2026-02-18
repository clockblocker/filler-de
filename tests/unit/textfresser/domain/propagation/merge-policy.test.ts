import { describe, expect, it } from "bun:test";
import { applySectionMutation } from "../../../../../src/commanders/textfresser/domain/propagation/merge-policy";

describe("applySectionMutation", () => {
	it("Relation/addRelation uses semantic set-union dedupe", () => {
		const result = applySectionMutation({
			mutation: {
				op: "addRelation",
				relationKind: " synonym ",
				sectionKind: "Relation",
				targetLemma: " haus ",
				targetWikilink: "[[Haus]]",
			},
			section: {
				items: [
					{
						relationKind: "Synonym",
						targetLemma: "Haus",
						targetWikilink: "[[Haus-alt]]",
					},
				],
				kind: "Relation",
			},
		});

		expect(result.changed).toBe(false);
		expect(result.section.items).toHaveLength(1);
	});

	it("Morphology/addBacklink dedupes by relation type plus target", () => {
		const result = applySectionMutation({
			mutation: {
				backlinkWikilink: " [[wurzel]] ",
				op: "addBacklink",
				relationType: "derived_from",
				sectionKind: "Morphology",
			},
			section: {
				backlinks: [
					{
						relationType: "derived_from",
						value: "[[Wurzel]]",
					},
				],
				equations: [],
				kind: "Morphology",
			},
		});

		expect(result.changed).toBe(false);
		expect(result.section.backlinks).toHaveLength(1);
	});

	it("Morphology/addEquation dedupes by normalized equation signature", () => {
		const unchangedResult = applySectionMutation({
			mutation: {
				lhsParts: [" haus ", "boot"],
				op: "addEquation",
				rhs: " hausboot ",
				sectionKind: "Morphology",
			},
			section: {
				backlinks: [],
				equations: [
					{
						lhsParts: ["Haus", "Boot"],
						rhs: "Hausboot",
					},
				],
				kind: "Morphology",
			},
		});

		const changedResult = applySectionMutation({
			mutation: {
				lhsParts: ["Boot", "Haus"],
				op: "addEquation",
				rhs: "Boothaus",
				sectionKind: "Morphology",
			},
			section: unchangedResult.section,
		});

		expect(unchangedResult.changed).toBe(false);
		expect(changedResult.changed).toBe(true);
		expect(changedResult.section.equations).toHaveLength(2);
	});

	it("Inflection/upsertInflection upserts by form and merges normalized tags", () => {
		const updated = applySectionMutation({
			mutation: {
				headerTemplate: " präteritum ",
				op: "upsertInflection",
				sectionKind: "Inflection",
				tags: ["#simple", "#Perfect"],
			},
			section: {
				items: [
					{
						form: "Präteritum",
						tags: ["#past", "#simple"],
					},
				],
				kind: "Inflection",
			},
		});

		const inserted = applySectionMutation({
			mutation: {
				headerTemplate: " Perfekt ",
				op: "upsertInflection",
				sectionKind: "Inflection",
				tags: ["#perfect"],
			},
			section: updated.section,
		});

		expect(updated.changed).toBe(true);
		expect(updated.section.items[0]?.tags).toEqual([
			"#past",
			"#simple",
			"#perfect",
		]);
		expect(inserted.changed).toBe(true);
		expect(inserted.section.items).toHaveLength(2);
		expect(inserted.section.items[1]?.form).toBe("Perfekt");
	});

	it("Tags/addTags dedupes normalized tag tokens", () => {
		const unchanged = applySectionMutation({
			mutation: {
				op: "addTags",
				sectionKind: "Tags",
				tags: [" #Akkusativ/Plural "],
			},
			section: {
				kind: "Tags",
				tags: ["#akkusativ/plural"],
			},
		});

		const changed = applySectionMutation({
			mutation: {
				op: "addTags",
				sectionKind: "Tags",
				tags: ["#Genitiv/Plural"],
			},
			section: unchanged.section,
		});

		expect(unchanged.changed).toBe(false);
		expect(changed.changed).toBe(true);
		expect(changed.section.tags).toEqual([
			"#akkusativ/plural",
			"#genitiv/plural",
		]);
	});
});
