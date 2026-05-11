'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchChapter, ChapterDetail } from '@/lib/api';
import ReaderSettings, { Settings, getThemeClasses } from './ReaderSettings';

const SETTINGS_KEY = 'readerSettings';
const DEFAULT_SETTINGS: Settings = { fontSize: 18, theme: 'white' };

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function Reader({ chapterNumber }: { chapterNumber: number }) {
  const router = useRouter();
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchChapter(chapterNumber)
      .then(setChapter)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [chapterNumber]);

  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Loading...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;
  if (!chapter) return null;

  const theme = getThemeClasses(settings.theme);
  const paragraphs = chapter.content.split('\n\n').filter((p) => p.trim());

  const NavButtons = () => (
    <div className="flex justify-between items-center py-4">
      <button
        onClick={() => chapter.prev && router.push(`/chapters/${chapter.prev}`)}
        disabled={!chapter.prev}
        className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
      >
        Previous Chapter
      </button>
      <button
        onClick={() => chapter.next && router.push(`/chapters/${chapter.next}`)}
        disabled={!chapter.next}
        className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
      >
        Next Chapter
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <ReaderSettings
        settings={settings}
        onChange={handleSettingsChange}
        open={settingsOpen}
        onToggle={() => setSettingsOpen(!settingsOpen)}
      />

      <NavButtons />

      <article
        className={`rounded-lg p-8 ${theme.bg} ${theme.text}`}
        style={{ fontSize: `${settings.fontSize}px`, lineHeight: 1.8 }}
      >
        <h1 className="text-2xl font-bold mb-8">{chapter.title}</h1>
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4">{p}</p>
        ))}
      </article>

      <NavButtons />
    </div>
  );
}
