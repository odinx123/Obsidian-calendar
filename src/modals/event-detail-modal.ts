import { App, Modal, Notice, Setting } from 'obsidian';
import { CATEGORY_LABELS, EVENT_STATUSES } from '../constants';
import { minutesToTimeLabel } from '../date/date-utils';
import type {
	CalendarCategory,
	CalendarEvent,
	CalendarEventDetails,
	CalendarEventFileRef,
	CalendarEventUpdateInput,
	EventStatus,
} from '../types';

interface EventDetailModalOptions {
	event: CalendarEvent;
	onUpdateEvent?: (
		event: CalendarEvent,
		update: CalendarEventUpdateInput,
	) => Promise<CalendarEvent>;
	onOpenNote?: (event: CalendarEvent) => Promise<void>;
	onOpenFileRef?: (
		event: CalendarEvent,
		fileRef: CalendarEventFileRef,
	) => Promise<void>;
}

const TIME_STEP_SECONDS = 900;

export class EventDetailModal extends Modal {
	private currentEvent: CalendarEvent;
	private titleInput!: HTMLInputElement;
	private dateInput!: HTMLInputElement;
	private startInput!: HTMLInputElement;
	private endInput!: HTMLInputElement;
	private descriptionInput!: HTMLTextAreaElement;
	private descriptionReferencesEl!: HTMLElement;
	private category: CalendarCategory;
	private status: EventStatus;
	private important: boolean;
	private deadline: boolean;
	private openingNote = false;
	private saving = false;

	constructor(
		app: App,
		private readonly options: EventDetailModalOptions,
	) {
		super(app);
		this.currentEvent = options.event;
		this.category = options.event.category;
		this.status = options.event.status;
		this.important = options.event.important;
		this.deadline = options.event.deadline;
	}

	onOpen(): void {
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ocp-event-detail-modal');
		contentEl.createEl('h2', { text: 'Edit event' });

		this.renderCoreFields(contentEl);
		this.renderMetadataFields(contentEl);
		this.renderDescription(contentEl);
		this.renderActions(contentEl);
	}

	private renderCoreFields(contentEl: HTMLElement): void {
		const grid = contentEl.createDiv({ cls: 'ocp-event-editor-grid' });
		this.titleInput = renderTextField(
			grid,
			'Title',
			this.currentEvent.title,
			'Event title',
		);
		this.dateInput = renderTextField(
			grid,
			'Date',
			this.currentEvent.date,
			'YYYY-MM-DD',
		);
		this.dateInput.type = 'date';

		this.startInput = renderTextField(
			grid,
			'Start',
			minutesToTimeLabel(this.currentEvent.startMinutes),
			'HH:mm',
		);
		this.startInput.type = 'time';
		this.startInput.step = TIME_STEP_SECONDS.toString();

		this.endInput = renderTextField(
			grid,
			'End',
			minutesToTimeLabel(this.currentEvent.endMinutes),
			'HH:mm',
		);
		this.endInput.type = 'time';
		this.endInput.step = TIME_STEP_SECONDS.toString();
	}

	private renderMetadataFields(contentEl: HTMLElement): void {
		const controls = contentEl.createDiv({
			cls: 'ocp-event-detail-controls',
		});

		new Setting(controls).setName('Status').addDropdown((dropdown) => {
			for (const status of EVENT_STATUSES) {
				dropdown.addOption(status, toTitleCase(status));
			}
			dropdown.setValue(this.status);
			dropdown.onChange((value) => {
				this.status = value as EventStatus;
			});
		});

		new Setting(controls).setName('Category').addDropdown((dropdown) => {
			for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
				dropdown.addOption(category, label);
			}
			dropdown.setValue(this.category);
			dropdown.onChange((value) => {
				this.category = value as CalendarCategory;
			});
		});

		new Setting(controls).setName('Important').addToggle((toggle) => {
			toggle.setValue(this.important);
			toggle.onChange((value) => {
				this.important = value;
			});
		});

