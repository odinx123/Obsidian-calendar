import type { CalendarTaskDay, CalendarTaskItem, TaskSection } from '../types';

type ParserSection = TaskSection | 'notes' | 'none';

export function createTaskTemplate(date: string): string {
	return `---
type: calendar-tasks
date: ${date}
---

## Most important

- [ ]

## Tasks

- [ ]

## Notes

`;
}

export function parseTaskDay(
	path: string,
	date: string,
	content: string,
): CalendarTaskDay {
	const lines = content.replace(/\r\n/g, '\n').split('\n');
	let section: ParserSection = 'none';
	const mostImportant: CalendarTaskItem[] = [];
	const tasks: CalendarTaskItem[] = [];
	const notes: string[] = [];

	lines.forEach((line, index) => {
		const heading = parseHeading(line);
		if (heading) {
			section = heading;
			return;
		}

		if (section === 'notes') {
			notes.push(line);
			return;
		}

		if (section !== 'most-important' && section !== 'tasks') {
			return;
		}

		const item = parseTaskLine(path, line, index, section);
		if (!item || !item.text.trim()) {
			return;
		}
		if (section === 'most-important') {
			mostImportant.push(item);
		} else {
			tasks.push(item);
		}
	});

	return {
		path,
		date,
		mostImportant,
		tasks,
		notes: notes.join('\n').trim(),
	};
}

export function updateCheckboxLine(
	content: string,
	lineNumber: number,
	completed: boolean,
): string | null {
	const lines = content.replace(/\r\n/g, '\n').split('\n');
	const line = lines[lineNumber];
	if (!line || !/^\s*[-*]\s+\[[ xX]\]/.test(line)) {
		return null;
	}

	lines[lineNumber] = line.replace(/\[[ xX]\]/, completed ? '[x]' : '[ ]');
	return lines.join('\n');
}

function parseHeading(line: string): ParserSection | null {
	const normalized = line.trim().toLowerCase();
	if (normalized === '## most important') {
		return 'most-important';
	}
	if (normalized === '## tasks') {
		return 'tasks';
	}
	if (normalized === '## notes') {
		return 'notes';
	}
	return null;
}

function parseTaskLine(
	path: string,
	line: string,
	lineNumber: number,
	section: TaskSection,
): CalendarTaskItem | null {
	const match = /^\s*[-*]\s+\[([ xX])\]\s*(.*)$/.exec(line);
	if (!match) {
		return null;
	}
	const [, marker, text] = match;
	return {
		path,
		line: lineNumber,
		text: text ?? '',
		completed: marker?.toLowerCase() === 'x',
		section,
	};
}
