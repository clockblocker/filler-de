import { err, ok, type Result } from "neverthrow";
import z from "zod";
import { CUSTOM_ERROR_CODE } from "../../librarin-shared/types/literals";

type ZodIssue = z.core.$ZodIssue;

const NamingErrorSchema = z.enum(["EmptyNodeName", "DelimiterInNodeName"]);

export type NamingError = z.infer<typeof NamingErrorSchema>;
export const NamingError = NamingErrorSchema.enum;

export const makeTryParseStringAs =
	<T, E extends string = string>(
		schema: z.ZodType<T>,
		opts?: {
			label?: string;
			unknownIssuesToError?: (issues: ZodIssue[]) => E;
		},
	) =>
	(input: string): Result<T, E> => {
		const res = schema.safeParse(input);
		if (res.success) return ok(res.data);

		const issues = res.error.issues;

		const custom = issues.find((i) => i.code === CUSTOM_ERROR_CODE);
		if (custom) return err(custom.message as E);

		if (opts?.unknownIssuesToError) {
			return err(opts.unknownIssuesToError(issues));
		}

		const msg = issues.map((i) => i.message).join("; ");
		const label = opts?.label ?? "value";
		return err(`Invalid ${label}: "${input}". ${msg}` as E);
	};
