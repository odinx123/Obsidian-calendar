export type CalendarCategory = 'work' | 'study' | 'life' | 'health' | 'other';

export type EventStatus = 'planned' | 'done' | 'cancelled';

export type WeekStartsOn = 'sunday' | 'monday';

export type TaskSection = 'most-important' | 'tasks';

export interface CalendarPlannerSettings {
	calendarRoot: string;
	weekStartsOn: WeekStartsOn;
	timelineStartHour: number;
	timelineEndHour: number;
	categories: Record<CalendarCategory, string>;
}

export interface CalendarEvent {
	path: string;
	title: string;
	date: string;
	startMinutes: number;
	endMinutes: number;
	category: CalendarCategory;
	important: boolean;
	deadline: boolean;
	status: EventStatus;
}

export interface CalendarTaskItem {
	path: string;
	line: number;
	text: string;
	completed: boolean;
	section: TaskSection;
}

export interface CalendarTaskDay {
	path: string;
	date: string;
	mostImportant: CalendarTaskItem[];
	tasks: CalendarTaskItem[];
	notes: string;
}

export interface CalendarDayData {
	date: string;
	events: CalendarEvent[];
	tasks: CalendarTaskDay;
}
