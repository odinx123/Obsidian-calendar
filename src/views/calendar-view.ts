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
	CalendarTimeRange,
	TaskSection,
} from '../types';
import { renderDayColumn } from './render-day';
import { renderMonthColumn, renderPlanningPanels } from './render-month';

type RefreshResult = 'rendered' | 'failed' | 'superseded';

interface ViewSelectionState {
	displayMonth: Date;
	selectedDate: string;
	selectedEventPath: string | null;
	selectedTimelineRange: CalendarTimeRange | null;
}

export class CalendarPlannerView extends ItemView {
	private displayMonth = startOfMonth(new Date());
	private selectedDate = getTodayString();
	private monthEvents: CalendarEvent[] = [];
	private dayData: CalendarDayData | null = null;
	private selectedEventPath: string | null = null;
	private selectedTimelineRange: CalendarTimeRange | null = null;
	private refreshRequestId = 0;
	private lastRenderedSelectionState: ViewSelectionState | null = null;

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

	getSelectedDate(): string {
		return this.selectedDate;
	}

	async refresh(): Promise<RefreshResult> {
		const requestId = ++this.refreshRequestId;
		const displayMonth = this.displayMonth;
		const selectedDate = this.selectedDate;
		const hasRenderedCalendar = this.hasRenderedCalendar();
		this.setRefreshing(true);
		if (hasRenderedCalendar) {
			this.showRefreshStatus('Updating calendar...');
		} else {
			this.renderLoading();
		}

		try {
			const nextMonth = addMonths(displayMonth, 1);
			const [monthEvents, nextMonthEvents, dayData] = await Promise.all([
				this.plugin.repository.readMonthEvents(displayMonth),
				this.plugin.repository.readMonthEvents(nextMonth),
				this.plugin.repository.readDay(selectedDate),
			]);
			if (requestId !== this.refreshRequestId) {
				return 'superseded';
			}

			this.monthEvents = [...monthEvents, ...nextMonthEvents];
			this.dayData = dayData;
			if (
				this.selectedEventPath &&
				!dayData.events.some((event) => event.path === this.selectedEventPath)
			) {
				this.selectedEventPath = null;
			}
			this.render();
			this.lastRenderedSelectionState = this.captureSelectionState();
			return 'rendered';
		} catch (error) {
			if (requestId !== this.refreshRequestId) {
				return 'superseded';
			}

			this.renderError(error, hasRenderedCalendar);
			return 'failed';
		} finally {
			if (requestId === this.refreshRequestId) {
				this.setRefreshing(false);
			}
		}
	}

	private hasRenderedCalendar(): boolean {
		return this.contentEl.querySelector('.ocp-root') !== null;
	}

	private setRefreshing(refreshing: boolean): void {
		this.contentEl.classList.toggle('is-refreshing', refreshing);
		if (refreshing) {
			this.contentEl.setAttribute('aria-busy', 'true');
		} else {
			this.contentEl.removeAttribute('aria-busy');
			this.clearRefreshStatus(false);
		}
	}

	private showRefreshStatus(message: string, isError = false): void {
		this.clearRefreshStatus(true);
		const status = activeDocument.createElement('div');
		status.className = isError
			? 'ocp-refresh-status is-error'
			: 'ocp-refresh-status';
		status.setAttribute('role', 'status');
		status.textContent = message;
		this.contentEl.prepend(status);
	}

	private clearRefreshStatus(includeErrors: boolean): void {
		for (const status of Array.from(
			this.contentEl.querySelectorAll('.ocp-refresh-status'),
		)) {
			if (includeErrors || !status.classList.contains('is-error')) {
				status.remove();
			}
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

		this.clearRefreshStatus(true);
		this.contentEl.empty();
		this.contentEl.addClass('ocp-view');

		const root = this.contentEl.createDiv({ cls: 'ocp-root' });
		const left = root.createDiv({ cls: 'ocp-column ocp-column-left' });
		const right = root.createDiv({ cls: 'ocp-column ocp-column-right' });

		const monthProps = {
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
			onSelectDate: (date: string) => {
				void this.selectDate(date);
			},
		};

		renderMonthColumn(left, monthProps);

		renderDayColumn(right, {
			selectedDate: this.selectedDate,
			events: dayData.events,
			taskDay: dayData.tasks,
			settings: this.plugin.settings,
			selectedEventPath: this.selectedEventPath,
			selectedTimelineRange: this.selectedTimelineRange,
			onToggleTask: async (task, completed) => {
				await this.toggleTask(task, completed);
			},
			onAddTask: async (section, text) => {
				await this.addTask(section, text);
			},
			onCreateEvent: (timeRange) => {
				this.plugin.openCreateEventModal(this.selectedDate, timeRange);
			},
			onSelectEvent: (event) => {
				this.selectedEventPath = event.path;
				this.selectedTimelineRange = null;
			},
			onShowEventDetails: (event) => {
				this.selectedEventPath = event.path;
				this.selectedTimelineRange = null;
				this.plugin.openEventDetailModal(event);
			},
			onSelectTimeRange: (timeRange) => {
				this.selectedEventPath = null;
				this.selectedTimelineRange = timeRange;
			},
			renderPlanningPanels: (container) => {
				renderPlanningPanels(container, monthProps);
			},
		});
	}

	private renderError(error: unknown, preserveCurrentContent: boolean): void {
		const message =
			error instanceof Error ? error.message : 'Unknown calendar error';
		if (preserveCurrentContent) {
			this.showRefreshStatus(`Update failed: ${message}`, true);
			new Notice('Calendar planner failed to update.');
			return;
		}

		this.contentEl.empty();
		this.contentEl.addClass('ocp-view');
		this.contentEl.createDiv({
			cls: 'ocp-error',
			text: `Calendar planner error: ${message}`,
		});
		new Notice('Calendar planner failed to load.');
	}

	private captureSelectionState(): ViewSelectionState {
		return {
			displayMonth: new Date(this.displayMonth.getTime()),
			selectedDate: this.selectedDate,
			selectedEventPath: this.selectedEventPath,
			selectedTimelineRange: this.selectedTimelineRange
				? { ...this.selectedTimelineRange }
				: null,
		};
	}

	private restoreSelectionState(state: ViewSelectionState): void {
		this.displayMonth = state.displayMonth;
		this.selectedDate = state.selectedDate;
		this.selectedEventPath = state.selectedEventPath;
		this.selectedTimelineRange = state.selectedTimelineRange;
	}

	private async selectDate(date: string): Promise<void> {
		const previousState = this.captureSelectionState();
		this.selectedDate = date;
		this.selectedEventPath = null;
		this.selectedTimelineRange = null;
		this.displayMonth = startOfMonth(dateFromString(date));
		const result = await this.refresh();
		if (result === 'failed') {
			this.restoreSelectionState(
				this.lastRenderedSelectionState ?? previousState,
			);
		}
	}

	private async shiftMonth(amount: number): Promise<void> {
		const previousState = this.captureSelectionState();
		this.displayMonth = addMonths(this.displayMonth, amount);
		this.selectedDate = formatDate(this.displayMonth);
		this.selectedEventPath = null;
		this.selectedTimelineRange = null;
		const result = await this.refresh();
		if (result === 'failed') {
			this.restoreSelectionState(
				this.lastRenderedSelectionState ?? previousState,
			);
		}
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
