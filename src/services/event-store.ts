import { App, normalizePath, TFile, TFolder } from 'obsidian';
import { dateFromString } from '../date/date-utils';
import {
	createEventTemplate,
	parseCalendarEvent,
	parseCalendarEventDetails,
	parseFrontmatterBlock,
	updateEventFrontmatter,
} from '../markdown/event-markdown';
import type {
	CalendarEvent,
	CalendarEventInput,
	CalendarPlannerSettings,
	CalendarEventUpdateInput,
} from '../types';
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

	async createEventNote(input: CalendarEventInput): Promise<TFile> {
		const folderPath = getEventMonthFolder(
			this.getSettings(),
			dateFromString(input.date),
		);
		await ensureFolderPath(this.app.vault, folderPath);
		const path = this.getUniqueEventPath(folderPath, input);
		return this.app.vault.create(path, createEventTemplate(input));
	}

	async updateEvent(
		path: string,
		update: CalendarEventUpdateInput,
	): Promise<CalendarEvent> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			throw new Error('Event note was not found.');
		}

		const content = await this.app.vault.read(file);
		await this.app.vault.modify(file, updateEventFrontmatter(content, update));
		const updatedEvent = await this.readEventFile(file);
		if (!updatedEvent) {
			throw new Error('Updated event note could not be read.');
		}
		return updatedEvent;
	}

	async readEventByPath(path: string): Promise<CalendarEvent> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			throw new Error('Event note was not found.');
		}
		const event = await this.readEventFile(file);
		if (!event) {
			throw new Error('Event note could not be read.');
		}
		return event;
	}

	async readDayEvents(date: string): Promise<CalendarEvent[]> {
		const month = dateFromString(date);
		const events = await this.readMonthEvents(month);
		return events.filter((event) => event.date === date);
	}

	private getUniqueEventPath(
		folderPath: string,
		input: CalendarEventInput,
	): string {
		const basePath = normalizePath(
			`${folderPath}/${input.date}_${formatFileTime(
				input.startMinutes,
			)}_${sanitizeEventTitle(input.title)}`,
		);
		let candidate = `${basePath}.md`;
		let index = 2;
		while (this.app.vault.getAbstractFileByPath(candidate)) {
			candidate = `${basePath}-${index}.md`;
			index += 1;
		}
		return candidate;
	}

	private async readEventFile(file: TFile): Promise<CalendarEvent | null> {
		const content = await this.app.vault.read(file);
		const details = parseCalendarEventDetails(content);
		const parsedFrontmatter = parseFrontmatterBlock(content);
		if (parsedFrontmatter) {
			return parseCalendarEvent(
				parsedFrontmatter,
				file.path,
				file.basename,
				details,
			);
		}

		const cachedFrontmatter = this.app.metadataCache.getFileCache(file)
			?.frontmatter;

		if (cachedFrontmatter) {
			const cachedEvent = parseCalendarEvent(
				cachedFrontmatter,
				file.path,
				file.basename,
				details,
			);
			if (cachedEvent) {
				return cachedEvent;
			}
		}

		return null;
	}
}

function formatFileTime(minutes: number): string {
	const hour = Math.floor(minutes / 60).toString().padStart(2, '0');
	const minute = (minutes % 60).toString().padStart(2, '0');
	return `${hour}${minute}`;
}

function sanitizeEventTitle(title: string): string {
	const sanitized = title
		.trim()
		.replace(/[<>:"/\\|?*]+/g, '-')
		.split('')
		.filter((character) => character.charCodeAt(0) >= 32)
		.join('')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/[.]+$/g, '')
		.replace(/^-+|-+$/g, '');

	return sanitized || 'new-event';
}
