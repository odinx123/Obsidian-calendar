import { Notice, Plugin } from 'obsidian';
import { VIEW_TYPE_CALENDAR_PLANNER } from './constants';
import { CalendarRepository } from './services/calendar-repository';
import {
	DEFAULT_SETTINGS,
	CalendarPlannerSettingTab,
} from './settings';
import type { CalendarPlannerSettings } from './types';
import { CalendarPlannerView } from './views/calendar-view';

export default class CalendarPlannerPlugin extends Plugin {
	settings!: CalendarPlannerSettings;
	repository!: CalendarRepository;

	async onload() {
		await this.loadSettings();
		this.repository = new CalendarRepository(this.app, () => this.settings);

		this.registerView(
			VIEW_TYPE_CALENDAR_PLANNER,
			(leaf) => new CalendarPlannerView(leaf, this),
		);

		this.addRibbonIcon('calendar-days', 'Open calendar planner', () => {
			void this.activateView();
		});
		this.addCommand({
			id: 'open-view',
			name: 'Open planner',
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: 'create-event-note',
			name: 'Create event note',
			callback: () => {
				void this.createEventNote();
			},
		});
		this.addSettingTab(new CalendarPlannerSettingTab(this.app, this));

		try {
			await this.repository.ensureCalendarStructure();
		} catch (error) {
			new Notice('Calendar planner could not create calendar folders.');
			throw error;
		}
	}

	async createEventNote(): Promise<void> {
		try {
			const date = this.getActiveCalendarDate();
			const file = await this.repository.createEventNote(date);
			await this.refreshCalendarViews();
			await this.app.workspace.getLeaf(true).openFile(file);
			new Notice('Created event note.');
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Could not create event note';
			new Notice(message);
		}
	}

	private getActiveCalendarDate(): string {
		const calendarLeaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_CALENDAR_PLANNER,
		);
		for (const leaf of calendarLeaves) {
			if (leaf.view instanceof CalendarPlannerView) {
				return leaf.view.getSelectedDate();
			}
		}
		return new Date().toISOString().slice(0, 10);
	}

	private async refreshCalendarViews(): Promise<void> {
		const calendarLeaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_CALENDAR_PLANNER,
		);
		for (const leaf of calendarLeaves) {
			if (leaf.view instanceof CalendarPlannerView) {
				await leaf.view.refresh();
			}
		}
	}

	async activateView() {
		const existingLeaf = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_CALENDAR_PLANNER,
		)[0];
		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({
			type: VIEW_TYPE_CALENDAR_PLANNER,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<CalendarPlannerSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}