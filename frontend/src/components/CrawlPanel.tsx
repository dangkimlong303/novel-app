'use client';

import { useState, useRef, useEffect } from 'react';
import { startCrawl, startSync, subscribeToCrawl, CrawlEvent, CrawlDone } from '@/lib/api';
import Toast from './Toast';

export default function CrawlPanel() {
  const [input, setInput] = useState('');
  const [events, setEvents] = useState<CrawlEvent[]>([]);
  const [summary, setSummary] = useState<CrawlDone | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState('');
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
    };
  }, []);

  const handleProgress = (event: CrawlEvent) => {
    setEvents((prev) => [...prev, event]);
  };

  const handleDone = (done: CrawlDone) => {
    setSummary(done);
    setCrawling(false);
  };

  const handleCrawl = async () => {
    if (!input.trim() || crawling) return;
    setEvents([]);
    setSummary(null);
    setError('');
    setCrawling(true);

    try {
      const { crawlId } = await startCrawl(input.trim());
      unsubRef.current = subscribeToCrawl(crawlId, handleProgress, handleDone, () => {
        setCrawling(false);
        setError('Connection lost. Check if the server is running.');
      });
    } catch (e) {
      setCrawling(false);
      setError((e as Error).message);
    }
  };

  const handleSync = async () => {
    if (crawling) return;
    setEvents([]);
    setSummary(null);
    setError('');
    setCrawling(true);

    try {
      const { crawlId } = await startSync();
      unsubRef.current = subscribeToCrawl(crawlId, handleProgress, handleDone, () => {
        setCrawling(false);
        setError('Connection lost. Check if the server is running.');
      });
    } catch (e) {
      setCrawling(false);
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. 1-50 or 1,2,3 or 100-110,115"
          className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={crawling}
        />
        <button
          onClick={handleCrawl}
          disabled={crawling || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {crawling ? 'Crawling...' : 'Crawl'}
        </button>
        <button
          onClick={handleSync}
          disabled={crawling}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Sync Latest
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 border rounded text-sm bg-red-100 text-red-800 border-red-300">
          {error}
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.map((event, i) => (
          <Toast key={i} event={event} />
        ))}
      </div>

      {summary && (
        <div className="mt-4 p-4 bg-gray-100 rounded text-sm">
          <strong>Crawl Complete:</strong> {summary.crawled} crawled, {summary.skipped} skipped, {summary.errors} errors (total: {summary.total})
          {summary.message && <span className="ml-2 text-gray-600">— {summary.message}</span>}
        </div>
      )}
    </div>
  );
}
