import { App, TFile } from 'obsidian';
import {
	appendTaskToSection,
	createTaskTemplate,
	parseTaskDay,
	updateCheckboxLine,
} from '../markdown/task-markdown';
import type {
	CalendarPlannerSettings,
	CalendarTaskDay,
	CalendarTaskItem,
	TaskSection,
} from '../types';
import {
	ensureFolderPath,
	getTaskFilePath,
	getTaskMonthFolder,
} from './vault-paths';

export class TaskStore {
	constructor(
		private readonly app: App,
		private readonly getSettings: () => CalendarPlannerSettings,
	) {}

	async readDayTasks(date: string): Promise<CalendarTaskDay> {
		const settings = this.getSettings();
		await ensureFolderPath(this.app.vault, getTaskMonthFolder(settings, date));

		const path = getTaskFilePath(settings, date);
		let file = this.app.vault.getAbstractFileByPath(path);
		if (!file) {
			file = await this.app.vault.create(path, createTaskTemplate(date));
		}

		if (!(file instanceof TFile)) {
			throw new Error(`Task path is not a file: ${path}`);
		}

		const content = await this.app.vault.read(file);
		return parseTaskDay(path, date, content);
	}

	async addTask(
		date: string,
		section: TaskSection,
		text: string,
	): Promise<void> {
		await this.readDayTasks(date);
		const path = getTaskFilePath(this.getSettings(), date);
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			throw new Error(`Task file not found: ${path}`);
		}

		const content = await this.app.vault.read(file);
		const updated = appendTaskToSection(content, section, text);
		await this.app.vault.modify(file, updated);
	}

	async toggleTask(
		task: CalendarTaskItem,
		completed: boolean,
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Task file not found: ${task.path}`);
		}

		const content = await this.app.vault.read(file);
		const updated = updateCheckboxLine(content, task.line, completed);
		if (!updated) {
			throw new Error(`Task line is no longer a checkbox: ${task.line + 1}`);
		}

		await this.app.vault.modify(file, updated);
	}
}
