import { z } from "zod/v3";

const personValues = ["0", "1", "2", "3", "4"] as const;

// Source: https://universaldependencies.org/u/feat/Person.html
export const Person = z.enum(personValues);
export type Person = z.infer<typeof Person>;

const reprForPerson = {
	"0": "zero person",
	"1": "first person",
	"2": "second person",
	"3": "third person",
	"4": "fourth person",
} satisfies Record<Person, string>;

export function getReprForPerson(person: Person) {
	return reprForPerson[person];
}
