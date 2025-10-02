// eslint.config.js
import { defineConfig } from 'eslint/config';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig([
	{
		files: ['**/*.ts', '**/*.tsx'],
		ignores: ['**/*.md'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
			// Add the Prettier plugin here
			prettier: prettierPlugin,
		},
		// Extend the Prettier config to disable conflicting ESLint rules
		extends: [prettierConfig],
		rules: {
			semi: 'error',
			'prefer-const': 'error',
			// Run Prettier as an ESLint rule and report issues as errors
			'prettier/prettier': 'error',
		},
	},
]);
