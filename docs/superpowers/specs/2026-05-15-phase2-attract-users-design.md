# Phase 2: Attract Users — Design Spec

## Overview

4 features to improve mobile experience, shareability, and discoverability. All server-rendered, no client JS dependencies for core functionality.

## Current State

- Home page: server-rendered chapter table with search, sort, pagination
- Reader page: server-rendered content with client-side font/theme settings
- No mobile-specific layout
- No reading time estimates
- No share functionality
- Default SEO meta tags (same title/description on every page)

---

## Feature 1: Mobile Responsive

**Breakpoint:** `md:` (768px). Below = mobile, above = desktop.

**Home page — chapter list:**
- **Mobile (< 768px):** simple list, each chapter is one line: `Ch.1 — Nightmare Begins`. No table headers. Compact padding.
- **Desktop (>= 768px):** keep current table layout unchanged.
- Implementation: use Tailwind `hidden md:table` / `md:hidden` to toggle between list and table views. Both render in HTML, CSS controls visibility.

**Reader page:**
- **Mobile:** reduce article padding from `p-8` to `p-4`. Navigation buttons use smaller text.
- **Desktop:** keep current layout unchanged.

**Nav bar:**
- Already responsive (flexbox). No changes needed.

**Novel header:**
- **Mobile:** smaller cover image (56x78 instead of 72x100). Title `text-lg` instead of `text-xl`.
- **Desktop:** unchanged.

---

## Feature 2: Reading Time Estimate

**Formula:** `Math.ceil(wordCount / 200)` minutes. 200 words/min is standard reading speed.

**Word count:** `content.split(/\s+/).length` — calculated server-side.

**Where displayed:**
- **Chapter list (home page):** show after title as gray text: `Ch.1 — Nightmare Begins · 5 min`
- **Reader page:** show below chapter title: `~5 min read`

**Edge cases:**
- Very short chapter (< 200 words): show "~1 min read" (minimum 1).

---

## Feature 3: Share Button

**Where:** Reader page, next to the navigation buttons.

**Behavior:**
1. Click "Share" button.
2. Copy current page URL to clipboard via `navigator.clipboard.writeText()`.
3. Button text changes to "Copied!" for 2 seconds, then reverts.

**Fallback:** If clipboard API not available (old browsers), show the URL in a prompt/alert.

**Implementation:** Small client component (`ShareButton.tsx`). Only the button needs JS — everything else on the page still works without it.

---

## Feature 4: SEO Meta Tags

**Home page:**
- Title: `Shadow Slave — Read Free Online | Novel Reader`
- Description: `Read Shadow Slave novel online for free. {total} chapters available.`
- og:image: `/cover.jpg`

**Reader page (`/chapters/[number]`):**
- Title: `Ch.{number} — {title} | Shadow Slave`
- Description: first 160 characters of chapter content (stripped of special chars).
- og:image: `/cover.jpg`

**Implementation:** Next.js `generateMetadata()` function in each page. Server-side, no extra dependencies.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/app/page.tsx` | Mobile list view, reading time in list, SEO metadata |
| `src/app/chapters/[number]/page.tsx` | Mobile padding, reading time, SEO metadata |
| `src/components/NovelHeader.tsx` | Mobile responsive sizes |
| `src/components/ShareButton.tsx` | New — copy link button |

---

## Scope Boundaries

**In scope:**
- 4 features listed above
- Server-rendered where possible
- Mobile responsive via Tailwind breakpoints (CSS only, no JS)

**Out of scope:**
- Infinite scroll (removed from Phase 2)
- Account system
- Performance/caching optimizations
