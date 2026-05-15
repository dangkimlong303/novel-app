export default function ChapterSearch({ currentSearch }: { currentSearch: string }) {
  return (
    <form action="/" method="GET" className="flex gap-2 mb-4">
      <input
        type="text"
        name="search"
        defaultValue={currentSearch}
        placeholder="Search by chapter number or title..."
        className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Search
      </button>
      {currentSearch && (
        <a
          href="/"
          className="px-4 py-2 border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 flex items-center"
        >
          Clear
        </a>
      )}
    </form>
  );
}
