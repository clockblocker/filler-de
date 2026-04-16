import z from "zod/v3";

type SurfaceSchemaLeaf = z.ZodTypeAny;

type SurfaceSchemaByLemmaKind = Record<
	string,
	Record<string, SurfaceSchemaLeaf>
>;

type SurfaceSchemaBySurfaceKind = Record<string, SurfaceSchemaByLemmaKind>;

type SurfaceSchemaLanguageLike = Record<string, SurfaceSchemaBySurfaceKind>;

type ResolvedTargetFor<T> = Extract<T, { lemmaKind: unknown }>;

type ResolvedSurfaceValueFor<T> = T extends { target: infer Target }
	? [ResolvedTargetFor<Target>] extends [never]
		? never
		: Omit<T, "target"> & {
				target: ResolvedTargetFor<Target>;
			}
	: never;

type ResolvedSurfaceSchemaFor<T extends SurfaceSchemaLeaf> = z.ZodType<
	ResolvedSurfaceValueFor<z.infer<T>>,
	z.ZodTypeDef,
	z.input<T>
>;

type ResolvedSurfaceSchemaLanguageFor<T extends SurfaceSchemaLanguageLike> = {
	[OS in keyof T]: {
		[SK in keyof T[OS]]: {
			[LK in keyof T[OS][SK]]: {
				[D in keyof T[OS][SK][LK]]: ResolvedSurfaceSchemaFor<
					T[OS][SK][LK][D]
				>;
			};
		};
	};
};

export function buildResolvedSurfaceSchemaForLanguage<
	const T extends SurfaceSchemaLanguageLike,
>(surfaceSchema: T): ResolvedSurfaceSchemaLanguageFor<T> {
	return Object.fromEntries(
		Object.entries(surfaceSchema).map(
			([orthographicStatus, surfaceKinds]) => [
				orthographicStatus,
				Object.fromEntries(
					Object.entries(surfaceKinds).map(
						([surfaceKind, lemmaKinds]) => [
							surfaceKind,
							Object.fromEntries(
								Object.entries(lemmaKinds).map(
									([lemmaKind, discriminators]) => [
										lemmaKind,
										Object.fromEntries(
											Object.entries(discriminators).map(
												([discriminator, schema]) => [
													discriminator,
													buildResolvedSurfaceSchema(
														schema,
													),
												],
											),
										),
									],
								),
							),
						],
					),
				),
			],
		),
	) as ResolvedSurfaceSchemaLanguageFor<T>;
}

function buildResolvedSurfaceSchema<T extends SurfaceSchemaLeaf>(
	schema: T,
): ResolvedSurfaceSchemaFor<T> {
	return schema.superRefine((value, ctx) => {
		if (!hasResolvedSurfaceTarget(value)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Resolved surfaces require a full lemma target",
				path: ["target"],
			});
		}
	}) as unknown as ResolvedSurfaceSchemaFor<T>;
}

function hasResolvedSurfaceTarget(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		"target" in value &&
		typeof (value as { target: unknown }).target === "object" &&
		(value as { target: object | null }).target !== null &&
		"lemmaKind" in ((value as { target: object }).target as object)
	);
}
