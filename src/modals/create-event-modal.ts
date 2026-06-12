import { App, Modal, Setting } from 'obsidian';
import type { DropdownComponent, TextComponent } from 'obsidian';
import { CATEGORY_LABELS, EVENT_STATUSES } from '../constants';
import { minutesToTimeLabel } from '../date/date-utils';
import type {
	CalendarCategory,
	CalendarEventInput,
	EventStatus,
} from '../types';

interface CreateEventModalOptions {
	defaultDate: string;
	defaultStartMinutes: number;
	defaultEndMinutes?: number;
	onSubmit: (input: CalendarEventInput) => Promise<void>;
}

const DEFAULT_TITLE = 'New event';
const TIME_STEP_SECONDS = 900;

export class CreateEventModal extends Modal {
	private titleInput!: TextComponent;
	private dateInput!: TextComponent;
	private startInput!: TextComponent;
	private endInput!: TextComponent;
	private category: CalendarCategory = 'work';
	private status: EventStatus = 'planned';
	private important = false;
	private deadline = false;
	private errorEl!: HTMLElement;
	private submitButtonEl: HTMLButtonElement | null = null;
	private submitting = false;

	constructor(
		app: App,
		private readonly options: CreateEventModalOptions,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ocp-event-modal');
		contentEl.createEl('h2', { text: 'Create event' });

		this.renderFields(contentEl);
		this.errorEl = contentEl.createDiv({ cls: 'ocp-modal-error' });
		this.renderActions(contentEl);

		window.setTimeout(() => {
			this.titleInput.inputEl.focus();
			this.titleInput.inputEl.select();
		}, 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderFields(contentEl: HTMLElement): void {
		const startMinutes = normalizeDefaultStartMinutes(
			this.options.defaultStartMinutes,
		);
		const endMinutes = normalizeDefaultEndMinutes(
			startMinutes,
			this.options.defaultEndMinutes,
		);

		new Setting(contentEl).setName('Title').addText((text) => {
			this.titleInput = text;
			text.setValue(DEFAULT_TITLE);
			text.setPlaceholder('Event title');
		});

		new Setting(contentEl).setName('Date').addText((text) => {
			this.dateInput = text;
			text.inputEl.type = 'date';
			text.setValue(this.options.defaultDate);
		});

		new Setting(contentEl).setName('Start').addText((text) => {
			this.startInput = text;
			text.inputEl.type = 'time';
			text.inputEl.step = TIME_STEP_SECONDS.toString();
			text.setValue(minutesToTimeLabel(startMinutes));
		});

		new Setting(contentEl).setName('End').addText((text) => {
			this.endInput = text;
			text.inputEl.type = 'time';
			text.inputEl.step = TIME_STEP_SECONDS.toString();
			text.setValue(minutesToTimeLabel(endMinutes));
		});

		new Setting(contentEl).setName('Category').addDropdown((dropdown) => {
			this.populateCategoryOptions(dropdown);
			dropdown.setValue(this.category);
			dropdown.onChange((value) => {
				this.category = value as CalendarCategory;
			});
		});

		new Setting(contentEl).setName('Important').addToggle((toggle) => {
			toggle.setValue(this.important);
			toggle.onChange((value) => {
				this.important = value;
			});
		});

		new Setting(contentEl).setName('Deadline').addToggle((toggle) => {
			toggle.setValue(this.deadline);
			toggle.onChange((value) => {
				this.deadline = value;
			});
		});

		new Setting(contentEl).setName('Status').addDropdown((dropdown) => {
			for (const status of EVENT_STATUSES) {
				dropdown.addOption(status, toTitleCase(status));
			}
			dropdown.setValue(this.status);
			dropdown.onChange((value) => {
				this.status = value as EventStatus;
			});
		});
	}

	private renderActions(contentEl: HTMLElement): void {
		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText('Cancel');
				button.onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				button.setCta();
				button.setButtonText('Create');
				this.submitButtonEl = button.buttonEl;
				button.onClick(() => {
					void this.submit();
				});
			});
	}

	private populateCategoryOptions(dropdown: DropdownComponent): void {
		for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
			dropdown.addOption(category, label);
		}
	}

	private async submit(): Promise<void> {
		if (this.submitting) {
			return;
		}

		const input = this.readInput();
		if (!input) {
			return;
		}

		this.setSubmitting(true);
		try {
			await this.options.onSubmit(input);
			this.close();
		} catch (error) {
			this.showError(
				error instanceof Error ? error.message : 'Could not create event.',
			);
		} finally {
			this.setSubmitting(false);
		}
	}

	private readInput(): CalendarEventInput | null {
		const title = this.titleInput.getValue().trim();
		const date = this.dateInput.getValue().trim();
		const startMinutes = parseTimeInput(this.startInput.getValue());
		const endMinutes = parseTimeInput(this.endInput.getValue());

		if (!title) {
			this.showError('Title is required.');
			return null;
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			this.showError('Date must use YYYY-MM-DD.');
			return null;
		}
		if (startMinutes === null || endMinutes === null) {
			this.showError('Start and end time are required.');
			return null;
		}
		if (endMinutes <= startMinutes) {
			this.showError('End time must be later than start time.');
			return null;
		}

		this.showError('');
		return {
			title,
			date,
			startMinutes,
			endMinutes,
			category: this.category,
			important: this.important,
			deadline: this.deadline,
			status: this.status,
		};
	}

	private setSubmitting(submitting: boolean): void {
		this.submitting = submitting;
		if (this.submitButtonEl) {
			this.submitButtonEl.disabled = submitting;
			this.submitButtonEl.setText(submitting ? 'Creating...' : 'Create');
		}
	}

	private showError(message: string): void {
		this.errorEl.setText(message);
		this.errorEl.toggleClass('is-visible', message.length > 0);
	}
}

function normalizeDefaultStartMinutes(defaultStartMinutes: number): number {
	return Math.min(
		Math.max(Math.trunc(defaultStartMinutes / 15) * 15, 0),
		23 * 60 + 30,
	);
}

function normalizeDefaultEndMinutes(
	startMinutes: number,
	defaultEndMinutes: number | undefined,
): number {
	const requestedEnd =
		defaultEndMinutes ?? Math.min(startMinutes + 60, 23 * 60 + 45);
	const normalizedEnd = Math.min(
		Math.max(Math.trunc(requestedEnd / 15) * 15, startMinutes + 15),
		23 * 60 + 45,
	);
	return normalizedEnd > startMinutes ? normalizedEnd : startMinutes + 15;
}

function parseTimeInput(value: string): number | null {
	const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
	if (!match) {
		return null;
	}

	const hour = Number.parseInt(match[1] ?? '', 10);
	const minute = Number.parseInt(match[2] ?? '', 10);
	if (
		Number.isNaN(hour) ||
		Number.isNaN(minute) ||
		hour < 0 ||
		hour > 23 ||
		minute < 0 ||
		minute > 59
	) {
		return null;
	}

	return hour * 60 + minute;
}

function toTitleCase(value: string): string {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
