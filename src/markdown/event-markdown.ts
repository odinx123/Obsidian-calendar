import { DEFAULT_CATEGORY_COLORS, EVENT_STATUSES } from '../constants';
import { parseDateTime } from '../date/date-utils';
import type { CalendarCategory, CalendarEvent, EventStatus } from '../types';

const EVENT_TYPE = 'calendar-event';
const VALID_CATEGORIES = Object.keys(
	DEFAULT_CATEGORY_COLORS,
) as CalendarCategory[];

export function parseCalendarEvent(
	frontmatter: Record<string, unknown>,
	path: string,
	basename: string,
): CalendarEvent | null {
	if (frontmatter.type !== EVENT_TYPE) {
		return null;
	}

	const start = parseDateTime(frontmatter.start);
	const end = parseDateTime(frontmatter.end);
	if (!start || !end) {
		return null;
	}

	const category = parseCategory(frontmatter.category);
	const title = parseTitle(frontmatter.title, basename);
	const status = parseStatus(frontmatter.status);

	return {
		path,
		title,
		date: start.date,
		startMinutes: start.minutes,
		endMinutes: end.minutes,
		category,
		important: frontmatter.important === true,
		deadline: frontmatter.deadline === true,
		status,
	};
}

export function parseFrontmatterBlock(
	content: string,
): Record<string, unknown> | null {
	if (!content.startsWith('---')) {
		return null;
	}

	const normalized = content.replace(/\r\n/g, '\n');
	const endIndex = normalized.indexOf('\n---', 3);
	if (endIndex === -1) {
		return null;
	}

	const block = normalized.slice(3, endIndex).trim();
	const entries: Record<string, unknown> = {};
	for (const line of block.split('\n')) {
		const separatorIndex = line.indexOf(':');
		if (separatorIndex === -1) {
			continue;
		}
		const key = line.slice(0, separatorIndex).trim();
		const rawValue = line.slice(separatorIndex + 1).trim();
		if (!key) {
			continue;
		}
		entries[key] = parseScalar(rawValue);
	}

	return entries;
}

function parseScalar(value: string): unknown {
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
}

function parseCategory(value: unknown): CalendarCategory {
	if (typeof value !== 'string') {
		return 'other';
	}
	if (VALID_CATEGORIES.includes(value as CalendarCategory)) {
		return value as CalendarCategory;
	}
	return 'other';
}

function parseStatus(value: unknown): EventStatus {
	if (typeof value !== 'string') {
		return 'planned';
	}
	if (EVENT_STATUSES.includes(value as EventStatus)) {
		return value as EventStatus;
	}
	return 'planned';
}

function parseTitle(value: unknown, basename: string): string {
	if (typeof value === 'string' && value.trim()) {
		return value.trim();
	}
	const fallback = basename.replace(/^\d{4}-\d{2}-\d{2}_\d{4}_/, '');
	return fallback || 'Untitled event';
}
