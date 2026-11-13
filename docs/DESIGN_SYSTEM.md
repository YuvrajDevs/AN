# Strata design system

Strata is a workbench for analysts who have to defend every number they repeat. The interface exists to make
evidence fast to read: what is known, where it came from, and what still needs a human. Every rule below serves that.

Tokens live in code: colours in `apps/web/src/app/globals.css`, the type scale in `apps/web/tailwind.config.ts`,
components in `apps/web/src/components/ui.tsx` and `charts.tsx`. This document explains how to use them.

---

## Principles

1. **Provenance is part of the interface.** A number without a source is not shown as fact. Sources are labelled in
   words an analyst recognises ("SEC Form D", "YC directory"), never by a pipeline id.
2. **Readable without interaction.** Charts carry a scale and a total; anything you can only learn by hovering is a bug.
3. **Calm by default, loud on purpose.** Warm paper and ink for structure; colour is spent on identity (sectors) and
   on state that needs attention (review, errors), not decoration.
4. **The next decision first.** Screens lead with what needs a person (a review backlog, a new filing), then trends,
   then reference detail. Breakdowns open when asked for, not by default.
5. **Honest edges.** Empty, loading, partial and failed states are designed, and say what happened in plain words.

---

## Colour

Warm, paper-like neutrals with near-black ink. All colours are RGB tokens so opacity can be applied (`bg-fg/10`).

| Token | Role |
|---|---|
| `bg` | Page background (warm paper) |
| `surface` | Cards, inputs, menus |
| `muted` | Subtle fills: table headers, hover rows, neutral badges, skeletons |
| `border` | Hairlines between and around surfaces |
| `fg` | Primary text and the strongest marks (selected bars, primary buttons) |
| `subtle` | Secondary text: hints, meta, axis labels |
| `accent` / `accent-fg` | Primary action fill and its text |
| `success` · `warning` · `danger` | State only: confidence, validation, errors |
| `yellow` · `pink` · `sage` · `sky` | Pastel identity colours (sectors, KPI tiles); always with `ink` text |

Rules
- Pastels identify, they never signal state. A sector keeps its pastel everywhere it appears.
- State colours (success, warning, danger) are never decorative.
- Text on pastel is always `ink`, in both themes (`.pastel`).
- Contrast meets WCAG AA in light and dark; this is enforced by the axe scans in `e2e/tests/a11y.spec.ts`.

---

## Typography

One family, chosen by role, not by pixel size. **Never write a raw size (`text-[13px]`) in product UI.**

| Class | Size / line | Use |
|---|---|---|
| `text-micro` | 11 / 14 | Eyebrows, axis labels, badges, keyboard hints |
| `text-caption` | 12 / 16 | Meta, hints, timestamps, table header text |
| `text-body-sm` | 13 / 20 | Dense UI: table cells, list rows, card titles, buttons |
| `text-body` | 14 / 22 | Default reading text |
| `text-lead` | 15 / 24 | Answers and intros that are meant to be read, not scanned |
| `text-heading` | 16 / 22 | Section headings, emphasised figures in lists |
| `text-title` | 20 / 26 | Panel and record titles |
| `text-stat` | 24 / 28 | KPI values |
| `text-display` | 26 / 32 | Page titles (one per page) |

