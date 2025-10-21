import { readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { LOG_DIR } from '../consts';

const clearTestLogs = () => {
	const files = readdirSync(LOG_DIR);
	for (const file of files) {
		unlinkSync(join(LOG_DIR, file));
	}
};

clearTestLogs();
