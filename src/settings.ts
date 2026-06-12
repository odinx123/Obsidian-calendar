import { App, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_CALENDAR_ROOT, DEFAULT_CATEGORY_COLORS } from './constants';
import type CalendarPlannerPlugin from './main';
import type { CalendarPlannerSettings, WeekStartsOn } from './types';

export const DEFAULT_SETTINGS: CalendarPlannerSettings = {
	calendarRoot: DEFAULT_CALENDAR_ROOT,
	weekStartsOn: 'sunday',
	timelineStartHour: 8,
	timelineEndHour: 22,
	categories: DEFAULT_CATEGORY_COLORS,
};

export class CalendarPlannerSettingTab extends PluginSettingTab {
	plugin: CalendarPlannerPlugin;

	constructor(app: App, plugin: CalendarPlannerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl).setName('Calendar data').setHeading();

		new Setting(containerEl)
			.setName('Calendar folder')
			.setDesc('Root folder used for calendar events, tasks, and daily files.')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_CALENDAR_ROOT)
					.setValue(this.plugin.settings.calendarRoot)
					.onChange(async (value) => {
						this.plugin.settings.calendarRoot = normalizeFolder(value);
						await this.plugin.saveSettings();
						await this.plugin.repository.ensureCalendarStructure();
					}),
			);

		new Setting(containerEl)
			.setName('Week starts on')
			.setDesc('Controls how month grids and weekly focus are calculated.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('sunday', 'Sunday')
					.addOption('monday', 'Monday')
					.setValue(this.plugin.settings.weekStartsOn)
					.onChange(async (value) => {
						this.plugin.settings.weekStartsOn = value as WeekStartsOn;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Timeline start hour')
			.setDesc('Hour shown at the top of the daily timeline.')
			.addText((text) =>
				text
					.setPlaceholder('8')
					.setValue(this.plugin.settings.timelineStartHour.toString())
					.onChange(async (value) => {
						const nextValue = parseHour(value);
						if (
							nextValue === null ||
							nextValue >= this.plugin.settings.timelineEndHour
						) {
							return;
						}
						this.plugin.settings.timelineStartHour = nextValue;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Timeline end hour')
			.setDesc('Hour shown at the bottom of the daily timeline.')
			.addText((text) =>
				text
					.setPlaceholder('22')
					.setValue(this.plugin.settings.timelineEndHour.toString())
					.onChange(async (value) => {
						const nextValue = parseHour(value);
						if (
							nextValue === null ||
							nextValue <= this.plugin.settings.timelineStartHour
						) {
							return;
						}
						this.plugin.settings.timelineEndHour = nextValue;
						await this.plugin.saveSettings();
					}),
			);
	}
}

function normalizeFolder(value: string): string {
	const normalized = value
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+/, '')
		.replace(/\/+$/, '');

	return normalized || DEFAULT_CALENDAR_ROOT;
}

function parseHour(value: string): number | null {
	const parsed = Number.parseInt(value.trim(), 10);
	if (!Number.isInteger(parsed)) {
		return null;
	}
	if (parsed < 0 || parsed > 23) {
		return null;
	}
	return parsed;
}
