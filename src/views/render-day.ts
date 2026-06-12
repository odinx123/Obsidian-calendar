import { setIcon } from 'obsidian';
import { CATEGORY_LABELS } from '../constants';
import { minutesToTimeLabel } from '../date/date-utils';
import type {
	CalendarEvent,
	CalendarPlannerSettings,
	CalendarTaskDay,
	CalendarTaskItem,
	TaskSection,
} from '../types';

interface DayColumnProps {
	selectedDate: string;
	events: CalendarEvent[];
	taskDay: CalendarTaskDay;
	settings: CalendarPlannerSettings;
	onToggleTask: (
		task: CalendarTaskItem,
		completed: boolean,
	) => Promise<void>;
	onAddTask: (section: TaskSection, text: string) => Promise<void>;
	renderPlanningPanels?: (container: HTMLElement) => void;
}

interface ClippedTimelineEvent {
	event: CalendarEvent;
	start: number;
	end: number;
}

interface TimelineEventLayout extends ClippedTimelineEvent {
	top: number;
	height: number;
	lane: number;
	laneCount: number;
}

const TIMELINE_HOUR_HEIGHT = 56;
const MIN_EVENT_BLOCK_HEIGHT = 38;

export function renderDayColumn(
	container: HTMLElement,
	props: DayColumnProps,
): void {
	container.empty();

	const header = container.createDiv({ cls: 'ocp-day-header' });
	header.createEl('h2', { text: props.selectedDate });
	header.createDiv({
		cls: 'ocp-day-subtitle',
		text: 'Daily execution',
	});

	const body = container.createDiv({ cls: 'ocp-day-layout' });
	renderTimeline(body.createDiv({ cls: 'ocp-panel ocp-timeline-panel' }), props);

	const side = body.createDiv({ cls: 'ocp-day-side' });
	renderTaskList(
		side,
		'Most important',
		props.taskDay.mostImportant.slice(0, 3),
		'most-important',
		props,
	);
	renderTaskList(side, 'Tasks', props.taskDay.tasks, 'tasks', props);
	renderNotes(side, props.taskDay);
	props.renderPlanningPanels?.(side);
}

function renderTimeline(parent: HTMLElement, props: DayColumnProps): void {
	parent.createEl('h3', { text: 'Timeline' });
	const startHour = props.settings.timelineStartHour;
	const endHour = Math.max(startHour + 1, props.settings.timelineEndHour);
	const timelineStart = startHour * 60;
	const timelineEnd = endHour * 60;
	const layouts = getTimelineLayouts(
		props.events,
		timelineStart,
		timelineEnd,
	);

	const timeline = parent.createDiv({ cls: 'ocp-timeline' });
	const body = timeline.createDiv({ cls: 'ocp-timeline-body' });
	body.style.height = `${
		((timelineEnd - timelineStart) / 60) * TIMELINE_HOUR_HEIGHT
	}px`;

	for (let hour = startHour; hour <= endHour; hour += 1) {
		const marker = body.createDiv({ cls: 'ocp-time-marker' });
		marker.style.top = `${(hour - startHour) * TIMELINE_HOUR_HEIGHT}px`;
		marker.createDiv({
			cls: 'ocp-time-label',
			text: minutesToTimeLabel(hour * 60),
		});
		marker.createDiv({ cls: 'ocp-time-line' });
	}

	const eventLayer = body.createDiv({ cls: 'ocp-timeline-events' });
	for (const layout of layouts) {
		const card = renderEventCard(eventLayer, layout.event, props.settings);
		card.addClass('is-timeline-block');
		card.style.top = `${layout.top}px`;
		card.style.height = `${layout.height}px`;
		if (layout.laneCount > 1) {
			const laneWidth = 100 / layout.laneCount;
			card.setCssProps({
				'--ocp-event-left': `calc(${laneWidth * layout.lane}% + 3px)`,
				'--ocp-event-right': 'auto',
				'--ocp-event-width': `calc(${laneWidth}% - 6px)`,
			});
		} else {
			card.setCssProps({
				'--ocp-event-left': '0',
				'--ocp-event-right': '0',
				'--ocp-event-width': 'auto',
			});
		}
	}
}

function renderEventCard(
	parent: HTMLElement,
	event: CalendarEvent,
	settings: CalendarPlannerSettings,
): HTMLElement {
	const card = parent.createDiv({ cls: 'ocp-event-card' });
	if (event.deadline) {
		card.addClass('has-deadline');
	}
	if (event.important) {
		card.addClass('has-important');
	}
	card.style.borderLeftColor = settings.categories[event.category];
	card.createDiv({ cls: 'ocp-event-title', text: event.title });
	card.createDiv({
		cls: 'ocp-event-time',
		text: `${minutesToTimeLabel(event.startMinutes)} - ${minutesToTimeLabel(
			event.endMinutes,
		)} - ${CATEGORY_LABELS[event.category]}`,
	});
	renderEventFlags(card, event);
	return card;
}

function renderEventFlags(parent: HTMLElement, event: CalendarEvent): void {
	if (!event.important && !event.deadline) {
		return;
	}

	const row = parent.createDiv({ cls: 'ocp-event-flags' });
	if (event.deadline) {
		row.createSpan({ cls: 'ocp-event-flag is-deadline', text: 'Deadline' });
	}
	if (event.important) {
		row.createSpan({ cls: 'ocp-event-flag is-important', text: 'Important' });
	}
}

