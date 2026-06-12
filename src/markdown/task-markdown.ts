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

export function appendTaskToSection(
	content: string,
	section: TaskSection,
	text: string,
): string {
	const taskText = text.replace(/\s+/g, ' ').trim();
	if (!taskText) {
		return content;
	}

	const lines = content.replace(/\r\n/g, '\n').split('\n');
	const heading = section === 'most-important' ? '## Most important' : '## Tasks';
	let headingIndex = findHeadingIndex(lines, heading);
	if (headingIndex === -1) {
		headingIndex = insertMissingSection(lines, heading);
	}

	const nextHeadingIndex = findNextHeadingIndex(lines, headingIndex + 1);
	const sectionEnd = nextHeadingIndex === -1 ? lines.length : nextHeadingIndex;
	for (let index = headingIndex + 1; index < sectionEnd; index += 1) {
		if (/^\s*[-*]\s+\[[ xX]\]\s*$/.test(lines[index] ?? '')) {
			lines[index] = `- [ ] ${taskText}`;
			return lines.join('\n');
		}
	}

	let insertAt = sectionEnd;
	if (insertAt > headingIndex + 1 && lines[insertAt - 1]?.trim() === '') {
		insertAt -= 1;
	}
	lines.splice(insertAt, 0, `- [ ] ${taskText}`);
	return lines.join('\n');
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

function findHeadingIndex(lines: string[], heading: string): number {
	const normalizedHeading = heading.toLowerCase();
	return lines.findIndex((line) => line.trim().toLowerCase() === normalizedHeading);
}

function findNextHeadingIndex(lines: string[], start: number): number {
	return lines.findIndex(
		(line, index) => index >= start && /^##\s+/.test(line.trim()),
	);
}

function insertMissingSection(lines: string[], heading: string): number {
	const notesIndex = findHeadingIndex(lines, '## Notes');
	const insertAt = notesIndex === -1 ? lines.length : notesIndex;
	if (insertAt > 0 && lines[insertAt - 1]?.trim() !== '') {
		lines.splice(insertAt, 0, '');
	}
	lines.splice(insertAt, 0, heading, '');
	return insertAt;
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
