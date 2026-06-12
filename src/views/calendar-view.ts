import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_CALENDAR_PLANNER } from '../constants';
import {
	addMonths,
	dateFromString,
	formatDate,
	getTodayString,
	startOfMonth,
} from '../date/date-utils';
import type CalendarPlannerPlugin from '../main';
import type {
	CalendarDayData,
	CalendarEvent,
	CalendarTaskItem,
	TaskSection,
} from '../types';
import { renderDayColumn } from './render-day';
import { renderMonthColumn } from './render-month';

export class CalendarPlannerView extends ItemView {
	private displayMonth = startOfMonth(new Date());
	private selectedDate = getTodayString();
	private monthEvents: CalendarEvent[] = [];
	private dayData: CalendarDayData | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: CalendarPlannerPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CALENDAR_PLANNER;
	}

	getDisplayText(): string {
		return 'Calendar planner';
	}

	getIcon(): string {
		return 'calendar-days';
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		this.renderLoading();
		try {
			const nextMonth = addMonths(this.displayMonth, 1);
			const [monthEvents, nextMonthEvents, dayData] = await Promise.all([
				this.plugin.repository.readMonthEvents(this.displayMonth),
				this.plugin.repository.readMonthEvents(nextMonth),
				this.plugin.repository.readDay(this.selectedDate),
			]);
			this.monthEvents = [...monthEvents, ...nextMonthEvents];
			this.dayData = dayData;
			this.render();
		} catch (error) {
			this.renderError(error);
		}
	}

	private renderLoading(): void {
		this.contentEl.empty();
		this.contentEl.addClass('ocp-view');
		this.contentEl.createDiv({
			cls: 'ocp-loading',
			text: 'Loading calendar...',
		});
	}

	private render(): void {
		const dayData = this.dayData;
		if (!dayData) {
			return;
		}

		this.contentEl.empty();
		this.contentEl.addClass('ocp-view');

		const root = this.contentEl.createDiv({ cls: 'ocp-root' });
		const left = root.createDiv({ cls: 'ocp-column ocp-column-left' });
		const right = root.createDiv({ cls: 'ocp-column ocp-column-right' });

		renderMonthColumn(left, {
			displayMonth: this.displayMonth,
			selectedDate: this.selectedDate,
			today: getTodayString(),
			weekStartsOn: this.plugin.settings.weekStartsOn,
			eventsByDate: groupEventsByDate(this.monthEvents),
			categoryColors: this.plugin.settings.categories,
			onPreviousMonth: () => {
				void this.shiftMonth(-1);
			},
			onNextMonth: () => {
				void this.shiftMonth(1);
			},
			onSelectDate: (date) => {
				void this.selectDate(date);
			},
		});

		renderDayColumn(right, {
			selectedDate: this.selectedDate,
			events: dayData.events,
			taskDay: dayData.tasks,
			settings: this.plugin.settings,
			onToggleTask: async (task, completed) => {
				await this.toggleTask(task, completed);
			},
			onAddTask: async (section, text) => {
				await this.addTask(section, text);
			},
		});
	}

	private renderError(error: unknown): void {
		this.contentEl.empty();
		const message =
			error instanceof Error ? error.message : 'Unknown calendar error';
		this.contentEl.createDiv({
			cls: 'ocp-error',
			text: `Calendar planner error: ${message}`,
		});
		new Notice('Calendar planner failed to load.');
	}

	private async selectDate(date: string): Promise<void> {
		this.selectedDate = date;
		this.displayMonth = startOfMonth(dateFromString(date));
		await this.refresh();
	}

	private async shiftMonth(amount: number): Promise<void> {
		this.displayMonth = addMonths(this.displayMonth, amount);
		this.selectedDate = formatDate(this.displayMonth);
		await this.refresh();
	}

	private async addTask(section: TaskSection, text: string): Promise<void> {
		try {
			await this.plugin.repository.addTask(this.selectedDate, section, text);
			await this.refresh();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Could not add task';
			new Notice(message);
			await this.refresh();
		}
	}

	private async toggleTask(
		task: CalendarTaskItem,
		completed: boolean,
	): Promise<void> {
		try {
			await this.plugin.repository.toggleTask(task, completed);
			await this.refresh();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Could not update task';
			new Notice(message);
			await this.refresh();
		}
	}
}

function groupEventsByDate(
	events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
	const groups = new Map<string, CalendarEvent[]>();
	for (const event of events) {
		const existing = groups.get(event.date);
		if (existing) {
			existing.push(event);
		} else {
			groups.set(event.date, [event]);
		}
	}
	return groups;
}
