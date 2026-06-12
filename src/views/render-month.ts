import { setIcon } from 'obsidian';
import { CATEGORY_LABELS } from '../constants';
import {
	addMonths,
	createMonthGrid,
	formatDate,
	formatMonthLabel,
	getWeekRange,
	getWeekdayLabels,
	isDateInRange,
	isSameMonth,
	minutesToTimeLabel,
} from '../date/date-utils';
import type {
	CalendarCategory,
	CalendarEvent,
	WeekStartsOn,
} from '../types';

export interface MonthColumnProps {
	displayMonth: Date;
	selectedDate: string;
	today: string;
	weekStartsOn: WeekStartsOn;
	eventsByDate: Map<string, CalendarEvent[]>;
	categoryColors: Record<CalendarCategory, string>;
	onPreviousMonth: () => void;
	onNextMonth: () => void;
	onSelectDate: (date: string) => void;
}

export function renderMonthColumn(
	container: HTMLElement,
	props: MonthColumnProps,
): void {
	container.empty();
	renderMonthHeader(container, props);
	renderCalendar(container, props.displayMonth, props, false);
	renderCalendar(container, addMonths(props.displayMonth, 1), props, true);
}

function renderMonthHeader(
	container: HTMLElement,
	props: MonthColumnProps,
): void {
	const header = container.createDiv({ cls: 'ocp-month-header' });
	const previous = header.createEl('button', { cls: 'ocp-icon-button' });
	previous.setAttr('type', 'button');
	previous.setAttr('aria-label', 'Previous month');
	setIcon(previous, 'chevron-left');
	previous.addEventListener('click', props.onPreviousMonth);

	header.createEl('h2', { text: formatMonthLabel(props.displayMonth) });

	const next = header.createEl('button', { cls: 'ocp-icon-button' });
	next.setAttr('type', 'button');
	next.setAttr('aria-label', 'Next month');
	setIcon(next, 'chevron-right');
	next.addEventListener('click', props.onNextMonth);
}

function renderCalendar(
	container: HTMLElement,
	month: Date,
	props: MonthColumnProps,
	compact: boolean,
): void {
	const panel = container.createDiv({
		cls: compact
			? 'ocp-panel ocp-calendar-panel is-compact'
			: 'ocp-panel ocp-calendar-panel',
	});
	if (compact) {
		panel.createEl('h3', { text: `${formatMonthLabel(month)} preview` });
	}

	const grid = panel.createDiv({ cls: 'ocp-calendar-grid' });
	for (const label of getWeekdayLabels(props.weekStartsOn)) {
		grid.createDiv({ cls: 'ocp-weekday', text: label });
	}

	for (const day of createMonthGrid(month, props.weekStartsOn)) {
		const date = formatDate(day);
		const events = props.eventsByDate.get(date) ?? [];
		const cell = grid.createEl('button', { cls: 'ocp-day-cell' });
		cell.setAttr('type', 'button');
		cell.setAttr('aria-label', date);
		if (!isSameMonth(day, month)) {
			cell.addClass('is-muted');
		}
		if (date === props.today) {
			cell.addClass('is-today');
		}
		if (date === props.selectedDate) {
			cell.addClass('is-selected');
		}
		cell.addEventListener('click', () => {
			props.onSelectDate(date);
		});

		cell.createDiv({ cls: 'ocp-day-number', text: day.getDate().toString() });
		if (!compact) {
			renderDayEvents(cell, events, props);
		} else if (events.length > 0) {
			cell.createDiv({ cls: 'ocp-event-dot-row' }).createSpan({
				cls: 'ocp-event-count',
				text: events.length.toString(),
			});
		}
	}
}

function renderDayEvents(
	cell: HTMLElement,
	events: CalendarEvent[],
	props: MonthColumnProps,
): void {
	const list = cell.createDiv({ cls: 'ocp-day-events' });
	const sortedEvents = [...events].sort(compareEventDateTime);
	for (const event of sortedEvents.slice(0, 2)) {
		const item = list.createDiv({ cls: 'ocp-day-event' });
		if (event.deadline) {
			item.addClass('has-deadline');
		}
		if (event.important) {
			item.addClass('has-important');
		}
		item.style.borderLeftColor = props.categoryColors[event.category];
		item.createSpan({ text: event.title });
	}
	if (events.length > 2) {
		list.createDiv({
			cls: 'ocp-more-events',
			text: `+${events.length - 2} more`,
		});
	}
}

