import type { CalendarCategory, EventStatus } from './types';

export const VIEW_TYPE_CALENDAR_PLANNER = 'calendar-planner-view';

export const DEFAULT_CATEGORY_COLORS: Record<CalendarCategory, string> = {
	work: '#2f7dd3',
	study: '#54a24b',
	life: '#f2a23a',
	health: '#e8668a',
	other: '#7e57c2',
};

export const CATEGORY_LABELS: Record<CalendarCategory, string> = {
	work: 'Work',
	study: 'Study',
	life: 'Life',
	health: 'Health',
	other: 'Other',
};

export const EVENT_STATUSES: EventStatus[] = ['planned', 'done', 'cancelled'];

export const DEFAULT_CALENDAR_ROOT = 'Calendar';
