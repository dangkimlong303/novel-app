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
