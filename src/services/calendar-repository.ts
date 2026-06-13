import type { App, TFile } from 'obsidian';
import { EventStore } from './event-store';
import { TaskStore } from './task-store';
import {
	ensureFolderPath,
	getCalendarRoot,
	getDailyRoot,
	getEventsRoot,
	getTasksRoot,
} from './vault-paths';
import type {
	CalendarDayData,
	CalendarEvent,
	CalendarEventInput,
	CalendarEventUpdateInput,
	CalendarPlannerSettings,
	CalendarTaskItem,
	TaskSection,
} from '../types';

export class CalendarRepository {
	private readonly eventStore: EventStore;
	private readonly taskStore: TaskStore;

	constructor(
		private readonly app: App,
		private readonly getSettings: () => CalendarPlannerSettings,
	) {
		this.eventStore = new EventStore(app, getSettings);
		this.taskStore = new TaskStore(app, getSettings);
	}

	async ensureCalendarStructure(): Promise<void> {
		const settings = this.getSettings();
		await ensureFolderPath(this.app.vault, getCalendarRoot(settings));
		await ensureFolderPath(this.app.vault, getEventsRoot(settings));
		await ensureFolderPath(this.app.vault, getTasksRoot(settings));
		await ensureFolderPath(this.app.vault, getDailyRoot(settings));
	}

	async readMonthEvents(month: Date): Promise<CalendarEvent[]> {
		await this.ensureCalendarStructure();
		return this.eventStore.readMonthEvents(month);
	}

	async readDay(date: string): Promise<CalendarDayData> {
		await this.ensureCalendarStructure();
		const [events, tasks] = await Promise.all([
			this.eventStore.readDayEvents(date),
			this.taskStore.readDayTasks(date),
		]);

		return {
			date,
			events,
			tasks,
		};
	}

	async createEventNote(input: CalendarEventInput): Promise<TFile> {
		await this.ensureCalendarStructure();
		return this.eventStore.createEventNote(input);
	}

	async readEventByPath(path: string): Promise<CalendarEvent> {
		return this.eventStore.readEventByPath(path);
	}

	async updateEvent(
		path: string,
		update: CalendarEventUpdateInput,
	): Promise<CalendarEvent> {
		return this.eventStore.updateEvent(path, update);
	}

	async addTask(
		date: string,
		section: TaskSection,
		text: string,
	): Promise<void> {
		await this.taskStore.addTask(date, section, text);
	}

	async toggleTask(task: CalendarTaskItem, completed: boolean): Promise<void> {
		await this.taskStore.toggleTask(task, completed);
	}
}
