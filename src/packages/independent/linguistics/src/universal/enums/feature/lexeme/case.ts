import { z } from "zod/v3";

const caseValues = [
	"Abe",
	"Ben",
	"Cau",
	"Cmp",
	"Cns",
	"Com",
	"Dat",
	"Dis",
	"Equ",
	"Gen",
	"Ins",
	"Par",
	"Tem",
	"Abl",
	"Add",
	"Ade",
	"All",
	"Del",
	"Ela",
	"Ess",
	"Ill",
	"Ine",
	"Lat",
	"Loc",
	"Per",
	"Sbe",
	"Sbl",
	"Spl",
	"Sub",
	"Sup",
	"Ter",
] as const;

// Source: https://universaldependencies.org/u/feat/Case.html
export const Case = z.enum(caseValues);
export type Case = z.infer<typeof Case>;

const caseRepr = {
	Abe: "abessive / caritive / privative",
	Abl: "ablative / adelative",
	Add: "additive",
	Ade: "adessive",
	All: "allative / adlative",
	Ben: "benefactive / destinative",
	Cau: "causative / motivative / purposive",
	Cmp: "comparative",
	Cns: "considerative",
	Com: "comitative / associative",
	Dat: "dative",
	Del: "delative / superelative",
	Dis: "distributive",
	Ela: "elative / inelative",
	Equ: "equative",
	Ess: "essive / prolative",
	Gen: "genitive",
	Ill: "illative / inlative",
	Ine: "inessive",
	Ins: "instrumental / instructive",
	Lat: "lative / directional allative",
	Loc: "locative",
	Par: "partitive",
	Per: "perlative",
	Sbe: "subelative",
	Sbl: "sublative",
	Spl: "superlative",
	Sub: "subessive",
	Sup: "superessive",
	Tem: "temporal",
	Ter: "terminative / terminal allative",
} satisfies Record<Case, string>;

export function reprForCase(caseValue: Case) {
	return caseRepr[caseValue];
}
