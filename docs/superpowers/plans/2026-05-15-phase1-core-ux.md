# Phase 1: Core UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 UX features: novel header, reading progress, keyboard navigation, scroll-to-top, and full-page dark mode.

**Architecture:** All features are frontend-only, using localStorage for persistence. Pages are server-rendered (Next.js App Router server components). Client components are minimal — only for interactive bits (dark toggle, keyboard listener, settings). Tailwind v4 with CSS-based config.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, localStorage

---

## File Structure

```
frontend/src/
├── app/
│   ├── globals.css                    # Modify: add dark mode variant
│   ├── layout.tsx                     # Modify: add dark mode toggle + dark classes
│   ├── page.tsx                       # Modify: add NovelHeader above search
│   └── chapters/[number]/page.tsx     # Modify: add KeyboardNav + save progress
├── components/
│   ├── NovelHeader.tsx                # Create: cover image + novel info + continue reading
│   ├── DarkModeToggle.tsx             # Create: moon/sun toggle button
│   ├── DarkModeInit.tsx               # Create: inline script to apply dark class before render
│   └── KeyboardNav.tsx                # Create: ←→ keyboard nav + scroll to top + save progress
└── public/
    └── cover.jpg                      # Create: static cover image
```

---

## Task 1: Dark Mode — Tailwind Config + Init Script

**Files:**
- Modify: `frontend/src/app/globals.css`
- Create: `frontend/src/components/DarkModeInit.tsx`

- [ ] **Step 1: Add dark mode variant to Tailwind CSS**

In `frontend/src/app/globals.css`, add the dark variant after the import:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

This tells Tailwind v4 that `dark:` classes activate when a parent element has the `.dark` class.

- [ ] **Step 2: Create DarkModeInit component**

This component injects an inline script that runs before React hydration — it reads localStorage and adds the `dark` class to `<html>` immediately. This prevents a "flash of light mode" on page load.

Create `frontend/src/components/DarkModeInit.tsx`:

