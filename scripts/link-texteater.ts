// Points `.texteater` at the texteater checkout whose battery packages the
// plugin type-checks, tests and bundles from source. tsconfig.json `paths`
// read the batteries through this link. Nothing is copied, and nothing is
// written inside texteater. Runs as `postinstall`, or as
// `bun run link:texteater` after moving the checkout.
//
// TEXTEATER_DIR overrides the location. Otherwise the link targets the nearest
// `texteater` or `textfresser-batteries` directory beside the plugin checkout
// or beside one of its ancestors, such as the vault folder.
import {
	existsSync,
	lstatSync,
	readFileSync,
	readlinkSync,
	symlinkSync,
	unlinkSync,
} from "node:fs";
import path from "node:path";

export const BATTERY_PACKAGES = [
	"common-utils",
	"dumling",
	"dumrel",
	"dumcorpus",
	"dumdict",
	"dumgen",
] as const;

const CHECKOUT_NAMES = ["texteater", "textfresser-batteries"] as const;

export const REPO_ROOT = path.resolve(import.meta.dir, "..");
export const TEXTEATER_LINK = path.join(REPO_ROOT, ".texteater");

function missingBatteries(checkout: string): string[] {
	return BATTERY_PACKAGES.filter((name) => {
		const manifestPath = path.join(
			checkout,
			"battery",
			name,
			"package.json",
		);
		if (!existsSync(manifestPath)) return true;
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
			name?: string;
		};
		return manifest.name !== name;
	});
}

function findSiblingCheckout(): string | undefined {
	let dir = path.dirname(REPO_ROOT);
	while (true) {
		for (const name of CHECKOUT_NAMES) {
			const candidate = path.join(dir, name);
			if (missingBatteries(candidate).length === 0) return candidate;
		}
		const parent = path.dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

function resolveCheckout(): string {
	const fromEnv = process.env.TEXTEATER_DIR;
	if (fromEnv) {
		const checkout = path.resolve(fromEnv);
		const missing = missingBatteries(checkout);
		if (missing.length > 0) {
			throw new Error(
				`TEXTEATER_DIR=${fromEnv} has no battery/{${missing.join(",")}}/package.json.`,
			);
		}
		return checkout;
	}
	const checkout = findSiblingCheckout();
	if (!checkout) {
		throw new Error(
			`No texteater checkout found. Clone clockblocker/texteater as "texteater" or "textfresser-batteries" next to this plugin or the vault that holds it, or set TEXTEATER_DIR.`,
		);
	}
	return checkout;
}

function linkTexteater(): void {
	const checkout = resolveCheckout();
	const existing = lstatSync(TEXTEATER_LINK, { throwIfNoEntry: false });
	if (existing) {
		if (!existing.isSymbolicLink()) {
			throw new Error(
				`${TEXTEATER_LINK} exists and is not a symlink; move it away first.`,
			);
		}
		if (path.resolve(REPO_ROOT, readlinkSync(TEXTEATER_LINK)) === checkout) {
			console.log(`[link-texteater] .texteater -> ${checkout}`);
			return;
		}
		unlinkSync(TEXTEATER_LINK);
	}
	symlinkSync(checkout, TEXTEATER_LINK, "dir");
	console.log(`[link-texteater] linked .texteater -> ${checkout}`);
}

if (import.meta.main) {
	try {
		linkTexteater();
	} catch (error) {
		console.error(
			`[link-texteater] ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}
