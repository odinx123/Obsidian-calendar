import type { WeekStartsOn } from '../types';

export interface DateParts {
	year: string;
	month: string;
	day: string;
}

export interface ParsedDateTime {
	date: string;
	minutes: number;
}

export function pad2(value: number): string {
	return value.toString().padStart(2, '0');
}

export function formatDate(value: Date): string {
	return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(
		value.getDate(),
	)}`;
}

export function getTodayString(): string {
	return formatDate(new Date());
}

export function dateFromString(date: string): Date {
	const parts = getDateParts(date);
	return new Date(
		Number.parseInt(parts.year, 10),
		Number.parseInt(parts.month, 10) - 1,
		Number.parseInt(parts.day, 10),
	);
}

export function getDateParts(date: string): DateParts {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (!match) {
		throw new Error(`Invalid date: ${date}`);
	}
	const [, year, month, day] = match;
	if (!year || !month || !day) {
		throw new Error(`Invalid date: ${date}`);
	}
	return { year, month, day };
}

export function getMonthParts(date: Date): Pick<DateParts, 'year' | 'month'> {
	return {
		year: date.getFullYear().toString(),
		month: pad2(date.getMonth() + 1),
	};
}

export function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, amount: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

export function addMonths(date: Date, amount: number): Date {
	return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function isSameMonth(left: Date, right: Date): boolean {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth()
	);
}

export function createMonthGrid(
	displayMonth: Date,
	weekStartsOn: WeekStartsOn,
): Date[] {
	const firstDay = startOfMonth(displayMonth);
	const weekday = firstDay.getDay();
	const offset = weekStartsOn === 'monday' ? (weekday + 6) % 7 : weekday;
	const gridStart = addDays(firstDay, -offset);

	return Array.from({ length: 42 }, (_unused, index) =>
		addDays(gridStart, index),
	);
}

export function getWeekdayLabels(weekStartsOn: WeekStartsOn): string[] {
	const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	if (weekStartsOn === 'sunday') {
		return labels;
	}
	const sunday = labels[0] ?? 'Sun';
	return labels.slice(1).concat(sunday);
}

export function formatMonthLabel(date: Date): string {
	return `${date.getFullYear()} / ${pad2(date.getMonth() + 1)}`;
}

export function minutesToTimeLabel(minutes: number): string {
	const hour = Math.floor(minutes / 60);
	const minute = minutes % 60;
	return `${pad2(hour)}:${pad2(minute)}`;
}

export function getWeekRange(
	date: string,
	weekStartsOn: WeekStartsOn,
): { start: string; end: string } {
	const value = dateFromString(date);
	const weekday = value.getDay();
	const offset = weekStartsOn === 'monday' ? (weekday + 6) % 7 : weekday;
	const start = addDays(value, -offset);
	const end = addDays(start, 6);
	return { start: formatDate(start), end: formatDate(end) };
}

export function isDateInRange(date: string, start: string, end: string): boolean {
	return date >= start && date <= end;
}

export function parseDateTime(value: unknown): ParsedDateTime | null {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return {
			date: formatDate(value),
			minutes: value.getHours() * 60 + value.getMinutes(),
		};
	}

	if (typeof value !== 'string') {
		return null;
	}

	const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
	if (!match) {
		return null;
	}

	const [, date, hour, minute] = match;
	if (!date || !hour || !minute) {
		return null;
	}

	return {
		date,
		minutes: Number.parseInt(hour, 10) * 60 + Number.parseInt(minute, 10),
	};
}
