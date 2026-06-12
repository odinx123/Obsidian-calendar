import { App, Modal, Notice, Setting } from 'obsidian';
import { CATEGORY_LABELS } from '../constants';
import { minutesToTimeLabel } from '../date/date-utils';
import type { CalendarEvent } from '../types';

interface EventDetailModalOptions {
	event: CalendarEvent;
	onOpenNote?: (event: CalendarEvent) => Promise<void>;
}

export class EventDetailModal extends Modal {
	private openingNote = false;

	constructor(
		app: App,
		private readonly options: EventDetailModalOptions,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		const { event } = this.options;
		contentEl.empty();
		contentEl.addClass('ocp-event-detail-modal');
		contentEl.createEl('h2', { text: event.title });

		const body = contentEl.createDiv({ cls: 'ocp-event-detail-body' });
		renderDetailRow(body, 'Date', event.date);
		renderDetailRow(
			body,
			'Time',
			`${minutesToTimeLabel(event.startMinutes)} - ${minutesToTimeLabel(
				event.endMinutes,
			)}`,
		);
		renderDetailRow(body, 'Category', CATEGORY_LABELS[event.category]);
		renderDetailRow(body, 'Status', toTitleCase(event.status));
		renderDetailRow(body, 'Source note', event.path);
		this.renderFlags(body, event);
		this.renderActions(contentEl);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderFlags(parent: HTMLElement, event: CalendarEvent): void {
		const row = parent.createDiv({ cls: 'ocp-event-detail-row' });
		row.createDiv({ cls: 'ocp-event-detail-label', text: 'Flags' });
		const value = row.createDiv({ cls: 'ocp-event-detail-value' });
		if (!event.deadline && !event.important) {
			value.setText('None');
			return;
		}
		const flags = value.createDiv({ cls: 'ocp-event-detail-flags' });
		if (event.deadline) {
			flags.createSpan({
				cls: 'ocp-event-flag is-deadline',
				text: 'Deadline',
			});
		}
		if (event.important) {
			flags.createSpan({
				cls: 'ocp-event-flag is-important',
				text: 'Important',
			});
		}
	}

	private renderActions(contentEl: HTMLElement): void {
		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText('Close');
				button.onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				button.setButtonText('Open note');
				button.setCta();
				button.buttonEl.disabled = !this.options.onOpenNote;
				button.onClick(() => {
					void this.openNote(button.buttonEl);
				});
			});
	}

	private async openNote(buttonEl: HTMLButtonElement): Promise<void> {
		if (this.openingNote || !this.options.onOpenNote) {
			return;
		}

		this.openingNote = true;
		buttonEl.disabled = true;
		buttonEl.setText('Opening...');
		try {
			await this.options.onOpenNote(this.options.event);
			this.close();
		} catch (error) {
			new Notice(
				error instanceof Error ? error.message : 'Could not open event note.',
			);
		} finally {
			this.openingNote = false;
			buttonEl.disabled = false;
			buttonEl.setText('Open note');
		}
	}
}

function renderDetailRow(
	parent: HTMLElement,
	label: string,
	value: string,
): void {
	const row = parent.createDiv({ cls: 'ocp-event-detail-row' });
	row.createDiv({ cls: 'ocp-event-detail-label', text: label });
	row.createDiv({ cls: 'ocp-event-detail-value', text: value });
}

function toTitleCase(value: string): string {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
