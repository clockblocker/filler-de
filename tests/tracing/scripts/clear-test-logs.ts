import { readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { LOG_DIR } from '../consts';

const clearTestLogs = () => {
	const entries = readdirSync(LOG_DIR);
	for (const entry of entries) {
		rmSync(join(LOG_DIR, entry), { recursive: true });
	}
};

clearTestLogs();
