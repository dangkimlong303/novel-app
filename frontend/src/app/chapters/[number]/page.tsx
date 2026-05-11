'use client';

import { useParams } from 'next/navigation';
import Reader from '@/components/Reader';

export default function ChapterPage() {
  const params = useParams();
  const chapterNumber = Number(params.number);

  if (isNaN(chapterNumber)) {
    return <div className="text-center py-10 text-red-500">Invalid chapter number</div>;
  }

  return <Reader chapterNumber={chapterNumber} />;
}
