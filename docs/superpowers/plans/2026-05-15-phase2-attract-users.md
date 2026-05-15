# Phase 2: Attract Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile responsive layout, reading time estimates, share button, and SEO meta tags.

**Architecture:** All server-rendered. Mobile responsive via Tailwind breakpoints (CSS only). Reading time calculated server-side. ShareButton is the only new client component (for clipboard API). SEO via Next.js `generateMetadata`.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4

---

## File Structure

```
frontend/src/
├── app/
│   ├── page.tsx                       # Modify: mobile list view, reading time, SEO metadata
│   └── chapters/[number]/page.tsx     # Modify: mobile padding, reading time, share button, SEO metadata
├── components/
│   ├── NovelHeader.tsx                # Modify: responsive image/text sizes
│   └── ShareButton.tsx                # Create: copy link button
```

---

## Task 1: Mobile Responsive — Novel Header

**Files:**
- Modify: `frontend/src/components/NovelHeader.tsx`

- [ ] **Step 1: Add responsive sizes to NovelHeader**

Read `frontend/src/components/NovelHeader.tsx`, then replace it with:

```tsx
import Image from 'next/image';
import ReadingProgressButton from '@/components/ReadingProgressButton';

interface Props {
  totalChapters: number;
}

export default function NovelHeader({ totalChapters }: Props) {
  return (
    <div className="flex gap-3 md:gap-4 mb-6 items-center">
      <Image
        src="/cover.jpg"
        alt="Shadow Slave"
        width={72}
        height={100}
        className="rounded shadow-md flex-shrink-0 w-14 h-[78px] md:w-[72px] md:h-[100px]"
      />
      <div>
        <h1 className="text-lg md:text-xl font-bold">Shadow Slave</h1>
        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">A novel by Guiltythree</p>
        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{totalChapters.toLocaleString()} chapters</p>
        <ReadingProgressButton />
      </div>
    </div>
  );
}
```

Changes: smaller image on mobile (`w-14 h-[78px]`), smaller gap, smaller text (`text-lg`, `text-xs`). Desktop unchanged via `md:` breakpoint.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NovelHeader.tsx
git commit -m "feat: make novel header responsive for mobile"
```

---

## Task 2: Mobile Responsive — Chapter List + Reader

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/chapters/[number]/page.tsx`

- [ ] **Step 1: Add mobile list view to home page**

In `frontend/src/app/page.tsx`, the Prisma query already fetches `chapter_number` and `title`. We also need `content` length for reading time (Task 3), so update the select to include a content length. Actually, fetching full content for 20 rows is wasteful. Instead, we'll calculate reading time separately in Task 3. For now, just add the mobile list.

Read `frontend/src/app/page.tsx`. Find the section between `{data.length === 0 ? (` and the closing `</>)}`. Replace the table + pagination block with a version that has both mobile list and desktop table:

Replace the `<>` block (lines 67–113 approximately) with:

```tsx
        <>
          {/* Mobile list view */}
          <div className="md:hidden space-y-1">
            {data.map(function(ch) {
              return (
                <Link
                  key={ch.id}
                  href={'/chapters/' + ch.chapter_number}
                  className="block py-3 px-2 border-b dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="text-gray-500 dark:text-gray-400">Ch.{ch.chapter_number}</span>
                  <span className="mx-2">—</span>
                  <span>{ch.title}</span>
                </Link>
              );
            })}
          </div>

          {/* Desktop table view */}
          <table className="hidden md:table w-full border-collapse">
            <thead>
              <tr className="border-b dark:border-gray-800 text-left text-sm text-gray-500">
                <th className="py-2 pr-4 w-20">
                  <Link href={buildUrl({ page: 1, sort: nextSort })} className="hover:text-gray-900 dark:hover:text-gray-100">
                    # {sort === 'asc' ? '↑' : '↓'}
                  </Link>
                </th>
                <th className="py-2">Title</th>
              </tr>
            </thead>
            <tbody>
              {data.map(function(ch) {
                return (
                  <tr key={ch.id} className="border-b dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{ch.chapter_number}</td>
                    <td className="py-3">
                      <Link href={'/chapters/' + ch.chapter_number} className="block">
                        {ch.title}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Sort link for mobile (above pagination) */}
          <div className="md:hidden flex justify-end mt-2 mb-2">
            <Link href={buildUrl({ page: 1, sort: nextSort })} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Sort {sort === 'asc' ? '↑ Oldest' : '↓ Newest'}
            </Link>
          </div>

          <div className="flex justify-center items-center gap-4 mt-4 md:mt-6">
            {page > 1 ? (
              <Link href={buildUrl({ page: page - 1 })} className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
                Previous
              </Link>
            ) : (
              <span className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded opacity-30 dark:border-gray-700">Previous</span>
            )}
            <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={buildUrl({ page: page + 1 })} className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
                Next
              </Link>
            ) : (
              <span className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded opacity-30 dark:border-gray-700">Next</span>
            )}
          </div>
        </>
```

