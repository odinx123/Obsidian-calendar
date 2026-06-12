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
}

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
}

function renderTimeline(parent: HTMLElement, props: DayColumnProps): void {
	parent.createEl('h3', { text: 'Timeline' });
	const timeline = parent.createDiv({ cls: 'ocp-timeline' });
	const start = props.settings.timelineStartHour;
	const end = props.settings.timelineEndHour;
	const events = [...props.events].sort(
		(left, right) => left.startMinutes - right.startMinutes,
	);

	for (let hour = start; hour <= end; hour += 1) {
		const slotStart = hour * 60;
		const slotEnd = slotStart + 60;
		const slot = timeline.createDiv({ cls: 'ocp-time-slot' });
		slot.createDiv({
			cls: 'ocp-time-label',
			text: minutesToTimeLabel(slotStart),
		});
		const content = slot.createDiv({ cls: 'ocp-time-content' });
		const slotEvents = events.filter(
			(event) =>
				event.startMinutes >= slotStart && event.startMinutes < slotEnd,
		);

		if (slotEvents.length === 0) {
			content.createDiv({ cls: 'ocp-empty-slot' });
			continue;
		}

		for (const event of slotEvents) {
			renderEventCard(content, event, props.settings);
		}
	}
}

function renderEventCard(
	parent: HTMLElement,
	event: CalendarEvent,
	settings: CalendarPlannerSettings,
): void {
	const card = parent.createDiv({ cls: 'ocp-event-card' });
	card.style.borderLeftColor = settings.categories[event.category];
	card.createDiv({ cls: 'ocp-event-title', text: event.title });
	card.createDiv({
		cls: 'ocp-event-time',
		text: `${minutesToTimeLabel(event.startMinutes)} - ${minutesToTimeLabel(
			event.endMinutes,
		)} · ${CATEGORY_LABELS[event.category]}`,
	});
	if (event.important || event.deadline) {
		card.createDiv({
			cls: 'ocp-event-flag',
			text: event.deadline ? 'Deadline' : 'Important',
		});
	}
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
