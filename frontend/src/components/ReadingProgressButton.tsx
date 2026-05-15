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