Key changes:
- Mobile list: `md:hidden` — shows "Ch.1 — Title" per row, compact
- Desktop table: `hidden md:table` — original table, only on >=768px
- Mobile sort link: separate link below list since table header sort isn't visible
- Pagination: smaller on mobile (`px-3 py-1.5 text-sm`)

- [ ] **Step 2: Make reader page responsive**

In `frontend/src/app/chapters/[number]/page.tsx`, change the article padding:

Find:
```
className="rounded-lg p-8 bg-white text-gray-900"
```

Replace with:
```
className="rounded-lg p-4 md:p-8 bg-white text-gray-900"
```

Also make nav buttons smaller on mobile. Find all instances (4 total) of:
```
className="px-4 py-2 border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
```

Replace each with:
```
className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
```

And the 4 disabled spans, find:
```
className="px-4 py-2 border rounded opacity-30 dark:border-gray-700"
```

Replace each with:
```
className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded opacity-30 dark:border-gray-700"
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/app/chapters/[number]/page.tsx
git commit -m "feat: add mobile responsive layout for chapter list and reader"
```

---

## Task 3: Reading Time Estimate

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/chapters/[number]/page.tsx`

- [ ] **Step 1: Add reading time to chapter list**

In `frontend/src/app/page.tsx`, update the Prisma query `select` to also fetch `content`:

Find:
```
select: { id: true, chapter_number: true, title: true },
```

Replace with:
```
select: { id: true, chapter_number: true, title: true, content: true },
```

Then create a helper function inside `HomePage` (after the `buildUrl` function):

```tsx
  function readingTime(content: string): number {
    var words = content.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }
```

In the **mobile list view**, add reading time after the title. Change the mobile Link content from:

```tsx
                  <span className="text-gray-500 dark:text-gray-400">Ch.{ch.chapter_number}</span>
                  <span className="mx-2">—</span>
                  <span>{ch.title}</span>
```

To:

```tsx
                  <span className="text-gray-500 dark:text-gray-400">Ch.{ch.chapter_number}</span>
                  <span className="mx-2">—</span>
                  <span>{ch.title}</span>
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">· {readingTime(ch.content)} min</span>
```

In the **desktop table**, add a reading time column. Add a header:

```tsx
                <th className="py-2 w-20 text-right">Time</th>
```

And in each row, add a cell after the title cell:

```tsx
                    <td className="py-3 text-right text-sm text-gray-400 dark:text-gray-500">{readingTime(ch.content)} min</td>
```

- [ ] **Step 2: Add reading time to reader page**

In `frontend/src/app/chapters/[number]/page.tsx`, add reading time calculation after `const paragraphs = ...`:

```tsx
  var wordCount = chapter.content.split(/\s+/).length;
  var readTime = Math.max(1, Math.ceil(wordCount / 200));
```

Add it below the `<h1>` in the article, find:

```tsx
          <h1 className="text-2xl font-bold mb-8">{chapter.title}</h1>
```

Replace with:

```tsx
          <h1 className="text-2xl font-bold mb-2">{chapter.title}</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">~{readTime} min read</p>
