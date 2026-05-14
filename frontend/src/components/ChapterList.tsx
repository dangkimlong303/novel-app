'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchChapters, PaginatedResponse } from '@/lib/api';

export default function ChapterList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page') || '1');
  const currentSort = (searchParams.get('sort') || 'desc') as 'asc' | 'desc';
  const currentSearch = searchParams.get('search') || '';

  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchChapters(currentPage, 20, currentSort, currentSearch)
      .then(setData)
      .catch(function(err) { setError(err.message || 'Failed to load chapters'); })
      .finally(function() { setLoading(false); });
  }, [currentPage, currentSort, currentSearch]);

  const buildUrl = useCallback(
    (params: { page?: number; sort?: string; search?: string }) => {
      const p = new URLSearchParams();
      const page = params.page !== undefined ? params.page : currentPage;
      const sort = params.sort !== undefined ? params.sort : currentSort;
      const search = params.search !== undefined ? params.search : currentSearch;
      if (page > 1) p.set('page', String(page));
      if (sort !== 'asc') p.set('sort', sort);
      if (search) p.set('search', search);
      const qs = p.toString();
      return qs ? `/?${qs}` : '/';
    },
    [currentPage, currentSort, currentSearch],
  );

  const handleSearch = () => {
    router.push(buildUrl({ page: 1, search: searchInput }));
  };

  const handleClear = () => {
    setSearchInput('');
    router.push(buildUrl({ page: 1, search: '' }));
  };

  const toggleSort = () => {
    const newSort = currentSort === 'asc' ? 'desc' : 'asc';
    router.push(buildUrl({ page: 1, sort: newSort }));
  };

  return (
    <div>
      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by chapter number or title..."
          className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Search
        </button>
        {currentSearch && (
          <button
            onClick={handleClear}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Clear
          </button>
        )}
      </div>

      {loading && <div className="text-center py-10 text-gray-500">Loading...</div>}

      {!loading && error && (
        <div className="text-center py-10 text-red-500">{error}</div>
      )}

      {!loading && !error && (!data || data.data.length === 0) && (
        <div className="text-center py-10 text-gray-500">
          {currentSearch ? 'No chapters found for your search.' : 'No chapters found. Use the Admin panel to crawl chapters.'}
        </div>
      )}

      {!loading && data && data.data.length > 0 && (
        <>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                <th
                  className="py-2 pr-4 w-20 cursor-pointer hover:text-gray-900 select-none"
                  onClick={toggleSort}
                >
                  # {currentSort === 'asc' ? '↑' : '↓'}
                </th>
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
              onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
              disabled={currentPage <= 1}
              className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              onClick={() => router.push(buildUrl({ page: currentPage + 1 }))}
              disabled={currentPage >= data.totalPages}
              className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
