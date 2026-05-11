'use client';

import { CrawlEvent } from '@/lib/api';

const statusColors = {
  success: 'bg-green-100 text-green-800 border-green-300',
  skipped: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  error: 'bg-red-100 text-red-800 border-red-300',
};

export default function Toast({ event }: { event: CrawlEvent }) {
  const color = statusColors[event.status];
  const label =
    event.status === 'success'
      ? `Chapter ${event.chapter_number}: ${event.title}`
      : event.status === 'skipped'
        ? `Chapter ${event.chapter_number}: Skipped — ${event.message}`
        : `Chapter ${event.chapter_number}: Error — ${event.message}`;

  return (
    <div className={`px-3 py-2 border rounded text-sm ${color}`}>
      {label}
    </div>
  );
}
