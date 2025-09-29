import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	test: {
		environment: 'node',
		setupFiles: ['test/setup.ts'],
		include: ['tests/**/*.test.ts'],
	},
	resolve: {
		alias: {
			utils: fileURLToPath(new URL('./src/utils.ts', import.meta.url)),
		},
	},
});