Rules
- Abbreviated chart labels ('25) carry a full title (2025) used by the readout and screen readers.
- Weights: 400 for reading, 500 for labels and links, 600 for headings and figures. No 700.
- Every figure that can be compared uses `tabular` (tabular numerals).
- Headings use `tracking-tight`; uppercase is reserved for table headers and eyebrows (`text-micro uppercase tracking-wide`).
- Exceptions, on purpose: the wordmark, and the miniature product mockup on the landing page.

---

## Space and layout

A 4px base. Use the steps below; anything else needs a reason.

| Step | px | Use |
|---|---|---|
| 1 / 1.5 | 4 / 6 | Inside small controls: icon to label, badge padding |
| 2 / 2.5 | 8 / 10 | Between related items in a row; list row vertical padding |
| 3 | 12 | Inside dense groups (chips, filters) |
| 4 | 16 | **Card padding, gutters between cards, vertical rhythm between rows of cards** |
| 5 / 6 | 20 / 24 | Page header to content; generous reading panels |
| 8 | 32 | Between major page sections |

Rules
- Cards sit on a 16px grid: `gap-4` between cards, `mt-4` between rows, `space-y-4` in stacked columns.
- Card header: `px-4 py-2.5`, title in `text-body-sm font-semibold`, actions right-aligned. Card body: `p-4`
  unless it is a list or table, which runs edge to edge with `px-4` rows.
- Page frame: one centred column, max 1304px including a 32px gutter on each side (24px tablet, 16px phone). The top
  bar and the page share it, so their edges always line up.
- Page structure: `PageHeader` (title, one-line purpose, actions on the right), 24px, then content. One title per page.
- Major sections inside a page (a market map, then charts) are 32px apart; rows of cards are 16px apart.
- Card headers are at least 48px tall, so headers with and without actions line up across a row.
- Desktop first for analysts (1280px+); every page must still work at 390px with no horizontal scroll (tested).

---

## Shape and elevation

| Radius | Use |
|---|---|
| `rounded-full` | Buttons, inputs, chips, avatars, segmented controls |
| `rounded-2xl` (16px) | Cards and panels |
| `rounded-xl` (12px) | Items inside cards: list hover areas, nested panels |
| `rounded-lg` (8px) | Icon tiles, small nested elements |
| `rounded-md` (6px) | Keyboard keys, citation markers, tiny tags |

Elevation is flat: cards are separated by tone and a hairline border, not shadows. Shadows are reserved for things that
float above the page (menus, the command palette, toasts).

---

## Motion

- 200ms, `cubic-bezier(0.22, 1, 0.36, 1)` for colour and state changes on every interactive element.
- Bars grow from zero on first paint (700ms, staggered by at most 300ms); panels enter with `fadeUp` (320ms).
- Motion explains a change (a breakdown opening, data arriving); it is never decoration.
- `prefers-reduced-motion` collapses all of it to 1ms.

---

## Components

| Component | Use it for | Notes |
|---|---|---|
| `Button` / `buttonClass` | Actions | `primary` once per area (the main action); `secondary` otherwise; `ghost` in toolbars; `danger` for destructive. Sizes `md` (36px) and `sm` (32px). |
| `Card` | Any grouped content | Title is a noun ("Funding timeline"), actions sit in the header. |
| `Stat` | Headline numbers | Label, value, one-line hint saying where it came from. With a pastel tone on the dashboard. |
| `Badge` | Short categorical labels | `neutral` for type labels that repeat on every row; colour only for state. |
| `ConfidenceBadge` / `StatusBadge` | Classification confidence, company status | Colours follow the state rules above. |
| `Segmented` | Switching the measure of one view ($ sold / offerings) | Two or three options. |
| `BarChart` / `HBar` | Trends and shares | Always shows a scale, a total and the peak; hover or focus gives exact values; bars are buttons when they drill down. |
| `Skeleton` / `TableSkeleton` | Loading | Shaped like the content that is coming, never a lone spinner for a whole panel. |
| `EmptyState` / `ErrorState` | Nothing to show, or a failure | Says what happened and what to do next; errors offer a retry. |
| `Logo` | Company marks | Falls back to initials; never stretches. |
| Tables (`.th`, `.td`) | Lists of records | Numbers right-aligned and tabular; the identifying column first; row hover tint; scrollable regions are focusable. |

---

## Patterns

**Provenance.** Facts link to their source; sources use readable labels; long source lists show the first three with
"Show all". Generated text cites sources inline (`[1]`), and the citation check is visible ("3 claims passed").

**Drill-down.** Summaries first, detail on request: select a quarter to see its rounds; select a subsector to see its
companies. Closed by default.

**AI output.** Labelled as generated, with the model named. When the model is unavailable the screen says so and shows
the closest sources instead of an invented answer. Questions the data cannot answer are answered with "the dataset does
not contain this", plus how to ask better.

**Review.** The queue is keyboard-first (j/k, number keys, a to accept), lowest confidence first, with the model's
rationale beside the options.

---

## Accessibility

- WCAG AA contrast in both themes; axe scans run on every page in CI.
- Every interactive element is reachable by keyboard with a visible focus ring that never changes the element's shape.
- Charts are labelled groups; each bar has an accessible name with its value.
- Icons that carry meaning have labels; decorative ones are hidden from assistive tech.
