import { normalizePath, TFolder, Vault } from 'obsidian';
import { getDateParts, getMonthParts } from '../date/date-utils';
import type { CalendarPlannerSettings } from '../types';

export function getCalendarRoot(settings: CalendarPlannerSettings): string {
	return normalizePath(settings.calendarRoot || 'Calendar');
}

export function getEventsRoot(settings: CalendarPlannerSettings): string {
	return normalizePath(`${getCalendarRoot(settings)}/Events`);
}

export function getTasksRoot(settings: CalendarPlannerSettings): string {
	return normalizePath(`${getCalendarRoot(settings)}/Tasks`);
}

export function getDailyRoot(settings: CalendarPlannerSettings): string {
	return normalizePath(`${getCalendarRoot(settings)}/Daily`);
}

export function getEventMonthFolder(
	settings: CalendarPlannerSettings,
	month: Date,
): string {
	const parts = getMonthParts(month);
	return normalizePath(`${getEventsRoot(settings)}/${parts.year}/${parts.month}`);
}

export function getTaskMonthFolder(
	settings: CalendarPlannerSettings,
	date: string,
): string {
	const parts = getDateParts(date);
	return normalizePath(`${getTasksRoot(settings)}/${parts.year}/${parts.month}`);
}

export function getTaskFilePath(
	settings: CalendarPlannerSettings,
	date: string,
): string {
	return normalizePath(`${getTaskMonthFolder(settings, date)}/${date}_tasks.md`);
}

export async function ensureFolderPath(
	vault: Vault,
	folderPath: string,
): Promise<void> {
	const normalized = normalizePath(folderPath);
	const segments = normalized.split('/').filter(Boolean);
	let current = '';

	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		const existing = vault.getAbstractFileByPath(current);
		if (!existing) {
			await vault.createFolder(current);
			continue;
		}
		if (!(existing instanceof TFolder)) {
			throw new Error(`Expected folder but found file: ${current}`);
		}
	}
}
