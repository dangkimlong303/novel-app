import Image from 'next/image';
import ReadingProgressButton from '@/components/ReadingProgressButton';

interface Props {
  totalChapters: number;
}

export default function NovelHeader({ totalChapters }: Props) {
  return (
    <div className="flex gap-3 md:gap-4 mb-6 items-center">
      <Image
        src="/cover.jpg"
        alt="Shadow Slave"
        width={72}
        height={100}
        className="rounded shadow-md flex-shrink-0 w-14 h-[78px] md:w-[72px] md:h-[100px]"
      />
      <div>
        <h1 className="text-lg md:text-xl font-bold">Shadow Slave</h1>
        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">A novel by Guiltythree</p>
        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{totalChapters.toLocaleString()} chapters</p>
        <ReadingProgressButton />
      </div>
    </div>
  );
}
