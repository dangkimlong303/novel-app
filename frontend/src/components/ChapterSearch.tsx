'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChapterSearch({ currentSearch }: { currentSearch: string }) {
  const router = useRouter();
  const [input, setInput] = useState(currentSearch);

  function handleSearch() {
    var params = new URLSearchParams(window.location.search);
    params.set('page', '1');
    if (input.trim()) {
      params.set('search', input.trim());
    } else {
      params.delete('search');
    }
    router.push('/?' + params.toString());
  }

  function handleClear() {
    setInput('');
    var params = new URLSearchParams(window.location.search);
    params.delete('search');
    params.set('page', '1');
    router.push('/?' + params.toString());
  }

  return (
    <div className="flex gap-2 mb-4">
      <input
        type="text"
        value={input}
        onChange={function(e) { setInput(e.target.value); }}
        onKeyDown={function(e) { if (e.key === 'Enter') handleSearch(); }}
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
  );
}
