import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_PROPERTY_KEYS, PropertyKeys, validatePropertyKey } from '../contract/frontmatter';
import { RedirectsPluginData, ToggleKey } from '../data/plugin-data';

export interface SettingsTabHost {
	getData(): RedirectsPluginData;
	saveData(data: RedirectsPluginData): Promise<void>;
}

export class RedirectsSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private host: SettingsTabHost,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Frontmatter properties').setHeading();

		this.addPropertyKeySetting(
			containerEl,
			'Redirect target property',
			'On a redirect stub, the property holding a single wikilink to the canonical note.',
			'redirectTo',
			'redirectsFrom',
		);
		this.addPropertyKeySetting(
			containerEl,
			'Reciprocal list property',
			'On a canonical note, the property listing the stubs that redirect to it.',
			'redirectsFrom',
			'redirectTo',
		);

		new Setting(containerEl).setName('Behavior').setHeading();

		new Setting(containerEl)
			.setName('Promotable link threshold')
			.setDesc(
				'Minimum number of distinct notes that must reference the same unresolved link before it is surfaced as promotable (issue #6).',
			)
			.addText((text) =>
				text.setValue(String(this.host.getData().promotableThreshold)).onChange((value) => {
					const parsed = Number.parseInt(value, 10);
					if (!Number.isFinite(parsed) || parsed < 1) return;
					void this.host.saveData({ ...this.host.getData(), promotableThreshold: parsed });
				}),
			);

		new Setting(containerEl)
			.setName('Auto-sync missing reciprocal declarations')
			.setDesc(
				'Add a missing reciprocal entry automatically after every save. Turn this off to leave it for the health report\'s "Fix" action or the "Repair a reciprocal redirect declaration" command instead.',
			)
			.addToggle((toggle) =>
				toggle.setValue(this.host.getData().autoSyncReciprocals).onChange((value) => {
					void this.host.saveData({ ...this.host.getData(), autoSyncReciprocals: value });
				}),
			);

		new Setting(containerEl).setName('Two-way sync and aliases').setHeading();

		this.addToggle(
			containerEl,
			'Sync redirect target from the reciprocal list',
			'When a canonical note lists a note in its reciprocal list property, give that note a redirect target pointing back — but only if it has none and no body content. Never overwrites an existing one. Applies from the next save of any note.',
			'autoSyncRedirectsTo',
		);
		this.addToggle(
			containerEl,
			'Add stub names as aliases on the canonical note',
			'Add each stub\'s name to its canonical note\'s aliases.',
			'aliasStubOnCanonical',
		);
		this.addToggle(
			containerEl,
			'Add the canonical name as an alias on each stub',
			'Add the canonical note\'s name to each stub\'s aliases.',
			'aliasCanonicalOnStub',
		);
		this.addToggle(
			containerEl,
			'Add swallowed terms as aliases',
			'Add every term in a note\'s swallows list to that note\'s own aliases.',
			'aliasSwallowedTerms',
		);

		new Setting(containerEl)
			.setName('Ignored folders')
			.setDesc(
				'One vault-relative folder per line, excluded from the promotable-links and swallow-claim scans.',
			)
			.addTextArea((text) =>
				text.setValue(this.host.getData().ignoredFolders.join('\n')).onChange((value) => {
					const folders = value
						.split('\n')
						.map((line) => line.trim())
						.filter(Boolean);
					void this.host.saveData({ ...this.host.getData(), ignoredFolders: folders });
				}),
			);
	}

	private addToggle(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		key: ToggleKey,
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle.setValue(this.host.getData()[key]).onChange((value) => {
					void this.host.saveData({ ...this.host.getData(), [key]: value });
				}),
			);
	}

	private addPropertyKeySetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		key: keyof PropertyKeys,
		otherKey: keyof PropertyKeys,
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(
				`${desc} Default: ${DEFAULT_PROPERTY_KEYS[key]}. Existing notes using a different name stop being recognized until you rename the property in them or here.`,
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_PROPERTY_KEYS[key])
					.setValue(this.host.getData().propertyKeys[key])
					.onChange((value) => {
						const data = this.host.getData();
						const valid = validatePropertyKey(value, data.propertyKeys[otherKey]);
						if (!valid || valid === data.propertyKeys[key]) return;
						void this.host.saveData({
							...data,
							propertyKeys: { ...data.propertyKeys, [key]: valid },
						});
					}),
			);
	}
}
