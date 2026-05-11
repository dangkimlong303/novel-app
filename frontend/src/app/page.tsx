import { Suspense } from 'react';
import ChapterList from '@/components/ChapterList';

export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Shadow Slave — Chapters</h1>
      <Suspense fallback={<div className="text-center py-10 text-gray-500">Loading...</div>}>
        <ChapterList />
      </Suspense>
    </div>
  );
}
