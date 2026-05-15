import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import ChapterSearch from '@/components/ChapterSearch';

interface PageProps {
  searchParams: Promise<{ page?: string; sort?: string; search?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const limit = 20;
  const sort = params.sort === 'asc' ? 'asc' : 'desc';
  const search = (params.search || '').trim();

  // Build where clause for search
  const where: Prisma.ChapterWhereInput = {};
  if (search) {
    const asNumber = parseInt(search, 10);
    if (!isNaN(asNumber)) {
      where.chapter_number = asNumber;
    } else {
      where.title = { contains: search, mode: 'insensitive' };
    }
  }

  const [data, total] = await Promise.all([
    prisma.chapter.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { chapter_number: sort },
      select: { id: true, chapter_number: true, title: true },
    }),
    prisma.chapter.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const nextSort = sort === 'asc' ? 'desc' : 'asc';

  // Build pagination URLs preserving current params
  function buildUrl(newParams: { page?: number; sort?: string; search?: string }) {
    const p = new URLSearchParams();
    const pg = newParams.page !== undefined ? newParams.page : page;
    const s = newParams.sort !== undefined ? newParams.sort : sort;
    const q = newParams.search !== undefined ? newParams.search : search;
    if (pg > 1) p.set('page', String(pg));
    if (s !== 'desc') p.set('sort', s);
    if (q) p.set('search', q);
    const qs = p.toString();
    return qs ? '/?' + qs : '/';
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Shadow Slave — Chapters</h1>

      <ChapterSearch currentSearch={search} />

      {data.length === 0 ? (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          {search ? 'No chapters found for your search.' : 'No chapters found.'}
        </div>
      ) : (
        <>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b dark:border-gray-800 text-left text-sm text-gray-500">
                <th className="py-2 pr-4 w-20">
                  <Link href={buildUrl({ page: 1, sort: nextSort })} className="hover:text-gray-900 dark:hover:text-gray-100">
                    # {sort === 'asc' ? '↑' : '↓'}
                  </Link>
                </th>
                <th className="py-2">Title</th>
              </tr>
            </thead>
            <tbody>
              {data.map(function(ch) {
                return (
                  <tr key={ch.id} className="border-b dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{ch.chapter_number}</td>
                    <td className="py-3">
                      <Link href={'/chapters/' + ch.chapter_number} className="block">
                        {ch.title}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-center items-center gap-4 mt-6">
            {page > 1 ? (
              <Link href={buildUrl({ page: page - 1 })} className="px-4 py-2 border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
                Previous
              </Link>
            ) : (
              <span className="px-4 py-2 border rounded opacity-30 dark:border-gray-700">Previous</span>
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={buildUrl({ page: page + 1 })} className="px-4 py-2 border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
                Next
              </Link>
            ) : (
              <span className="px-4 py-2 border rounded opacity-30 dark:border-gray-700">Next</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
