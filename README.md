# Calendar Planner

Calendar Planner is an Obsidian plugin for a local-first hybrid calendar view. The MVP focuses on monthly planning and daily execution while keeping Markdown files as the source of truth.

## MVP scope

- Calendar custom view opened from the ribbon or command palette.
- Month calendar, next-month preview, weekly focus, and important reminders.
- Daily timeline, most important tasks, task list, and notes.
- Event data read from `Calendar/Events/YYYY/MM/*.md`.
- Task data read from `Calendar/Tasks/YYYY/MM/YYYY-MM-DD_tasks.md`.
- Checkbox updates written back to the task Markdown file.
- No recurring events in the MVP.

## Data layout

```text
Calendar/
  Events/
    YYYY/
      MM/
        YYYY-MM-DD_HHmm_title.md
  Tasks/
    YYYY/
      MM/
        YYYY-MM-DD_tasks.md
  Daily/
    YYYY-MM-DD.md
```

## Event frontmatter

```yaml
---
type: calendar-event
title: Design proposal
start: 2026-06-12T10:00:00+08:00
end: 2026-06-12T12:00:00+08:00
category: work
important: true
deadline: false
status: planned
---
```

## How to use

1. Run `npm install`.
2. Run `npm run dev` during development, or `npm run build` for a production bundle.
3. Copy `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/calendar-planner/`.
4. Reload Obsidian and enable **Calendar Planner**.