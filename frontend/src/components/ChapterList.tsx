'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchChapters, PaginatedResponse } from '@/lib/api';

export default function ChapterList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page') || '1');

  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchChapters(currentPage)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentPage]);

  if (loading) return <div className="text-center py-10 text-gray-500">Loading...</div>;
  if (!data || data.data.length === 0) {
    return <div className="text-center py-10 text-gray-500">No chapters found. Use the Admin panel to crawl chapters.</div>;
  }

  return (
    <div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left text-sm text-gray-500">
            <th className="py-2 pr-4 w-20">#</th>
            <th className="py-2">Title</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((ch) => (
            <tr
              key={ch.id}
              className="border-b hover:bg-gray-100 cursor-pointer"
              onClick={() => router.push(`/chapters/${ch.chapter_number}`)}
            >
              <td className="py-3 pr-4 text-gray-500">{ch.chapter_number}</td>
              <td className="py-3">{ch.title}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-center items-center gap-4 mt-6">
        <button
          onClick={() => router.push(`/?page=${currentPage - 1}`)}
          disabled={currentPage <= 1}
          className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">
          Page {data.page} of {data.totalPages}
        </span>
        <button
          onClick={() => router.push(`/?page=${currentPage + 1}`)}
          disabled={currentPage >= data.totalPages}
          className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
        >
          Next
        </button>
      </div>
    </div>
  );
}
