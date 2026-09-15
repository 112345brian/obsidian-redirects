import { Plugin, debounce } from 'obsidian';
import { ObsidianVaultSource } from './obsidian-adapter';
import { RedirectRegistry } from './registry/registry';
import { HealthReportModal } from './ui/health-modal';

const REBUILD_DEBOUNCE_MS = 500;

export default class RedirectsPlugin extends Plugin {
	registry?: RedirectRegistry;

	onload(): void {
		const source = new ObsidianVaultSource(this.app);

		const rebuild = debounce(
			() => this.registry?.rebuild(source),
			REBUILD_DEBOUNCE_MS,
			true,
		);

		// Obsidian's metadata cache is still being populated while the vault
		// opens; building the registry before then would read incomplete
		// frontmatter/headings and report spurious broken targets. Deferring
		// the first build here also keeps it off onload's critical path.
		this.app.workspace.onLayoutReady(() => {
			this.registry = new RedirectRegistry(source);
		});

		// Metadata cache events cover create/edit/delete of frontmatter-bearing
		// files; rename events don't fire 'changed' on their own so they're
		// registered separately.
		this.registerEvent(this.app.metadataCache.on('changed', rebuild));
		this.registerEvent(this.app.metadataCache.on('deleted', rebuild));
		this.registerEvent(this.app.vault.on('rename', rebuild));
		this.register(() => rebuild.cancel());

		this.addCommand({
			id: 'show-redirect-health-report',
			name: 'Show redirect health report',
			callback: () => {
				new HealthReportModal(
					this.app,
					() => this.registry?.getHealthReport() ?? [],
				).open();
			},
		});
	}

	onunload(): void {}
}