		new Setting(controls).setName('Deadline').addToggle((toggle) => {
			toggle.setValue(this.deadline);
			toggle.onChange((value) => {
				this.deadline = value;
			});
		});
	}

	private renderDescription(contentEl: HTMLElement): void {
		const section = contentEl.createDiv({ cls: 'ocp-event-editor-section' });
		section.createEl('h3', { text: 'Description' });
		this.descriptionInput = section.createEl('textarea', {
			cls: 'ocp-event-editor-textarea',
		});
		this.descriptionInput.value = this.currentEvent.details.description;
		this.descriptionInput.placeholder = 'Description';
		this.descriptionInput.rows = 5;
		this.descriptionReferencesEl = section.createDiv({
			cls: 'ocp-event-description-references',
		});
		this.renderDescriptionReferences();
		this.descriptionInput.addEventListener('input', () => {
			this.renderDescriptionReferences();
		});
	}

	private renderActions(contentEl: HTMLElement): void {
		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText('Save');
				button.setCta();
				button.onClick(() => {
					void this.save(button.buttonEl);
				});
			})
			.addButton((button) => {
				button.setButtonText('Close');
				button.onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				button.setButtonText('Open note');
				button.buttonEl.disabled = !this.options.onOpenNote;
				button.onClick(() => {
					void this.openNote(button.buttonEl);
				});
			});
	}

	private async save(buttonEl: HTMLButtonElement): Promise<void> {
		if (this.saving || !this.options.onUpdateEvent) {
			return;
		}

		const update = this.getUpdate();
		if (!update) {
			return;
		}

		this.saving = true;
		buttonEl.disabled = true;
		buttonEl.setText('Saving...');
		try {
			this.currentEvent = await this.options.onUpdateEvent(
				this.currentEvent,
				update,
			);
			this.syncFieldsFromEvent();
			new Notice('Event updated.');
		} catch (error) {
			new Notice(
				error instanceof Error ? error.message : 'Could not update event.',
			);
		} finally {
			this.saving = false;
			buttonEl.disabled = false;
			buttonEl.setText('Save');
		}
	}

	private syncFieldsFromEvent(): void {
		this.category = this.currentEvent.category;
		this.status = this.currentEvent.status;
		this.important = this.currentEvent.important;
		this.deadline = this.currentEvent.deadline;
	}

	private getUpdate(): CalendarEventUpdateInput | null {
		const title = this.titleInput.value.trim();
		const date = this.dateInput.value.trim();
		const startMinutes = parseTimeInput(this.startInput.value);
		const endMinutes = parseTimeInput(this.endInput.value);

		if (!title) {
			new Notice('Title is required.');
			return null;
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			new Notice('Date must use yyyy-mm-dd.');
			return null;
		}
		if (startMinutes === null || endMinutes === null) {
			new Notice('Start and end time are required.');
			return null;
		}
		if (endMinutes <= startMinutes) {
			new Notice('End time must be later than start time.');
			return null;
		}

		return {
			title,
			date,
			startMinutes,
			endMinutes,
			category: this.category,
			important: this.important,
			deadline: this.deadline,
			status: this.status,
			details: this.getDetailsInput(),
		};
	}

	private getDetailsInput(): CalendarEventDetails {
		const description = this.descriptionInput.value.trim();
		return {
			description,
			links: extractLinks(description),
			files: extractFiles(description),
		};
	}

	private renderDescriptionReferences(): void {
		const description = this.descriptionInput.value;
		const links = extractLinks(description);
		const files = extractFiles(description);
		this.descriptionReferencesEl.empty();
		if (links.length === 0 && files.length === 0) {
			return;
		}

		for (const link of links) {
			const anchor = this.descriptionReferencesEl.createEl('a', {
				cls: 'ocp-event-description-reference',
				text: link.label,
			});
			anchor.href = link.target;
			anchor.target = '_blank';
			anchor.rel = 'noopener noreferrer';
		}

		for (const file of files) {
			const button = this.descriptionReferencesEl.createEl('button', {
				cls: 'ocp-event-description-reference',
				text: file.label,
			});
			button.type = 'button';
			button.addEventListener('click', () => {
				void this.openFileRef(file);
			});
		}
	}

	private async openNote(buttonEl: HTMLButtonElement): Promise<void> {
		if (this.openingNote || !this.options.onOpenNote) {
			return;
		}

		this.openingNote = true;
		buttonEl.disabled = true;
		buttonEl.setText('Opening...');
		try {
			await this.options.onOpenNote(this.currentEvent);
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

	private async openFileRef(fileRef: CalendarEventFileRef): Promise<void> {
		if (!this.options.onOpenFileRef || !fileRef.target) {
			return;
		}
		try {
			await this.options.onOpenFileRef(this.currentEvent, fileRef);
		} catch (error) {
			new Notice(
				error instanceof Error ? error.message : 'Could not open file.',
			);
		}
	}
}

function renderTextField(
	parent: HTMLElement,
	label: string,
	value: string,
	placeholder: string,
): HTMLInputElement {
	const field = parent.createDiv({ cls: 'ocp-event-editor-field' });
	field.createEl('label', { text: label });
	const input = field.createEl('input', { cls: 'ocp-event-editor-input' });
	input.type = 'text';
	input.value = value;
	input.placeholder = placeholder;
	return input;
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

function extractLinks(value: string): CalendarEventDetails['links'] {
	const links: CalendarEventDetails['links'] = [];
	const markdownLinkPattern = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
	let markdownMatch: RegExpExecArray | null;
	while ((markdownMatch = markdownLinkPattern.exec(value)) !== null) {
		const label = markdownMatch[1]?.trim() || markdownMatch[2]?.trim() || '';
		const target = markdownMatch[2]?.trim() || '';
		if (target) {
			links.push({ label, target });
		}
	}

	const bareUrlPattern = /https?:\/\/[^\s<>)]+/g;
	let urlMatch: RegExpExecArray | null;
	while ((urlMatch = bareUrlPattern.exec(value)) !== null) {
		const target = urlMatch[0];
		links.push({ label: target, target });
	}

	return dedupeReferences(links);
}

function extractFiles(value: string): CalendarEventDetails['files'] {
	const files: CalendarEventDetails['files'] = [];
	const markdownFilePattern = /\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g;
	let markdownMatch: RegExpExecArray | null;
	while ((markdownMatch = markdownFilePattern.exec(value)) !== null) {
		const target = markdownMatch[2]?.trim() || '';
		if (!target) {
			continue;
		}
		files.push({
			label: markdownMatch[1]?.trim() || target,
			target,
		});
	}

	const wikilinkPattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
	let wikilinkMatch: RegExpExecArray | null;
	while ((wikilinkMatch = wikilinkPattern.exec(value)) !== null) {
		const target = wikilinkMatch[1]?.trim() || '';
		if (!target) {
			continue;
		}
		files.push({
			label: wikilinkMatch[2]?.trim() || target,
			target,
		});
	}

	for (const target of extractPlainFileTargets(value)) {
		files.push({ label: target, target });
	}

	return dedupeReferences(files);
}

function extractPlainFileTargets(value: string): string[] {
	const targets: string[] = [];
	const pattern =
		/(^|[\s(])([^\s()[\]<>]+?\.(?:md|pdf|png|jpe?g|gif|webp|txt|csv|docx?|xlsx?|pptx?))/gi;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(value)) !== null) {
		const target = match[2]?.trim();
		if (target && !/^https?:\/\//i.test(target)) {
			targets.push(target);
		}
	}
	return targets;
}

function dedupeReferences<T extends { target: string }>(references: T[]): T[] {
	const seen = new Set<string>();
	return references.filter((reference) => {
		const key = reference.target.toLowerCase();
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}
