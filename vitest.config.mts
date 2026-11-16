import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Agent worktrees under .claude/ hold copies of the whole repo.
		exclude: ['**/node_modules/**', '.claude/**'],
	},
	resolve: {
		alias: {
			obsidian: new URL('./src/test-support/obsidian-stub.ts', import.meta.url).pathname,
		},
	},
});
