import { Plugin, TFile, debounce } from 'obsidian';
import {
	addDisambiguationCandidate,
	createRedirectStub,
	insertQualifiedLink,
	repairReciprocals,
} from './authoring/commands';
import { showHeadingCollisions } from './collision/router';
import { DEFAULT_PLUGIN_DATA, RedirectsPluginData, mergePluginData } from './data/plugin-data';
import { ObsidianVaultSource } from './obsidian-adapter';
import { DisambiguationRouter } from './navigation/disambiguation-router';
import { RedirectNavigator } from './navigation/navigator';
import { showPromotableLinks } from './promotable/router';
import { RedirectRegistry } from './registry/registry';
import { HealthReportModal } from './ui/health-modal';

const REBUILD_DEBOUNCE_MS = 500;

export default class RedirectsPlugin extends Plugin {
	registry?: RedirectRegistry;
	navigator?: RedirectNavigator;
	disambiguationRouter?: DisambiguationRouter;
	data: RedirectsPluginData = DEFAULT_PLUGIN_DATA;

	async onload(): Promise<void> {
		this.data = mergePluginData(await this.loadData());

		const source = new ObsidianVaultSource(this.app);
		this.navigator = new RedirectNavigator(this.app, () => this.registry);
		this.disambiguationRouter = new DisambiguationRouter(this.app, () => this.registry);

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

		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				void this.navigator?.handleFileOpen(file);
				this.disambiguationRouter?.handleFileOpen(file);
			}),
		);

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (!(file instanceof TFile)) return;

				if (this.registry?.getRedirect(file.path)) {
					menu.addItem((item) => {
						item
							.setTitle('Open without following redirect')
							.setIcon('corner-up-left')
							.onClick(() => {
								void this.navigator?.openBypassingRedirect(file.path);
							});
					});
				}

				if (this.registry?.getDisambiguation(file.path)) {
					menu.addItem((item) => {
						item
							.setTitle('Open without showing chooser')
							.setIcon('corner-up-left')
							.onClick(() => {
								void this.disambiguationRouter?.openBypassingChooser(file.path);
							});
					});
				}
			}),
		);

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

		this.addCommand({
			id: 'open-original-redirect-stub',
			name: 'Open original redirect stub',
			checkCallback: (checking) => {
				const stubPath = this.navigator?.getLastStubPath();
				if (!stubPath) return false;
				if (!checking) void this.navigator?.openBypassingRedirect(stubPath);
				return true;
			},
		});

		this.addCommand({
			id: 'create-redirect-stub',
			name: 'Create redirect stub',
			callback: () => void createRedirectStub(this.app),
		});

		this.addCommand({
			id: 'add-disambiguation-candidate',
			name: 'Add disambiguation candidate',
			callback: () => void addDisambiguationCandidate(this.app),
		});

		this.addCommand({
			id: 'repair-reciprocal-declaration',
			name: 'Repair a reciprocal redirect declaration',
			callback: () => void repairReciprocals(this.app, this.registry),
		});

		this.addCommand({
			id: 'insert-qualified-link',
			name: 'Insert path-qualified link to a note, heading, or block',
			editorCallback: (editor) => void insertQualifiedLink(this.app, editor),
		});

		this.addCommand({
			id: 'show-promotable-unresolved-links',
			name: 'Show promotable unresolved links',
			callback: () =>
				void showPromotableLinks(this.app, {
					getData: () => this.data,
					saveData: async (data) => {
						this.data = data;
						await this.saveData(data);
					},
				}),
		});

		this.addCommand({
			id: 'show-heading-note-collisions',
			name: 'Show heading / note collisions',
			callback: () =>
				void showHeadingCollisions(this.app, source, {
					getData: () => this.data,
					saveData: async (data) => {
						this.data = data;
						await this.saveData(data);
					},
				}),
		});
	}

	onunload(): void {}
}
