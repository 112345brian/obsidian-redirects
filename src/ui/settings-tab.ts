import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { RedirectsPluginData } from '../data/plugin-data';

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
}
