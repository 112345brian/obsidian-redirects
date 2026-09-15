import { Notice, Plugin } from 'obsidian';

/**
 * Redirects keeps redirect and disambiguation metadata explicit in note
 * frontmatter. Feature work is tracked in the repository issue plan.
 */
export default class RedirectsPlugin extends Plugin {
	onload(): void {
		this.addCommand({
			id: 'validate-redirects',
			name: 'Validate redirects',
			callback: () => {
				new Notice('Redirect validation is not implemented yet.');
			},
		});
	}
}
