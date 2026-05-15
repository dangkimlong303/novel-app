import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ReaderClient from '@/components/ReaderClient';
import KeyboardNav from '@/components/KeyboardNav';

interface PageProps {
  params: Promise<{ number: string }>;
}

export default async function ChapterPage({ params }: PageProps) {
  const { number } = await params;
  const chapterNumber = parseInt(number, 10);

  if (isNaN(chapterNumber)) {
    notFound();
  }

  const chapter = await prisma.chapter.findUnique({
    where: { chapter_number: chapterNumber },
  });

  if (!chapter) {
    notFound();
  }

  const [prev, next] = await Promise.all([
    prisma.chapter.findFirst({
      where: { chapter_number: { lt: chapterNumber } },
      orderBy: { chapter_number: 'desc' },
      select: { chapter_number: true },
    }),
    prisma.chapter.findFirst({
      where: { chapter_number: { gt: chapterNumber } },
      orderBy: { chapter_number: 'asc' },
      select: { chapter_number: true },
    }),
  ]);

  const paragraphs = chapter.content.split('\n\n').filter(function(p) { return p.trim(); });
  const prevNum = prev ? prev.chapter_number : null;
  const nextNum = next ? next.chapter_number : null;

  return (
    <div className="max-w-3xl mx-auto">
      <KeyboardNav
        chapterNumber={chapterNumber}
        chapterTitle={chapter.title}
        prev={prevNum}
        next={nextNum}
      />
      <ReaderClient>
        {/* Navigation — top */}
        <div className="flex justify-between items-center py-4">
          {prevNum ? (
            <Link href={'/chapters/' + prevNum} className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
              Previous Chapter
            </Link>
          ) : (
            <span className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded opacity-30 dark:border-gray-700">Previous Chapter</span>
          )}
          {nextNum ? (
            <Link href={'/chapters/' + nextNum} className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
              Next Chapter
            </Link>
          ) : (
            <span className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded opacity-30 dark:border-gray-700">Next Chapter</span>
          )}
        </div>

        {/* Chapter content */}
        <article className="rounded-lg p-4 md:p-8 bg-white text-gray-900" data-chapter-content>
          <h1 className="text-2xl font-bold mb-8">{chapter.title}</h1>
          {paragraphs.map(function(p, i) {
            return <p key={i} className="mb-4">{p}</p>;
          })}
        </article>

        {/* Navigation — bottom */}
        <div className="flex justify-between items-center py-4">
          {prevNum ? (
            <Link href={'/chapters/' + prevNum} className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
              Previous Chapter
            </Link>
          ) : (
            <span className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded opacity-30 dark:border-gray-700">Previous Chapter</span>
          )}
          {nextNum ? (
            <Link href={'/chapters/' + nextNum} className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
              Next Chapter
            </Link>
          ) : (
            <span className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded opacity-30 dark:border-gray-700">Next Chapter</span>
          )}
        </div>
      </ReaderClient>
    </div>
  );
}
