import { DEFAULT_CATEGORY_COLORS, EVENT_STATUSES } from '../constants';
import { minutesToTimeLabel, parseDateTime } from '../date/date-utils';
import type {
	CalendarCategory,
	CalendarEvent,
	CalendarEventDetails,
	CalendarEventInput,
	CalendarEventUpdateInput,
	EventStatus,
} from '../types';

const EVENT_TYPE = 'calendar-event';
const VALID_CATEGORIES = Object.keys(
	DEFAULT_CATEGORY_COLORS,
) as CalendarCategory[];
const EMPTY_EVENT_DETAILS: CalendarEventDetails = {
	description: '',
	links: [],
	files: [],
};
const DESCRIPTION_HEADINGS = new Set([
	'description',
	'details',
	'notes',
	'描述',
	'細節',
	'詳情',
	'備註',
	'內容',
]);

export function parseCalendarEvent(
	frontmatter: Record<string, unknown>,
	path: string,
	basename: string,
	details: CalendarEventDetails = EMPTY_EVENT_DETAILS,
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
		details,
	};
}

export function parseCalendarEventDetails(
	content: string,
): CalendarEventDetails {
	const body = getMarkdownBody(content).trim();
	if (!body) {
		return { ...EMPTY_EVENT_DETAILS };
	}

	const sections = splitMarkdownSections(body);
	const descriptionSection = sections.find((section) =>
		DESCRIPTION_HEADINGS.has(section.heading.toLowerCase()),
	);
	const descriptionSource =
		descriptionSection?.content.trim() || removeReferenceOnlyLines(body).trim();

	return {
		description: normalizeDescription(descriptionSource),
		links: extractEventLinks(body),
		files: extractEventFiles(body),
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

export function createEventTemplate(input: CalendarEventInput): string {
	const offset = getLocalTimezoneOffsetLabel();
	return `---
type: calendar-event
title: ${quoteYamlString(input.title)}
start: ${input.date}T${minutesToTimeLabel(input.startMinutes)}:00${offset}
end: ${input.date}T${minutesToTimeLabel(input.endMinutes)}:00${offset}
category: ${input.category}
important: ${input.important ? 'true' : 'false'}
deadline: ${input.deadline ? 'true' : 'false'}
status: ${input.status}
---

## Description

`;
}

export function updateEventFrontmatter(
	content: string,
	update: CalendarEventUpdateInput,
): string {
	const normalized = content.replace(/\r\n/g, '\n');
	const endIndex = normalized.indexOf('\n---', 3);
	if (!normalized.startsWith('---') || endIndex === -1) {
		throw new Error('Event note must start with frontmatter.');
	}

	const currentFrontmatter = parseFrontmatterBlock(normalized) ?? {};
	const currentStart = parseDateTime(currentFrontmatter.start);
	const currentEnd = parseDateTime(currentFrontmatter.end);
	const date = update.date ?? currentStart?.date;
	const startMinutes = update.startMinutes ?? currentStart?.minutes;
	const endMinutes = update.endMinutes ?? currentEnd?.minutes;
	const frontmatterLines = normalized.slice(0, endIndex).split('\n');
	const updates: Array<[string, string]> = [];
	if (update.title) {
		updates.push(['title', quoteYamlString(update.title)]);
	}
	if (date && typeof startMinutes === 'number') {
		updates.push([
			'start',
			`${date}T${minutesToTimeLabel(startMinutes)}:00${getLocalTimezoneOffsetLabel()}`,
		]);
	}
	if (date && typeof endMinutes === 'number') {
		updates.push([
			'end',
			`${date}T${minutesToTimeLabel(endMinutes)}:00${getLocalTimezoneOffsetLabel()}`,
		]);
	}
	if (update.category) {
		updates.push(['category', update.category]);
	}
	if (typeof update.important === 'boolean') {
		updates.push(['important', update.important ? 'true' : 'false']);
	}
	if (typeof update.deadline === 'boolean') {
		updates.push(['deadline', update.deadline ? 'true' : 'false']);
	}
	if (update.status) {
		updates.push(['status', update.status]);
	}

	for (const [key, value] of updates) {
		const existingIndex = frontmatterLines.findIndex((line, index) => {
			if (index === 0) {
				return false;
			}
			return new RegExp(`^\\s*${key}\\s*:`).test(line);
		});
		if (existingIndex >= 0) {
			frontmatterLines[existingIndex] = `${key}: ${value}`;
		} else {
			frontmatterLines.push(`${key}: ${value}`);
		}
	}

	const body =
		update.details !== undefined
			? createEventBody(update.details)
			: normalized.slice(endIndex + 4);
	const updated = `${frontmatterLines.join('\n')}\n---${body}`;
	return content.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
}

function createEventBody(details: CalendarEventDetails): string {
	const description = details.description.trim();
	return `\n\n## Description\n\n${description}\n`;
}

function getMarkdownBody(content: string): string {
	const normalized = content.replace(/\r\n/g, '\n');
	if (!normalized.startsWith('---')) {
		return normalized;
	}

	const endIndex = normalized.indexOf('\n---', 3);
	if (endIndex === -1) {
		return normalized;
	}

	return normalized.slice(endIndex + 4);
}

function splitMarkdownSections(
	body: string,
): Array<{ heading: string; content: string }> {
	const lines = body.replace(/\r\n/g, '\n').split('\n');
	const sections: Array<{ heading: string; contentLines: string[] }> = [];
	let current: { heading: string; contentLines: string[] } | null = null;

	for (const line of lines) {
		const headingMatch = /^#{1,6}\s+(.+?)\s*$/.exec(line);
		if (headingMatch?.[1]) {
			current = {
				heading: headingMatch[1].trim(),
				contentLines: [],
			};
			sections.push(current);
			continue;
		}
		current?.contentLines.push(line);
	}

	return sections.map((section) => ({
		heading: section.heading,
		content: section.contentLines.join('\n').trim(),
	}));
}

function normalizeDescription(value: string): string {
	return value
		.split('\n')
		.map((line) =>
			line
				.replace(
					/!?\[([^\]]*)\]\(([^)]+)\)/g,
					(_match: string, label: string, target: string) =>
						label ? `${label} (${target})` : target,
				)
				.replace(
					/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
					(_match: string, target: string, label: string | undefined) =>
						label || target,
				)
				.trimEnd(),
		)
		.join('\n')
		.trim();
}

