import { App, normalizePath, TFile, TFolder } from 'obsidian';
import { dateFromString } from '../date/date-utils';
import {
	createEventTemplate,
	parseCalendarEvent,
	parseFrontmatterBlock,
} from '../markdown/event-markdown';
import type { CalendarEvent, CalendarPlannerSettings } from '../types';
import { ensureFolderPath, getEventMonthFolder } from './vault-paths';

export class EventStore {
	constructor(
		private readonly app: App,
		private readonly getSettings: () => CalendarPlannerSettings,
	) {}

	async readMonthEvents(month: Date): Promise<CalendarEvent[]> {
		const folderPath = getEventMonthFolder(this.getSettings(), month);
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) {
			return [];
		}

		const events: CalendarEvent[] = [];
		const files = folder.children.filter(
			(child): child is TFile =>
				child instanceof TFile && child.extension.toLowerCase() === 'md',
		);

		for (const file of files) {
			const event = await this.readEventFile(file);
			if (event) {
				events.push(event);
			}
		}

		return events.sort(
			(left, right) =>
				left.date.localeCompare(right.date) ||
				left.startMinutes - right.startMinutes ||
				left.title.localeCompare(right.title),
		);
	}

	async createEventNote(date: string): Promise<TFile> {
		const folderPath = getEventMonthFolder(this.getSettings(), dateFromString(date));
		await ensureFolderPath(this.app.vault, folderPath);
		const path = this.getUniqueEventPath(folderPath, date);
		return this.app.vault.create(path, createEventTemplate(date));
	}

	async readDayEvents(date: string): Promise<CalendarEvent[]> {
		const month = dateFromString(date);
		const events = await this.readMonthEvents(month);
		return events.filter((event) => event.date === date);
	}

	private getUniqueEventPath(folderPath: string, date: string): string {
		const basePath = normalizePath(`${folderPath}/${date}_0900_new-event`);
		let candidate = `${basePath}.md`;
		let index = 2;
		while (this.app.vault.getAbstractFileByPath(candidate)) {
			candidate = `${basePath}-${index}.md`;
			index += 1;
		}
		return candidate;
	}

	private async readEventFile(file: TFile): Promise<CalendarEvent | null> {
		const cachedFrontmatter = this.app.metadataCache.getFileCache(file)
			?.frontmatter;

		if (cachedFrontmatter) {
			const cachedEvent = parseCalendarEvent(
				cachedFrontmatter,
				file.path,
				file.basename,
			);
			if (cachedEvent) {
				return cachedEvent;
			}
		}

		const content = await this.app.vault.read(file);
		const parsedFrontmatter = parseFrontmatterBlock(content);
		if (!parsedFrontmatter) {
			return null;
		}

		return parseCalendarEvent(parsedFrontmatter, file.path, file.basename);
	}
}