function getTimelineLayouts(
	events: CalendarEvent[],
	timelineStart: number,
	timelineEnd: number,
): TimelineEventLayout[] {
	const clippedEvents = events
		.map((event): ClippedTimelineEvent | null => {
			const eventEnd = Math.max(event.endMinutes, event.startMinutes + 15);
			const displayStart = Math.max(event.startMinutes, timelineStart);
			const displayEnd = Math.min(eventEnd, timelineEnd);
			if (displayEnd <= timelineStart || displayStart >= timelineEnd) {
				return null;
			}
			if (displayEnd <= displayStart) {
				return null;
			}
			return { event, start: displayStart, end: displayEnd };
		})
		.filter((event): event is ClippedTimelineEvent => event !== null)
		.sort(
			(left, right) =>
				left.start - right.start ||
				left.end - right.end ||
				left.event.title.localeCompare(right.event.title),
		);

	const layouts: TimelineEventLayout[] = [];
	let group: ClippedTimelineEvent[] = [];
	let groupEnd = Number.NEGATIVE_INFINITY;
	for (const event of clippedEvents) {
		if (group.length === 0 || event.start < groupEnd) {
			group.push(event);
			groupEnd = Math.max(groupEnd, event.end);
			continue;
		}

		layouts.push(...layoutTimelineGroup(group, timelineStart, timelineEnd));
		group = [event];
		groupEnd = event.end;
	}

	if (group.length > 0) {
		layouts.push(...layoutTimelineGroup(group, timelineStart, timelineEnd));
	}

	return layouts;
}

function layoutTimelineGroup(
	group: ClippedTimelineEvent[],
	timelineStart: number,
	timelineEnd: number,
): TimelineEventLayout[] {
	const laneEnds: number[] = [];
	const assigned = group.map((event) => {
		let lane = laneEnds.findIndex((end) => event.start >= end);
		if (lane === -1) {
			lane = laneEnds.length;
			laneEnds.push(event.end);
		} else {
			laneEnds[lane] = event.end;
		}

		return { event, lane };
	});

	const laneCount = Math.max(1, laneEnds.length);
	const timelineHeight =
		((timelineEnd - timelineStart) / 60) * TIMELINE_HOUR_HEIGHT;

	return assigned.map(({ event, lane }) => {
		const top =
			((event.start - timelineStart) / 60) * TIMELINE_HOUR_HEIGHT;
		const rawHeight =
			((event.end - event.start) / 60) * TIMELINE_HOUR_HEIGHT - 4;
		const maxHeight = Math.max(24, timelineHeight - top - 2);
		const height = Math.min(
			Math.max(MIN_EVENT_BLOCK_HEIGHT, rawHeight),
			maxHeight,
		);

		return {
			...event,
			top,
			height,
			lane,
			laneCount,
		};
	});
}

function renderTaskList(
	parent: HTMLElement,
	title: string,
	tasks: CalendarTaskItem[],
	section: TaskSection,
	props: DayColumnProps,
): void {
	const panel = parent.createDiv({ cls: 'ocp-panel ocp-task-panel' });
	panel.createEl('h3', { text: title });
	renderAddTaskForm(panel, title, section, props);

	if (tasks.length === 0) {
		panel.createDiv({ cls: 'ocp-empty-state', text: 'No tasks.' });
		return;
	}

	const list = panel.createDiv({ cls: 'ocp-task-list' });
	for (const task of tasks) {
		const row = list.createDiv({ cls: 'ocp-task-row' });
		const checkbox = row.createEl('input', {
			type: 'checkbox',
			cls: 'ocp-task-checkbox',
		});
		checkbox.checked = task.completed;
		checkbox.addEventListener('change', () => {
			void props.onToggleTask(task, checkbox.checked);
		});

		const label = row.createEl('span', { text: task.text });
		if (task.completed) {
			label.addClass('is-complete');
		}
	}
}

function renderAddTaskForm(
	parent: HTMLElement,
	title: string,
	section: TaskSection,
	props: DayColumnProps,
): void {
	const form = parent.createEl('form', { cls: 'ocp-add-task-form' });
	const input = form.createEl('input', { cls: 'ocp-add-task-input' });
	input.type = 'text';
	input.placeholder = `Add ${title.toLowerCase()}`;

	const button = form.createEl('button', { cls: 'ocp-add-task-button' });
	button.type = 'submit';
	button.setAttr('aria-label', `Add ${title.toLowerCase()}`);
	setIcon(button, 'plus');

	form.addEventListener('submit', (event) => {
		event.preventDefault();
		const text = input.value.trim();
		if (!text) {
			return;
		}

		input.disabled = true;
		button.disabled = true;
		void props.onAddTask(section, text);
	});
}

function renderNotes(parent: HTMLElement, taskDay: CalendarTaskDay): void {
	const panel = parent.createDiv({ cls: 'ocp-panel ocp-notes-panel' });
	panel.createEl('h3', { text: 'Notes' });
	panel.createDiv({
		cls: taskDay.notes ? 'ocp-notes' : 'ocp-empty-state',
		text: taskDay.notes || 'No notes.',
	});
}