function removeReferenceOnlyLines(body: string): string {
	return body
		.split('\n')
		.filter((line) => {
			const trimmed = line.trim();
			if (!trimmed) {
				return true;
			}
			if (/^#{1,6}\s+/.test(trimmed)) {
				return false;
			}
			return !/^[-*]\s+(!?\[.*\]\(.*\)|!?\[\[.*\]\]|https?:\/\/\S+)$/.test(
				trimmed,
			);
		})
		.join('\n');
}

function extractEventLinks(body: string): CalendarEventDetails['links'] {
	const links: CalendarEventDetails['links'] = [];
	const markdownLinkPattern = /!?\[([^\]]*)\]\(([^)]+)\)/g;
	let markdownMatch: RegExpExecArray | null;
	while ((markdownMatch = markdownLinkPattern.exec(body)) !== null) {
		const label = markdownMatch[1]?.trim() || markdownMatch[2]?.trim() || '';
		const target = markdownMatch[2]?.trim() || '';
		if (isExternalUrl(target)) {
			links.push({ label, target });
		}
	}

	const bareUrlPattern = /https?:\/\/[^\s<>)]+/g;
	let urlMatch: RegExpExecArray | null;
	while ((urlMatch = bareUrlPattern.exec(body)) !== null) {
		const target = urlMatch[0];
		links.push({ label: target, target });
	}

	return dedupeReferences(links);
}

function extractEventFiles(body: string): CalendarEventDetails['files'] {
	const files: CalendarEventDetails['files'] = [];
	const markdownLinkPattern = /!?\[([^\]]*)\]\(([^)]+)\)/g;
	let markdownMatch: RegExpExecArray | null;
	while ((markdownMatch = markdownLinkPattern.exec(body)) !== null) {
		const target = markdownMatch[2]?.trim() || '';
		if (!target || isExternalUrl(target)) {
			continue;
		}
		files.push({
			label: markdownMatch[1]?.trim() || target,
			target,
		});
	}

	const wikilinkPattern = /!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
	let wikilinkMatch: RegExpExecArray | null;
	while ((wikilinkMatch = wikilinkPattern.exec(body)) !== null) {
		const target = wikilinkMatch[1]?.trim() || '';
		if (!target) {
			continue;
		}
		files.push({
			label: wikilinkMatch[2]?.trim() || target,
			target,
		});
	}

	return dedupeReferences(files);
}

function dedupeReferences<T extends { target: string }>(references: T[]): T[] {
	const seen = new Set<string>();
	return references.filter((reference) => {
		const key = reference.target.toLowerCase();
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

function isExternalUrl(value: string): boolean {
	return /^https?:\/\//i.test(value);
}

function quoteYamlString(value: string): string {
	return JSON.stringify(value);
}

function getLocalTimezoneOffsetLabel(): string {
	const offsetMinutes = -new Date().getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? '+' : '-';
	const absoluteMinutes = Math.abs(offsetMinutes);
	const hours = Math.floor(absoluteMinutes / 60).toString().padStart(2, '0');
	const minutes = (absoluteMinutes % 60).toString().padStart(2, '0');
	return `${sign}${hours}:${minutes}`;
}