```

Note: changed `mb-8` from h1 to `mb-2`, and put `mb-8` on the new `<p>`.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/app/chapters/[number]/page.tsx
git commit -m "feat: add reading time estimates to chapter list and reader"
```

---

## Task 4: Share Button

**Files:**
- Create: `frontend/src/components/ShareButton.tsx`
- Modify: `frontend/src/app/chapters/[number]/page.tsx`

- [ ] **Step 1: Create ShareButton component**

Create `frontend/src/components/ShareButton.tsx`:

```tsx
'use client';

import { useState } from 'react';

export default function ShareButton() {
  var [copied, setCopied] = useState(false);

  function handleShare() {
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function() {
        setCopied(true);
        setTimeout(function() { setCopied(false); }, 2000);
      });
    } else {
      // Fallback for old browsers
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <button
      onClick={handleShare}
      className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
```

- [ ] **Step 2: Add ShareButton to reader page**

In `frontend/src/app/chapters/[number]/page.tsx`, add import at top:

```tsx
import ShareButton from '@/components/ShareButton';
```

Add the ShareButton between the top navigation and the article. Find the comment `{/* Chapter content */}` and add this block before it:

```tsx
        {/* Share */}
        <div className="flex justify-end mb-2">
          <ShareButton />
        </div>
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ShareButton.tsx frontend/src/app/chapters/[number]/page.tsx
git commit -m "feat: add share button to copy chapter link"
```

---

## Task 5: SEO Meta Tags

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/chapters/[number]/page.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Update layout.tsx default metadata**

In `frontend/src/app/layout.tsx`, update the metadata:

Find:
```tsx
export const metadata: Metadata = {
  title: 'Novel Reader',
  description: 'Read Shadow Slave chapters',
};
```

Replace with:
```tsx
export const metadata: Metadata = {
  title: {
    default: 'Shadow Slave — Read Free Online | Novel Reader',
    template: '%s | Novel Reader',
  },
  description: 'Read Shadow Slave novel online for free.',
  openGraph: {
    images: ['/cover.jpg'],
  },
};
```

The `template` means child pages can set just a title like `"Ch.1 — Nightmare Begins"` and it becomes `"Ch.1 — Nightmare Begins | Novel Reader"`.

- [ ] **Step 2: Add dynamic metadata to home page**

In `frontend/src/app/page.tsx`, add `generateMetadata` export. Add this BEFORE the `HomePage` function:

```tsx
export async function generateMetadata({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = (params.search || '').trim();
  const total = await prisma.chapter.count();

  if (search) {
    return {
      title: 'Search: ' + search + ' | Shadow Slave',
      description: 'Search results for "' + search + '" in Shadow Slave novel.',
    };
  }

  return {
    title: 'Shadow Slave — Read Free Online',
    description: 'Read Shadow Slave novel online for free. ' + total.toLocaleString() + ' chapters available.',
  };
}
```

- [ ] **Step 3: Add dynamic metadata to chapter page**

In `frontend/src/app/chapters/[number]/page.tsx`, add `generateMetadata` export. Add this BEFORE the `ChapterPage` function:

```tsx
export async function generateMetadata({ params }: PageProps) {
  const { number } = await params;
  const chapterNumber = parseInt(number, 10);
  if (isNaN(chapterNumber)) return {};

  const chapter = await prisma.chapter.findUnique({
    where: { chapter_number: chapterNumber },
    select: { title: true, content: true },
  });
  if (!chapter) return {};

  var description = chapter.content
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 160);

  return {
    title: 'Ch.' + chapterNumber + ' — ' + chapter.title,
    description: description,
  };
}
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/layout.tsx frontend/src/app/page.tsx frontend/src/app/chapters/[number]/page.tsx
git commit -m "feat: add dynamic SEO meta tags for home and chapter pages"
```

---

## Task 6: Final Build + Push

- [ ] **Step 1: Full build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds, all routes listed.

- [ ] **Step 2: Push**

```bash
git push origin feat/novel-crawler-reader feat/novel-crawler-reader:main
```
