# Phase 1: Core UX Improvements — Design Spec

## Overview

Improve the reading experience for the existing Shadow Slave novel reader. Focus on 5 features: minimal header with novel info, reading progress tracking, keyboard navigation, scroll-to-top on chapter change, and full-page dark mode toggle.

All features are frontend-only. No backend/API changes needed. Data stored in localStorage.

## Target Users

Community of novel readers. The site should feel like a clean, purpose-built reading app — not a generic page with a table.

## Current State

- Home page: title "Shadow Slave — Chapters" + search bar + chapter table + pagination
- Reader page: settings (font size, theme for content only) + prev/next nav + chapter content
- No reading progress tracking
- Dark mode only inside reader content area, not full page
- No keyboard shortcuts

---

## Feature 1: Minimal Header

**Where:** Home page, above the search bar.

**Layout:**
```
┌──────────────────────────────────────────────┐
│  [Cover Image]  Shadow Slave                 │
│  72x100px       A novel by Guiltythree       │
│                 2,993 chapters               │
│                 [Continue Reading Ch.245 →]   │
└──────────────────────────────────────────────┘
```

**Details:**
- Cover image: static file stored in `public/cover.jpg` (downloaded once from novelight). Size 72x100px, rounded corners.
- Title: "Shadow Slave" in bold, large text.
- Subtitle: "A novel by Guiltythree" in gray, small text.
- Chapter count: "{total} chapters" — read from the same Prisma query already used for the chapter list.
- "Continue Reading" button: only shows if localStorage has saved progress. Links to the last-read chapter. Format: "Continue Reading Ch.245 →".
- If no progress saved, show "Start Reading →" linking to chapter 1.
- Entire section is compact — should not push the chapter list below the fold on desktop.

---

## Feature 2: Reading Progress (localStorage)

**How it works:**
- When a user opens a chapter page (`/chapters/[number]`), save `{ chapterNumber, title, timestamp }` to localStorage key `readingProgress`.
- Overwrite on every chapter visit (always tracks the latest chapter opened).
- No history — just the single most recent chapter.

**Where it's used:**
- Home page header: "Continue Reading Ch.245 →" button.
- Nav bar: small "Ch.245" indicator next to "Novel Reader" logo (optional, if space allows — otherwise skip).

**localStorage schema:**
```json
{
  "chapterNumber": 245,
  "title": "Something",
  "timestamp": 1715750400000
}
```

**Edge cases:**
- First visit (no progress): show "Start Reading →" linking to chapter 1.
- Chapter no longer exists (deleted from DB): button still shows, clicking leads to 404. Acceptable — unlikely scenario.

---

## Feature 3: Keyboard Navigation

**Where:** Reader page only (`/chapters/[number]`).

**Keys:**
- `←` (ArrowLeft): navigate to previous chapter (if exists).
- `→` (ArrowRight): navigate to next chapter (if exists).

**Implementation:**
- Small client component that listens to `keydown` events.
- Receives `prev` and `next` chapter numbers as props (already available from server component).
- Uses `router.push()` for navigation.
- Only fires if no input/textarea is focused (prevent conflict with search typing).

---

## Feature 4: Scroll to Top

**Where:** Reader page, when navigating between chapters.

**Behavior:**
- When the chapter page renders with a new chapter number, scroll to `window.scrollTo(0, 0)`.
- Smooth or instant — instant is simpler and more reliable.

**Implementation:**
- Inside the keyboard navigation client component (or a separate tiny component), use `useEffect` with `chapterNumber` dependency to trigger scroll.

---

## Feature 5: Dark Mode Toggle (Full Page)

**Current state:** Reader page has theme settings (white/sepia/dark) but only applied to the content `<article>` area. Nav bar, chapter list, and page background stay light.

**New behavior:**
- A single dark mode toggle in the nav bar (moon/sun icon).
- Toggles the entire page: nav bar, background, chapter list, reader, everything.
- Persisted in localStorage key `darkMode` (boolean).
- Applied by toggling a `dark` class on `<html>` element.
- Uses Tailwind's `dark:` variant for styling.

**Affected areas:**
- `layout.tsx`: nav bar background, text colors, border.
- Home page: table rows, search input, pagination buttons.
- Reader page: settings panel background. Content area still uses its own theme (white/sepia/dark) independently.
- All text, borders, hover states need dark variants.

**Note:** The reader's content theme (white/sepia/dark) remains separate from the page dark mode. Page dark mode controls everything *around* the content. Content theme controls the reading area. They are independent.

**Toggle behavior:**
- Default: light mode.
- Click toggle → save `darkMode: true` to localStorage → add `dark` class to `<html>`.
- Click again → remove.
- On page load: check localStorage, apply `dark` class before render (to avoid flash).

**Tailwind config:** Add `darkMode: 'class'` to `tailwind.config.ts`.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `public/cover.jpg` | Add static cover image |
| `src/app/page.tsx` | Add minimal header section above search |
| `src/app/layout.tsx` | Add dark mode toggle button in nav, dark class logic |
| `src/app/globals.css` | Add dark mode base styles if needed |
| `src/app/chapters/[number]/page.tsx` | Pass prev/next to client components |
| `src/components/NovelHeader.tsx` | New — minimal header with cover, info, continue reading |
| `src/components/KeyboardNav.tsx` | New — keyboard ←→ navigation + scroll to top |
| `src/components/DarkModeToggle.tsx` | New — toggle button + localStorage sync |
| `src/components/DarkModeInit.tsx` | New — script to apply dark class before render (prevent flash) |
| `tailwind.config.ts` | Add `darkMode: 'class'` |

---

## Scope Boundaries

**In scope:**
- 5 features listed above.
- localStorage only — no database changes.
- Frontend changes only — no API/backend changes.

**Out of scope:**
- Account system / auth.
- Multiple novel support.
- Mobile responsive redesign (Phase 2).
- SEO improvements (Phase 2).
- Infinite scroll (Phase 2).