```tsx
export default function DarkModeInit() {
  var script = `
    (function() {
      try {
        if (localStorage.getItem('darkMode') === 'true') {
          document.documentElement.classList.add('dark');
        }
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
```

This is a server component (no `'use client'`). The script runs synchronously before paint.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/globals.css frontend/src/components/DarkModeInit.tsx
git commit -m "feat: add Tailwind dark mode variant and init script"
```

---

## Task 2: Dark Mode — Toggle Button

**Files:**
- Create: `frontend/src/components/DarkModeToggle.tsx`

- [ ] **Step 1: Create DarkModeToggle component**

Create `frontend/src/components/DarkModeToggle.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';

export default function DarkModeToggle() {
  var [dark, setDark] = useState(false);

  useEffect(function() {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    var next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('darkMode', String(next)); } catch(e) {}
  }

  return (
    <button
      onClick={toggle}
      className="text-lg px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/DarkModeToggle.tsx
git commit -m "feat: add DarkModeToggle client component"
```

---

## Task 3: Dark Mode — Wire into Layout + Add Dark Styles

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Update layout with DarkModeInit, DarkModeToggle, and dark classes**

Replace `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';
import DarkModeInit from '@/components/DarkModeInit';
import DarkModeToggle from '@/components/DarkModeToggle';

export const metadata: Metadata = {
  title: 'Novel Reader',
  description: 'Read Shadow Slave chapters',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <DarkModeInit />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <nav className="bg-white shadow-sm border-b dark:bg-gray-900 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
            <a href="/" className="font-bold text-lg">Novel Reader</a>
            {process.env.NEXT_PUBLIC_ADMIN_ENABLED === 'true' && (
              <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Admin</a>
            )}
            <div className="ml-auto">
              <DarkModeToggle />
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
```

Key changes:
- `suppressHydrationWarning` on `<html>` — because DarkModeInit may add `dark` class before hydration.
- `<DarkModeInit />` in `<head>` — runs before body renders.
- `<DarkModeToggle />` in nav bar with `ml-auto` — pushes to right side.
- Dark classes on `body`, `nav`: `dark:bg-gray-950`, `dark:bg-gray-900`, `dark:text-gray-100`, etc.

- [ ] **Step 2: Verify dark mode works**

Run: `cd frontend && npm run dev`
Open browser → click moon icon → page should turn dark. Refresh → should stay dark.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat: wire dark mode into layout — toggle in nav, dark styles on body/nav"
```

---

## Task 4: Dark Mode — Dark Styles for Home Page + Chapter List

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/ChapterSearch.tsx`

- [ ] **Step 1: Add dark classes to home page**

Update `frontend/src/app/page.tsx` — add dark classes to table, pagination, and empty states.

Changes needed (edit specific class strings, don't rewrite the whole file):

Table row hover:
```
"border-b hover:bg-gray-100"  →  "border-b hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800"
```

Table header:
```
"border-b text-left text-sm text-gray-500"  →  "border-b text-left text-sm text-gray-500 dark:border-gray-800"
```

Chapter number cell:
```
"py-3 pr-4 text-gray-500"  →  "py-3 pr-4 text-gray-500 dark:text-gray-400"
```

Pagination text:
```
"text-sm text-gray-600"  →  "text-sm text-gray-600 dark:text-gray-400"
```

Pagination buttons (both Link and span):
```
"px-4 py-2 border rounded hover:bg-gray-100"  →  "px-4 py-2 border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
```

Disabled pagination span:
```
"px-4 py-2 border rounded opacity-30"  →  "px-4 py-2 border rounded opacity-30 dark:border-gray-700"
```

Empty state text:
```
"text-center py-10 text-gray-500"  →  "text-center py-10 text-gray-500 dark:text-gray-400"
```

Sort link:
```
"hover:text-gray-900"  →  "hover:text-gray-900 dark:hover:text-gray-100"
```

- [ ] **Step 2: Add dark classes to ChapterSearch**

Update `frontend/src/components/ChapterSearch.tsx`:

Search input:
```
"flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
→
"flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
```

Clear button:
```
"px-4 py-2 border rounded hover:bg-gray-100 flex items-center"
→
"px-4 py-2 border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 flex items-center"
```

- [ ] **Step 3: Verify**

Open home page in dark mode → table, search, pagination should all look correct.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/ChapterSearch.tsx
git commit -m "feat: add dark mode styles to home page and search"
```

---

## Task 5: Dark Mode — Dark Styles for Reader Page

**Files:**
- Modify: `frontend/src/app/chapters/[number]/page.tsx`
- Modify: `frontend/src/components/ReaderClient.tsx`

- [ ] **Step 1: Add dark classes to reader page navigation**

In `frontend/src/app/chapters/[number]/page.tsx`, update nav button classes:

Link buttons:
```
"px-4 py-2 border rounded hover:bg-gray-100"  →  "px-4 py-2 border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
```

Disabled spans:
```
"px-4 py-2 border rounded opacity-30"  →  "px-4 py-2 border rounded opacity-30 dark:border-gray-700"
```

- [ ] **Step 2: Add dark classes to ReaderClient settings panel**

In `frontend/src/components/ReaderClient.tsx`:

Settings toggle button:
```
"text-sm px-3 py-1 border rounded hover:bg-gray-100"  →  "text-sm px-3 py-1 border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
```

Settings panel container:
```
"mt-3 p-4 border rounded-lg bg-white flex flex-wrap gap-6 items-center"  →  "mt-3 p-4 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700 flex flex-wrap gap-6 items-center"
```

Font size label:
```
"text-sm text-gray-600"  →  "text-sm text-gray-600 dark:text-gray-400"
```

Font size +/- buttons:
```
"w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100"  →  "w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
```

- [ ] **Step 3: Verify**

Open reader page in dark mode → nav buttons, settings panel should look correct. Content area still uses its own theme (independent).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/chapters/[number]/page.tsx frontend/src/components/ReaderClient.tsx
git commit -m "feat: add dark mode styles to reader page and settings"
```

---

## Task 6: Novel Header

**Files:**
- Create: `frontend/public/cover.jpg`
- Create: `frontend/src/components/NovelHeader.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Download cover image**

Download the Shadow Slave cover image and save to `frontend/public/cover.jpg`.

Source: `https://novelight.net/media/book/poster/2024/04/09/Shadow_Slave_Web_Novel_Read_Online.webp`

```bash
curl -o frontend/public/cover.jpg 'https://novelight.net/media/book/poster/2024/04/09/Shadow_Slave_Web_Novel_Read_Online.webp'
```

- [ ] **Step 2: Create NovelHeader component**

Create `frontend/src/components/NovelHeader.tsx`:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import ReadingProgressButton from '@/components/ReadingProgressButton';

interface Props {
  totalChapters: number;
}

export default function NovelHeader({ totalChapters }: Props) {
  return (
    <div className="flex gap-4 mb-6 items-center">
      <Image
        src="/cover.jpg"
        alt="Shadow Slave"
        width={72}
        height={100}
        className="rounded shadow-md flex-shrink-0"
      />
      <div>
        <h1 className="text-xl font-bold">Shadow Slave</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">A novel by Guiltythree</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{totalChapters.toLocaleString()} chapters</p>
        <ReadingProgressButton />
      </div>
    </div>
  );
}
```

Note: `ReadingProgressButton` will be created in Task 7. For now this won't compile — that's OK, both are committed together.

- [ ] **Step 3: Create ReadingProgressButton (client component)**

Create `frontend/src/components/ReadingProgressButton.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';

interface Progress {
  chapterNumber: number;
  title: string;
}

export default function ReadingProgressButton() {
  var [progress, setProgress] = useState<Progress | null>(null);

  useEffect(function() {
    try {
      var saved = localStorage.getItem('readingProgress');
      if (saved) setProgress(JSON.parse(saved));
    } catch(e) {}
  }, []);

  if (progress) {
    return (
      <a
        href={'/chapters/' + progress.chapterNumber}
        className="inline-block mt-2 text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Continue Reading Ch.{progress.chapterNumber} →
      </a>
    );
  }

  return (
    <a
      href="/chapters/1"
      className="inline-block mt-2 text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      Start Reading →
    </a>
  );
}
```

- [ ] **Step 4: Add NovelHeader to home page**

In `frontend/src/app/page.tsx`, add import and replace the `<h1>` with `<NovelHeader>`:

Add import at top:
```tsx
import NovelHeader from '@/components/NovelHeader';
```

Replace:
```tsx
<h1 className="text-2xl font-bold mb-6">Shadow Slave — Chapters</h1>
```

With:
```tsx
<NovelHeader totalChapters={total} />
```

The `total` variable already exists from the Prisma query.

- [ ] **Step 5: Verify**

Open home page → should see cover image, title, author, chapter count, and "Start Reading →" button.

- [ ] **Step 6: Commit**

```bash
git add frontend/public/cover.jpg frontend/src/components/NovelHeader.tsx frontend/src/components/ReadingProgressButton.tsx frontend/src/app/page.tsx
git commit -m "feat: add novel header with cover image, info, and reading progress button"
```

---

## Task 7: Reading Progress + Keyboard Navigation + Scroll to Top

**Files:**
- Create: `frontend/src/components/KeyboardNav.tsx`
- Modify: `frontend/src/app/chapters/[number]/page.tsx`

- [ ] **Step 1: Create KeyboardNav component**

This single client component handles 3 things:
1. Save reading progress to localStorage on mount
2. Listen for ← → keyboard events
3. Scroll to top on chapter change

Create `frontend/src/components/KeyboardNav.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  chapterNumber: number;
  chapterTitle: string;
  prev: number | null;
  next: number | null;
}

export default function KeyboardNav({ chapterNumber, chapterTitle, prev, next }: Props) {
  var router = useRouter();

  // Save reading progress
  useEffect(function() {
    try {
      localStorage.setItem('readingProgress', JSON.stringify({
        chapterNumber: chapterNumber,
        title: chapterTitle,
      }));
    } catch(e) {}
  }, [chapterNumber, chapterTitle]);

  // Scroll to top on chapter change
  useEffect(function() {
    window.scrollTo(0, 0);
  }, [chapterNumber]);

  // Keyboard navigation
  useEffect(function() {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input
      var tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft' && prev) {
        router.push('/chapters/' + prev);
      } else if (e.key === 'ArrowRight' && next) {
        router.push('/chapters/' + next);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return function() { document.removeEventListener('keydown', handleKeyDown); };
  }, [prev, next, router]);

  // This component renders nothing — it's just for side effects
  return null;
}
```

- [ ] **Step 2: Add KeyboardNav to chapter page**

In `frontend/src/app/chapters/[number]/page.tsx`, add import:

```tsx
import KeyboardNav from '@/components/KeyboardNav';
```

Add the component inside the `<div className="max-w-3xl mx-auto">`, before `<ReaderClient>`:

```tsx
<KeyboardNav
  chapterNumber={chapterNumber}
  chapterTitle={chapter.title}
  prev={prevNum}
  next={nextNum}
/>
```

- [ ] **Step 3: Verify**

1. Open `/chapters/1` → check localStorage has `readingProgress` with `chapterNumber: 1`.
2. Press → → should navigate to chapter 2. Page scrolls to top.
3. Press ← → should navigate back to chapter 1.
4. Go to home page → should see "Continue Reading Ch.1 →" button.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/KeyboardNav.tsx frontend/src/app/chapters/[number]/page.tsx
git commit -m "feat: add reading progress, keyboard navigation, and scroll to top"
```

---

## Task 8: Final Push

- [ ] **Step 1: Build and verify**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Push to GitHub**

```bash
git push origin feat/novel-crawler-reader feat/novel-crawler-reader:main
```

Vercel auto-deploys from main.
