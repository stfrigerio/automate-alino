# Project: FSE+ Rendicontazione Manager

## Stack
- **Frontend:** React 19 + TypeScript + Vite + CSS Modules
- **Backend:** Express + TypeScript (tsx) + SQLite (better-sqlite3)
- **Shared types:** `shared/types.ts` (types only, no runtime exports)
- **Runtime helpers:** each package has its own `helpers.ts`

## Icons
Use `lucide-react` for all icons throughout the codebase. Do not use emoji, text symbols, or other icon libraries.

## Running
- Server: `cd server && npm run dev` (port 3001)
- Frontend: `cd frontend && npm run dev` (port 5173, proxies /api to server)

## Conventions
- UI language: Italian
- Shared types path alias: `@shared/types` in frontend (configured in vite.config.ts + tsconfig.app.json)
- Server imports shared types with `import type ... from "../../shared/types.ts"`
- Runtime code (functions, constants) must NOT be in shared/types.ts — put in each package's helpers.ts

## Styling
- **CSS Modules only** (no inline styles, no CSS-in-JS, no Tailwind). Files named `*.module.css`.
- Every component gets its own co-located `.module.css` file (1:1 mapping enforced by `npm run check`).
- All CSS classes in a module must be used — no dead CSS (also enforced by `npm run check`).
- Colors, spacing, and shared design tokens are defined in `src/styles/tokens.css` as CSS custom properties. Use `var(--color-*)`, `var(--spacing-*)`, etc. in component CSS modules instead of hardcoding values.

## UI Components
Reusable components live in `frontend/src/components/`. Always use these instead of reimplementing:
- **Breadcrumb** — page navigation trail (`items: Crumb[]`, optional `end` slot)
- **Badge** — status/category labels with variants: `success`, `warning`, `error`, `neutral`
- **EmptyState** — empty list placeholder
- **ProgressBar** — progress indicator
- **EditableText** — inline editable text field
- **EditableSelect** — inline editable dropdown
- **DropZone** — file drag-and-drop upload area
- **AllocationModal** — modal for allocating hours across projects
- **DailyGrid** — grid for daily hour entries
- **NavControls** — prev/next navigation controls
- **NotificationBell** — notification indicator
- **ModelSelector** — AI model picker
- **ThemeToggle** — light/dark theme switcher

## Data Model
- **Lavoratori** (global): real internal workers, cross-project identity
- **Persone** (per-project): assignment of a worker to a project, with role and hourly cost. Internal persone link to a lavoratore via `lavoratore_id`; external persone have `lavoratore_id = NULL`
- **Buste Paga** (global): monthly payslip for a lavoratore. Contains total hours for the month across all projects
- **Allocazioni Ore**: junction table splitting a busta paga's hours across projects. Each row = hours allocated to one project
- **Ore Non Progetto**: non-project hours from a busta paga (riunioni, formazione, malattia, ferie, permessi, altro)
- **Timecards** (per-project): auto-created from allocazioni_ore, not from total busta paga hours