export function renderPlanningPanels(
	container: HTMLElement,
	props: MonthColumnProps,
): void {
	renderWeeklyFocus(container, props);
	renderImportantReminders(container, props);
}

function renderWeeklyFocus(
	container: HTMLElement,
	props: MonthColumnProps,
): void {
	const panel = container.createDiv({ cls: 'ocp-panel ocp-list-panel' });
	panel.createEl('h3', { text: 'Weekly focus' });
	const range = getWeekRange(props.selectedDate, props.weekStartsOn);
	const events = flattenEvents(props.eventsByDate)
		.filter((event) => isDateInRange(event.date, range.start, range.end))
		.slice(0, 5);

	if (events.length === 0) {
		panel.createDiv({ cls: 'ocp-empty-state', text: 'No events this week.' });
		return;
	}

	for (const event of events) {
		renderCompactEvent(panel, event, props);
	}
}

function renderImportantReminders(
	container: HTMLElement,
	props: MonthColumnProps,
): void {
	const panel = container.createDiv({ cls: 'ocp-panel ocp-list-panel' });
	panel.createEl('h3', { text: 'Important & deadlines' });
	const events = flattenEvents(props.eventsByDate)
		.filter((event) => event.important || event.deadline)
		.sort(compareReminderEvents)
		.slice(0, 6);

	if (events.length === 0) {
		panel.createDiv({
			cls: 'ocp-empty-state',
			text: 'No important events or deadlines.',
		});
		return;
	}

	for (const event of events) {
		renderCompactEvent(panel, event, props);
	}
}

function renderCompactEvent(
	parent: HTMLElement,
	event: CalendarEvent,
	props: MonthColumnProps,
): void {
	const row = parent.createDiv({ cls: 'ocp-compact-event' });
	if (event.deadline) {
		row.addClass('has-deadline');
	}
	if (event.important) {
		row.addClass('has-important');
	}
	row.style.borderLeftColor = props.categoryColors[event.category];
	row.createDiv({ cls: 'ocp-compact-title', text: event.title });
	row.createDiv({
		cls: 'ocp-compact-meta',
		text: `${event.date} ${minutesToTimeLabel(
			event.startMinutes,
		)}-${minutesToTimeLabel(event.endMinutes)} - ${
			CATEGORY_LABELS[event.category]
		}`,
	});
	renderCompactEventFlags(row, event);
}

function renderCompactEventFlags(
	parent: HTMLElement,
	event: CalendarEvent,
): void {
	if (!event.important && !event.deadline) {
		return;
	}

	const row = parent.createDiv({ cls: 'ocp-compact-flags' });
	if (event.deadline) {
		row.createSpan({ cls: 'ocp-compact-flag is-deadline', text: 'Deadline' });
	}
	if (event.important) {
		row.createSpan({ cls: 'ocp-compact-flag is-important', text: 'Important' });
	}
}

function flattenEvents(
	eventsByDate: Map<string, CalendarEvent[]>,
): CalendarEvent[] {
	return Array.from(eventsByDate.values()).flat().sort(compareEventDateTime);
}

function compareReminderEvents(
	left: CalendarEvent,
	right: CalendarEvent,
): number {
	if (left.deadline || right.deadline) {
		if (left.deadline && right.deadline) {
			return compareEventDateTime(left, right);
		}
		return left.deadline ? -1 : 1;
	}

	const importantPriority = Number(right.important) - Number(left.important);
	if (importantPriority !== 0) {
		return importantPriority;
	}

	return compareEventDateTime(left, right);
}

function compareEventDateTime(left: CalendarEvent, right: CalendarEvent): number {
	return (
		left.date.localeCompare(right.date) ||
		left.startMinutes - right.startMinutes ||
		left.title.localeCompare(right.title)
	);
}
