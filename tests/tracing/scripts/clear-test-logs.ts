import { mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { LOG_DIR } from '../consts';

const clearTestLogs = () => {
	// The directory is gitignored, so a fresh checkout lacks it.
	mkdirSync(LOG_DIR, { recursive: true });
	const entries = readdirSync(LOG_DIR);
	for (const entry of entries) {
		rmSync(join(LOG_DIR, entry), { recursive: true });
	}
};

clearTestLogs();
